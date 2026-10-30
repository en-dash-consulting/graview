/**
 * `@graview/core/told` — WHAT PEOPLE TELL GRAVIEW, KEPT (Roadmap f-menu-learns).
 *
 * "Tell Graview…" takes words about what a person is on — "finish all
 * these", "assign this to Sam" — and answers with an act over records, a
 * plan that changes the app, an open answer, or a refusal. A TELLING is the
 * record of one of those: the words, what they were about (a kind and ids,
 * never a record's content), which records they were read as, whom they
 * named, what was decided and by which slot, how long it took, how it
 * ended (previewed, accepted, declined, undone, abandoned), and what the
 * person thought of it (👍, 👎 and "what should it have done?").
 *
 * Kept, tellings are what the app learns from: one that worked is offered
 * again where somebody types something like it (`similarTellings`), and
 * given to Jev and the light model as an example of what this app's people
 * mean (`tellingExamples`); an owner sees them all in the Studio, marks a
 * good one, excludes a bad one, deletes any (`toldTeachingWords` says how
 * many teach).
 *
 * Who sees what: a telling is read back only by somebody who may see every
 * record it names (`toldSeenBy`); a person reads their own, and somebody
 * else's only once `minPeople` people (2 unsaid) have told the app the same
 * kind of thing and it worked (`toldFor`) — the rule `@graview/core/learn`
 * holds. A visitor is never recorded.
 *
 * Core keeps no storage of it: `memoryTold` here, `fileTold` (`told.json`
 * beside the store, as `graview serve` and the dev server keep it) and the
 * wire's door in `@graview/ship`, a host's own anywhere. A page reaches the
 * host's through `HostAi.told` — `toldOver(url)` for a served one. Its own
 * entry, because a page draws nothing with it: the answer card that records
 * a telling and the Studio that lists them are fetched when opened.
 */
import type { Author } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";

// ── the shape ───────────────────────────────────────────────────────────────

/** How a telling ended: still on the card, taken (Yes, Take, Accept), set aside (No, Dismiss), taken back, or closed with nothing done. */
export const TELLING_OUTCOMES = ["previewed", "accepted", "declined", "undone", "abandoned"] as const;
export type TellingOutcome = (typeof TELLING_OUTCOMES)[number];

/** Which slot decided it: the graph by the Fast slot (Jev), the light model, or the full one. */
export const TELLING_SLOTS = ["graph", "light", "full"] as const;
export type TellingSlot = (typeof TELLING_SLOTS)[number];

/** What a person thought of it. */
export type TellingRating = "up" | "down";

/** What was decided: one act over N records, a plan of N edits to the app, an open answer, or nothing it could do. */
export type TellingDecided =
  | { readonly type: "act"; readonly act: string; readonly records: number }
  | { readonly type: "plan"; readonly edits: number }
  | { readonly type: "answer" }
  | { readonly type: "refusal" }
  /** A section of a worker view revised ("Make this better", Roadmap f-make-this-section-better), by the section's name. */
  | { readonly type: "view"; readonly section: string };

/** What the words were said on: the target's own kind and id, or the place. Never a record's content. */
export interface TellingTarget {
  readonly on: "record" | "field" | "selection" | "list" | "lens" | "place" | "act";
  readonly kind?: string;
  readonly id?: string;
  readonly place?: string;
}

/** Which records the words were read as: the target itself or the records it holds, by id. */
export interface TellingReading {
  readonly which: "itself" | "held";
  readonly kind: string;
  readonly records: readonly string[];
}

/** One stage, timed. */
export interface TellingStage {
  readonly stage: string;
  readonly ms: number;
  readonly model?: string;
}

export interface Telling {
  readonly id: string;
  /** When it was told, ISO. */
  readonly at: string;
  /** Who told it: the seat's kind and id, and whom an agent acted for. */
  readonly by: Author;
  /** The person's own words, as typed. */
  readonly words: string;
  readonly target: TellingTarget;
  readonly reading?: TellingReading;
  /** The records the words named as people ("Sam", "her"), resolved, by id. */
  readonly people?: readonly string[];
  readonly decided: TellingDecided;
  readonly slot?: TellingSlot;
  readonly stages?: readonly TellingStage[];
  /** How long it took from Enter to the answer, in milliseconds. */
  readonly ms?: number;
  readonly outcome: TellingOutcome;
  readonly rating?: TellingRating;
  /** What the person said it should have done, with a 👎. */
  readonly should?: string;
  /** The first telling of the card's conversation: its own id when it began one. */
  readonly conversation: string;
  /** The telling this one replies to on the same card. */
  readonly follows?: string;
  /** The AI interaction it answered as (`AiInteraction.id`, `@graview/core/catalog`). */
  readonly interaction?: string;
  /** The tellings given to the slots as examples, or the one a suggestion was taken from. */
  readonly examples?: readonly string[];
  /** An owner marked it a good example: ranked first among the like. */
  readonly pinned?: boolean;
  /** An owner excluded it: never suggested, never an example. */
  readonly excluded?: boolean;
}

