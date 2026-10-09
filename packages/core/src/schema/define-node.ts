import type { z } from "zod";
import type {
  AnyNodeDefinition,
  EdgeMap,
  EmptyEdgeMap,
  NodeDefinition,
  NodeDefinitionSpec,
  PageFields,
} from "./types.js";

/**
 * The single declaration everything else derives from. Views, agent tool
 * schemas, drag legality, aggregate contents and accessibility labels all
 * read this — nothing is sealed, every derived value stays inspectable.
 */
export function defineNode<
  const K extends string,
  F extends z.ZodObject<z.ZodRawShape>,
  const E extends EdgeMap = EmptyEdgeMap,
>(kind: K, spec: NodeDefinitionSpec<F, E>): NodeDefinition<K, F, E> {
  return {
    ...spec,
    kind,
    edges: (spec.edges ?? ({} as E)) as E,
  };
}

/**
 * Whether a node is CURRENT under its kind's declared lifecycle.
 *
 * True when the kind declares no lifecycle — currency is opt-in, and a kind
 * that never retires anything should not pay for the concept. `today` is
 * injectable so a test (or a view pinned to a survey date) can ask about a
 * different day; it defaults to the real one.
 */
export function isCurrent(
  definition: AnyNodeDefinition | undefined,
  node: { id: string; kind: string } & Record<string, unknown>,
  today?: string,
): boolean {
  const lifecycle = definition?.lifecycle;
  if (!lifecycle) return true;
  const value = node[lifecycle.field];
  if (lifecycle.retired === "date") {
    // No date means no expiry: an open-ended node is current for ever.
    if (typeof value !== "string" || value.length === 0) return true;
    // The clock is read only where a date decides: a search asks this of every record it looks through.
    return value >= (today ?? new Date().toISOString().slice(0, 10));
  }
  return !lifecycle.retired.includes(value);
}

/**
 * WHAT TELLS TWO SAME-NAMED THINGS APART, among the nodes a person is
 * choosing from. A single and its album are both "Blue Hour", and every
 * picker, every ask and the Find strip listed "Blue Hour, Blue Hour": a
 * choice nobody could make. For each node whose name another in the list
 * shares, the first fact that differs between them — "single" and "album",
 * or the dates — else its kind, else its id. Nodes with a name of their
 * own get nothing.
 */
export function tellApart(
  nodes: readonly ({ id: string; kind: string } & Record<string, unknown>)[],
  definitionOf: (kind: string) => AnyNodeDefinition | undefined,
): Map<string, string> {
  const apart = new Map<string, string>();
  const byName = new Map<string, typeof nodes[number][]>();
  for (const node of nodes) {
    const name = labelOf(definitionOf(node.kind), node).trim().toLowerCase();
    byName.set(name, [...(byName.get(name) ?? []), node]);
  }
  for (const same of byName.values()) {
    if (same.length < 2) continue;
    const byKind = new Map<string, typeof same>();
    for (const node of same) byKind.set(node.kind, [...(byKind.get(node.kind) ?? []), node]);
    for (const [kind, alike] of byKind) {
      // One of its kind among namesakes of other kinds: the kind is what differs.
      if (alike.length === 1) {
        apart.set(alike[0]!.id, nounOf(definitionOf(kind), kind));
        continue;
      }
      const facts = alike.map((node) => new Map(readableFields(node, definitionOf(node.kind)).map((field) => [field.key, field.alone])));
      const keys = [...new Set(facts.flatMap((fact) => [...fact.keys()]))];
      // A word before a number: "single" and "album" say more than two dates.
      const wordy = (key: string) => facts.every((fact) => !/\d/.test(fact.get(key) ?? ""));
      const ordered = [...keys.filter(wordy), ...keys.filter((key) => !wordy(key))];
      const telling = ordered.find((key) => new Set(facts.map((fact) => fact.get(key) ?? "")).size === alike.length);
      alike.forEach((node, at) => {
        const fact = telling ? facts[at]!.get(telling) : undefined;
        apart.set(node.id, fact ?? node.id);
      });
    }
  }
  return apart;
}

/** Resolves a node's display label, honoring the declaration's override. */
export function labelOf(
  definition: AnyNodeDefinition | undefined,
  node: { id: string; kind: string } & Record<string, unknown>,
): string {
  if (definition?.label) {
    return definition.label(node);
  }
  const own = node["label"];
  return typeof own === "string" && own.length > 0 ? own : node.id;
}

