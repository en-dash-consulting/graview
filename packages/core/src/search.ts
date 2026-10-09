import { addressOf } from "./address.js";
import { arrangeable, asksForThePast, conditionHolds, type ArrangeContext, type ArrangeGraph, type Condition } from "./arrangement.js";
import { describeArg } from "./mutations/node-ref.js";
import type { Operation } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";
import { humanizeField, isCurrent, labelOf, readableFields, tellApart } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";
import type { AnyNodeDefinition } from "./schema/types.js";
import { hidesFrom, seesId } from "./seen.js";
import type { Store } from "./store.js";
import { placeSlug, type Place } from "./views/types.js";
import { capitalize } from "./capital.js";

/**
 * SEARCH IS ONE SEAM, and the graph is the result list.
 *
 * A person asks a picture of a domain four things — where is the thing
 * called X, where do I go for X, what can I do about X, what is X tied to —
 * and the framework answered pieces of each in different places with
 * different code: the list page's `?q=`, the inspector's searcher over acts,
 * the conversation's "a node named in the message", the arrangement's `q`.
 * This is the one matcher behind all of them. It is headless, derived from
 * the declaration (what `readableFields` would show is what is searchable;
 * `display.hide` is the opt-out), policy-honest (what a seat may not see is
 * not a hit) and not fuzzy: a typo is answered with nothing and the words
 * shown back, which is honest and cheap. See docs/search.md.
 */

/** How a hit matched, strongest first. */
export type MatchStrength = "exact" | "prefix" | "word" | "part" | "field";

/** Why a hit is shown: the field that matched and the words around the match. */
export interface Why {
  /** `label`, a field name, `plural`, `title` or `name`. */
  readonly field: string;
  /** The field as it reads: "Notes", "Name", "Title". */
  readonly reading: string;
  /** The matching text, cut to a window around the first match: "…the van on Friday…". */
  readonly fragment: string;
  readonly strength: MatchStrength;
}

export type Hit =
  | {
      readonly about: "node";
      readonly id: string;
      readonly kind: string;
      readonly label: string;
      readonly why: Why;
      /** False for a record its kind's lifecycle has retired; only seen under `is:any` or `is:past`. */
      readonly current: boolean;
      readonly flagged: boolean;
      /** What tells it apart from another hit of the same name — "single" beside "album". */
      readonly apart?: string;
      /**
       * Its record's path on the routed face, as the face's own record link
       * spells it — `/<plural>/<id>`, the id encoded — under `basePath`
       * when one is given, as `addressOf` spells it (FR-129).
       */
      readonly address: string;
    }
  | {
      readonly about: "kind";
      readonly kind: string;
      /** The plural, as a district is headed. */
      readonly label: string;
      readonly why: Why;
      /** How many node hits are of this kind. */
      readonly count: number;
      /** Its list on the routed face: `/<plural>`, under `basePath` when given. */
      readonly address: string;
    }
  | {
      readonly about: "place";
      readonly kind: string;
      readonly title: string;
      /** The place's name in a stop. */
      readonly as: string;
      readonly why: Why;
      /** Its address on the routed face, as `placesOf` gives it — `/places/<as>`, with `?of=` when two kinds share the name — under `basePath` when given. */
      readonly address: string;
    }
  | {
      readonly about: "act";
      readonly name: string;
      readonly title: string;
      /** The node the act would be offered on — an act is never a subjectless hit. */
      readonly subject: string;
      readonly why: Why;
      readonly destructive: boolean;
    }
  | {
      readonly about: "rule";
      readonly name: string;
      readonly label: string;
      /** The kind the rule judges, when it is scoped to one. */
      readonly kind?: string;
      readonly why: Why;
    };

export type HitAbout = Hit["about"];

/** A `key:value` token from the query, and which kinds it applied to. */
export interface SearchCondition extends Condition {
  /** The searched kinds that can be narrowed by it; the rest ignore it. */
  readonly admittedBy: readonly string[];
}