/** What a page hands the door: everything but who and when, which the door stamps. */
export type TellingDraft = Omit<Telling, "id" | "at" | "by" | "conversation"> & { readonly id?: string; readonly conversation?: string };

/** What may change on a kept telling: how it ended and how it was rated by its teller; pinned and excluded by an owner. */
export interface TellingChange {
  readonly outcome?: TellingOutcome;
  readonly rating?: TellingRating | null;
  readonly should?: string | null;
  readonly examples?: readonly string[];
  readonly pinned?: boolean;
  readonly excluded?: boolean;
}

/** The caps on what a telling keeps. */
export const TOLD_LIMITS = { words: 300, should: 300, name: 80, records: 200, people: 20, stages: 8, examples: 5 } as const;

/** How long a host keeps tellings when it says nothing: a year. */
export const TOLD_RETENTION_DAYS = 365;
/** The most a kept list holds, oldest let go first. */
export const TOLD_KEPT_MOST = 5000;

// eslint-disable-next-line no-control-regex
const UNSEEN = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]", "g");

/** Text as data: control characters gone, whitespace folded, cut to `max`. Empty is nothing. */
function textOf(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(UNSEEN, " ").replace(/\s+/g, " ").trim();
  return clean.length === 0 ? undefined : clean.slice(0, max).trimEnd();
}

/** A declared name or a record's id: letters, digits, `-`, `_`, `.`, `:` and `/`, or nothing. */
function nameOf(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= TOLD_LIMITS.name && /^[\p{L}\p{N}_][\p{L}\p{N}_.:/-]*$/u.test(value) ? value : undefined;
}

const namesOf = (value: unknown, most: number): readonly string[] => (Array.isArray(value) ? [...new Set(value.flatMap((one) => nameOf(one) ?? []))].slice(0, most) : []);

/** Who, as a telling keeps them: the kind and id, and whom an agent acted for — no session, no name. */
function whoOf(author: Author): Author {
  const id = typeof author.id === "string" ? author.id.slice(0, TOLD_LIMITS.name) : undefined;
  return { kind: author.kind, ...(id !== undefined ? { id } : {}), ...(author.onBehalfOf ? { onBehalfOf: whoOf(author.onBehalfOf) } : {}) };
}

/** A visitor — who never joined, answering a form — or an agent acting for one. */
const isVisitor = (author: Author | undefined): boolean => author?.kind === "visitor" || author?.onBehalfOf?.kind === "visitor";

