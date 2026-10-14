import { addressOf } from "./address.js";
import { isArchived, type Archived } from "./graph/archived.js";
import { arrangeable, asksForThePast, conditionHolds, type ArrangeContext, type ArrangeGraph, type Condition } from "./arrangement.js";
import { describeArg } from "./mutations/arg-shape.js";
import type { Operation } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";
import { actTitle, humanizeField, isCurrent, labelOf, pluralLabel, pluralOf as pluralOfKind } from "./schema/define-node.js";
import { readableFields, tellApart } from "./schema/reading.js";
import type { AnySchema } from "./schema/schema.js";
import type { AnyNodeDefinition } from "./schema/types.js";
import { FIELD_SIGHT } from "./permissions/sight.js";
import { hidesFrom, seesId } from "./seen.js";
import type { Store } from "./store.js";
import { kindPath, onePerPicture, placePath, sharesItsName, type Place } from "./views/types.js";
import { capitalize, listed } from "./capital.js";
import { markdownWords } from "./excerpt-of.js";

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
 * not a hit), and exact first: a near hit — a typo, another form of the
 * word, a word a host's model says means the same — fills in only when the
 * exact ones are few, ranked after them and said as near. See docs/search.md.
 */

/** How a hit matched, strongest first. `near` is a record found by a word close to the one typed. */
export type MatchStrength = "exact" | "prefix" | "word" | "part" | "field" | "near";

/** How a near hit was near: the word misspelled, another form of it, or a meaning the host's ranker gave. */
export type NearBy = "spelling" | "stem" | "meaning";

/** Why a hit is shown: the field that matched and the words around the match. */
export interface Why {
  /** `label`, a field name, `plural`, `title` or `name`. */
  readonly field: string;
  /** The field as it reads: "Notes", "Name", "Title". */
  readonly reading: string;
  /** The matching text, cut to a window around the first match: "…the van on Friday…". */
  readonly fragment: string;
  readonly strength: MatchStrength;
  /** On a near hit: the word typed that was not found as typed — "florist". */
  readonly asked?: string;
  /** On a near hit: the record's own word that answered it — "flowers". */
  readonly matched?: string;
  /** On a near hit: how it was near. */
  readonly by?: NearBy;
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
      /** Set on an archived record (FR-173): found, said so, and ranked after the live ones. */
      readonly archived?: true;
      readonly flagged: boolean;
      /**
       * Set on a record found by a word near the one typed rather than the
       * word itself — a typo, another form, a meaning — ranked after every
       * exact hit; `why` says which word answered (`matched`) and how (`by`).
       */
      readonly near?: true;
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
  /**
   * THE HOST'S RANKER, STILL ANSWERING: when `rank` was given and the exact
   * hits were few, the same result with the ranker's near hits merged in,
   * as they arrive. Resolves to this result when the ranker fails or adds
   * nothing. Absent when the ranker was not asked.
   */
  readonly later?: Promise<SearchResult>;
}

/**
 * ONE RECORD A RANKER MAY SCORE: a record this seat sees, in the kinds
 * searched, past the conditions, that the words did not find exactly — its
 * id, its kind, its name and the texts it is searched by.
 */
export interface NearCandidate {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  /** Every text the record is searched by — its name and each readable field. */
  readonly texts: readonly { readonly field: string; readonly reading: string; readonly text: string }[];
}

/**
 * A RANKER'S SCORE FOR ONE CANDIDATE: 0–1, nearer higher. Return only what
 * is near; a record left out is not a hit. `matched` names the record's own
 * word the query was near ("flowers" for "the florist"), for the strip and
 * the agent to say.
 */
export interface NearScore {
  readonly id: string;
  readonly score: number;
  readonly matched?: string;
}

/**
 * THE HOST'S RANKER (embeddings, a model): the words and the candidates in,
 * the near ones' scores out, at once or later. It is handed only records the
 * seat may see — the framework filters by the seat's sight, the kinds and
 * the conditions first, and never sends a hidden record's text.
 */
export type SearchRanker = (query: string, candidates: readonly NearCandidate[]) => readonly NearScore[] | Promise<readonly NearScore[]>;