export interface SearchResult {
  readonly hits: readonly Hit[];
  /** The words, without the conditions, as typed. */
  readonly words: string;
  readonly conditions: readonly SearchCondition[];
  /** What was looked through: the kinds (after `kind:` and the policy) and whether past records were. */
  readonly searched: { readonly kinds: readonly string[]; readonly past: boolean };
  /** Node hits per kind, before the limit — what a district counts at altitude. */
  readonly byKind: Readonly<Record<string, number>>;
  /** Node hits in all, before the limit. */
  readonly total: number;
  /**
   * Every matching record's id, in rank order, before the limit — what a
   * picture lights. The hits are an index to read; this is the answer to
   * "is this one of them", and a capped list would dim real matches.
   */
  readonly matched: readonly string[];
}

export interface SearchOptions {
  /** Who is looking. A kind this principal may not see yields no hits of any sort. */
  readonly principal?: Principal;
  /** The subject: the selection, the focus, the pointer's settle. A record one edge from it ranks first in its tier. */
  readonly from?: readonly string[];
  /**
   * The kind the person is in — the district they went into, or the kind of
   * the record they are on. Its records lead the others of the same
   * strength: "Gone Digital" typed inside the songs is the song, not the
   * album that happens to sort first.
   */
  readonly inKind?: string;
  /** The node hit that is highlighted; its acts become hits. */
  readonly subject?: string;
  /** The places the view registry names — the store cannot see pictures. */
  readonly places?: readonly Place[];
  /** Node ids the rules implicate. Read off the store's violations when absent. */
  readonly flagged?: ReadonlySet<string>;
  /** YYYY-MM-DD, for the lifecycle. */
  readonly today?: string;
  /**
   * What the op log touched lately (`touchWeights`), when the caller holds
   * it — a Find box asks on every keystroke, and the log only changes when
   * the graph does.
   */
  readonly touched?: ReadonlyMap<string, number>;
  /**
   * The kinds to look in, when fewer than all the seat may see: the scene
   * looks only in the districts it draws. Never widens past the policy.
   */
  readonly kinds?: readonly string[];
  /** Most hits returned; counts are taken before it. 50 when unsaid. */
  readonly limit?: number;
  /** The host's base path for the routed face (`/apps/<id>/`): every hit's `address` is under it, as `addressOf` spells it. */
  readonly basePath?: string;
}

/*
 * SQUEEZED TEXT. Case, diacritics and punctuation aside — "Café-Noir" and
 * "cafe noir" are the same words to a person typing. Words stay separate,
 * because token alignment is what keeps "bo" out of "elbow".
 */

/** Lower case, diacritics dropped, every run of punctuation a single space. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Folded, then with the spaces gone: what `exact` and `prefix` compare. */
export function squeeze(text: string): string {
  return fold(text).replace(/ /g, "");
}

/*
 * A TEXT'S WORDS, FOLDED ONCE. Every keystroke in Find asks the same names
 * and fields again, and folding is a Unicode normalization and three
 * replacements: kept by the text, which is all they depend on, and let go
 * when there are more than a catalog holds.
 */
const folded = new Map<string, { readonly tokens: readonly string[]; readonly whole: string }>();
const FOLDED_MAX = 50_000;
function foldedOf(text: string): { readonly tokens: readonly string[]; readonly whole: string } {
  let held = folded.get(text);
  if (held === undefined) {
    if (folded.size >= FOLDED_MAX) folded.clear();
    const once = fold(text);
    held = { tokens: once.split(" ").filter(Boolean), whole: once.replace(/ /g, "") };
    folded.set(text, held);
  }
  return held;
}
const tokensOf = (text: string): string[] => [...foldedOf(text).tokens];

/**
 * How strongly `text` answers the words, or undefined when it does not.
 *
 * Every word has to be found, each as the start of a word of the text —
 * `van` finds "Book the van" and "vans", never "caravan". Exact and prefix
 * are judged on the squeezed whole, so "book the" is a prefix of "Book the
 * van" however it was punctuated.
 */