/** A fresh telling id. */
export const tellingId = (): string => `tl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const TARGETS = new Set<string>(["record", "field", "selection", "list", "lens", "place", "act"]);

function decidedOf(value: unknown): TellingDecided | undefined {
  const asked = value as Record<string, unknown> | undefined;
  const count = (one: unknown) => (typeof one === "number" && Number.isFinite(one) && one >= 0 ? Math.min(10_000, Math.round(one)) : 0);
  switch (asked?.["type"]) {
    case "act": {
      const act = nameOf(asked["act"]);
      return act ? { type: "act", act, records: count(asked["records"]) } : undefined;
    }
    case "plan":
      return { type: "plan", edits: count(asked["edits"]) };
    case "answer":
      return { type: "answer" };
    case "refusal":
      return { type: "refusal" };
    case "view": {
      const section = typeof asked["section"] === "string" ? asked["section"].replace(/\s+/g, " ").trim().slice(0, TOLD_LIMITS.name) : "";
      return section ? { type: "view", section } : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * A DRAFT, KEPT AS A TELLING: its words bounded, its names and ids checked,
 * stamped with an id, a time and its author — the door's, never the
 * draft's. Undefined for a visitor and for a draft with no words or no
 * decision.
 */
export function tellingOf(draft: TellingDraft, by: Author, options: { readonly at?: string; readonly id?: string } = {}): Telling | undefined {
  if (!draft || typeof draft !== "object" || !by || isVisitor(by)) return undefined;
  const asked = draft as unknown as Record<string, unknown>;
  const words = textOf(asked["words"], TOLD_LIMITS.words);
  const decided = decidedOf(asked["decided"]);
  const targetAsked = asked["target"] as Record<string, unknown> | undefined;
  if (!words || !decided || !targetAsked || !TARGETS.has(String(targetAsked["on"]))) return undefined;
  const target: TellingTarget = {
    on: targetAsked["on"] as TellingTarget["on"],
    ...(nameOf(targetAsked["kind"]) ? { kind: nameOf(targetAsked["kind"])! } : {}),
    ...(nameOf(targetAsked["id"]) ? { id: nameOf(targetAsked["id"])! } : {}),
    ...(nameOf(targetAsked["place"]) ? { place: nameOf(targetAsked["place"])! } : {}),
  };
  const readingAsked = asked["reading"] as Record<string, unknown> | undefined;
  const reading: TellingReading | undefined =
    readingAsked && (readingAsked["which"] === "itself" || readingAsked["which"] === "held") && nameOf(readingAsked["kind"])
      ? { which: readingAsked["which"], kind: nameOf(readingAsked["kind"])!, records: namesOf(readingAsked["records"], TOLD_LIMITS.records) }
      : undefined;
  const people = namesOf(asked["people"], TOLD_LIMITS.people);
  const stages = Array.isArray(asked["stages"])
    ? (asked["stages"] as unknown[]).flatMap((one) => {
        const stage = one as Record<string, unknown>;
        const name = nameOf(stage?.["stage"]);
        const ms = stage?.["ms"];
        return name && typeof ms === "number" && Number.isFinite(ms) && ms >= 0 ? [{ stage: name, ms: Math.round(ms), ...(nameOf(stage["model"]) ? { model: nameOf(stage["model"])! } : {}) }] : [];
      }).slice(0, TOLD_LIMITS.stages)
    : [];
  const outcome = (TELLING_OUTCOMES as readonly unknown[]).includes(asked["outcome"]) ? (asked["outcome"] as TellingOutcome) : "previewed";
  const slot = (TELLING_SLOTS as readonly unknown[]).includes(asked["slot"]) ? (asked["slot"] as TellingSlot) : undefined;
  const rating = asked["rating"] === "up" || asked["rating"] === "down" ? (asked["rating"] as TellingRating) : undefined;
  const should = rating === "down" ? textOf(asked["should"], TOLD_LIMITS.should) : undefined;
  const ms = typeof asked["ms"] === "number" && Number.isFinite(asked["ms"]) && asked["ms"] >= 0 ? Math.round(asked["ms"]) : undefined;
  const id = options.id ?? nameOf(asked["id"]) ?? tellingId();
  const conversation = nameOf(asked["conversation"]) ?? id;
  const follows = nameOf(asked["follows"]);
  const interaction = nameOf(asked["interaction"]);
  const examples = namesOf(asked["examples"], TOLD_LIMITS.examples);
  return {
    id,
    at: options.at ?? new Date().toISOString(),
    by: whoOf(by),
    words,
    target,
    ...(reading ? { reading } : {}),
    ...(people.length > 0 ? { people } : {}),
    decided,
    ...(slot ? { slot } : {}),
    ...(stages.length > 0 ? { stages } : {}),
    ...(ms !== undefined ? { ms } : {}),
    outcome,
    ...(rating ? { rating } : {}),
    ...(should ? { should } : {}),
    conversation,
    ...(follows ? { follows } : {}),
    ...(interaction ? { interaction } : {}),
    ...(examples.length > 0 ? { examples } : {}),
  };
}

/** The change a teller may make (outcome, rating, what it should have done, examples) and an owner may make (pinned, excluded), checked. */
export function tellingChange(asked: unknown): TellingChange | undefined {
  if (!asked || typeof asked !== "object") return undefined;
  const one = asked as Record<string, unknown>;
  const change: Record<string, unknown> = {};
  if ((TELLING_OUTCOMES as readonly unknown[]).includes(one["outcome"])) change["outcome"] = one["outcome"];
  if (one["rating"] === "up" || one["rating"] === "down" || one["rating"] === null) change["rating"] = one["rating"];
  if (one["should"] === null) change["should"] = null;
  else if (textOf(one["should"], TOLD_LIMITS.should)) change["should"] = textOf(one["should"], TOLD_LIMITS.should);
  if (Array.isArray(one["examples"])) change["examples"] = namesOf(one["examples"], TOLD_LIMITS.examples);
  if (typeof one["pinned"] === "boolean") change["pinned"] = one["pinned"];
  if (typeof one["excluded"] === "boolean") change["excluded"] = one["excluded"];
  return Object.keys(change).length > 0 ? (change as TellingChange) : undefined;
}

/** Whether a change is only an owner's to make: pinning and excluding. */
export const curatesOnly = (change: TellingChange): boolean => change.pinned !== undefined || change.excluded !== undefined;
/** Whether a change is only its teller's to make: how it ended, how it was rated, what it should have done. */
export const tellsOnly = (change: TellingChange): boolean => change.outcome !== undefined || change.rating !== undefined || change.should !== undefined || change.examples !== undefined;

/**
 * A TELLING CHANGED. An outcome never goes back to "previewed", and once a
 * telling was accepted it ends only as undone: a card closed after its Yes
 * did not abandon it. A rating taken away takes its "should" with it; a 👍
 * keeps none.
 */
export function changedTelling(telling: Telling, change: TellingChange): Telling {
  const outcome =
    change.outcome === undefined || change.outcome === "previewed"
      ? telling.outcome
      : telling.outcome === "accepted" && change.outcome !== "undone"
        ? telling.outcome
        : telling.outcome === "undone" || ((telling.outcome === "declined" || telling.outcome === "abandoned") && change.outcome === "abandoned")
          ? telling.outcome
          : change.outcome;
  const rating = change.rating === undefined ? telling.rating : change.rating ?? undefined;
  const should = rating !== "down" ? undefined : change.should === undefined ? telling.should : change.should ?? undefined;
  const { rating: _rating, should: _should, ...rest } = telling;
  return {
    ...rest,
    outcome,
    ...(rating ? { rating } : {}),
    ...(should ? { should } : {}),
    ...(change.examples ? { examples: change.examples } : {}),
    ...(change.pinned !== undefined ? { pinned: change.pinned } : {}),
    ...(change.excluded !== undefined ? { excluded: change.excluded } : {}),
  };
}

// ── keeping it ──────────────────────────────────────────────────────────────

/**
 * WHERE A HOST KEEPS TELLINGS: add one, change one, remove one, list them.
 * `memoryTold` here; `fileTold` (`told.json` beside the store) and the
 * wire's door in `@graview/ship`; `toldOver(url)` for a page; a host's own
 * anywhere. Handed to a page as `HostAi.told`.
 */
export interface ToldStore {
  add(telling: Telling): void | Promise<void>;
  change(id: string, change: TellingChange): void | Promise<void>;
  remove(id: string): void | Promise<void>;
  list(): readonly Telling[] | Promise<readonly Telling[]>;
}

/** A store that answers at once: memory, a file. */
export interface HeldTold extends ToldStore {
  add(telling: Telling): void;
  change(id: string, change: TellingChange): void;
  remove(id: string): void;
  list(): readonly Telling[];
}

/** What a store keeps: within the retention, at most `most`, oldest let go first, one per id (the later kept). */
export function keptTold(tellings: readonly Telling[], options: { readonly retentionDays?: number; readonly most?: number; readonly now?: number } = {}): readonly Telling[] {
  const since = (options.now ?? Date.now()) - (options.retentionDays ?? TOLD_RETENTION_DAYS) * 86_400_000;
  const byId = new Map<string, Telling>();
  for (const telling of tellings) {
    const time = Date.parse(telling.at);
    if (Number.isFinite(time) && time >= since && !isVisitor(telling.by)) byId.set(telling.id, telling);
  }
  const kept = [...byId.values()];
  const most = options.most ?? TOLD_KEPT_MOST;
  return kept.length > most ? kept.slice(kept.length - most) : kept;
}

/** The tellings after one is added, changed or removed: what every held store does. */
export function toldAfter(tellings: readonly Telling[], step: { readonly add: Telling } | { readonly change: string; readonly with: TellingChange } | { readonly remove: string }, options: { readonly retentionDays?: number; readonly most?: number } = {}): readonly Telling[] {
  if ("add" in step) return keptTold([...tellings, step.add], options);
  if ("remove" in step) return tellings.filter((one) => one.id !== step.remove);
  return tellings.map((one) => (one.id === step.change ? changedTelling(one, step.with) : one));
}

/** Tellings kept in memory for as long as the process (or the page) runs. */
export function memoryTold(options: { readonly retentionDays?: number; readonly most?: number } = {}): HeldTold {
  let held: readonly Telling[] = [];
  return {
    add: (telling) => void (held = toldAfter(held, { add: telling }, options)),
    change: (id, change) => void (held = toldAfter(held, { change: id, with: change })),
    remove: (id) => void (held = toldAfter(held, { remove: id })),
    list: () => keptTold(held, options),
  };
}

/** The wire's path: `graview serve` answers it, and `toldOver` asks it. */
export const TOLD_PATH = "/graview/told";

/**
 * A PAGE'S DOOR TO A SERVED HOST'S TELLINGS: `POST` one, `PATCH <id>` a
 * change, `DELETE <id>`, `GET` what the asker may read. The server says who,
 * from the session; nothing is awaited by whoever recorded; a host that
 * keeps none (404, 410) is never asked again. `url` is the store's address
 * (`TOLD_PATH` is added) or, with `path`, the door's own.
 */
export function toldOver(url: string, options: { readonly headers?: Readonly<Record<string, string>>; readonly fetch?: typeof fetch; readonly path?: string } = {}): ToldStore {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const at = `${url.replace(/\/$/, "")}${options.path ?? TOLD_PATH}`;
  const headers = { "content-type": "application/json", ...options.headers };
  let closed = false;
  const send = async (path: string, method: string, body?: unknown): Promise<void> => {
    if (closed) return;
    try {
      const answer = await doFetch(`${at}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (answer.status === 404 || answer.status === 410) closed = true;
    } catch {
      // Keeping a telling is never why a page fails.
    }
  };
  return {
    add: (telling) => send("", "POST", { telling }),
    change: (id, change) => send(`/${encodeURIComponent(id)}`, "PATCH", { change }),
    remove: (id) => send(`/${encodeURIComponent(id)}`, "DELETE"),
    async list() {
      if (closed) return [];
      try {
        const answer = await doFetch(at, { headers });
        if (answer.status === 404 || answer.status === 410) closed = true;
        if (!answer.ok) return [];
        return ((await answer.json()) as { tellings?: Telling[] }).tellings ?? [];
      } catch {
        return [];
      }
    },
  };
}

