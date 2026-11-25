import type { Fetcher } from "./google-calendar.js";
import { dueDay, dueInstant, dueToWrite, dueWall, readRepeat, sameZone, sayRepeat, type TodoistDue } from "./todoist-due.js";
import type { RemoteAck, RemoteChange, RemoteSystem, RemoteWrite } from "./types.js";

/**
 * A Todoist project, as a transport.
 *
 * Todoist's API v1 and its `/sync` endpoint (developer.todoist.com/api/v1,
 * read 2026-11-25; the pages relied on are named where they are). One
 * project, or one section or label of it, is one resource (`tasks`), and
 * each of its tasks one record. Everything Todoist-specific is here; the
 * engine sees plain values keyed by a task's parts (`content`, `due`, …):
 *
 * - A PULL sends the last sync token and is answered what changed since
 *   (sync/overview.md, "Incremental sync"); `*` answers "all active resource
 *   data", so a whole read does not list a completed task. A task is
 *   `checked` when completed and `is_deleted` when deleted (sync/tasks.md).
 * - COMPLETED IS NEVER GONE. A completed task is a task whose `completed`
 *   is true. A task this sync knew that a whole read does not list is looked
 *   for among the completed ones, then asked for by id; one neither answers
 *   for is left as it is, and said. Only `is_deleted`, or a task moved out
 *   of what the connection keeps, takes a record away.
 * - A VERSION is a hash of the parts kept, so our own write coming back is
 *   an echo exactly when it holds what was sent, and an edit in the same
 *   second is still news.
 * - A PUSH sends only the parts that changed (`RemoteWrite.changed`) as
 *   commands, up to 100 to a request (request-limits.md): `item_add`,
 *   `item_update`, `item_move` (its section or parent, which
 *   `item_update` does not change), `item_uncomplete`, `item_delete`, and
 *   then `item_close`, which completes a task and moves one that repeats to
 *   its next date. It goes last and alone, so it is never sent twice for
 *   another part's refusal. Every command carries a `uuid` Todoist executes
 *   once, so a request whose answer was lost is made again as it was.
 * - THE CONNECTION'S LABEL is put on every task sent and left out of what a
 *   record's labels say.
 * - A RECORD SET ASIDE leaves its task as it is (`aside`): nothing is sent
 *   for it, and no task above it is deleted while it is, for a delete takes
 *   "all its sub-tasks" (sync/tasks.md) and nothing undoes one.
 * - A PART THAT CANNOT BE SENT is held, and said ("held unsent"): a due
 *   date whose repeat there are no words for, a section there is not. The
 *   rest of a task already there goes; one not made yet waits whole. A part
 *   held in conflict is never read as empty.
 * - Todoist asking us to slow down (429) is waited out as its `Retry-After`
 *   says, within a bound; a refused token (401) and a project it cannot
 *   find are said as sentences that say what to do.
 */

export const TODOIST_API = "https://api.todoist.com/api/v1";
/** request-limits.md: "The maximum number of commands is 100 per request", and a 1 MiB body. */
const MOST_COMMANDS = 100;
const MOST_BYTES = 900_000;
/** tasks.md, "Tasks Completed By Completion Date": a range of "up to 3 months". */
const COMPLETED_DAYS = 89;
const COMPLETED_PAGE = 200;
const DAY_MS = 86_400_000;

/** A task's parts as the mapping names them, each with the field type that holds it; `@relation` for a parent. */
export type TodoistRefs = Readonly<Record<string, string | undefined>>;

/** A value that Todoist cannot be told, and why: the write that says it is held unsent. */
export interface Unsayable {
  readonly held: string;
}
export const isUnsayable = (value: unknown): value is Unsayable => typeof value === "object" && value !== null && typeof (value as Unsayable).held === "string";

export interface TodoistOptions {
  /** The project, by its id or its name. */
  readonly projectId: string;
  /** Only the tasks of this section of it, by its id or its name. */
  readonly section?: string;
  /** Only the tasks that carry this label. */
  readonly label?: string;
  /** The parts kept, each with the type of the field that holds it. */
  readonly refs: TodoistRefs;
  /** The app's time zone, when the due date repeats at a time there: a repeat in an account of another zone is left alone. */
  readonly zone?: string;
  /** The personal API token, asked before every request. */
  token(): Promise<string> | string;
  /** What the token is called where it is kept (`TODOIST_TOKEN`), for the sentence a refusal says. Never its value. */
  readonly secretName?: string;
  readonly fetch?: Fetcher;
  readonly baseUrl?: string;
  /** The tasks this sync has linked, by Todoist's id, whether each is completed here, and whether its record is removed here. */
  known?(): readonly { readonly id: string; readonly completed?: boolean; readonly removed?: boolean }[];
  /** The tasks of the records set aside here, with what each is called and, where it is mapped, its parent as last agreed. */
  aside?(): readonly { readonly id: string; readonly localId: string; readonly label: string; readonly parent?: string; readonly completed?: boolean }[];
  /** The tasks of every record set aside in the app, whichever connection keeps it. */
  asideElsewhere?(): readonly string[];
  /** Whether another connection keeps this task. */
  keptElsewhere?(id: string): boolean;
  /** Whether another connection keeps this task and will move it out from under one removed here. */
  movedElsewhere?(id: string): boolean;
  /** Whether a record of ours is set aside, linked or not. */
  isAside?(localId: string): boolean;
  /** The longest a run waits out Todoist's rate limit, in ms (60 seconds by default). */
  readonly maxWait?: number;
  /** A note said once. */
  say?(line: string): void;
  now?(): number;
  sleep?(ms: number): Promise<void>;
  /** A command's id; `crypto.randomUUID` by default. */
  uuid?(): string;
}

/** What Todoist answered, when it was not a yes. */
export class TodoistError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly tag?: string,
  ) {
    super(message);
    this.name = "TodoistError";
  }
}