export function strengthOf(text: string, words: readonly string[]): Exclude<MatchStrength, "field"> | undefined {
  if (words.length === 0) return undefined;
  const { whole, tokens: own } = foldedOf(text);
  const asked = words.join("");
  if (whole.length === 0) return undefined;
  if (whole === asked) return "exact";
  const found = words.every((word) => own.some((token) => token.startsWith(word)));
  if (!found) return undefined;
  if (whole.startsWith(asked)) return "prefix";
  return words.every((word) => own.includes(word)) ? "word" : "part";
}

/** The text around the first word's match, with an ellipsis where it was cut. */
export function fragmentOf(written: string, words: readonly string[], width = 48): string {
  // One line: a draft's paragraphs and lists, read as words in a line of a list of hits (FR-146).
  const text = written.replace(/\s+/g, " ").trim();
  if (text.length <= width) return text;
  const first = words[0];
  const folded = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const at = first ? folded.search(new RegExp(`(^|[^\\p{L}\\p{N}])${escape(first)}`, "u")) : -1;
  const hit = at < 0 ? 0 : at + (folded[at] && /[\p{L}\p{N}]/u.test(folded[at]!) ? 0 : 1);
  let start = Math.max(0, hit - Math.floor(width / 3));
  // Start on a word, not in one.
  if (start > 0) {
    const space = text.lastIndexOf(" ", start);
    start = space < 0 ? 0 : space + 1;
  }
  let end = Math.min(text.length, start + width);
  if (end < text.length) {
    const space = text.indexOf(" ", end);
    end = space < 0 || space - end > 16 ? end : space;
  }
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/*
 * THE QUERY. Words are words; `key:value` tokens are the arrangement
 * grammar's conditions — `van done:false` finds open tasks about the van.
 * Two keys are the search's own: `kind:` narrows to kinds, and `is:` is the
 * arrangement's own `is` (current, past, any, flagged, clear).
 */

export interface ParsedQuery {
  readonly words: string;
  readonly conditions: readonly Condition[];
}

const CONDITION = /^([\p{L}][\p{L}\p{N}_-]*):(\S+)$/u;

export function parseQuery(query: string): ParsedQuery {
  const words: string[] = [];
  const conditions: Condition[] = [];
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    const match = CONDITION.exec(token);
    if (match) conditions.push({ key: match[1]!, value: match[2]! });
    else words.push(token);
  }
  return { words: words.join(" "), conditions };
}

/*
 * WHAT A NODE IS SEARCHED BY: its label, and every field a person would
 * read on it — the same list `readableFields` gives the record and the
 * card, so a field the declaration hides is a field nobody finds by.
 */

interface Text {
  readonly field: string;
  readonly reading: string;
  readonly text: string;
}

/*
 * A record's texts, worked out once per record as it stands: a change
 * replaces the record, so a record held here is one whose fields have not
 * moved, and it is read again only under another definition.
 */
const textsHeld = new WeakMap<object, { readonly definition: AnyNodeDefinition | undefined; readonly texts: Text[] }>();
function textsOf(definition: AnyNodeDefinition | undefined, node: { id: string; kind: string } & Record<string, unknown>): Text[] {
  const held = textsHeld.get(node);
  if (held && held.definition === definition) return held.texts;
  const texts = textsRead(definition, node);
  textsHeld.set(node, { definition, texts });
  return texts;
}

function textsRead(definition: AnyNodeDefinition | undefined, node: { id: string; kind: string } & Record<string, unknown>): Text[] {
  const label = labelOf(definition, node);
  const texts: Text[] = [{ field: "label", reading: "Name", text: label }];
  for (const field of readableFields(node, definition, { limit: Number.POSITIVE_INFINITY })) {
    if (field.key === "label" || field.value === label) continue;
    /*
     * A BOOLEAN IS A STATE, NOT A WORD. It reads as "Yes" or "No", and
     * searching that made "n" — the first letter of anything — find every
     * open task. A state is asked for as a condition: `done:false`.
     */
    if (typeof node[field.key] === "boolean") continue;
    texts.push({ field: field.key, reading: field.label, text: field.value });
  }
  return texts;
}

