/**
 * `@graview/core/friction` — WHAT PEOPLE LOOKED FOR AND COULD NOT DO
 * (Roadmap f-friction-log).
 *
 * The op log records every change, with its author and lineage; an AI
 * interaction keeps its outcome (`@graview/core/catalog`); a declined
 * suggestion is remembered (`@graview/core/tidying`). What none of them
 * records is what happened BEFORE a change, or instead of one: the words
 * somebody searched for and found nothing, the question the seat could not
 * answer, the act that was refused, the tool call an agent got wrong and
 * the form that worked after it. This is that record, in the graph's own
 * words — kinds, acts, refusal codes, the words people typed — never
 * clicks or selectors.
 *
 * A visitor (a person answering a form, who never joined the app) is never
 * recorded. Free text is bounded and kept as data. What anybody but the
 * person reads is counted across DISTINCT people (`frictionOf`), never who,
 * and words fewer than `minPeople` people used are not said at all; a
 * person reads their own (`ownFriction`); a model is told a short digest
 * (`frictionDigest`, `aiContextOf`'s `friction`) with no refusal's sentence
 * in it. `withinRetention` lets the old go.
 *
 * Core keeps no storage of it: `memoryFriction` here, a file beside the
 * store and a browser's storage in `@graview/ship`, a host's own anywhere.
 * Its own entry, because a page draws nothing with it; what a page records
 * through is `recordFriction` on the main entry, a weak map and a check.
 */
import { isVisitorAuthor, type FrictionDraft, type FrictionSink } from "./friction-record.js";
import type { Author } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";
import { REFUSAL_REASONS, type RefusalReason } from "./refused.js";
import { humanizeField, nounOf, pluralOf } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";

// The door a page records through is the main entry's (`recordFriction`, `attachFriction`, `isVisitorAuthor`): a page carries it up front, and nothing else of this.
export type { FrictionDraft, FrictionSink };

// ── the events ──────────────────────────────────────────────────────────────

export const FRICTION_TYPES = ["search-miss", "unanswered", "refused", "tool-invalid"] as const;
export type FrictionType = (typeof FRICTION_TYPES)[number];

/** Every event: an id, when, who (the seat's kind and id, and whom an agent acted for), and the kind it was about. */
export interface FrictionBase {
  readonly id: string;
  readonly at: string;
  readonly by: Author;
  readonly kind?: string;
}
export interface SearchMiss extends FrictionBase {
  readonly type: "search-miss";
  readonly words: string;
}
export interface Unanswered extends FrictionBase {
  readonly type: "unanswered";
  readonly question: string;
  readonly place?: string;
}
export interface RefusedAct extends FrictionBase {
  readonly type: "refused";
  readonly act: string;
  readonly code: RefusalReason;
}
export interface ToolInvalid extends FrictionBase {
  readonly type: "tool-invalid";
  readonly tool: string;
  readonly act?: string;
  readonly message: string;
  /** The form of the next call of the same tool that worked (`callShape`): argument names and types, never values. */
  readonly then?: string;
}
export type FrictionEvent = SearchMiss | Unanswered | RefusedAct | ToolInvalid;

/** The caps on what an event keeps: text is cut to these, and a name longer than `name` is no name. */
export const FRICTION_LIMITS = { words: 120, question: 300, message: 300, then: 300, name: 80 } as const;

/** How long a host keeps friction when it says nothing: ninety days. */
export const FRICTION_RETENTION_DAYS = 90;

/** Control characters, zero-width marks and direction overrides: nothing a person reads, something a reader could be fooled by. */
// eslint-disable-next-line no-control-regex
const UNSEEN = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]", "g");

/** Text as data: control characters gone, whitespace folded, cut to `max`. Empty is nothing. */
function textOf(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(UNSEEN, " ").replace(/\s+/g, " ").trim();
  return clean.length === 0 ? undefined : clean.slice(0, max).trimEnd();
}

/** A declared name (a kind, an act, a tool, a place): letters, digits, `-`, `_`, `.`, `:` and `/`, or nothing. */
function nameOf(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= FRICTION_LIMITS.name && /^[\p{L}\p{N}_][\p{L}\p{N}_.:/-]*$/u.test(value) ? value : undefined;
}