/** Near hits fill in when the exact record hits are fewer than this. */
export const NEAR_BELOW = 5;

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
  /**
   * WHICH RECORDS (FR-173): `"all"` when unsaid — a person's search finds
   * an archived record, marked and after the live ones — `false` the live
   * ones only, as an agent's find asks by default, `true` only the
   * archived. `is:archived` in the words asks for those alone.
   */
  readonly archived?: Archived;
  /**
   * NEAR HITS (no model): when the exact record hits are fewer than
   * `NEAR_BELOW`, records whose words are near the typed ones — a typo
   * (one letter off in a word of 4–7, two in a longer one), another form of
   * the word ("planted", "plants" for "plant") — follow them, said as near.
   * True when unsaid; false asks for exact hits only.
   */
  readonly near?: boolean;
  /**
   * THE HOST'S RANKER: asked, under the same rule, with the candidates this
   * seat sees; its near hits arrive on `later`. Never asked when `near` is false.
   */
  readonly rank?: SearchRanker | undefined;
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
    // Markdown is found by its words and shown as words (FR-180): "**van**" is "van" in a hit's line.
    texts.push({ field: field.key, reading: field.label, text: field.markdown ? markdownWords(field.value) : field.value });
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

const TIER: Record<MatchStrength, number> = { exact: 0, prefix: 1, word: 2, part: 3, field: 4, near: 5 };

/*
 * NEAR WORDS, WITH NO MODEL. A word typed is near a word of the record when
 * they are one form of a word ("plants", "planted", "planting" are "plant")
 * or one slip apart — a letter missing, extra, wrong or two swapped — in a
 * word of four to seven letters, two in a longer one. A short word is never
 * near another: "van" is not "can". A number is never near another either.
 */

/** Words a near search does without when others were typed: "the florist" asks for the florist. */
const SMALL_WORDS = new Set(["a", "an", "the", "of", "and", "or", "for", "to", "in", "on", "at", "by", "with", "my", "our", "is"]);

/** A word's plain form: plurals, -ing and -ed taken off, and a closing e, so "baked" and "bake" agree. */
export function stemOf(word: string): string {
  let stem = word;
  if (stem.length > 4 && stem.endsWith("ies")) stem = `${stem.slice(0, -3)}y`;
  else if (stem.length > 4 && /(ss|x|ch|sh|z)es$/.test(stem)) stem = stem.slice(0, -2);
  else if (stem.length > 3 && stem.endsWith("s") && !/(ss|us|is)$/.test(stem)) stem = stem.slice(0, -1);
  for (const end of ["ing", "ed"]) {
    if (stem.length > end.length + 2 && stem.endsWith(end)) {
      stem = stem.slice(0, -end.length);
      // "running" is "run", "planned" is "plan"; "falling" stays "fall".
      if (/([b-df-hj-km-np-rtv-z])\1$/.test(stem)) stem = stem.slice(0, -1);
      break;
    }
  }
  return stem.length > 3 && stem.endsWith("e") ? stem.slice(0, -1) : stem;
}

/** The slips between two words — insertions, deletions, substitutions and swaps of neighbors — or `most + 1` once it is past `most`. */
export function slipsBetween(a: string, b: string, most: number): number {
  if (Math.abs(a.length - b.length) > most) return most + 1;
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, at) => at);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let least = i;
    for (let j = 1; j <= b.length; j++) {
      let slips = Math.min(previous[j]! + 1, row[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) slips = Math.min(slips, before[j - 2]! + 1);
      row[j] = slips;
      if (slips < least) least = slips;
    }
    if (least > most) return most + 1;
    before = previous;
    previous = row;
  }
  return previous[b.length]!;
}

/*
 * Whether one typed word is near one word of a record, kept per typed word:
 * a Find box asks the same word of the same vocabulary on every keystroke
 * that does not change it, and a catalog's vocabulary is the size of its
 * words, not of its records.
 */
const nearHeld = new Map<string, Map<string, NearBy | null>>();
function nearWord(word: string, token: string): NearBy | undefined {
  let held = nearHeld.get(word);
  if (!held) {
    if (nearHeld.size >= 64) nearHeld.clear();
    nearHeld.set(word, (held = new Map()));
  }
  let by = held.get(token);
  if (by === undefined) {
    by = nearWordOnce(word, token) ?? null;
    held.set(token, by);
  }
  return by ?? undefined;
}