/**
 * What a kind is searched by, from its declaration alone: the name, and
 * every field a person would read on a record — which is to say every
 * field but the hidden and the ones with no one-line rendering. For
 * `describe` and llms.txt, so an agent knows what the words reach.
 */
export function searchableFields(schema: AnySchema, kind: string): readonly { readonly key: string; readonly reading: string }[] {
  const definition = schema.tryDefinition(kind);
  if (!definition) return [];
  const hidden = new Set(definition.display?.hide ?? []);
  const fields = [{ key: "label", reading: "Name" }];
  for (const [key, field] of Object.entries((definition.fields.shape ?? {}) as Record<string, unknown>)) {
    if (key === "id" || key === "kind" || key === "label" || hidden.has(key)) continue;
    const type = describeArg(field).type;
    // A state is a condition (`done:false`), not a word to find; see textsOf.
    if (type === "boolean") continue;
    if (type === "unknown" && definition.display?.format?.[key] === undefined) continue;
    fields.push({ key, reading: definition.display?.labels?.[key] ?? humanizeField(key) });
  }
  return fields;
}

const TIER: Record<MatchStrength, number> = { exact: 0, prefix: 1, word: 2, part: 3, field: 4 };

/**
 * Whether a node answers the words, and why.
 *
 * The label is judged first and whole; failing that, every word has to be
 * found somewhere on the node — "van large" finds the large job about the
 * van — and the why names the field that carried a word the label did not.
 */
export function matchNode(
  definition: AnyNodeDefinition | undefined,
  node: { id: string; kind: string } & Record<string, unknown>,
  words: string,
): Why | undefined {
  const asked = tokensOf(words);
  if (asked.length === 0) return undefined;
  const texts = textsOf(definition, node);
  const [label, ...rest] = texts;
  const onLabel = strengthOf(label!.text, asked);
  if (onLabel) return { field: "label", reading: label!.reading, fragment: fragmentOf(label!.text, asked), strength: onLabel };
  const everywhere = (word: string) => (text: Text) => foldedOf(text.text).tokens.some((token) => token.startsWith(word));
  if (!asked.every((word) => texts.some(everywhere(word)))) return undefined;
  const labelTokens = tokensOf(label!.text);
  const carried = asked.find((word) => !labelTokens.some((token) => token.startsWith(word))) ?? asked[0]!;
  const field = rest.find(everywhere(carried))!;
  return { field: field.field, reading: field.reading, fragment: fragmentOf(field.text, [carried]), strength: "field" };
}

/*
 * RECENTLY TOUCHED. What the op log wrote lately, decaying by log distance
 * the way the menu's usage boost does, so a record worked on this morning
 * ranks above its twin untouched since spring — a tiebreak, never a tier.
 */
const WINDOW = 512;
const HALF_LIFE = 64;

export function touchWeights(ops: readonly Operation[]): ReadonlyMap<string, number> {
  const weights = new Map<string, number>();
  if (ops.length === 0) return weights;
  const tail = ops.slice(-WINDOW);
  const last = ops[ops.length - 1]!.seq;
  for (const op of tail) {
    const weight = Math.pow(0.5, (last - op.seq) / HALF_LIFE);
    for (const id of op.writes) weights.set(id, (weights.get(id) ?? 0) + weight);
  }
  return weights;
}

const pluralOf = (definition: AnyNodeDefinition | undefined, kind: string) => definition?.plural ?? `${humanizeField(kind)}s`;

/** A kind's list on the routed face, as its router addresses it: the declared plural, else the kind and an s, as a slug. */
const listPath = (definition: AnyNodeDefinition | undefined, kind: string) => `/${placeSlug(definition?.plural ?? `${kind}s`)}`;