// ── reading it back ─────────────────────────────────────────────────────────

/** The person a telling is of: whom an agent acted for, else the author. */
const personOf = (author: Author): string => (author.onBehalfOf ? personOf(author.onBehalfOf) : author.id !== undefined ? `${author.kind}:${author.id}` : `${author.kind}:?`);

/** Every record a telling names: its target, the records it was read as, the people. */
export const recordsOfTelling = (telling: Telling): readonly string[] => [...new Set([...(telling.target.id ? [telling.target.id] : []), ...(telling.reading?.records ?? []), ...(telling.people ?? [])])];

/**
 * WHAT A VIEWER MAY READ BACK: a telling about a record they may not see is
 * hidden from them whole — its words would say what is there. `sees` is the
 * viewer's sight (`seesId(store, principal)`).
 */
export function toldSeenBy(tellings: readonly Telling[], sees: (id: string) => boolean): readonly Telling[] {
  return tellings.filter((telling) => recordsOfTelling(telling).every(sees));
}

/** A person's own tellings, and an agent's acting for them. A seat with no id has none. */
export function ownTold(tellings: readonly Telling[], principal: Principal): readonly Telling[] {
  if (principal.id === undefined && principal.onBehalfOf?.id === undefined) return [];
  const me = personOf(principal);
  return tellings.filter((telling) => personOf(telling.by) === me);
}