/**
 * Prose, shortened to a length, at a WORD BOUNDARY.
 *
 * Every app here had `text.slice(0, 60)` in its label function, and every one
 * of them produced headings like "Hold the banked hour for a night s" — cut
 * mid-word, with no ellipsis, in the largest type on the page. It is the
 * obvious thing to write and it is wrong every time, so the framework should
 * own it rather than leaving each app to discover it.
 *
 * A single word longer than the limit is still cut, because the alternative
 * is a heading that ignores the limit it was given.
 */
export function summarize(text: string, max = 60): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const boundary = cut.lastIndexOf(" ");
  // A trailing comma or full stop before the ellipsis reads as a typo.
  return `${(boundary > max * 0.5 ? cut.slice(0, boundary) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

/** Resolves a node's prose description, used for a11y and tool text. */
export function describeNode(
  definition: AnyNodeDefinition | undefined,
  node: { id: string; kind: string } & Record<string, unknown>,
): string {
  if (definition?.describe) {
    return definition.describe(node);
  }
  return `${node.kind} ${labelOf(definition, node)}`;
}

/** One field, as a person sees it. */
export interface ReadableField {
  readonly key: string;
  /** The field name in words, after `display.labels` and humanizing. */
  readonly label: string;
  /** The value in words, after `display.format` and the built-in defaults. */
  readonly value: string;
  /**
   * The value as it reads WITHOUT its label beside it — on a chip, in a
   * list line, on a card at summary. A word says what it is ("released");
   * a number or a yes/no does not, so it carries the label: "Track 8",
   * "Length 4:27", "Explicit: yes". A song's card read "8 · 4:27 · Yes",
   * which is three facts and no sentence.
   */
  readonly alone: string;
  /**
   * PROSE, NOT A FACT (FR-147): a string the declaration allows more than
   * 500 characters (a document's `text`), or one that holds a line break
   * or runs past 160 characters. A record draws it the width of the
   * record with its label above it, keeps its paragraphs and lists, and
   * edits it in a text area.
   */
  readonly long: boolean;
}

/** Never shown: identity and the name, which the heading already is. */
const NOT_A_FIELD = new Set(["id", "kind", "label"]);

/** `effectiveFrom` shown to a person is a schema leaking through a surface. */
/**
 * WHAT AN ACT IS CALLED, everywhere it is offered — the actions strip, the
 * seat, a model's tool: its title, else its name in words ("markDone" is
 * "Mark done").
 */
export function actTitle(act: { readonly name: string; readonly title?: string }): string {
  return act.title ?? humanizeField(act.name);
}

export function humanizeField(field: string): string {
  const spaced = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * A field in words, as the declaration says it: its `display.labels` entry,
 * else the key spoken. Every sentence that names a field — "Nothing
 * declared writes the planned time", a tooltip, a refusal — reads it here,
 * so `plannedAt` never reaches a person from one surface while another says
 * "Planned at".
 */
/**
 * One of a field's values, as the declaration says it: its `display.format`
 * where it has one ("SUV", "Plug-in hybrid"), else the value spoken. A
 * filter that offered "suv" and "plug-in-hybrid" beside a record that said
 * "SUV" and "Plug-in hybrid" read one field two ways.
 */
export function valueWords(definition: AnyNodeDefinition | undefined, key: string, value: unknown): string {
  const format = definition?.display?.format?.[key];
  return format ? format(value) : typeof value === "string" ? humanizeField(value) : String(value);
}

/**
 * HOW MANY OF A KIND, in its words: "1 car", "3 cars", "1 test drive" —
 * the noun for one, the plural for the rest. Sentences that took the kind's
 * id for one ("1 vehicle", "1 test-drive") said the declaration's
 * identifier wherever a count came to one.
 */
export function counted(schema: { tryDefinition(kind: string): { readonly noun?: string; readonly plural?: string } | undefined }, kind: string, count: number): string {
  const definition = schema.tryDefinition(kind);
  return `${count} ${count === 1 ? nounOf(definition, kind) : pluralOf(schema, kind).toLowerCase()}`;
}

/**
 * WHAT A KIND'S RECORDS ARE CALLED TOGETHER: its declared plural, else its
 * name with an "s" — the word the routed face's lists are titled and
 * addressed by, so every surface that says a kind's many says the same.
 */
export function pluralOf(schema: { tryDefinition(kind: string): { readonly plural?: string } | undefined }, kind: string): string {
  return schema.tryDefinition(kind)?.plural ?? `${kind}s`;
}

/**
 * A RELATION IN WORDS, read from the end you are standing on (FR-142): from
 * the kind that declares it, its `description`; from the far end, its
 * `inverse`. Where the declaration says nothing, the key is spoken —
 * "partOf" is "part of", never `partOf` — so a sentence a person reads never
 * carries a key, whichever surface wrote it.
 */
export function edgeWords(
  schema: { tryDefinition(kind: string): { readonly edges?: unknown } | undefined },
  ownerKind: string,
  edgeKind: string,
  direction: "out" | "in",
): string {
  const edges = schema.tryDefinition(ownerKind)?.edges as Readonly<Record<string, { readonly description?: string; readonly inverse?: string }>> | undefined;
  const declared = edges && Object.prototype.hasOwnProperty.call(edges, edgeKind) ? edges[edgeKind] : undefined;
  const said = direction === "out" ? declared?.description : declared?.inverse;
  return said ?? humanizeField(edgeKind).toLowerCase();
}

export function fieldWords(
  definition: { readonly display?: { readonly labels?: Readonly<Record<string, string>> }; readonly computed?: Readonly<Record<string, string | { readonly label?: string }>> } | undefined,
  key: string,
): string {
  // A computed field's own label is its words too (FR-83), where the display does not say otherwise.
  const computed = definition?.computed && Object.prototype.hasOwnProperty.call(definition.computed, key) ? definition.computed[key] : undefined;
  return definition?.display?.labels?.[key] ?? (typeof computed === "object" ? computed.label : undefined) ?? humanizeField(key);
}

/*
 * "a item" is the sound of generated prose.
 *
 * Every surface here writes sentences about a kind the author named —
 * "Add a item", "Nothing you may do with a item", "from a item it is
 * captioned" — and a kind is as likely to begin with a vowel as not. The
 * article is therefore never a literal: it is derived from the word, in one
 * place, so that the scaffolder, the checker and the strip cannot disagree.
 *
 * Sound, not spelling, decides it, and the two disagree in exactly two small
 * families that domain vocabulary is full of: "a user", "a unit" (the "yoo"
 * sound), and "an hour", "an heir" (the silent h). Both are listed rather
 * than guessed at.
 */
const SOUNDS_LIKE_YOU = /^(u[nt]i|use|usu|uti|ubiq|eu|ewe|one|once)/;
const SILENT_H = /^(hour|honest|hono[ur]r?|heir)/;

/** "a" or "an", by how the word SOUNDS. */
export function article(word: string): "a" | "an" {
  const first = humanizeField(word).toLowerCase();
  if (SILENT_H.test(first)) return "an";
  if (SOUNDS_LIKE_YOU.test(first)) return "a";
  return /^[aeiou]/.test(first) ? "an" : "a";
}

/**
 * A kind in words, with its article: "an item", "a work order".
 *
 * Takes the declared id and speaks it — the hyphen in `work-order` is a
 * identifier's punctuation, not a word's.
 */
export function withArticle(word: string): string {
  return `${article(word)} ${humanizeField(word).toLowerCase()}`;
}

/**
 * What one of a kind is called: its declared `noun`, else its id spoken.
 * Every sentence about ONE of them — "Change the staff member", "a staff
 * member called …", "Remove the staff member" — reads this, never the id.
 */
export function nounOf(definition: { readonly noun?: string } | undefined, kind: string): string {
  return definition?.noun ?? humanizeField(kind).toLowerCase();
}

/** Whether `line` carries `value` as whole words: "2027 Subaru Forester" says "Subaru" and "2027", not "Sub". */
function saysAsWords(line: string, value: string): boolean {
  if (value.length === 0) return false;
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s·,(/])${escaped}($|[\\s·,)/])`).test(line);
}