/** Whether the words name this kind: its id, its singular in words, or its plural. */
function kindStrength(schema: AnySchema, kind: string, words: readonly string[]): { strength: Exclude<MatchStrength, "field">; field: string; text: string } | undefined {
  const definition = schema.tryDefinition(kind);
  const candidates: { field: string; text: string }[] = [
    { field: "plural", text: pluralOf(definition, kind) },
    { field: "kind", text: humanizeField(kind) },
    ...(definition?.noun ? [{ field: "noun", text: definition.noun }] : []),
  ];
  let best: { strength: Exclude<MatchStrength, "field">; field: string; text: string } | undefined;
  for (const candidate of candidates) {
    const strength = strengthOf(candidate.text, words);
    if (strength && (!best || TIER[strength] < TIER[best.strength])) best = { strength, ...candidate };
  }
  return best;
}

type Ranked = { hit: Hit; tier: number; inKind: number; near: number; past: number; touched: number; flagged: number; name: string; id: string };

/*
 * Alphabetical as `localeCompare` with these options says it, from one
 * collator: building the options on every comparison was most of a sort
 * over a thousand hits.
 */
let names: Intl.Collator | undefined;
const byName = (a: string, b: string): number => (names ??= new Intl.Collator(undefined, { sensitivity: "base", numeric: true })).compare(a, b);

/** The ranking, as one comparison: how it matched, the kind the person is in, near, current, touched, flagged, alphabetical, id. */
const byRank = (a: Ranked, b: Ranked): number =>
  a.tier - b.tier ||
  a.inKind - b.inKind ||
  a.near - b.near ||
  a.past - b.past ||
  a.touched - b.touched ||
  a.flagged - b.flagged ||
  byName(a.name, b.name) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Finds what the words name, anywhere in the graph, for one seat.
 *
 * Node hits are records whose label or readable fields carry every word;
 * kind, place and rule hits are what the words name in the declaration;
 * act hits are the acts the seat may run on `subject`, the highlighted
 * node hit — never subjectless. A declaration hit leads only when the words
 * name it exactly or as a prefix; otherwise the records lead.
 *
 * Ranking, stable: how the words matched (exact label, label prefix, whole
 * words of the label, parts of it, a field), then near the subject, then
 * current before past, then recently touched, then flagged before clear,
 * then alphabetical, then by id.
 */
