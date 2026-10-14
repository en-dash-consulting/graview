import type { z } from "zod";
import { isoToday, numberAsRead } from "../days.js";
import { capitalize } from "../capital.js";
import type { FileValue } from "./files.js";
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
  today?: string,
): boolean {
  const lifecycle = definition?.lifecycle;
  if (!lifecycle) return true;
  const value = node[lifecycle.field];
  if (lifecycle.retired === "date") {
    // No date means no expiry: an open-ended node is current for ever.
    if (typeof value !== "string" || value.length === 0) return true;
    // The clock is read only where a date decides: a search asks this of every record it looks through.
    return value >= (today ?? isoToday());
  }
  return !lifecycle.retired.includes(value);
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

/** One field, as a person sees it. */
export interface ReadableField {
  readonly key: string;
  /**
   * THE PICTURES OR DOCUMENTS IT HOLDS (FR-162), where it holds files: a
   * record draws them — a gallery, a document by its name, type and size —
   * and its words are their names. A glance leaves them out of its words.
   */
  readonly files?: readonly FileValue[];
  /**
   * ANOTHER APP'S ADDRESS (FR-171), where the field links to one: a record
   * draws it as the app the host's `resolveApp` names, never as the
   * address. A glance leaves it out of its words, as it does a file.
   */
  readonly app?: string;
  /**
   * A DATE THAT MAY REPEAT (`repeat.ts`): its value says how and the next
   * one ("Every Tuesday, next Oct 27"), and a record draws, beside it, the
   * control that changes how it repeats (`<field>Repeat`).
   */
  readonly repeats?: true;
  /**
   * WHERE A PHONE OR A PLACE TAKES ITS READER: a `tel:` link, or the
   * reader's maps app. A face draws the value as a link to it.
   */
  readonly href?: string;
  /** The field name in words, after `display.labels` and humanizing. */
  readonly label: string;
  /** The value in words, after `display.format` and the built-in defaults: a day as a person reads it, a choice as it is declared. */
  readonly value: string;
  /**
   * The value as the record keeps it — `2026-08-28`, `tue` — for the one
   * place that shows it so: the edit control, which writes it back.
   */
  readonly stored: string;
  /**
   * The value as it reads WITHOUT its label beside it — on a chip, in a
   * list line, on a card at summary. A word says what it is ("Released");
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
  /**
   * WRITTEN IN MARKDOWN (FR-180): the declaration says so
   * (`markdownField()`, `{"type": "text", "format": "markdown"}`). A
   * record's page draws it as prose; a glance says its start with the
   * syntax taken out.
   */
  readonly markdown?: true;
}

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
  return capitalize(spaced);
}

/**
 * A field in words, as the declaration says it: its `display.labels` entry,
 * else the key spoken. Every sentence that names a field — "Nothing
 * declared writes the planned time", a tooltip, a refusal — reads it here,
 * so `plannedAt` never reaches a person from one surface while another says
 * "Planned at".
 */
/**
 * HOW MANY OF A KIND, in its words: "1 car", "3 cars", "1 test drive" —
 * the noun for one, the plural for the rest. Sentences that took the kind's
 * id for one ("1 vehicle", "1 test-drive") said the declaration's
 * identifier wherever a count came to one.
 */
export function counted(schema: { tryDefinition(kind: string): { readonly noun?: string; readonly plural?: string } | undefined }, kind: string, count: number): string {
  const definition = schema.tryDefinition(kind);
  // A count is a figure, said in the page's locale like every other (W-198): "7,540 inspections", never "7540".
  return `${numberAsRead(count)} ${count === 1 ? nounOf(definition, kind) : pluralOf(schema, kind).toLowerCase()}`;
}

/**
 * WHAT A KIND'S RECORDS ARE CALLED TOGETHER, inside a sentence: its
 * declared plural, else its name in words with an "s" — "shelf items" for
 * `shelfItem`, split as `humanizeField` splits a name. Every surface that
 * says a kind's many says the same. A label is `pluralLabel`; an address is
 * `kindPath`, which keeps the name as written.
 */
export function pluralOf(schema: { tryDefinition(kind: string): { readonly plural?: string } | undefined }, kind: string): string {
  return schema.tryDefinition(kind)?.plural ?? `${humanizeField(kind).toLowerCase()}s`;
}

/**
 * THE SAME WORD STANDING ALONE as a label — a heading, a hit, a group's
 * name, a button that starts with it: `pluralOf` with its first letter
 * upper-cased ("Tasks"). Inside a sentence the plural is `pluralOf` itself.
 */
export function pluralLabel(schema: { tryDefinition(kind: string): { readonly plural?: string } | undefined }, kind: string): string {
  return capitalize(pluralOf(schema, kind));
}

export function fieldWords(
  definition: { readonly display?: { readonly labels?: Readonly<Record<string, string>> }; readonly computed?: Readonly<Record<string, string | { readonly label?: string }>> } | undefined,
  key: string,
): string {
  // A computed field's own label is its words too (FR-83), where the display does not say otherwise.
  const computed = definition?.computed && Object.hasOwn(definition.computed, key) ? definition.computed[key] : undefined;
  // A kind's `label` is its name: the log said "Change Woodworking: label → …" of a shelf renamed (W-184).
  return definition?.display?.labels?.[key] ?? (typeof computed === "object" ? computed.label : undefined) ?? (key === "label" ? "Name" : humanizeField(key));
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