/**
 * WHICH of a node's fields a person sees, and HOW each one reads.
 *
 * One implementation, because there were two: the record on a page and the
 * summary on a card each decided this for themselves, and every rule — hide an
 * ordering key, format minutes as a time, render a boolean as a word, drop a
 * value the heading already said — had to be written into both and kept in
 * step by hand. They diverged the day the second one was written, which is how
 * a summary card ended up showing a list's ordering key as a chip reading "0"
 * while the page beside it did not.
 *
 * `said` is what the surrounding view has already put on screen. A value the
 * heading already carries is not information twice, it is the same sentence
 * twice — and where the heading is a SHORTENED form of a field, an exact
 * comparison never catches it, so the summary's stem is compared too.
 */
export function readableFields(
  node: Record<string, unknown>,
  definition: AnyNodeDefinition | undefined,
  options: {
    /** How many a GLANCE shows. Unset, every field: a record is read whole (W-156). */
    readonly limit?: number;
    readonly said?: readonly (string | undefined)[];
    /**
     * A GLANCE drops a value the heading already says as a WORD, not only as
     * the whole heading: a vehicle's summary is headed "2027 Subaru Forester
     * Sport", and "Year 2027 · Subaru" under it spent two of its three facts
     * saying the heading again while the price never appeared. A record's
     * full facts keep every field — that is where each is changed.
     */
    readonly glance?: boolean;
  } = {},
): readonly ReadableField[] {
  const display = definition?.display;
  const skip = new Set([...NOT_A_FIELD, ...(display?.hide ?? [])]);
  const said = (options.said ?? []).filter((text): text is string => Boolean(text));
  const stems = said
    .filter((text) => text.endsWith("…"))
    .map((text) => text.replace(/…$/, "").trim())
    .filter((stem) => stem.length > 12);

  const fields: ReadableField[] = [];
  /*
   * IN THE ORDER THE DECLARATION SAYS, NOT THE ORDER THE RECORD WAS WRITTEN
   * IN (FR-148). This read `Object.entries(node)`, so a record created with
   * three of its fields and given two more later read Status, Summary, Due,
   * Draft, Subject line — the order of its writes, which nobody chose.
   * A glance says what the declaration chose for it first (`display.glance`);
   * a record's page, what its page chose (`display.page`); then the fields
   * as the kind declares them, its computed ones after.
   */
  const chosen = options.glance ? (display?.glance ?? []) : pageOrder(display?.page);
  const keys = [...new Set([...chosen, ...declaredOrder(definition), ...Object.keys(node)])].filter((key) => Object.hasOwn(node, key));
  const entries = keys.map((key) => [key, node[key]] as const);
  for (const [key, value] of entries) {
    if (skip.has(key) || value === undefined || value === null) continue;
    const format = display?.format?.[key];
    /*
     * A NESTED OBJECT HAS NO ONE-LINE RENDERING, and inventing one is worse
     * than leaving it to a view that knows what it is.
     *
     * That was true of an object and was not checked of an ARRAY of them,
     * which fell through to `join(", ")` — so a piece of ground with a
     * five-corner outline had a field on its record reading "[object
     * Object], [object Object], [object Object], [object Object]". Nobody
     * wrote that; nobody could have read it. The shape is drawn on the map
     * and belongs there, not in a list of words.
     *
     * A declaration that HAS a one-line rendering says so with `format`,
     * and then it is the declaration's sentence rather than this one's
     * guess — "5 corners" is a useful thing to say and only the app knows
     * that the numbers are corners.
     */
    const nested =
      typeof value === "object" &&
      (!Array.isArray(value) || value.some((one) => typeof one === "object" && one !== null));
    if (nested && format === undefined) continue;
    const text = format
      ? format(value)
      : Array.isArray(value)
        ? value.join(", ")
        : typeof value === "boolean"
          ? // Nobody says "false". A boolean is a state, and the words for a
            // state are words.
            value
            ? "Yes"
            : "No"
          : // A GLANCE says a day as a person reads one ("28 Aug 2026"); a record's facts keep the day as it is written, where it is changed.
            options.glance && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? dayAsRead(value)
            : String(value);

    if (said.includes(text) || stems.some((stem) => text.startsWith(stem))) continue;
    if (options.glance && (typeof value === "string" || typeof value === "number") && said.some((line) => saysAsWords(line, text))) continue;
    const label = fieldWords(definition, key);
    const alone =
      typeof value === "number" ? `${label} ${text}` : typeof value === "boolean" ? `${label}: ${text.toLowerCase()}` : text;
    fields.push({ key, label, value: text, alone, long: typeof value === "string" && isLongText(definition, key, text) });
    if (options.limit !== undefined && fields.length >= options.limit) break;
  }
  return fields;
}