export function search<S extends AnySchema>(store: Store<S>, query: string, options: SearchOptions = {}): SearchResult {
  const schema = store.schema as AnySchema;
  const parsed = parseQuery(query);
  const words = tokensOf(parsed.words);
  const principal = options.principal ?? { kind: "human" };
  const kept = store.kindsKeptFrom(principal);
  const off = store.modules.disabledKinds;

  const kindWords = parsed.conditions.filter((condition) => condition.key === "kind").map((condition) => condition.value);
  const isWords = parsed.conditions.filter((condition) => condition.key === "is").map((condition) => condition.value);
  const past = isWords.includes("any") || isWords.includes("past");
  const onlyPast = isWords.includes("past") && !isWords.includes("any") && !isWords.includes("current");

  const named = (kind: string, value: string) => {
    const asked = squeeze(value);
    const definition = schema.tryDefinition(kind);
    return squeeze(kind) === asked || squeeze(pluralOf(definition, kind)) === asked;
  };
  const kinds = (schema.kinds as readonly string[]).filter(
    (kind) =>
      !kept.has(kind) &&
      !off.has(kind) &&
      (options.kinds === undefined || options.kinds.includes(kind)) &&
      (kindWords.length === 0 || kindWords.some((value) => named(kind, value))),
  );

  // The rest of the conditions narrow the kinds whose declaration offers them.
  const narrowing = parsed.conditions.filter((condition) => condition.key !== "kind");
  const conditions: SearchCondition[] = narrowing.map((condition) => ({
    ...condition,
    admittedBy: kinds.filter((kind) => arrangeable(schema, kind).filters.some((offer) => offer.key === condition.key)),
  }));
  const fieldConditions = conditions.filter((condition) => condition.key !== "is");
  // `is:flagged`, `is:clear` and `is:past` narrow on their own; `is:any` and `is:current` only say which horizon.
  const narrowingIs = isWords.filter((word) => word === "flagged" || word === "clear" || word === "past");

  const searched = { kinds, past };
  const empty: SearchResult = { hits: [], words: parsed.words, conditions, searched, byKind: {}, total: 0, matched: [] };
  if (words.length === 0 && fieldConditions.length === 0 && narrowingIs.length === 0) return empty;

  const today = options.today;
  const flagged = options.flagged ?? new Set(store.violations().flatMap((violation) => violation.nodeIds));
  const touched = options.touched ?? touchWeights(store.log.all());
  const near = new Set<string>();
  for (const id of options.from ?? []) {
    near.add(id);
    for (const neighbor of store.graph.neighbors(id)) near.add(neighbor.id);
  }
  // The same words mean the same thing in a search box and in a list page's filter.
  /*
   * WHAT THIS SEAT SEES, RECORD BY RECORD. A kind it sees none of is never
   * searched; a kind it sees only its own of (`own`) is searched only
   * through what is its own, so a hit — and the address it carries — never
   * names a record the seat may not open.
   */
  const sighted = hidesFrom(store, principal) ? seesId(store, principal) : undefined;
  const at = (path: string) => addressOf(path, options.basePath === undefined ? {} : { basePath: options.basePath });
  const ctx: ArrangeContext = { schema, graph: store.graph as unknown as ArrangeGraph, flagged, ...(today ? { today } : {}) };

  const ranked: Ranked[] = [];
  const byKind: Record<string, number> = {};

  for (const kind of kinds) {
    const definition = schema.tryDefinition(kind);
    const own = conditions.filter((condition) => condition.key !== "is" && condition.admittedBy.includes(kind));
    // Conditions alone find only in the kinds that can be narrowed by them.
    if (words.length === 0 && own.length === 0 && narrowingIs.length === 0) continue;
    /*
     * A CONDITION THAT NAMES A RETIRED STATE ASKS FOR THE PAST. `status:demo`
     * on a discography whose demos are behind the horizon found nothing and
     * said "add is:any" — to somebody who had just named the past by name.
     */
    const namesThePast = asksForThePast(definition, own);
    for (const node of store.graph.nodesOfKind(kind as never) as unknown as ({ id: string; kind: string } & Record<string, unknown>)[]) {
      const current = isCurrent(definition, node, today);
      if (!past && !namesThePast && !current) continue;
      if (sighted && !sighted(node.id)) continue;
      if (onlyPast && current) continue;
      if (!own.every((condition) => conditionHolds(ctx, node, condition))) continue;
      if (isWords.includes("flagged") && !flagged.has(node.id)) continue;
      if (isWords.includes("clear") && flagged.has(node.id)) continue;
      const why =
        words.length > 0
          ? matchNode(definition, node, parsed.words)
          : own[0]
            ? { field: own[0].key, reading: humanizeField(own[0].key), fragment: `${own[0].key}:${own[0].value}`, strength: "field" as const }
            : { field: "is", reading: "Is", fragment: `is:${narrowingIs[0]!}`, strength: "field" as const };
      if (!why) continue;
      const label = labelOf(definition, node);
      byKind[kind] = (byKind[kind] ?? 0) + 1;
      ranked.push({
        hit: { about: "node", id: node.id, kind, label, why, current, flagged: flagged.has(node.id), address: at(`${listPath(definition, kind)}/${encodeURIComponent(node.id)}`) },
        tier: TIER[why.strength],
        inKind: kind === options.inKind ? 0 : 1,
        near: near.has(node.id) ? 0 : 1,
        past: current ? 0 : 1,
        touched: -(touched.get(node.id) ?? 0),
        flagged: flagged.has(node.id) ? 0 : 1,
        name: label,
        id: node.id,
      });
    }
  }

  /*
   * THE DECLARATION'S HITS: a kind, a place, a rule. They lead the records
   * only when the words name them exactly or as a prefix — "tasks" is the
   * district, "van" is a record that happens to share a letter with nothing.
   */
  const lead = (strength: MatchStrength) => (strength === "exact" || strength === "prefix" ? -1 : TIER[strength]);
  const declared = (hit: Hit, strength: Exclude<MatchStrength, "field">, name: string, id: string): Ranked => ({
    hit,
    tier: lead(strength),
    inKind: 1,
    near: 1,
    past: 0,
    touched: 0,
    flagged: 1,
    name,
    id,
  });

  if (words.length > 0) {
    for (const kind of kinds) {
      const match = kindStrength(schema, kind, words);
      if (!match) continue;
      const label = pluralOf(schema.tryDefinition(kind), kind);
      const why: Why = { field: match.field, reading: match.field === "plural" ? "Plural" : "Kind", fragment: match.text, strength: match.strength };
      ranked.push(declared({ about: "kind", kind, label, why, count: byKind[kind] ?? 0, address: at(listPath(schema.tryDefinition(kind), kind)) }, match.strength, label, `kind:${kind}`));
    }

    const places = options.places ?? [];
    for (const place of places) {
      if (!kinds.includes(place.kind) || (place.across && kept.has(place.across))) continue;
      const strength = strengthOf(place.title, words);
      if (!strength) continue;
      const why: Why = { field: "title", reading: "Title", fragment: place.title, strength };
      // A name two kinds' pictures share says which kind's, as placesOf spells it.
      const of = places.some((other) => other.as === place.as && other.kind !== place.kind) ? listPath(schema.tryDefinition(place.kind), place.kind).slice(1) : undefined;
      const address = at(`/places/${encodeURIComponent(place.as)}${of ? `?of=${encodeURIComponent(of)}` : ""}`);
      ranked.push(declared({ about: "place", kind: place.kind, title: place.title, as: place.as, why, address }, strength, place.title, `place:${place.kind}:${place.as}`));
    }

    for (const rule of store.allInvariants()) {
      const scoped = rule.scope === "graph" ? undefined : rule.scope.kind;
      if (scoped && !kinds.includes(scoped)) continue;
      const label = rule.label ?? humanizeField(rule.name);
      const onLabel = strengthOf(label, words);
      const onName = onLabel ? undefined : strengthOf(humanizeField(rule.name), words);
      const strength = onLabel ?? onName;
      if (!strength) continue;
      const why: Why = { field: onLabel ? "label" : "name", reading: onLabel ? "Rule" : "Name", fragment: onLabel ? label : rule.name, strength };
      ranked.push(declared({ about: "rule", name: rule.name, label, ...(scoped ? { kind: scoped } : {}), why }, strength, label, `rule:${rule.name}`));
    }
  }

  ranked.sort(byRank);
  const limit = options.limit ?? 50;
  const shown = ranked.slice(0, limit).map((entry) => entry.hit);
  /*
   * Two hits of one name say what tells them apart — a single and its
   * album, both "Blue Hour", by the fact that differs; a song and an album,
   * both "Gone Digital", by their nouns. Across kinds too: the strip heads
   * each kind, but a row is read alone — by the pointer that lands on it,
   * by the screen reader that speaks it — and "Gone Digital, Gone Digital"
   * is a choice nobody can make.
   */
  const alike = shown.flatMap((hit) => (hit.about === "node" ? [store.graph.getNode(hit.id) as unknown as { id: string; kind: string } & Record<string, unknown>] : [])).filter(Boolean);
  const apart = tellApart(alike, (named) => schema.tryDefinition(named));
  const hits = shown.map((hit) => (hit.about === "node" && apart.has(hit.id) ? { ...hit, apart: apart.get(hit.id)! } : hit));
  const total = Object.values(byKind).reduce((sum, count) => sum + count, 0);
  const matched = ranked.flatMap((entry) => (entry.hit.about === "node" ? [entry.hit.id] : []));
  const acts = options.subject && kinds.includes(String(store.graph.getNode(options.subject)?.kind)) ? actsOn(store, options.subject, parsed.words, { principal }) : [];
  return {
    hits: [...hits, ...acts],
    words: parsed.words,
    conditions,
    searched,
    byKind,
    total,
    matched,
  };
}