function nearWordOnce(word: string, token: string): NearBy | undefined {
  if (/\d/.test(word)) return undefined;
  const stem = stemOf(word);
  if (stem.length >= 3 && (stemOf(token) === stem || (stem.length >= 4 && token.startsWith(stem)))) return "stem";
  const most = word.length < 4 ? 0 : word.length <= 7 ? 1 : 2;
  if (most === 0) return undefined;
  if (slipsBetween(word, token, most) <= most) return "spelling";
  // A slip in a word still being typed: "flowr" is the start of "flowers".
  if (word.length >= 5) {
    for (let length = word.length - most; length <= word.length + most; length++) {
      if (length < token.length && slipsBetween(word, token.slice(0, length), most) <= most) return "spelling";
    }
  }
  return undefined;
}

/**
 * Whether a record is near the words: every word typed (the small ones
 * aside, when there are others) found on it as typed or near, at least one
 * of them near. The why names the first near one — the word typed, the
 * record's word that answered it, the field it is in.
 */
function nearNode(texts: readonly Text[], asked: readonly string[]): Why | undefined {
  const words = asked.length > 1 ? asked.filter((word) => !SMALL_WORDS.has(word)) : asked;
  if (words.length === 0) return undefined;
  let first: { readonly text: Text; readonly asked: string; readonly matched: string; readonly by: NearBy } | undefined;
  for (const word of words) {
    let found: { readonly text: Text; readonly matched: string; readonly by?: NearBy } | undefined;
    for (const text of texts) {
      for (const token of foldedOf(text.text).tokens) {
        if (token.startsWith(word)) {
          found = { text, matched: token };
          break;
        }
        const by = found ? undefined : nearWord(word, token);
        if (by) found = { text, matched: token, by };
      }
      if (found && !found.by) break;
    }
    if (!found) return undefined;
    if (found.by && !first) first = { text: found.text, asked: word, matched: found.matched, by: found.by };
  }
  if (!first) return undefined;
  return { field: first.text.field, reading: first.text.reading, fragment: fragmentOf(first.text.text, [first.matched]), strength: "near", asked: first.asked, matched: first.matched, by: first.by };
}

/** The why of a hit a host's ranker found: the field carrying the word it named, else the name. */
function meantBy(texts: readonly Text[], words: string, matched: string | undefined): Why {
  const asked = tokensOf(words).filter((word) => !SMALL_WORDS.has(word)).join(" ") || words;
  const said = matched === undefined ? [] : tokensOf(matched);
  const text = (said.length > 0 && texts.find((one) => said.every((word) => foldedOf(one.text).tokens.some((token) => token.startsWith(word))))) || texts[0]!;
  return {
    field: text.field,
    reading: text.reading,
    fragment: fragmentOf(text.text, said),
    strength: "near",
    asked,
    matched: matched ?? text.text,
    by: "meaning",
  };
}

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

/** A kind's plural as every surface says it (`pluralOf`), from the definition in hand. */
const pluralOf = (definition: AnyNodeDefinition | undefined, kind: string) => pluralOfKind({ tryDefinition: () => definition }, kind);

/** A kind's list on the routed face, as its router addresses it (`kindPath`). */
const listPath = (definition: AnyNodeDefinition | undefined, kind: string) => kindPath({ tryDefinition: () => definition }, kind);

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

type Ranked = { hit: Hit; nearly?: number; tier: number; inKind: number; near: number; past: number; touched: number; flagged: number; name: string; id: string; archived?: number };

/*
 * Alphabetical as `localeCompare` with these options says it, from one
 * collator: building the options on every comparison was most of a sort
 * over a thousand hits.
 */
let names: Intl.Collator | undefined;
const byName = (a: string, b: string): number => (names ??= new Intl.Collator(undefined, { sensitivity: "base", numeric: true })).compare(a, b);