/** Whether a telling worked: accepted or 👍, never 👎, never excluded, never undone. */
export const tellingWorked = (telling: Telling): boolean => !telling.excluded && telling.rating !== "down" && telling.outcome !== "undone" && (telling.outcome === "accepted" || telling.rating === "up");

/** What a telling teaches: the act and the kind it was over, or the plan's kind — the same thing told, by whoever. */
const lessonOf = (telling: Telling): string | undefined => {
  const kind = telling.reading?.kind ?? telling.target.kind ?? "";
  return telling.decided.type === "act" ? `act:${telling.decided.act}:${kind}:${telling.reading?.which ?? ""}` : telling.decided.type === "plan" ? `plan:${kind}` : undefined;
};

/**
 * THE LESSONS ENOUGH PEOPLE AGREE ON: each act-over-a-kind (or plan on a
 * kind) that worked for at least `minPeople` distinct people other than
 * the reader. Only these of other people's tellings are ever suggested.
 */
export function agreedLessons(tellings: readonly Telling[], options: { readonly reader?: Principal; readonly minPeople?: number } = {}): ReadonlySet<string> {
  const minPeople = Math.max(1, options.minPeople ?? 2);
  const reader = options.reader ? personOf(options.reader) : undefined;
  const people = new Map<string, Set<string>>();
  for (const telling of tellings) {
    const lesson = lessonOf(telling);
    if (!lesson || !tellingWorked(telling) || personOf(telling.by) === reader) continue;
    people.set(lesson, (people.get(lesson) ?? new Set()).add(personOf(telling.by)));
  }
  return new Set([...people].filter(([, who]) => who.size >= minPeople).map(([lesson]) => lesson));
}

