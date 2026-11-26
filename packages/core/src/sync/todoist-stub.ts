import { occurrences } from "../repeat.js";
import type { Fetcher } from "./google-calendar.js";
import { readRepeat } from "./todoist-due.js";

/**
 * A SCRIPTED TODOIST: the endpoints a Todoist connection reaches, in memory.
 *
 * `POST /sync` — resources since a sync token (a whole read lists active
 * tasks alone), and commands, a `uuid` executed once — and the two reads of
 * tasks a whole read leaves out: one active task by id, and the completed
 * ones by completion date. It answers as Todoist's documentation says where
 * a connection would notice: a token it does not take is 401, a sync token
 * it forgot is 400, more than 100 commands is 400, a project, section,
 * parent or person it does not have is an error in `sync_status`, deleting
 * or completing a task takes its subtasks with it, completing one that
 * repeats moves it to its next date, and `limit(n)` answers the next `n`
 * requests 429 with a `Retry-After`. Where the documentation is silent — a
 * completed task in an incremental read — it answers the task with
 * `checked` set, which `scripts/verify-todoist.mjs` asks Todoist itself.
 *
 * `add`, `edit`, `complete`, `reopen` and `remove` are another person,
 * working in Todoist.
 */

type Json = Record<string, unknown>;

export interface ScriptedTodoistOptions {
  /** The API token it takes. */
  readonly token?: string;
  /** The account's time zone. */
  readonly timeZone?: string;
}

export interface ScriptedTodoistRequest {
  readonly method: string;
  readonly path: string;
  /** The sync token a read sent. */
  readonly token?: string;
  readonly resources: readonly string[];
  readonly commands: number;
}

export interface ScriptedTodoist {
  readonly fetch: Fetcher;
  readonly token: string;
  /** Every request answered, in order (never the token). */
  readonly requests: ScriptedTodoistRequest[];
  /** Every command carried out, in order. */
  readonly commands: { readonly type: string; readonly args: Json }[];
  /** A project by name; its id. One of that name already there is it. */
  project(name: string): string;
  /** A section of a project; its id. */
  section(projectId: string, name: string): string;
  /** Somebody a project is shared with; their id. */
  person(name: string, email: string, projectId: string): string;
  /** Another person makes a task. */
  add(projectId: string, values: Json): Json;
  /** Another person changes a task. */
  edit(id: string, values: Json): Json;
  complete(id: string): void;
  reopen(id: string): void;
  remove(id: string): void;
  /** A task as Todoist would answer it, a completed or deleted one too. */
  task(id: string): Json | undefined;
  /** The tasks neither completed nor deleted, of one project or all. */
  tasks(projectId?: string): Json[];
  sectionOf(task: Json): string | undefined;
  /** A task no read answers for any more: completed longer ago than the list reaches. */
  forget(id: string): void;
  /** Refuses every sync token given so far. */
  forgetTokens(): void;
  /** The next `count` requests are answered 429, asking for `retryAfter` seconds. */
  limit(count: number, retryAfter?: number): void;
  /** The next `count` writes are carried out and their answers lost. */
  loseAnswers(count: number): void;
  /** The next `count` reads of tasks do not answer. */
  failReads(count: number): void;
  /** The next `count` writes that hold a command of this type never arrive. */
  dropWrites(type: string, count: number): void;
  /** The next `count` writes are refused whole. */
  refuseRequests(count: number): void;
  /** The next command of this type is refused. */
  refuseOnce(type: string): void;
  /** Runs once, just before the next write is carried out. */
  onWrite(act: () => void): void;
}

class Refusal extends Error {
  constructor(
    readonly tag: string,
    message: string,
    readonly http = 400,
  ) {
    super(message);
  }
}