/** Who, as an event keeps them: the kind and id, and whom an agent acted for — no session, no name. */
function whoOf(author: Author): Author {
  const id = typeof author.id === "string" ? author.id.slice(0, FRICTION_LIMITS.name) : undefined;
  return {
    kind: author.kind,
    ...(id !== undefined ? { id } : {}),
    ...(author.onBehalfOf ? { onBehalfOf: whoOf(author.onBehalfOf) } : {}),
  };
}

const freshId = (): string => `fr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * A DRAFT, KEPT AS AN EVENT: its text bounded, its names checked, stamped
 * with an id, a time and its author. Undefined for a visitor (or an agent
 * acting for one) and for a draft that is not one of the four.
 */
export function frictionEvent(draft: FrictionDraft, by: Author, options: { readonly at?: string; readonly id?: string } = {}): FrictionEvent | undefined {
  if (!draft || typeof draft !== "object" || !by || isVisitorAuthor(by)) return undefined;
  const asked = draft as Record<string, unknown>;
  const kind = asked["kind"] === undefined ? undefined : nameOf(asked["kind"]);
  if (asked["kind"] !== undefined && kind === undefined) return undefined;
  const base = { id: options.id ?? freshId(), at: options.at ?? new Date().toISOString(), by: whoOf(by), ...(kind ? { kind } : {}) };
  switch (asked["type"]) {
    case "search-miss": {
      const words = textOf(asked["words"], FRICTION_LIMITS.words);
      return words ? { ...base, type: "search-miss", words } : undefined;
    }
    case "unanswered": {
      const question = textOf(asked["question"], FRICTION_LIMITS.question);
      const place = asked["place"] === undefined ? undefined : nameOf(asked["place"]);
      return question ? { ...base, type: "unanswered", question, ...(place ? { place } : {}) } : undefined;
    }
    case "refused": {
      const act = nameOf(asked["act"]);
      const code = asked["code"];
      return act && (REFUSAL_REASONS as readonly unknown[]).includes(code) ? { ...base, type: "refused", act, code: code as RefusalReason } : undefined;
    }
    case "tool-invalid": {
      const tool = nameOf(asked["tool"]);
      const message = textOf(asked["message"], FRICTION_LIMITS.message);
      const act = asked["act"] === undefined ? undefined : nameOf(asked["act"]);
      const then = textOf(asked["then"], FRICTION_LIMITS.then);
      return tool && message ? { ...base, type: "tool-invalid", tool, message, ...(act ? { act } : {}), ...(then ? { then } : {}) } : undefined;
    }
    default:
      return undefined;
  }
}

// ── keeping it ──────────────────────────────────────────────────────────────

/**
 * WHERE A HOST KEEPS FRICTION: append and read back. `memoryFriction` here;
 * `fileFriction` (a file beside the store) and `browserFriction` (a
 * browser's storage) in `@graview/ship`; a host's own anywhere.
 */
export interface FrictionStore {
  add(event: FrictionEvent): void | Promise<void>;
  list(): readonly FrictionEvent[] | Promise<readonly FrictionEvent[]>;
}

/** A store that answers at once: memory, a file, a browser's storage. */
export interface HeldFriction extends FrictionStore {
  add(event: FrictionEvent): void;
  list(): readonly FrictionEvent[];
}

/** What a kept log holds at most, oldest let go first. */
export const FRICTION_KEPT_MOST = 5000;

/** What a store keeps after an event: within the retention, at most `most`, oldest let go first. */
export function keptFriction(events: readonly FrictionEvent[], options: { readonly retentionDays?: number; readonly most?: number; readonly now?: number } = {}): readonly FrictionEvent[] {
  const kept = withinRetention(events, options.retentionDays ?? FRICTION_RETENTION_DAYS, options.now);
  const most = options.most ?? FRICTION_KEPT_MOST;
  return kept.length > most ? kept.slice(kept.length - most) : kept;
}

/** Friction kept in memory for as long as the process runs. */
export function memoryFriction(options: { readonly retentionDays?: number; readonly most?: number } = {}): HeldFriction {
  let held: readonly FrictionEvent[] = [];
  return {
    add(event) {
      if (isVisitorAuthor(event.by)) return;
      held = keptFriction([...held, event], options);
    },
    list: () => keptFriction(held, options),
  };
}

/** A sink that keeps each draft in a `FrictionStore`, as `by` — or, unsaid, as `otherwise`. A visitor's never is. */
export function frictionSinkTo(store: FrictionStore, otherwise?: Author): FrictionSink {
  return (draft, by) => {
    const author = by ?? otherwise;
    const event = author ? frictionEvent(draft, author) : undefined;
    if (event) void store.add(event);
  };
}

/** The events within the last `days` days of `now`. */
export function withinRetention(events: readonly FrictionEvent[], days: number = FRICTION_RETENTION_DAYS, now: number = Date.now()): readonly FrictionEvent[] {
  const since = now - days * 86_400_000;
  return events.filter((event) => {
    const time = Date.parse(event.at);
    return Number.isFinite(time) && time >= since;
  });
}

// ── reading it ──────────────────────────────────────────────────────────────

/** The person an event is of: whom an agent acted for, else the author; a seat with no id is one anonymous person per kind. */
const personOf = (author: Author): string => (author.onBehalfOf ? personOf(author.onBehalfOf) : author.id !== undefined ? `${author.kind}:${author.id}` : `${author.kind}:?`);

/** Words as they are counted: lower case, whitespace folded, the punctuation at the ends gone. */
const foldWords = (words: string): string =>
  words
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "");

/** A person's own events — and an agent's acting for them. A seat with no id has none. */
export function ownFriction(events: readonly FrictionEvent[], principal: Principal): readonly FrictionEvent[] {
  if (principal.id === undefined && principal.onBehalfOf?.id === undefined) return [];
  const me = personOf(principal);
  return events.filter((event) => personOf(event.by) === me);
}

/** One thing counted: by how many distinct people, and how many times. */
export interface FrictionCount {
  readonly people: number;
  readonly times: number;
}

/**
 * WHAT PEOPLE COULD NOT DO, COUNTED — and never who. Each group is counted
 * across distinct people (an agent acting for somebody counts as them),
 * most people first; a group fewer than `minPeople` people share is left
 * out, so a word one person typed is never said to anybody else. Tool
 * mistakes say the tool, the act and the form that worked, never the
 * refusal's sentence.
 */
export interface FrictionSummary {
  readonly events: number;
  readonly people: number;
  readonly byType: Readonly<Record<FrictionType, { readonly events: number; readonly people: number }>>;
  readonly searches: readonly (FrictionCount & { readonly words: string })[];
  readonly questions: readonly (FrictionCount & { readonly question: string })[];
  readonly words: readonly (FrictionCount & { readonly word: string })[];
  readonly refusals: readonly (FrictionCount & { readonly act: string; readonly code: RefusalReason })[];
  readonly tools: readonly (FrictionCount & { readonly tool: string; readonly act?: string; readonly then?: string })[];
}

export interface FrictionOptions {
  /** The fewest distinct people a group is said for. 2 unsaid. */
  readonly minPeople?: number;
  /** The most groups of each list. 12 unsaid. */
  readonly most?: number;
  /**
   * Who the counts are said to. Their own events are left out before
   * anything is counted, so a group reaches `minPeople` only with that many
   * people OTHER than the reader: words a reader posts can never confirm
   * what one other person typed.
   */
  readonly reader?: Principal;
}

/** Words too common to say anything on their own. */
const STOP = new Set("a an and are at be by can do does for from has have how i in is it me my of on or our the their there this to was we what when where which who why will with you your".split(" "));

function grouped<T>(events: readonly FrictionEvent[], keyOf: (event: FrictionEvent) => string | undefined, make: (event: FrictionEvent, key: string) => T, minPeople: number, most: number): (T & FrictionCount)[] {
  const groups = new Map<string, { first: FrictionEvent; people: Set<string>; times: number; last: FrictionEvent }>();
  for (const event of events) {
    const key = keyOf(event);
    if (key === undefined) continue;
    const group = groups.get(key) ?? { first: event, people: new Set<string>(), times: 0, last: event };
    group.people.add(personOf(event.by));
    group.times += 1;
    group.last = event;
    groups.set(key, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.people.size >= minPeople)
    .sort(([a, one], [b, other]) => other.people.size - one.people.size || other.times - one.times || a.localeCompare(b))
    .slice(0, most)
    .map(([key, group]) => ({ ...make(group.last, key), people: group.people.size, times: group.times }));
}

export function frictionOf(events: readonly FrictionEvent[], options: FrictionOptions = {}): FrictionSummary {
  const minPeople = Math.max(1, options.minPeople ?? 2);
  const most = options.most ?? 12;
  const reader = options.reader ? personOf(options.reader) : undefined;
  const kept = events.filter((event) => !isVisitorAuthor(event.by) && (reader === undefined || personOf(event.by) !== reader));
  const byType = Object.fromEntries(
    FRICTION_TYPES.map((type) => {
      const of = kept.filter((event) => event.type === type);
      return [type, { events: of.length, people: new Set(of.map((event) => personOf(event.by))).size }];
    }),
  ) as Record<FrictionType, { readonly events: number; readonly people: number }>;
  // The words one at a time, from what was searched and asked, each said once per event.
  const tokens: FrictionEvent[] = [];
  const tokenOf = new Map<FrictionEvent, string>();
  for (const event of kept) {
    const text = event.type === "search-miss" ? event.words : event.type === "unanswered" ? event.question : undefined;
    if (text === undefined) continue;
    for (const word of new Set(foldWords(text).split(/[^\p{L}\p{N}]+/u))) {
      if (word.length < 3 || STOP.has(word)) continue;
      const one = { ...event, id: `${event.id}:${word}` } as FrictionEvent;
      tokens.push(one);
      tokenOf.set(one, word);
    }
  }
  return {
    events: kept.length,
    people: new Set(kept.map((event) => personOf(event.by))).size,
    byType,
    searches: grouped(kept, (event) => (event.type === "search-miss" ? foldWords(event.words) || undefined : undefined), (_event, words) => ({ words }), minPeople, most),
    questions: grouped(kept, (event) => (event.type === "unanswered" ? foldWords(event.question) || undefined : undefined), (_event, question) => ({ question }), minPeople, most),
    words: grouped(tokens, (event) => tokenOf.get(event), (_event, word) => ({ word }), minPeople, most),
    refusals: grouped(kept, (event) => (event.type === "refused" ? `${event.act}|${event.code}` : undefined), (event) => ({ act: (event as RefusedAct).act, code: (event as RefusedAct).code }), minPeople, most),
    tools: grouped(
      kept,
      (event) => (event.type === "tool-invalid" ? `${event.tool}|${event.act ?? ""}` : undefined),
      (event) => {
        const tool = event as ToolInvalid;
        return { tool: tool.tool, ...(tool.act ? { act: tool.act } : {}), ...(tool.then ? { then: tool.then } : {}) };
      },
      1,
      most,
    ),
  };
}

// ── a model's digest ────────────────────────────────────────────────────────

/**
 * WHAT A MODEL IS TOLD OF IT: the words people searched for that no kind,
 * noun, plural or field of the app is called, the questions left
 * unanswered, grouped, and the tool calls refused as invalid with the form
 * that worked after them — and `said`, the same in a few lines.
 */
export interface FrictionDigest {
  readonly said: string;
  readonly unknownWords: readonly { readonly words: string; readonly people: number }[];
  readonly questions: readonly { readonly question: string; readonly people: number }[];
  readonly toolMistakes: readonly { readonly tool: string; readonly act?: string; readonly then?: string; readonly times: number }[];
}

/** A word as it is compared with the app's names: lower case, a plural's `s` gone. */
const stem = (word: string): string => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);

/** Every word the app's kinds and fields are called by, their aliases among them. */
function namesOf(schema: AnySchema): ReadonlySet<string> {
  const names = new Set<string>();
  const add = (text: string) => {
    for (const word of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (word.length > 0) names.add(stem(word));
  };
  for (const kind of schema.kinds as readonly string[]) {
    const definition = schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> }; aliases?: readonly string[]; fieldAliases?: Readonly<Record<string, readonly string[]>> } | undefined;
    add(kind);
    add(nounOf(definition as never, kind));
    add(pluralOf(schema, kind));
    // And the other words the app answers to (Roadmap f-learned-suggestions): a word it took as an alias is no longer unknown.
    for (const alias of [...(definition?.aliases ?? []), ...Object.values(definition?.fieldAliases ?? {}).flat()]) add(alias);
    for (const field of Object.keys(definition?.fields?.shape ?? {})) {
      add(field);
      add(humanizeField(field));
    }
  }
  return names;
}

export function frictionDigest(events: readonly FrictionEvent[], schema: AnySchema, options: FrictionOptions = {}): FrictionDigest {
  const summary = frictionOf(events, { most: 8, ...options });
  const names = namesOf(schema);
  const unknownWords = summary.searches
    .filter((search) => !search.words.split(/[^\p{L}\p{N}]+/u).some((word) => word.length > 0 && names.has(stem(word))))
    .map((search) => ({ words: search.words, people: search.people }));
  const questions = summary.questions.map((question) => ({ question: question.question, people: question.people }));
  const toolMistakes = summary.tools.map((tool) => ({ tool: tool.tool, ...(tool.act ? { act: tool.act } : {}), ...(tool.then ? { then: tool.then } : {}), times: tool.times }));
  const people = (count: number) => `${count} ${count === 1 ? "person" : "people"}`;
  const lines = [
    ...(unknownWords.length > 0 ? [`Searched for, found nothing, and nothing here is called it: ${unknownWords.map((one) => `“${one.words}” (${people(one.people)})`).join(", ")}.`] : []),
    ...(questions.length > 0 ? [`Asked and not answered: ${questions.map((one) => `“${one.question}” (${people(one.people)})`).join(", ")}.`] : []),
    ...(toolMistakes.length > 0
      ? [`Tool calls refused as invalid: ${toolMistakes.map((one) => `${one.tool}${one.act ? ` (${one.act})` : ""} ${one.times === 1 ? "once" : `${one.times} times`}${one.then ? `, then worked as ${one.then}` : ""}`).join("; ")}.`]
      : []),
  ];
  return { said: lines.join("\n"), unknownWords, questions, toolMistakes };
}

// ── an agent's tool calls ───────────────────────────────────────────────────

/** A call's form: each argument's name and type, an object's one level in — never a value. "{ label: string, due: string }". */
export function callShape(args: Readonly<Record<string, unknown>>, depth = 0): string {
  const typeOf = (value: unknown): string =>
    value === null ? "null" : Array.isArray(value) ? "array" : typeof value === "object" ? (depth < 1 ? callShape(value as Record<string, unknown>, depth + 1) : "object") : typeof value;
  const parts = Object.keys(args)
    .filter((name) => args[name] !== undefined)
    .slice(0, 16)
    .map((name) => `${name.slice(0, 40)}: ${typeOf(args[name])}`);
  return (parts.length === 0 ? "{}" : `{ ${parts.join(", ")} }`).slice(0, FRICTION_LIMITS.then);
}

/** What became of one tool call, as `toolMistakes` hears it. */
export type ToolOutcome = { readonly ok: true } | { readonly ok: false; readonly reason?: string; readonly message: string };

/**
 * AN AGENT'S TOOL CALLS, WATCHED FOR MISTAKES IN THEIR FORM: a call refused
 * as `invalid` is held until the next call of the same tool — recorded with
 * that call's form as `then` when it worked, as it was when it too was
 * refused — and `flush` records what is still held. A refusal for any
 * other reason is not a mistake in the call's form, and is not recorded.
 */
export function toolMistakes(record: (draft: FrictionDraft) => void): {
  heard(tool: string, act: string | undefined, args: Readonly<Record<string, unknown>>, outcome: ToolOutcome): void;
  flush(): void;
} {
  const held = new Map<string, Extract<FrictionDraft, { type: "tool-invalid" }>>();
  const keep = (draft: FrictionDraft) => {
    try {
      record(draft);
    } catch {
      // Recording is never why a call fails.
    }
  };
  return {
    heard(tool, act, args, outcome) {
      const before = held.get(tool);
      if (outcome.ok) {
        if (before) {
          held.delete(tool);
          keep({ ...before, then: callShape(args) });
        }
        return;
      }
      if (outcome.reason !== "invalid") return;
      if (before) keep(before);
      held.set(tool, { type: "tool-invalid", tool, ...(act ? { act } : {}), message: outcome.message });
    },
    flush() {
      for (const draft of held.values()) keep(draft);
      held.clear();
    },
  };
}
