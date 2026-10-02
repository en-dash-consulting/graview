import type { z } from "zod";
import type {
  AnyNodeDefinition,
  EdgeMap,
  EmptyEdgeMap,
  NodeDefinition,
  NodeDefinitionSpec,
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
  today: string = new Date().toISOString().slice(0, 10),
): boolean {
  const lifecycle = definition?.lifecycle;
  if (!lifecycle) return true;
  const value = node[lifecycle.field];
  if (lifecycle.retired === "date") {
    // No date means no expiry: an open-ended node is current for ever.
    if (typeof value !== "string" || value.length === 0) return true;
    return value >= today;
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

/** Resolves a node's display label, honouring the declaration's override. */
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
export function summarise(text: string, max = 60): string {
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
  /** The field name in words, after `display.labels` and humanising. */
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
}

/** Never shown: identity and the name, which the heading already is. */
const NOT_A_FIELD = new Set(["id", "kind", "label"]);

/** `effectiveFrom` shown to a person is a schema leaking through a surface. */
export function humaniseField(field: string): string {
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
  return format ? format(value) : typeof value === "string" ? humaniseField(value) : String(value);
}

export function fieldWords(definition: { readonly display?: { readonly labels?: Readonly<Record<string, string>> } } | undefined, key: string): string {
  return definition?.display?.labels?.[key] ?? humaniseField(key);
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
  const first = humaniseField(word).toLowerCase();
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
  return `${article(word)} ${humaniseField(word).toLowerCase()}`;
}

/**
 * What one of a kind is called: its declared `noun`, else its id spoken.
 * Every sentence about ONE of them — "Change the staff member", "a staff
 * member called …", "Remove the staff member" — reads this, never the id.
 */
export function nounOf(definition: { readonly noun?: string } | undefined, kind: string): string {
  return definition?.noun ?? humaniseField(kind).toLowerCase();
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
  for (const [key, value] of Object.entries(node)) {
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
          : String(value);

    if (said.includes(text) || stems.some((stem) => text.startsWith(stem))) continue;
    if (options.glance && (typeof value === "string" || typeof value === "number") && said.some((line) => saysAsWords(line, text))) continue;
    const label = fieldWords(definition, key);
    const alone =
      typeof value === "number" ? `${label} ${text}` : typeof value === "boolean" ? `${label}: ${text.toLowerCase()}` : text;
    fields.push({ key, label, value: text, alone });
    if (options.limit !== undefined && fields.length >= options.limit) break;
  }
  return fields;
}