export function scriptedTodoist(options: ScriptedTodoistOptions = {}): ScriptedTodoist {
  const token = options.token ?? "0123456789abcdef0123456789abcdef01234567";
  const projects = new Map<string, Json>();
  const sections = new Map<string, Json>();
  const people = new Map<string, Json>();
  const states: Json[] = [];
  const items = new Map<string, Json>();
  const changed = new Map<string, number>();
  const forgotten = new Set<string>();
  const executed = new Map<string, { readonly status: unknown; readonly temp?: string; readonly id?: string }>();
  const requests: ScriptedTodoistRequest[] = [];
  const commands: { type: string; args: Json }[] = [];
  const user: Json = { id: "1000", email: "me@example.com", full_name: "Me", tz_info: { timezone: options.timeZone ?? "UTC" } };
  let made = 0;
  let seq = 0;
  let oldest = 0;
  let limited = 0;
  let retryAfter = 1;
  let losing = 0;
  let refusing: string | undefined;
  let refused = 0;
  let failing = 0;
  let dropping: { type: string; count: number } | undefined;
  let before: (() => void) | undefined;

  const id = (salt: string) => `6${salt}${(made += 1).toString(36).padStart(14, "0")}`;
  const touch = (one: Json) => {
    seq += 1;
    changed.set(String(one["id"]), seq);
    one["updated_at"] = `2026-10-25T10:00:00.000000Z`;
    return one;
  };
  const found = (one: unknown): Json => {
    const item = items.get(String(one));
    if (!item || item["is_deleted"] === true) throw new Refusal("ITEM_NOT_FOUND", "Item not found", 404);
    return item;
  };
  const below = (parent: Json): Json[] => [...items.values()].filter((item) => item["parent_id"] === parent["id"] && item["is_deleted"] !== true).flatMap((item) => [item, ...below(item)]);
  /** A due date as Todoist keeps it: what was given, the rest filled in. */
  const dueOf = (due: unknown): Json | null => {
    if (!due || typeof due !== "object") return null;
    const { date, string, timezone, lang } = due as Json;
    if (typeof date !== "string") throw new Refusal("INVALID_ARGUMENT_VALUE", "Invalid date format");
    const words = typeof string === "string" ? string : String(date);
    return { date, timezone: timezone ?? (date.endsWith("Z") ? user["tz_info"] && (user["tz_info"] as Json)["timezone"] : null), string: words, lang: lang ?? "en", is_recurring: /^(?:every|ev|daily|weekly|monthly|yearly)\b/i.test(words) };
  };
  const WRITTEN = ["content", "description", "priority", "labels", "responsible_uid", "deadline"];
  const assign = (item: Json, args: Json) => {
    for (const key of WRITTEN) if (key in args) item[key] = key === "labels" ? [...(args[key] as string[])] : args[key];
    if ("due" in args) item["due"] = dueOf(args["due"]);
    if (String(item["content"] ?? "") === "") throw new Refusal("INVALID_ARGUMENT_VALUE", "Content can not be empty");
    if (item["responsible_uid"] && !states.some((one) => one["user_id"] === item["responsible_uid"]) && item["responsible_uid"] !== user["id"]) throw new Refusal("INVALID_ARGUMENT_VALUE", "Invalid responsible_uid");
  };
  const place = (item: Json, args: Json) => {
    if (args["parent_id"]) {
      const parent = found(args["parent_id"]);
      Object.assign(item, { parent_id: parent["id"], section_id: parent["section_id"], project_id: parent["project_id"] });
    } else if (args["section_id"]) {
      const section = sections.get(String(args["section_id"]));
      if (!section) throw new Refusal("SECTION_NOT_FOUND", "Section not found", 404);
      Object.assign(item, { parent_id: null, section_id: section["id"], project_id: section["project_id"] });
    } else {
      if (!projects.has(String(args["project_id"]))) throw new Refusal("PROJECT_NOT_FOUND", "Project not found", 404);
      Object.assign(item, { parent_id: null, section_id: null, project_id: args["project_id"] });
    }
    for (const child of below(item)) touch(Object.assign(child, { section_id: item["section_id"], project_id: item["project_id"] }));
  };
  const add = (args: Json): Json => {
    const item: Json = { id: id("X"), user_id: user["id"], content: "", description: "", priority: 1, due: null, deadline: null, labels: [], responsible_uid: null, checked: false, is_deleted: false, completed_at: null, parent_id: null, section_id: null };
    assign(item, args);
    place(item, args);
    items.set(String(item["id"]), item);
    return touch(item);
  };
  const complete = (item: Json) => {
    for (const one of [item, ...below(item)]) touch(Object.assign(one, { checked: true, completed_at: new Date().toISOString() }));
  };
  const close = (item: Json) => {
    const due = item["due"] as Json | null;
    if (!due?.["is_recurring"]) return complete(item);
    const repeat = readRepeat(String(due["string"]));
    const next = repeat ? occurrences(String(due["date"]), repeat, { limit: 2 })[1] : undefined;
    touch(Object.assign(item, { due: { ...due, date: next ?? due["date"] } }));
  };
  const reopen = (item: Json) => {
    touch(Object.assign(item, { checked: false, completed_at: null }));
    if (item["parent_id"]) reopen(found(item["parent_id"]));
  };
  const remove = (item: Json) => {
    for (const one of [item, ...below(item)]) touch(Object.assign(one, { is_deleted: true }));
  };

  const run = (type: string, args: Json): Json | undefined => {
    if (type === refusing) {
      refusing = undefined;
      throw new Refusal("FORBIDDEN", "Forbidden", 403);
    }
    switch (type) {
      case "item_add":
        return add(args);
      case "item_update": {
        const item = found(args["id"]);
        const next = { ...item };
        assign(next, args);
        touch(Object.assign(item, next));
        return undefined;
      }
      case "item_move":
        if (["parent_id", "section_id", "project_id"].filter((key) => args[key]).length !== 1) throw new Refusal("INVALID_ARGUMENT_VALUE", "Only one of parent_id, section_id or project_id must be set");
        place(found(args["id"]), args);
        touch(found(args["id"]));
        return undefined;
      case "item_close":
        close(found(args["id"]));
        return undefined;
      case "item_uncomplete":
        reopen(found(args["id"]));
        return undefined;
      case "item_delete":
        remove(found(args["id"]));
        return undefined;
      default:
        throw new Refusal("INVALID_COMMAND", `Invalid command ${type}`);
    }
  };

  const answer = (status: number, body: unknown, headers: Record<string, string> = {}) => ({ ok: status < 400, status, json: async () => structuredClone(body), headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } });

  const read = (since: string, resources: readonly string[]): Json => {
    const whole = since === "*";
    const at = whole ? 0 : Number(since.slice(1));
    if (!whole && (!Number.isFinite(at) || at < oldest)) throw new Refusal("INVALID_SYNC_TOKEN", "Invalid sync token");
    const news = (one: Json) => (whole ? one["is_deleted"] !== true : (changed.get(String(one["id"])) ?? 0) > at);
    const out: Json = { full_sync: whole, sync_token: `t${seq}`, ...(whole ? { full_sync_date_utc: new Date().toISOString() } : {}) };
    if (resources.includes("items")) out["items"] = [...items.values()].filter((item) => news(item) && !forgotten.has(String(item["id"])) && (!whole || item["checked"] !== true));
    if (resources.includes("projects")) out["projects"] = [...projects.values()].filter(news);
    if (resources.includes("sections")) out["sections"] = [...sections.values()].filter(news);
    if (resources.includes("collaborators")) out["collaborators"] = [...people.values()].filter(news);
    if (resources.includes("collaborator_states")) out["collaborator_states"] = states.filter((one) => whole || (changed.get(String(one["user_id"])) ?? 0) > at);
    if (resources.includes("user")) out["user"] = user;
    return out;
  };

  const fetch: Fetcher = async (url, init) => {
    const at = new URL(url);
    const path = at.pathname.replace(/^\/api\/v1/, "");
    const form = new URLSearchParams(init?.body ?? "");
    const sent = form.get("commands") ? (JSON.parse(form.get("commands")!) as { type: string; uuid: string; temp_id?: string; args: Json }[]) : [];
    const resources = form.get("resource_types") ? (JSON.parse(form.get("resource_types")!) as string[]) : [];
    const since = form.get("sync_token");
    requests.push({ method: init?.method ?? "GET", path, ...(since ? { token: since } : {}), resources, commands: sent.length });
    if (init?.headers?.["authorization"] !== `Bearer ${token}`) return answer(401, { error_tag: "UNAUTHORIZED", error_code: 477, error: "Unauthorized", http_code: 401 });
    if (limited > 0) {
      limited -= 1;
      return answer(429, { error_tag: "LIMITS_REACHED", error: "Too many requests", error_extra: { retry_after: retryAfter } }, { "retry-after": String(retryAfter) });
    }
    try {
      if (path === "/sync") {
        if (resources.includes("items") && failing > 0) {
          failing -= 1;
          throw new TypeError("fetch failed");
        }
        if (dropping && dropping.count > 0 && sent.some((one) => one.type === dropping!.type)) {
          dropping.count -= 1;
          throw new TypeError("fetch failed");
        }
        if (sent.length > 0 && refused > 0) {
          refused -= 1;
          throw new Refusal("INVALID_ARGUMENT", "Bad request");
        }
        if (sent.length > 100) throw new Refusal("MAX_COMMANDS", "Too many commands");
        const status: Json = {};
        const mapping: Json = {};
        if (sent.length > 0) {
          const act = before;
          before = undefined;
          act?.();
        }
        for (const command of sent) {
          let done = executed.get(command.uuid);
          if (!done) {
            try {
              commands.push({ type: command.type, args: structuredClone(command.args) });
              const result = run(command.type, command.args);
              done = { status: "ok", ...(command.temp_id && result ? { temp: command.temp_id, id: String(result["id"]) } : {}) };
            } catch (error) {
              if (!(error instanceof Refusal)) throw error;
              done = { status: { error_tag: error.tag, error_code: 20, error: error.message, http_code: error.http } };
            }
            executed.set(command.uuid, done);
          }
          status[command.uuid] = done.status;
          if (done.temp) mapping[done.temp] = done.id;
        }
        if (sent.length > 0 && losing > 0) {
          losing -= 1;
          throw new TypeError("fetch failed");
        }
        return answer(200, { ...(since ? read(since, resources) : { sync_token: `t${seq}` }), ...(sent.length > 0 ? { sync_status: status, temp_id_mapping: mapping } : {}) });
      }
      const one = /^\/tasks\/([^/]+)$/.exec(path);
      if (one) {
        const item = items.get(decodeURIComponent(one[1]!));
        if (!item || item["checked"] === true || forgotten.has(String(item["id"])) || item["is_deleted"] === true) return answer(404, { error_tag: "NOT_FOUND", error: "Task not found" });
        return answer(200, item);
      }
      if (path === "/tasks/completed/by_completion_date") {
        const within = [...items.values()].filter((item) => item["checked"] === true && item["is_deleted"] !== true && !forgotten.has(String(item["id"])) && item["project_id"] === at.searchParams.get("project_id") && String(item["completed_at"]) >= at.searchParams.get("since")! && String(item["completed_at"]) < at.searchParams.get("until")!);
        const size = Number(at.searchParams.get("limit") ?? "50");
        const from = Number(at.searchParams.get("cursor") ?? "0");
        return answer(200, { items: within.slice(from, from + size), next_cursor: from + size < within.length ? String(from + size) : null });
      }
      return answer(404, { error_tag: "NOT_FOUND", error: "Not found" });
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      return answer(error.http, { error_tag: error.tag, error: error.message, http_code: error.http });
    }
  };

  return {
    fetch,
    token,
    requests,
    commands,
    project(name) {
      const there = [...projects.values()].find((one) => one["name"] === name);
      if (there) return String(there["id"]);
      const one: Json = { id: id("P"), name, is_deleted: false, is_archived: false };
      projects.set(String(one["id"]), touch(one));
      return String(one["id"]);
    },
    section(projectId, name) {
      const one: Json = { id: id("S"), name, project_id: projectId, is_deleted: false, is_archived: false };
      sections.set(String(one["id"]), touch(one));
      return String(one["id"]);
    },
    person(name, email, projectId) {
      const one: Json = { id: String(2000 + (made += 1)), full_name: name, email };
      people.set(String(one["id"]), touch(one));
      states.push({ project_id: projectId, user_id: one["id"], state: "active", is_deleted: false });
      return String(one["id"]);
    },
    add: (projectId, values) => {
      const item = add({ project_id: projectId, ...values });
      return structuredClone(item);
    },
    edit(itemId, values) {
      const item = found(itemId);
      if (values["project_id"] || values["section_id"]) place(item, values);
      assign(item, values);
      return structuredClone(touch(item));
    },
    complete: (itemId) => complete(found(itemId)),
    reopen: (itemId) => reopen(found(itemId)),
    remove: (itemId) => remove(found(itemId)),
    task: (itemId) => structuredClone(items.get(itemId)),
    tasks: (projectId) => structuredClone([...items.values()].filter((item) => item["checked"] !== true && item["is_deleted"] !== true && (!projectId || item["project_id"] === projectId))),
    sectionOf: (task) => sections.get(String(task["section_id"]))?.["name"] as string | undefined,
    forget: (itemId) => void forgotten.add(itemId),
    forgetTokens() {
      seq += 1;
      oldest = seq;
    },
    limit(count, after = 1) {
      limited = count;
      retryAfter = after;
    },
    loseAnswers: (count) => void (losing = count),
    failReads: (count) => void (failing = count),
    dropWrites: (type, count) => void (dropping = { type, count }),
    refuseRequests: (count) => void (refused = count),
    refuseOnce: (type) => void (refusing = type),
    onWrite: (act) => void (before = act),
  };
}
