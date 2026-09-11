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

/** Resolves a node's display label, honouring the declaration's override. */
export function labelOf(
  definition: AnyNodeDefinition | undefined,
  node: { id: string; kind: string } & Record<string, unknown>,
): string {
  if (definition?.label) {
    return definition.label(node as never);
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
    return definition.describe(node as never);
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
  options: { readonly limit?: number; readonly said?: readonly (string | undefined)[] } = {},
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
    // A nested object has no one-line rendering, and inventing one is worse
    // than leaving it to a view that knows what it is.
    if (typeof value === "object" && !Array.isArray(value)) continue;

    const format = display?.format?.[key];
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
    fields.push({ key, label: display?.labels?.[key] ?? humaniseField(key), value: text });
    if (fields.length >= (options.limit ?? 10)) break;
  }
  return fields;
}