/**
 * WHAT A READER IS SERVED: everything, for an owner (`curator`); else their
 * own, and of other people's only those that worked in a lesson enough
 * people agree on (`agreedLessons`) — so one person's words are never shown
 * to another until others told the app the same. Sight is `toldSeenBy`'s.
 */
export function toldFor(tellings: readonly Telling[], reader: Principal, options: { readonly minPeople?: number; readonly curator?: boolean } = {}): readonly Telling[] {
  if (options.curator) return tellings;
  const me = personOf(reader);
  const agreed = agreedLessons(tellings, { reader, ...(options.minPeople !== undefined ? { minPeople: options.minPeople } : {}) });
  return tellings.filter((telling) => (reader.id !== undefined && personOf(telling.by) === me) || (tellingWorked(telling) && agreed.has(lessonOf(telling) ?? "")));
}

/** What the Studio filters by: a rating (or none), an outcome, a kind. */
export interface ToldFilter {
  readonly rating?: TellingRating | "none";
  readonly outcome?: TellingOutcome;
  readonly kind?: string;
}

export function toldMatching(tellings: readonly Telling[], filter: ToldFilter): readonly Telling[] {
  return tellings.filter(
    (telling) =>
      (filter.rating === undefined || (filter.rating === "none" ? telling.rating === undefined : telling.rating === filter.rating)) &&
      (filter.outcome === undefined || telling.outcome === filter.outcome) &&
      (filter.kind === undefined || (telling.reading?.kind ?? telling.target.kind) === filter.kind),
  );
}

/** The tellings that teach: those that worked, act or plan, not excluded. */
export const teachingTold = (tellings: readonly Telling[]): readonly Telling[] => tellings.filter((telling) => tellingWorked(telling) && lessonOf(telling) !== undefined);

/** What is teaching the system, in a sentence: "Suggestions come from 23 rated tellings in this app." */
export function toldTeachingWords(tellings: readonly Telling[]): string {
  const count = teachingTold(tellings).length;
  return count === 0 ? "Nothing told here teaches suggestions yet: a telling that is accepted or rated 👍 will." : `Suggestions come from ${count} rated ${count === 1 ? "telling" : "tellings"} in this app.`;
}

/** What a telling did, in words: "An act over 6 records", "A plan of 3 changes", "An open answer", "Nothing it could do". */
export function tellingDidWords(telling: Telling, titleOf: (act: string) => string = (act) => act): string {
  switch (telling.decided.type) {
    case "act":
      return `${titleOf(telling.decided.act)}, over ${telling.decided.records} ${telling.decided.records === 1 ? "record" : "records"}`;
    case "plan":
      return `A plan of ${telling.decided.edits} ${telling.decided.edits === 1 ? "change" : "changes"} to the app`;
    case "answer":
      return "An open answer";
    case "refusal":
      return "Nothing it could do";
    case "view":
      return `A revision of “${telling.decided.section}”`;
  }
}

/** How a telling ended, in words. */
export const TELLING_OUTCOME_WORDS: Readonly<Record<TellingOutcome, string>> = { previewed: "Previewed", accepted: "Accepted", declined: "Declined", undone: "Undone", abandoned: "Closed with nothing done" };

// ── like ones ───────────────────────────────────────────────────────────────