type Json = Record<string, unknown>;
interface Command {
  readonly type: string;
  readonly uuid: string;
  readonly temp_id?: string;
  readonly args: Json;
}
/** What names are read from: the account's projects, sections and people, and its time zone. */
interface Around {
  readonly projects: Map<string, Json>;
  readonly sections: Map<string, Json>;
  readonly people: Map<string, Json>;
  readonly places: Map<string, Json>;
  user: Json;
}

const loose = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const words = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const asWords = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

/** A short, stable hash of a task's parts: what makes it the one last agreed, or news. */
export function todoistVersion(values: Json): string {
  const text = JSON.stringify(Object.keys(values).sort().map((key) => [key, values[key] ?? null]));
  let one = 0x811c9dc5;
  let two = 0x1000193;
  for (let at = 0; at < text.length; at++) {
    one = Math.imul(one ^ text.charCodeAt(at), 0x01000193) >>> 0;
    two = Math.imul(two ^ text.charCodeAt(text.length - 1 - at), 0x01000193) >>> 0;
  }
  return one.toString(16).padStart(8, "0") + two.toString(16).padStart(8, "0");
}

export function todoist(options: TodoistOptions): RemoteSystem {
  const doFetch = options.fetch ?? (globalThis.fetch as Fetcher);
  const base = options.baseUrl ?? TODOIST_API;
  const secret = options.secretName ?? "the API token";
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const uuid = options.uuid ?? (() => globalThis.crypto.randomUUID());
  const maxWait = options.maxWait ?? 60_000;
  const { refs } = options;
  const keeps = (ref: string) => ref in refs;
  const dueAs: "day" | "moment" = refs["due"] === "date" ? "day" : "moment";
  const said = new Set<string>();
  let fresh: string[] = [];
  const note = (line: string) => {
    if (said.has(line)) return;
    said.add(line);
    fresh.push(line);
    options.say?.(line);
  };

  /** One request, Todoist's rate limit waited out; anything but a yes thrown as a `TodoistError`. */
  const call = async (method: string, path: string, form?: Readonly<Record<string, string>>): Promise<Json> => {
    let waited = 0;
    for (;;) {
      const response = await doFetch(`${base}${path}`, {
        method,
        headers: { authorization: `Bearer ${await options.token()}`, ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
        ...(form ? { body: new URLSearchParams(form).toString() } : {}),
      });
      const answer = ((await response.json().catch(() => ({}))) ?? {}) as Json;
      if (response.status === 429) {
        // `Retry-After`, and `error_extra.retry_after` beside it (sync/overview.md).
        const after = Number(response.headers?.get("retry-after") ?? (answer["error_extra"] as Json | undefined)?.["retry_after"] ?? "");
        const wait = Number.isFinite(after) && after > 0 ? after * 1000 : 1000;
        if (waited + wait > maxWait) throw new TodoistError(`todoist: Todoist is still limiting the rate after ${Math.round(waited / 1000)} s of waiting (HTTP 429); the next pass tries again`, 429);
        waited += wait;
        await sleep(wait);
        continue;
      }
      if (response.ok) return answer;
      const tag = typeof answer["error_tag"] === "string" ? answer["error_tag"] : undefined;
      if (response.status === 401) throw new TodoistError(`todoist: Todoist refused ${secret} (HTTP 401): copy the API token from Todoist's Settings → Integrations → Developer again`, 401, tag);
      throw new TodoistError(`todoist: HTTP ${response.status}${sentenceOf(answer)}`, response.status, tag);
    }
  };

  /*
   * WHAT WAS SENT AND NOT ANSWERED, judged by what the next pull shows
   * rather than sent again blind. A task that may have been made is known by
   * its words, being new there since: the write that made it then takes it
   * up and sets the rest. One that repeats and may have been completed is
   * known by its date having moved on. Kept while the process runs; a
   * process that stops between the two makes its task again, and a record
   * removed in between comes back with its task.
   */
  /** Our id → the words an unanswered `item_add` sent. */
  const unheard = new Map<string, string>();
  /** Our id → the task that turned up holding them, withheld from the pull until its write takes it up. */
  const found = new Map<string, string>();
  /** A task whose `item_close` was not answered → the date it was due then. */
  const closing = new Map<string, string>();
  /** Tasks read again as they stand on the next pull. */
  const recheck = new Set<string>();
  let pushed = false;
  /** Our ids among those that were set aside at the last pull. */
  let waited = new Set<string>();
  /** Each subtask's parent, a completed one's too: kept in the cursor, so what is under a task is known whatever a read lists. */
  let under = new Map<string, string>();
  /** Subtasks set aside, kept until they are out from under what was above them: bringing one back is not leave to delete it with its parent. */
  const spared = new Set<string>();
  /** The records set aside that have been said. */
  const saidAside = new Set<string>();
  const letGo = (localId: string) => {
    const id = found.get(localId);
    if (id !== undefined) recheck.add(id);
    found.delete(localId);
    unheard.delete(localId);
  };

  const sync = (token: string, resources: readonly string[]) => call("POST", "/sync", { sync_token: token, resource_types: JSON.stringify(resources) });

  /* ------------------------------------------------ the project, and the names its tasks use */
  let around: Around | undefined;
  let aroundToken = "*";
  const readAround = async (): Promise<Around> => {
    const answer = await sync(aroundToken, ["user", "projects", "sections", "collaborators", "collaborator_states"]).catch((error: unknown) => {
      if (aroundToken === "*" || !isTokenRefused(error)) throw error;
      aroundToken = "*";
      return sync("*", ["user", "projects", "sections", "collaborators", "collaborator_states"]);
    });
    if (!around || answer["full_sync"] === true) around = { projects: new Map(), sections: new Map(), people: new Map(), places: new Map(), user: {} };
    const held = around;
    const merge = (into: Map<string, Json>, list: unknown, key: (one: Json) => string) => {
      for (const one of (list as Json[] | undefined) ?? []) into.set(key(one), one);
    };
    merge(held.projects, answer["projects"], (one) => String(one["id"]));
    merge(held.sections, answer["sections"], (one) => String(one["id"]));
    merge(held.people, answer["collaborators"], (one) => String(one["id"]));
    merge(held.places, answer["collaborator_states"], (one) => `${String(one["project_id"])} ${String(one["user_id"])}`);
    if (answer["user"] && Object.keys(answer["user"] as Json).length > 0) held.user = { ...held.user, ...(answer["user"] as Json) };
    if (typeof answer["sync_token"] === "string") aroundToken = answer["sync_token"];
    return held;
  };
  const here = async () => around ?? (await readAround());
  /** One of several by its id, else by its name: as written, then loosely when only one has it. */
  const pick = (list: readonly Json[], named: string): Json | undefined => {
    const exact = list.find((one) => one["id"] === named) ?? list.find((one) => one["name"] === named);
    const near = list.filter((one) => loose(String(one["name"])) === loose(named));
    return exact ?? (near.length === 1 ? near[0] : undefined);
  };
  const projectId = (held: Around): string => {
    const found = pick([...held.projects.values()].filter((one) => one["is_deleted"] !== true), options.projectId);
    if (!found) throw new TodoistError(`todoist: the account of ${secret} has no project ${options.projectId}: name it by its id, the letters and digits at the end of its link, or share the project with that account`, 404);
    if (found["is_archived"] === true) throw new TodoistError(`todoist: the project ${String(found["name"])} is archived in Todoist: unarchive it there, or name another`, 404);
    return String(found["id"]);
  };
  const sectionsOf = (held: Around) => [...held.sections.values()].filter((one) => one["project_id"] === projectId(held) && one["is_deleted"] !== true);
  const sectionId = (held: Around, named: string): string => {
    const found = pick(sectionsOf(held).filter((one) => one["is_archived"] !== true), named);
    if (!found) throw new TodoistError(`todoist: the project has no section ${named}: make it in Todoist, or name one it has (${sectionsOf(held).map((one) => String(one["name"])).join(", ") || "it has none"})`, 404);
    return String(found["id"]);
  };
  /** Who a task of the project may be assigned to: the people on it, and the account itself. */
  const peopleOf = (held: Around): Json[] => {
    const project = projectId(held);
    const on = [...held.places.values()].filter((one) => one["project_id"] === project && one["is_deleted"] !== true).map((one) => held.people.get(String(one["user_id"]))).filter((one): one is Json => one !== undefined);
    return [...on, held.user].filter((one) => one["id"] !== undefined);
  };
  const personId = (held: Around, named: string): string => {
    const want = named.trim().toLowerCase();
    const people = peopleOf(held);
    const found = people.find((one) => String(one["email"] ?? "").toLowerCase() === want) ?? only(people.filter((one) => String(one["full_name"] ?? "").toLowerCase() === want));
    if (!found) throw new TodoistError(`todoist: nobody on the project is ${named}, so the task is not assigned: say an email or a name of somebody the project is shared with`, 404);
    return String(found["id"]);
  };
  const zoneOf = (held: Around): string => words((held.user["tz_info"] as Json | undefined)?.["timezone"]) ?? options.zone ?? "UTC";
  /** The names this connection's values are read through, as one word: when they change, every task is read again. */
  const namesNow = (held: Around): string =>
    todoistVersion({
      project: projectId(held),
      ...(keeps("section") || options.section ? { sections: sectionsOf(held).map((one) => [one["id"], one["name"]]) } : {}),
      ...(keeps("assignee") ? { people: peopleOf(held).map((one) => [one["id"], one["full_name"], one["email"]]) } : {}),
      ...(keeps("due") ? { zone: zoneOf(held) } : {}),
    });

  /* ------------------------------------------------------------ a task, as plain parts */
  /** The words a due date repeats in, when a repeat here can hold them and the two clocks agree. */
  const repeatIn = (due: TodoistDue | undefined, zone: string): string | null => {
    if (!due?.is_recurring || !due.string) return null;
    if (due.lang && due.lang !== "en") return null;
    if (due.timezone && !sameZone(due.timezone, zone)) return null;
    if (options.zone && !sameZone(options.zone, zone)) return null;
    const repeat = readRepeat(due.string);
    return (repeat && sayRepeat(repeat)) ?? null;
  };
  const dueOf = (item: Json): TodoistDue | undefined => (item["due"] && typeof item["due"] === "object" && typeof (item["due"] as Json)["date"] === "string" ? (item["due"] as unknown as TodoistDue) : undefined);
  const valuesOf = (item: Json, held: Around): Json => {
    const out: Json = {};
    const zone = zoneOf(held);
    const due = dueOf(item);
    for (const ref of Object.keys(refs)) {
      switch (ref) {
        case "content":
        case "description":
          out[ref] = words(item[ref]);
          break;
        case "due":
          out[ref] = due ? (dueAs === "day" ? dueDay(due, zone) : dueInstant(due, zone)) : null;
          break;
        case "repeat": {
          const repeat = repeatIn(due, zone);
          if (due?.is_recurring && repeat === null) note(`${String(item["content"])} repeats in Todoist as "${due.string ?? ""}", which is not a repeat this app can keep: its date is kept, and how it repeats stays in Todoist`);
          out[ref] = repeat;
          break;
        }
        case "deadline":
          out[ref] = words((item["deadline"] as Json | null | undefined)?.["date"]);
          break;
        case "priority": {
          // "p1 will return 4 in the API" (sync/tasks.md): kept as people see it, 1 the most urgent.
          const api = Number(item["priority"]);
          out[ref] = api >= 1 && api <= 4 ? 5 - api : 4;
          break;
        }
        case "labels": {
          const named = ((item["labels"] as string[] | undefined) ?? []).filter((label) => label !== options.label);
          out[ref] = named.length > 0 ? [...new Set(named)].sort() : null;
          break;
        }
        case "section":
          out[ref] = item["section_id"] ? (words(held.sections.get(String(item["section_id"]))?.["name"]) ?? null) : null;
          break;
        case "assignee": {
          const id = item["responsible_uid"];
          const person = id ? peopleOf(held).find((one) => String(one["id"]) === String(id)) ?? held.people.get(String(id)) : undefined;
          out[ref] = !id ? null : words(person?.[refs["assignee"] === "email" ? "email" : "full_name"]);
          break;
        }
        case "parent":
          out[ref] = item["parent_id"] ? [String(item["parent_id"])] : null;
          break;
        case "completed":
          out[ref] = item["checked"] === true;
          break;
      }
    }
    return out;
  };

  /** The tasks the last pulls listed, as Todoist has them: what a write reads a due date's repeat and time from. */
  const listed = new Map<string, Json>();
  const taskNow = async (id: string): Promise<Json | undefined> => {
    const have = listed.get(id);
    if (have) return have;
    try {
      const task = await call("GET", `/tasks/${encodeURIComponent(id)}`);
      listed.set(id, task);
      return task;
    } catch (error) {
      // Refused for this one task (404 for one completed or deleted, 403 for one out of reach) is a task not read, not a pass that failed.
      if (error instanceof TodoistError && error.status !== 401 && error.status !== 429 && error.status < 500) return undefined;
      throw error;
    }
  };

  /** The completed tasks of the project among these, by id: pages of the last three months' (tasks.md). */
  const completedAmong = async (ids: ReadonlySet<string>, project: string): Promise<Json[]> => {
    const found: Json[] = [];
    let cursor: string | undefined;
    do {
      const query = new URLSearchParams({
        since: new Date(now() - COMPLETED_DAYS * DAY_MS).toISOString(),
        until: new Date(now() + DAY_MS / 24).toISOString(),
        project_id: project,
        limit: String(COMPLETED_PAGE),
        ...(cursor ? { cursor } : {}),
      });
      const answer = await call("GET", `/tasks/completed/by_completion_date?${query.toString()}`);
      for (const item of (answer["items"] as Json[] | undefined) ?? []) if (ids.has(String(item["id"]))) found.push({ ...item, checked: true });
      cursor = words(answer["next_cursor"]) ?? undefined;
    } while (cursor);
    return found;
  };

  const itemsSince = async (token: string): Promise<{ items: Map<string, Json>; token: string; whole: boolean }> => {
    let answer: Json;
    try {
      answer = await sync(token, ["items"]);
    } catch (error) {
      // A token Todoist no longer takes is a whole read, as none is.
      if (token === "*" || !isTokenRefused(error)) throw error;
      answer = await sync("*", ["items"]);
    }
    const items = new Map(((answer["items"] as Json[] | undefined) ?? []).map((item) => [String(item["id"]), item]));
    const whole = token === "*" || answer["full_sync"] === true;
    let next = String(answer["sync_token"] ?? token);
    // "For big accounts, the data in the initial sync may be returned with some delay … do an incremental sync" (sync/overview.md).
    const dated = whole ? Date.parse(String(answer["full_sync_date_utc"] ?? "")) : NaN;
    if (Number.isFinite(dated) && now() - dated > 60_000) {
      const later = await sync(next, ["items"]);
      for (const item of (later["items"] as Json[] | undefined) ?? []) items.set(String(item["id"]), item);
      next = String(later["sync_token"] ?? next);
    }
    return { items, token: next, whole };
  };

  /** Whether a command of this push was answered: the first request that fails is a run that failed, a later one is not. */
  let sent = false;
  /** Whether a task that repeats moved on since its completion was sent and not answered. */
  const movedOn = (id: string): boolean => {
    const was = closing.get(id);
    const due = dueOf(listed.get(id) ?? {});
    return was !== undefined && due !== undefined && due.date !== was;
  };

  return {
    name: "todoist",

    async pull(cursor) {
      const held = await readAround();
      // Nothing was owed after the last pull, so nothing is taken up: a task like any other.
      if (!pushed) {
        // Save for a record set aside, or just brought back: what it owes is worked out on the pass after.
        for (const localId of [...unheard.keys()]) if (!waited.has(localId) && !options.isAside?.(localId)) letGo(localId);
        const waits = new Set((options.aside?.() ?? []).map((one) => one.id));
        for (const id of [...closing.keys()]) if (!waits.has(id) && !saidAside.has(id)) closing.delete(id);
      }
      const project = projectId(held);
      const section = options.section ? sectionId(held, options.section) : undefined;
      const names = namesNow(held);
      const kept = readCursor(cursor);
      const scope = todoistVersion({ project, section: section ?? null, label: options.label ?? null });
      // Another project's tasks are not this one's moved out: nothing is taken away for a change of what is declared.
      if (kept && kept.scope !== scope) {
        throw new TodoistError("todoist: this connection kept another project, section or label before, and the records it made are of that one: put it back, or keep the new one with a connection of another name", 400);
      }
      under = new Map(Object.entries(kept?.under ?? {}));
      const read = await itemsSince(kept && kept.names === names ? kept.token : "*");
      const known = new Map((options.known?.() ?? []).map((one) => [one.id, one]));
      if (read.whole) {
        listed.clear();
        // A whole read is of active tasks: what it does not list is completed, deleted, or out of sight.
        const absent = new Set([...known.values()].filter((one) => (!one.completed || !kept) && !read.items.has(one.id)).map((one) => one.id));
        if (absent.size > 0) {
          for (const item of await completedAmong(absent, project)) {
            read.items.set(String(item["id"]), item);
            absent.delete(String(item["id"]));
          }
          for (const id of absent) {
            if (known.get(id)?.completed) continue;
            const item = await taskNow(id);
            if (item) read.items.set(id, item);
            else note(`Todoist no longer lists the task ${id}, so what it made here is kept as it was`);
          }
        }
      }
      for (const id of recheck) {
        const item = read.items.has(id) ? undefined : await taskNow(id);
        if (item) read.items.set(id, item);
      }
      recheck.clear();
      for (const [id, item] of read.items) {
        const parent = item["is_deleted"] === true ? null : words(item["parent_id"]);
        if (parent === null || item["project_id"] !== project) under.delete(id);
        else under.set(id, parent);
      }
      waited = new Set([...unheard.keys()].filter((localId) => options.isAside?.(localId)));
      const aside = new Map((options.aside?.() ?? []).map((one) => [one.id, one]));
      for (const id of kept?.spared ?? []) spared.add(id);
      const asides = asideNow();
      for (const id of asides.keys()) spared.add(id);
      // Let go once nothing is above it, or it is brought back with no record above it removed here: a task like any other.
      for (const id of [...spared]) if (!under.has(id) || (!asides.has(id) && !climb(id).some((one) => known.get(one)?.removed))) spared.delete(id);
      for (const id of kept?.aside ?? []) saidAside.add(id);
      for (const id of [...saidAside]) {
        if (aside.has(id)) continue;
        saidAside.delete(id);
        // Brought back: read as it stands, for what was let be while it was aside.
        const item = read.items.has(id) ? undefined : await taskNow(id);
        if (item) read.items.set(id, item);
      }
      for (const { id, label } of aside.values()) {
        if (saidAside.has(id)) continue;
        saidAside.add(id);
        const line = `${label} is set aside here: its task is left as it is in Todoist, and nothing is sent for it until it is brought back`;
        fresh.push(line);
        options.say?.(line);
      }
      const changes: RemoteChange[] = [];
      for (const [id, item] of read.items) {
        const isKnown = known.has(id);
        const checked = item["checked"] === true;
        const inScope = item["project_id"] === project && (section === undefined || item["section_id"] === section) && (options.label === undefined || ((item["labels"] as string[] | undefined) ?? []).includes(options.label));
        if (item["is_deleted"] === true || (!inScope && !(isKnown && checked))) {
          listed.delete(id);
          // Out of what the connection keeps while its record is aside: judged when the record is brought back.
          if (item["is_deleted"] !== true && aside.has(id)) continue;
          if (isKnown) changes.push({ resource: "tasks", id, version: "gone", deleted: true });
          continue;
        }
        // A task already completed when first seen is a record only where a field says it is completed.
        if (!isKnown && checked && !keeps("completed")) continue;
        listed.set(id, item);
        const fields = valuesOf(item, held);
        if (!isKnown) {
          const said = asWords(item["content"]).trim();
          const ours = [...unheard].find(([localId, sent]) => sent === said && !found.has(localId));
          if (ours || [...found.values()].includes(id)) {
            if (ours) found.set(ours[0], id);
            continue;
          }
        }
        changes.push({ resource: "tasks", id, version: todoistVersion(fields), fields });
      }
      // Only a pull that was answered is one nothing was owed after.
      pushed = false;
      // What did not turn up by the first pull that was answered was not made.
      for (const localId of [...unheard.keys()]) if (!found.has(localId)) unheard.delete(localId);
      const said = fresh;
      fresh = [];
      return { changes, cursor: JSON.stringify({ token: read.token, names, scope, ...(under.size > 0 ? { under: Object.fromEntries(under) } : {}), ...(saidAside.size > 0 ? { aside: [...saidAside] } : {}), ...(spared.size > 0 ? { spared: [...spared] } : {}) }), ...(said.length > 0 ? { said } : {}) };
    },

    async push(writes) {
      const around = await here();
      const acks = new Map<string, RemoteAck>();
      const refuse = (write: RemoteWrite, error: unknown) => acks.set(write.localId, { localId: write.localId, id: write.id ?? "", version: "", error: error instanceof Error ? error.message : String(error) });
      const planned: Planned[] = [];
      pushed = true;
      sent = false;
      const owedNow = new Set(writes.map((write) => write.localId));
      for (const localId of [...unheard.keys()]) if (!owedNow.has(localId) && !options.isAside?.(localId)) letGo(localId);
      const completing = new Set(writes.filter((write) => write.fields?.["completed"] === true && write.changed?.includes("completed")).map((write) => write.id));
      const waits = new Set((options.aside?.() ?? []).map((one) => one.id));
      for (const id of [...closing.keys()]) if (!completing.has(id) && !waits.has(id)) closing.delete(id);
      for (const write of writes) {
        try {
          planned.push(await plan(write, around));
        } catch (error) {
          // One refusal is not a failed run: the engine keeps the local state for this write and says so.
          if (error instanceof TodoistError && (error.status === 401 || error.status === 429)) throw error;
          refuse(write, error);
        }
      }
      /* Made and changed first, deleted next, completed last: a part refused then never repeats a completion, and a task goes only once what was under it has been moved out. */
      const clean = new Set<string>();
      const toClose: { readonly one: Planned; readonly id: string }[] = [];
      const first = await execute(planned.filter((one) => !one.write.deleted).flatMap((one) => one.commands), (lost) => {
        for (const one of planned) if (one.made && lost.has(one.made.uuid)) unheard.set(one.write.localId, asWords(one.write.fields?.["content"]).trim());
      });
      for (const one of planned) {
        if (one.write.deleted) continue;
        const outcome = one.commands.map((command) => first.status.get(command.uuid));
        const bad = outcome.find((status) => status !== undefined && !status.ok && !status.later);
        const id = one.id ?? (one.made ? first.ids.get(one.made.temp_id!) : undefined);
        if (bad) refuse(one.write, `todoist: ${bad.said}`);
        else if (outcome.some((status) => status === undefined || status.later)) {
          // Not answered for, or asked to wait: still owed, and worked out again on the next pass.
        } else if (id === undefined) refuse(one.write, "todoist: Todoist did not say the id of the task it made");
        else if (one.close && !movedOn(id)) toClose.push({ one, id });
        else {
          // Completed on a pass that did not hear so: it is agreed, and read again as it stands.
          if (one.close) recheck.add(id);
          closing.delete(id);
          acks.set(one.write.localId, one.ack(id));
          if (!one.partly) clean.add(id);
        }
      }
      /* A task is deleted with everything under it, so not while a change to something under it is still owed or refused. */
      const deletes = planned.filter((one) => one.write.deleted);
      const open = new Set(writes.flatMap((write) => (write.id && !write.deleted && !clean.has(write.id) && !toClose.some((one) => one.id === write.id) ? [write.id] : [])));
      /* Nor while the task of a record set aside is under it, however far: that one is not deleted until its record is. */
      const above = new Set<string>();
      const asides = asideNow();
      for (const [id, parent] of asides) for (const at of climb(id, parent)) above.add(at);
      for (const id of spared) for (const at of climb(id)) above.add(at);
      const waiting = (id: string) => above.has(id) || [...under].some(([child, parent]) => parent === id && (options.movedElsewhere?.(child) ?? false)) || [...open].some((other) => under.get(other) === id);
      for (const { write } of deletes) {
        if (above.has(write.id!)) note(`the task ${write.id} is not deleted in Todoist while the task of a record set aside is under it, or of one that was: bring it back and move it out from under this one, or remove its record`);
      }
      for (let grew = true; grew; ) {
        grew = false;
        for (const { write } of deletes) {
          if (open.has(write.id!) || !waiting(write.id!)) continue;
          open.add(write.id!);
          grew = true;
        }
      }
      const going = deletes.filter((one) => !open.has(one.write.id!));
      const gone = await execute(going.flatMap((one) => one.commands));
      for (const one of going) {
        const status = gone.status.get(one.commands[0]!.uuid);
        // Already gone there is what a delete asks for.
        if (status?.ok || status?.tag === "ITEM_NOT_FOUND") acks.set(one.write.localId, one.ack(one.write.id!));
        else if (status && !status.later) refuse(one.write, `todoist: ${status.said}`);
      }
      const closes = toClose.map(({ one, id }) => ({ one, id, command: { type: "item_close", uuid: uuid(), args: { id } } satisfies Command }));
      const last = await execute(
        closes.map((one) => one.command),
        (lost) => {
          for (const { one, id, command } of closes) {
            // The date it was due as it was closed: the one just sent, where this write sent one.
            const sentDue = one.commands.map((sent) => sent.args["due"]).find((due) => due !== undefined && due !== null);
            const due = dueOf(sentDue ? { due: sentDue } : (listed.get(id) ?? {}));
            if (lost.has(command.uuid) && due?.is_recurring) closing.set(id, due.date);
          }
        },
      );
      for (const { one, id, command } of closes) {
        const status = last.status.get(command.uuid);
        // The rest of it went: only its completion is owed, and Todoist still has it open.
        const opened = { ...one.ack(id), fields: { ...one.ack(id).fields, completed: false } };
        if (status) closing.delete(id);
        if (status?.ok) acks.set(one.write.localId, one.ack(id));
        else if (status === undefined) {
          if (one.commands.length > 0) acks.set(one.write.localId, opened);
        } else if (one.commands.length > 0) acks.set(one.write.localId, status.later ? opened : { ...opened, held: [opened.held, `todoist: ${status.said}`].filter(Boolean).join("; ") });
        else if (!status.later) refuse(one.write, `todoist: ${status.said}`);
      }
      for (const { localId, error } of acks.values()) {
        if (error !== undefined) continue;
        unheard.delete(localId);
        found.delete(localId);
      }
      return [...acks.values()];
    },
  };

  /* ------------------------------------------------------------ writing */
  /**
   * One write as its commands, and whether it completes the task after them.
   * A part that cannot be sent — a repeat there are no words for, a section
   * there is not — holds that part alone of a task already there, and the
   * whole of one not made yet.
   */
  async function plan(write: RemoteWrite, around: Around): Promise<Planned> {
    const fields = write.fields ?? {};
    const command = (type: string, args: Json, temp?: boolean): Command => ({ type, uuid: uuid(), ...(temp ? { temp_id: uuid() } : {}), args });
    if (write.deleted && write.id) return { write, id: write.id, commands: [command("item_delete", { id: write.id })], close: false, partly: false, ack: (id) => ({ localId: write.localId, id, version: "" }) };
    // Made already, its answer lost on an earlier pass: what it holds is set rather than made again.
    const at = write.id ?? found.get(write.localId);
    const changed = new Set(write.id ? (write.changed ?? Object.keys(fields)) : Object.keys(fields));
    const unsent = new Map<string, string>();
    const part = async (named: readonly string[], act: () => unknown) => {
      if (!named.some((ref) => changed.has(ref))) return;
      try {
        for (const ref of named) if (changed.has(ref) && isUnsayable(fields[ref])) throw new Error(`held unsent: ${(fields[ref] as Unsayable).held}`);
        await act();
      } catch (error) {
        if (!at || (error instanceof TodoistError && (error.status === 401 || error.status === 429))) throw error;
        for (const ref of named) if (changed.has(ref)) unsent.set(ref, error instanceof Error ? error.message : String(error));
      }
    };
    const args: Json = {};
    await part(["content"], () => (args["content"] = asWords(fields["content"])));
    await part(["description"], () => (args["description"] = asWords(fields["description"])));
    await part(["deadline"], () => (args["deadline"] = fields["deadline"] ? { date: String(fields["deadline"]) } : null));
    await part(["priority"], () => (args["priority"] = 5 - Number(fields["priority"] ?? 4)));
    if (changed.has("labels") || (!at && options.label)) args["labels"] = [...new Set([...((fields["labels"] as string[] | null | undefined) ?? []), ...(options.label ? [options.label] : [])])];
    await part(["assignee"], () => (args["responsible_uid"] = fields["assignee"] ? personId(around, String(fields["assignee"])) : null));
    await part(["due", "repeat"], async () => {
      args["due"] = await dueFor({ ...write, ...(at ? { id: at } : {}) }, changed, around);
    });
    await part(["completed"], async () => {
      if (at) await reachesAside(at, fields["completed"] === true);
    });
    let move: Json | undefined;
    await part(["parent", "section"], async () => (move = await moveFor(at, fields, changed, around)));

    if (!at) {
      for (const key of Object.keys(args)) if (args[key] === null) delete args[key];
      const adds = command("item_add", { ...args, project_id: projectId(around), ...(move ?? (options.section ? { section_id: sectionId(around, options.section) } : {})) }, true);
      return { write, commands: [adds], made: adds, close: fields["completed"] === true, partly: false, ack: ackOf(write, {}) };
    }
    const commands: Command[] = [];
    if (write.id && changed.has("completed") && !unsent.has("completed") && fields["completed"] !== true) commands.push(command("item_uncomplete", { id: at }));
    if (Object.keys(args).length > 0) commands.push(command("item_update", { id: at, ...args }));
    // "Only one of parent_id, section_id or project_id must be set" (sync/tasks.md): a subtask is where its parent is.
    if (move) commands.push(command("item_move", { id: at, ...move }));
    const close = changed.has("completed") && !unsent.has("completed") && fields["completed"] === true;
    if (unsent.size === 0) return { write, id: at, commands, close, partly: false, ack: ackOf(write, {}) };
    const said = [...new Set(unsent.values())].join("; ");
    const task = await taskNow(at);
    if ((commands.length === 0 && !close) || !task) throw new Error(said);
    // What was not sent is agreed as Todoist has it, so it is owed still.
    const values = valuesOf(task, around);
    return { write, id: at, commands, close, partly: true, ack: ackOf(write, Object.fromEntries([...unsent.keys()].map((ref) => [ref, values[ref] ?? null])), said) };
  }

  /** The ack of a write that went, with the version it comes back at should nobody else have touched it. */
  function ackOf(write: RemoteWrite, instead: Json, held?: string): (id: string) => RemoteAck {
    return (id) => ({
      localId: write.localId,
      id,
      version: todoistVersion(Object.fromEntries(Object.keys(refs).map((ref) => [ref, (ref in instead ? instead[ref] : write.fields?.[ref]) ?? null]))),
      ...(held !== undefined ? { fields: instead, held } : {}),
    });
  }

  /** The tasks of the records set aside, whoever keeps them, each with its parent as last agreed where that is known. */
  function asideNow(): Map<string, string | undefined> {
    const all = new Map<string, string | undefined>((options.asideElsewhere?.() ?? []).map((id) => [id, undefined]));
    for (const { id, parent } of options.aside?.() ?? []) all.set(id, parent);
    return all;
  }

  /** What is above a task, nearest first. */
  function climb(id: string, parent?: string): string[] {
    const above: string[] = [];
    for (let at = under.get(id) ?? parent; at !== undefined && !above.includes(at); at = under.get(at)) above.push(at);
    return above;
  }

  /** Refuses to complete or reopen a task where Todoist would do it to the task of a record set aside: completing one completes its sub-tasks, and reopening one reopens what is above it (sync/tasks.md). */
  async function reachesAside(id: string, completing: boolean): Promise<void> {
    const own = new Map((options.aside?.() ?? []).map((one) => [one.id, one]));
    const isOpen = async (task: string) => (own.get(task)?.completed !== undefined ? !own.get(task)!.completed : (await taskNow(task))?.["checked"] === false);
    if (completing) {
      if (dueOf((await taskNow(id)) ?? {})?.is_recurring) return;
      for (const [task, parent] of asideNow()) {
        if (climb(task, parent).includes(id) && (await isOpen(task))) throw new Error("held unsent: completing this task would complete the task of a record set aside under it — bring that one back, or complete it, first");
      }
      return;
    }
    const aside = asideNow();
    for (const task of climb(id)) if (aside.has(task) && !(await isOpen(task))) throw new Error("held unsent: reopening this task would reopen the task of a record set aside above it — bring that one back first");
  }

  /** Where a task goes when its parent or its section changed here; a part held in conflict is left where Todoist has it. */
  async function moveFor(id: string | undefined, fields: Json, changed: ReadonlySet<string>, around: Around): Promise<Json | undefined> {
    const own = options.section ? sectionId(around, options.section) : undefined;
    const parent = (fields["parent"] as string[] | null | undefined)?.[0];
    if (!id) return parent ? { parent_id: parent } : own ? { section_id: own } : fields["section"] ? { section_id: sectionId(around, String(fields["section"])) } : undefined;
    const task = await taskNow(id);
    if (!task) throw new Error("held unsent: Todoist does not list the task, so where it is there is not known");
    if (changed.has("parent")) {
      if (parent) return { parent_id: parent };
      // A parent this connection no longer keeps is not one somebody here took it out of.
      const was = words(task["parent_id"]);
      if (was === null || !((options.known?.() ?? []).some((one) => one.id === was) || (options.keptElsewhere?.(was) ?? false))) {
        if (!changed.has("section")) return undefined;
      }
    } else if (task["parent_id"]) throw new Error("held unsent: a subtask is in its parent's section, so it is moved by moving its parent, or by taking it out of it");
    const into = own ?? (keeps("section") && changed.has("section") ? (fields["section"] ? sectionId(around, String(fields["section"])) : undefined) : (words(task["section_id"]) ?? undefined));
    return into ? { section_id: into } : { project_id: projectId(around) };
  }

  /** The due date a write says, or a refusal where saying it would end a repeat this app cannot say, or settle one that is held in conflict. */
  async function dueFor(write: RemoteWrite, changed: ReadonlySet<string>, held: Around): Promise<Json | null> {
    const fields = write.fields ?? {};
    if (!("due" in fields) || (keeps("repeat") && !("repeat" in fields))) throw new Error("held unsent: a due date and how it repeats are written together, and one of them is held in conflict");
    const value = words(fields["due"]);
    const zone = zoneOf(held);
    let was: TodoistDue | undefined;
    if (write.id) {
      const task = await taskNow(write.id);
      if (!task) throw new Error("held unsent: Todoist does not list the task, so whether its due date repeats is not known");
      was = dueOf(task);
      if (was?.is_recurring && repeatIn(was, zone) === null) {
        throw new Error(`held unsent: the task repeats in Todoist as "${was.string ?? ""}", which this app cannot say, and setting its date from here would end that repeat — change it in Todoist`);
      }
      if (was?.is_recurring && !keeps("repeat")) {
        throw new Error(`held unsent: the task repeats in Todoist as "${was.string ?? ""}", and the field its due date is in keeps no repeat, so setting it from here would end that one — change it in Todoist`);
      }
    }
    const repeat = words(fields["repeat"]);
    if (value === null) {
      if (repeat && changed.has("repeat")) throw new Error("held unsent: a date that repeats needs its first date");
      return null;
    }
    if (repeat) {
      if (options.zone && !sameZone(options.zone, zone)) throw new Error(`held unsent: it repeats at a time in ${options.zone}, and the Todoist account is in ${zone}, where the same words are other times`);
      if (was?.timezone && !sameZone(was.timezone, zone)) throw new Error(`held unsent: the task's due date is fixed in ${was.timezone}, and the Todoist account is in ${zone}`);
    }
    // A time fixed in its own zone keeps it; its wall is the account's, as its words are.
    if (was && dueWall(was, zone).fixed && !was.timezone) was = { ...was, timezone: zone };
    return dueToWrite(value, dueAs, zone, was, repeat);
  }

  /** Sends commands in order, a hundred to a request, and answers what became of each. */
  async function execute(commands: readonly Command[], unanswered: (lost: ReadonlySet<string>) => void = () => undefined): Promise<{ readonly status: Map<string, Status>; readonly ids: Map<string, string> }> {
    const status = new Map<string, Status>();
    const ids = new Map<string, string>();
    for (let at = 0; at < commands.length; ) {
      const batch: Command[] = [];
      let bytes = 0;
      while (at < commands.length && batch.length < MOST_COMMANDS) {
        const size = encodeURIComponent(JSON.stringify(commands[at])).length;
        if (batch.length > 0 && bytes + size > MOST_BYTES) break;
        bytes += size;
        batch.push(commands[at]!);
        at += 1;
      }
      let answer: Json;
      try {
        answer = await again({ commands: JSON.stringify(batch) });
      } catch (error) {
        // Carried out, perhaps, where the answer was lost; a request refused was not.
        if (!(error instanceof TodoistError) || error.status >= 500) unanswered(new Set(batch.map((command) => command.uuid)));
        // What went before is kept; this and what follows is not answered for, and stays owed. Nothing sent yet is a run that failed.
        if (!sent) {
          sent = true;
          throw error;
        }
        note(error instanceof Error ? error.message : String(error));
        break;
      }
      sent = true;
      for (const [temporary, id] of Object.entries((answer["temp_id_mapping"] as Json | undefined) ?? {})) ids.set(temporary, String(id));
      for (const [key, value] of Object.entries((answer["sync_status"] as Json | undefined) ?? {})) {
        if (value === "ok") {
          status.set(key, { ok: true, later: false, said: "" });
          continue;
        }
        const refused = (value ?? {}) as Json;
        const http = Number(refused["http_code"] ?? 0);
        // "Clients should treat 400 command errors as a terminal signal"; a wait or a fault there is not one (sync/overview.md).
        const later = http === 429 || http >= 500;
        status.set(key, { ok: false, later, said: sentenceOf(refused).replace(/^: /, "") || "the command was refused", ...(typeof refused["error_tag"] === "string" ? { tag: refused["error_tag"] } : {}) });
      }
    }
    return { status, ids };
  }

  /** A write made again as it was when its answer was lost: "Todoist will not execute a command that has same UUID as a previously executed command" (sync/overview.md). */
  async function again(form: Readonly<Record<string, string>>): Promise<Json> {
    for (let tries = 0; ; tries += 1) {
      try {
        return await call("POST", "/sync", form);
      } catch (error) {
        const lost = !(error instanceof TodoistError) || error.status >= 500;
        if (!lost || tries >= 2) throw error;
        await sleep(500 * (tries + 1));
      }
    }
  }
}

interface Status {
  readonly ok: boolean;
  /** Refused for now: owed still. */
  readonly later: boolean;
  readonly said: string;
  readonly tag?: string;
}

interface Planned {
  readonly write: RemoteWrite;
  /** The task's id, when it is there already. */
  readonly id?: string;
  /** Part of it is held unsent. */
  readonly partly: boolean;
  readonly commands: readonly Command[];
  /** The `item_add` that makes the task, when it is new there. */
  readonly made?: Command;
  /** Completed once the rest is done. */
  readonly close: boolean;
  ack(id: string): RemoteAck;
}

const only = <T>(list: readonly T[]): T | undefined => (list.length === 1 ? list[0] : undefined);

/** Todoist's words for a refusal. */
function sentenceOf(answer: Json): string {
  const explanation = (answer["error_extra"] as Json | undefined)?.["explanation"];
  const error = answer["error"];
  return typeof explanation === "string" && explanation ? `: ${explanation}` : typeof error === "string" && error ? `: ${error}` : "";
}

/** Whether a read was refused for its sync token, which the documentation does not give a tag: any bad request that names it. */
const isTokenRefused = (error: unknown): boolean => error instanceof TodoistError && error.status === 400 && /sync.?token/i.test(`${error.tag ?? ""} ${error.message}`);

function readCursor(cursor: string | undefined): { readonly token: string; readonly names: string; readonly scope: string; readonly under?: Readonly<Record<string, string>>; readonly aside?: readonly string[]; readonly spared?: readonly string[] } | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(cursor) as { token?: unknown; names?: unknown; scope?: unknown; under?: Record<string, string>; aside?: string[]; spared?: string[] };
    return typeof parsed.token === "string" && typeof parsed.names === "string" && typeof parsed.scope === "string" ? { token: parsed.token, names: parsed.names, scope: parsed.scope, ...(parsed.under ? { under: parsed.under } : {}), ...(parsed.aside ? { aside: parsed.aside } : {}), ...(parsed.spared ? { spared: parsed.spared } : {}) } : undefined;
  } catch {
    return undefined;
  }
}