/** The ranking, as one comparison: live before archived, how it matched, the kind the person is in, near, current, touched, flagged, alphabetical, id. */
const byRank = (a: Ranked, b: Ranked): number =>
  // A near hit after every exact one, the nearest first.
  (a.nearly ?? 0) - (b.nearly ?? 0) ||
  // An archived record after every live one, however well it matched (FR-173).
  (a.archived ?? 0) - (b.archived ?? 0) ||
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
  const archived: Archived = isWords.includes("archived") ? true : (options.archived ?? "all");

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
  const narrowingIs = isWords.filter((word) => word === "flagged" || word === "clear" || word === "past" || word === "archived");

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
  // A record some of whose fields its sight keeps is searched as the seat is served it: no hit on what it may not read (Roadmap f-field-sight).
  const served = FIELD_SIGHT.keptFrom?.(store, principal) && store.seenBy(principal).graph;
  const at = (path: string) => addressOf(path, options.basePath === undefined ? {} : { basePath: options.basePath });
  const ctx: ArrangeContext = { schema, graph: store.graph as unknown as ArrangeGraph, flagged, ...(today ? { today } : {}) };

  const ranked: Ranked[] = [];
  const byKind: Record<string, number> = {};
  type Node = { id: string; kind: string } & Record<string, unknown>;
  // What passed the seat's sight, the kinds and the conditions but not the words: where near hits are looked for.
  const misses: { readonly node: Node; readonly kind: string; readonly definition: AnyNodeDefinition | undefined; readonly current: boolean }[] = [];
  const add = (node: Node, kind: string, definition: AnyNodeDefinition | undefined, current: boolean, why: Why, score?: number): void => {
    const label = labelOf(definition, node);
    byKind[kind] = (byKind[kind] ?? 0) + 1;
    ranked.push({
      hit: {
        about: "node",
        id: node.id,
        kind,
        label,
        why,
        current,
        flagged: flagged.has(node.id),
        address: at(`${listPath(definition, kind)}/${encodeURIComponent(node.id)}`),
        ...(score === undefined ? {} : { near: true as const }),
        ...(isArchived(node) ? { archived: true as const } : {}),
      },
      ...(score === undefined ? {} : { nearly: 2 - score }),
      tier: TIER[why.strength],
      inKind: kind === options.inKind ? 0 : 1,
      near: near.has(node.id) ? 0 : 1,
      past: current ? 0 : 1,
      archived: isArchived(node) ? 1 : 0,
      touched: -(touched.get(node.id) ?? 0),
      flagged: flagged.has(node.id) ? 0 : 1,
      name: label,
      id: node.id,
    });
  };

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
    for (const whole of store.graph.nodesOfKind(kind as never, { archived }) as unknown as Node[]) {
      if (sighted && !sighted(whole.id)) continue;
      // Read as the seat is served it, when its sight keeps some fields: no hit on a field it may not read (Roadmap f-field-sight).
      const node = served ? (served.getNode(whole.id) as Node | undefined) : whole;
      if (!node) continue;
      const current = isCurrent(definition, node, today);
      if (!past && !namesThePast && !current) continue;
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
      if (why) add(node, kind, definition, current, why);
      else if (words.length > 0) misses.push({ node, kind, definition, current });
    }
  }

  /*
   * NEAR, WHEN EXACT IS FEW. A typo or another form of the word finds the
   * record the words meant, after every exact hit and said as near; a host's
   * ranker is asked about the same candidates — only what this seat sees —
   * and what it scores arrives on `later`.
   */
  const nearing = options.near !== false && words.length > 0 && ranked.length < NEAR_BELOW && misses.length > 0;
  const spelled = new Set<string>();
  if (nearing) {
    for (const miss of misses) {
      const why = nearNode(textsOf(miss.definition, miss.node), words);
      if (!why) continue;
      spelled.add(miss.node.id);
      add(miss.node, miss.kind, miss.definition, miss.current, why, why.by === "stem" ? 0.9 : 0.8);
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
      const label = pluralLabel(schema, kind);
      const why: Why = { field: match.field, reading: match.field === "plural" ? "Plural" : "Kind", fragment: match.text, strength: match.strength };
      ranked.push(declared({ about: "kind", kind, label, why, count: byKind[kind] ?? 0, address: at(listPath(schema.tryDefinition(kind), kind)) }, match.strength, label, `kind:${kind}`));
    }

    const places = options.places ?? [];
    // A picture over several kinds is found once, under the first of them this seat searches.
    for (const place of onePerPicture(places.filter((one) => kinds.includes(one.kind)))) {
      if (place.across && kept.has(place.across)) continue;
      const strength = strengthOf(place.title, words);
      if (!strength) continue;
      const why: Why = { field: "title", reading: "Title", fragment: place.title, strength };
      // A name two kinds' pictures share says which kind's, as placesOf spells it.
      const of = sharesItsName(place, places) ? listPath(schema.tryDefinition(place.kind), place.kind).slice(1) : undefined;
      const address = at(placePath(place.as, of));
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

  const answer = (): SearchResult => {
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
    const alike = shown.flatMap((hit) => (hit.about === "node" ? [(served || store.graph).getNode(hit.id) as unknown as Node] : [])).filter(Boolean);
    const apart = tellApart(alike, (named) => schema.tryDefinition(named));
    const hits = shown.map((hit) => (hit.about === "node" && apart.has(hit.id) ? { ...hit, apart: apart.get(hit.id)! } : hit));
    const total = Object.values(byKind).reduce((sum, count) => sum + count, 0);
    const matched = ranked.flatMap((entry) => (entry.hit.about === "node" ? [entry.hit.id] : []));
    const acts = options.subject && kinds.includes(String(store.graph.getNode(options.subject)?.kind)) ? actsOn(store, options.subject, parsed.words, { principal }) : [];
    return { hits: [...hits, ...acts], words: parsed.words, conditions, searched, byKind: { ...byKind }, total, matched };
  };
  const first = answer();
  const rank = options.rank;
  if (!nearing || !rank) return first;
  const candidates: NearCandidate[] = misses
    .filter((miss) => !spelled.has(miss.node.id))
    .map(({ node, kind, definition }) => ({ id: node.id, kind, label: labelOf(definition, node), texts: textsOf(definition, node) }));
  if (candidates.length === 0) return first;
  const later = (async (): Promise<SearchResult> => {
    let scores: readonly NearScore[];
    try {
      scores = await rank(parsed.words, candidates);
    } catch {
      return first;
    }
    const missed = new Map(misses.filter((miss) => !spelled.has(miss.node.id)).map((miss) => [miss.node.id, miss]));
    let added = false;
    for (const { id, score, matched } of Array.isArray(scores) ? scores : []) {
      const miss = missed.get(id);
      // Only a candidate it was handed, once, and only a score that says near.
      if (!miss || !(score > 0)) continue;
      missed.delete(id);
      added = true;
      add(miss.node, miss.kind, miss.definition, miss.current, meantBy(textsOf(miss.definition, miss.node), parsed.words, typeof matched === "string" ? matched : undefined), Math.min(1, score));
    }
    return added ? answer() : first;
  })();
  return { ...first, later };
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
  const principal = options.principal ?? { kind: "human" };
  // Its name as the seat is served the record: a label never reads a field kept from it (Roadmap f-field-sight).
  const subject = (FIELD_SIGHT.keptFrom?.(store, principal) ? store.seenBy(principal) : store).graph.getNode(subjectId);
  if (!subject) return [];
  if (store.kindsKeptFrom(principal).has(subject.kind as string)) return [];
  const asked = tokensOf(words);
  const said = labelOf(store.schema.tryDefinition(subject.kind as string), subject as never);
  const ranked: Ranked[] = [];
  for (const mutation of store.allMutations()) {
    const binding = mutation.subject;
    if (!binding) continue;
    if (binding.kinds !== "*" && !(binding.kinds as readonly string[]).includes(subject.kind as string)) continue;
    // Archive is offered on a live record, "Bring it back" on an archived one, and merge only from a live one (FR-173).
    const act = mutation.derived?.act;
    if ((act === "archive" || act === "merge") && isArchived(subject)) continue;
    if (act === "unarchive" && !isArchived(subject)) continue;
    if (!store.permits({ name: mutation.name, args: { [binding.arg]: subject.id } }, principal).ok) continue;
    const title = actTitle(mutation);
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
  const names = listed(plurals) || "Nothing";
  const lifecycled = searched.kinds.some((kind) => schema.tryDefinition(kind)?.lifecycle);
  if (!lifecycled) return `${capitalize(names)}.`;
  return searched.past ? `${capitalize(names)}, past ones included.` : `${capitalize(names)}, current ones; add is:any for past ones.`;
}