/** Words too common to tell two tellings apart. */
const STOP = new Set("a an and are as at be by can do does for from has have how i in is it its me my of on or our please the their them these they this those to was we what when where which who why will with you your all each every".split(" "));

/** Words as they are compared: lower case, no accents, a plural's `s` gone, the common ones out. */
export function tellingWordsOf(words: string): readonly string[] {
  return [
    ...new Set(
      words
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 1 && !STOP.has(word))
        .map((word) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word)),
    ),
  ];
}

/** What a telling is like: the words typed, the kind they are on, the act wanted, if known. */
export interface TellingLike {
  readonly words: string;
  readonly kind?: string;
  readonly act?: string;
}

export interface SimilarTelling {
  readonly telling: Telling;
  /** How alike, 0–1: the words' overlap, the kind and the act. */
  readonly score: number;
}

/**
 * TELLINGS LIKE THESE WORDS THAT WORKED: accepted or 👍, never excluded,
 * never 👎, never undone, ranked by how alike their words are (by the words'
 * overlap, a typed word that begins one of theirs counting), the same kind
 * and the same act — an owner's pinned first among equals. Cheap and local:
 * no model. Another person's is offered only where `minPeople` people agree
 * (`agreedLessons`); the reader's own always. One per lesson, so two
 * suggestions say two things.
 */
export function similarTellings(tellings: readonly Telling[], like: TellingLike, options: { readonly reader?: Principal; readonly minPeople?: number; readonly most?: number; readonly floor?: number; readonly rated?: boolean } = {}): readonly SimilarTelling[] {
  const typed = tellingWordsOf(like.words);
  if (typed.length === 0) return [];
  const reader = options.reader ? personOf(options.reader) : undefined;
  const agreed = agreedLessons(tellings, { ...(options.reader ? { reader: options.reader } : {}), ...(options.minPeople !== undefined ? { minPeople: options.minPeople } : {}) });
  const scored = tellings.flatMap((telling) => {
    const lesson = lessonOf(telling);
    if (!lesson || !tellingWorked(telling) || (options.rated && telling.rating !== "up")) return [];
    const own = reader !== undefined && personOf(telling.by) === reader;
    if (!own && !agreed.has(lesson)) return [];
    const theirs = tellingWordsOf(telling.words);
    const shared = typed.filter((word) => theirs.some((one) => one === word || (word.length >= 3 && one.startsWith(word)))).length;
    if (shared === 0) return [];
    const words = shared / new Set([...typed, ...theirs]).size;
    // The same kind it was said on (a list), or the kind it was over (its tasks).
    const kind = like.kind !== undefined && (telling.target.kind === like.kind || telling.reading?.kind === like.kind) ? 0.25 : like.kind !== undefined ? -0.25 : 0;
    const act = like.act !== undefined && telling.decided.type === "act" && telling.decided.act === like.act ? 0.15 : 0;
    const score = Math.max(0, Math.min(1, words * 0.6 + 0.25 + kind + act + (telling.pinned ? 0.1 : 0)));
    return score >= (options.floor ?? 0.35) ? [{ telling, score, lesson }] : [];
  });
  scored.sort((a, b) => b.score - a.score || Number(b.telling.pinned ?? false) - Number(a.telling.pinned ?? false) || (a.telling.at < b.telling.at ? 1 : -1));
  const seen = new Set<string>();
  const out: SimilarTelling[] = [];
  for (const one of scored) {
    if (seen.has(one.lesson)) continue;
    seen.add(one.lesson);
    out.push({ telling: one.telling, score: one.score });
    if (out.length >= (options.most ?? 2)) break;
  }
  return out;
}

/** An example a slot is given: what was said and what was done, by name — no ids, no record's content. */
export interface TellingExample {
  readonly said: string;
  readonly did: string;
  readonly reading?: "itself" | "held";
}

/** The like tellings that worked, as the Fast slot and the light model are given them. */
export function tellingExamples(similar: readonly SimilarTelling[]): readonly TellingExample[] {
  return similar.map(({ telling }) => ({
    said: telling.words,
    did: telling.decided.type === "act" ? `act ${telling.decided.act} over ${telling.reading?.which === "itself" ? "the record itself" : "each record it holds"}` : telling.decided.type === "plan" ? "a plan that changes the app" : telling.decided.type === "view" ? "a revision of a view's section" : telling.decided.type,
    ...(telling.reading ? { reading: telling.reading.which } : {}),
  }));
}