/**
 * WHAT CAN BE DONE ABOUT IT: the acts a seat may run on one record, as
 * hits. An act is never a subjectless hit — it is offered on the thing the
 * person highlighted, with its own title — and the words that name the
 * record may name the act too ("van finish"), so each act is judged on the
 * words its own title carries. The named first, the destructive last.
 *
 * Its own function because a Find box asks it for a highlighted row on
 * every keystroke, and has no need to rescan the graph to get it.
 */
export function actsOn<S extends AnySchema>(
  store: Store<S>,
  subjectId: string,
  words: string,
  options: { readonly principal?: Principal; readonly limit?: number } = {},
): readonly Extract<Hit, { about: "act" }>[] {
  const subject = store.graph.getNode(subjectId);
  if (!subject) return [];
  const principal = options.principal ?? { kind: "human" };
  if (store.kindsKeptFrom(principal).has(subject.kind as string)) return [];
  const asked = tokensOf(words);
  const said = labelOf(store.schema.tryDefinition(subject.kind as string), subject as never);
  const ranked: Ranked[] = [];
  for (const mutation of store.allMutations()) {
    const binding = mutation.subject;
    if (!binding) continue;
    if (binding.kinds !== "*" && !(binding.kinds as readonly string[]).includes(subject.kind as string)) continue;
    if (!store.permits({ name: mutation.name, args: { [binding.arg]: subject.id } }, principal).ok) continue;
    const title = mutation.title ?? humanizeField(mutation.name);
    const titled = tokensOf(title);
    const own = asked.filter((word) => titled.some((token) => token.startsWith(word)));
    const strength = own.length > 0 ? strengthOf(title, own) : undefined;
    const why: Why = strength
      ? { field: "title", reading: "Act", fragment: title, strength }
      : { field: "subject", reading: "On", fragment: said, strength: "field" };
    ranked.push({
      hit: { about: "act", name: mutation.name, title, subject: subject.id, why, destructive: mutation.destructive === true },
      tier: strength ? TIER[strength] : TIER.field + 1,
      inKind: 0,
      near: 0,
      past: mutation.destructive ? 1 : 0,
      touched: 0,
      flagged: mutation.pinned ? 0 : 1,
      name: title,
      id: `act:${mutation.name}`,
    });
  }
  ranked.sort(byRank);
  const acts = ranked.map((entry) => entry.hit as Extract<Hit, { about: "act" }>);
  return options.limit === undefined ? acts : acts.slice(0, options.limit);
}

/**
 * The sentence for what was searched, for an empty state or a strip's
 * footer: "Tasks and lists, current ones; add is:any for past ones."
 */
export function describeSearched(schema: AnySchema, searched: SearchResult["searched"]): string {
  const plurals = searched.kinds.map((kind, index) => {
    const plural = pluralOf(schema.tryDefinition(kind), kind);
    return index === 0 ? plural : plural.toLowerCase();
  });
  const names =
    plurals.length === 0
      ? "Nothing"
      : plurals.length === 1
        ? plurals[0]!
        : `${plurals.slice(0, -1).join(", ")} and ${plurals[plurals.length - 1]!}`;
  const lifecycled = searched.kinds.some((kind) => schema.tryDefinition(kind)?.lifecycle);
  if (!lifecycled) return `${capitalize(names)}.`;
  return searched.past ? `${capitalize(names)}, past ones included.` : `${capitalize(names)}, current ones; add is:any for past ones.`;
}