const MONTH_WORDS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A `YYYY-MM-DD` day as a person reads it on a card: "28 Aug 2026". */
function dayAsRead(day: string): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return `${date} ${MONTH_WORDS[month - 1] ?? ""} ${year}`;
}

/** The kind's fields as it declares them, then its computed fields. */
function declaredOrder(definition: AnyNodeDefinition | undefined): readonly string[] {
  const shape = (definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape;
  return [...Object.keys(shape ?? {}), ...Object.keys((definition as { computed?: object } | undefined)?.computed ?? {})];
}

/** Every field a page names, in the order it names them: its first fields, then each group's. */
function pageOrder(page: PageFields | undefined): readonly string[] {
  return [...(page?.fields ?? []), ...(page?.groups ?? []).flatMap((group) => group.fields)];
}

/** What a string field may hold beyond which it is prose: a document's `string` holds 500, its `text` 20,000. */
const PROSE_ALLOWED = 500;
/** A value this long, or with a line break in it, is read as prose whatever its field allows. */
const PROSE_LENGTH = 160;

/** The string schema under optional, default and nullable. */
function stringSchema(schema: unknown): { readonly checks?: readonly { readonly _zod?: { readonly def?: { readonly check?: string; readonly maximum?: number } } }[] } | undefined {
  let at = schema as { _zod?: { def?: { type?: string; innerType?: unknown; checks?: never } } } | undefined;
  for (let depth = 0; depth < 6 && at?._zod?.def?.innerType !== undefined; depth++) at = at._zod.def.innerType as typeof at;
  return at?._zod?.def?.type === "string" ? (at._zod.def as never) : undefined;
}

/**
 * WHETHER A FIELD'S VALUE IS PROSE (FR-147): a string field declared to hold
 * more than 500 characters — a document's `text`, or `z.string().max(5000)`
 * in TypeScript — whatever it holds now, so an empty draft is still edited
 * in a text area; or a value with a line break in it, or longer than 160
 * characters.
 */
export function isLongText(definition: AnyNodeDefinition | undefined, key: string, value: unknown): boolean {
  const field = stringSchema((definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape?.[key]);
  if (field?.checks?.some((check) => check._zod?.def?.check === "max_length" && (check._zod.def.maximum ?? 0) > PROSE_ALLOWED)) return true;
  return typeof value === "string" && (value.includes("\n") || value.length > PROSE_LENGTH);
}

/** One run of a record's facts: under a group's title, or (the first) under none. */
export interface FieldSection<F extends { readonly key: string } = ReadableField> {
  readonly title?: string;
  readonly fields: readonly F[];
}

/**
 * A RECORD'S FACTS, IN THE SECTIONS ITS PAGE DECLARES (FR-148).
 *
 * `fields` are read as `readableFields` ordered them. Unsaid, one untitled
 * section of all of them. With `display.page`, its `fields` first, untitled;
 * each of its `groups` under its title; and what neither names under
 * "Details" when there are groups, else after the first fields. A section
 * with nothing to show is left out.
 */
export function pageSections<F extends { readonly key: string }>(definition: AnyNodeDefinition | undefined, fields: readonly F[]): readonly FieldSection<F>[] {
  const page = definition?.display?.page;
  const groups = page?.groups ?? [];
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const named = new Set(pageOrder(page));
  const pick = (keys: readonly string[]) => keys.flatMap((key) => (byKey.has(key) ? [byKey.get(key)!] : []));
  const rest = fields.filter((field) => !named.has(field.key));
  const sections: FieldSection<F>[] = [
    { fields: [...pick(page?.fields ?? []), ...(groups.length > 0 ? [] : rest)] },
    ...groups.map((group) => ({ title: group.title, fields: pick(group.fields) })),
    ...(groups.length > 0 ? [{ title: "Details", fields: rest }] : []),
  ];
  return sections.filter((section) => section.fields.length > 0);
}
