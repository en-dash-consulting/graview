import { defOf } from "./zod.js";

/*
 * A TEXT FIELD WRITTEN IN MARKDOWN (FR-180).
 *
 * A document says `{"type": "text", "format": "markdown"}`; TypeScript says
 * `markdownField()`. The value is kept as written — the Markdown, not a
 * rendering of it — and the mark is on the schema's def, as a file field's
 * is (`files.ts`), so a clone shares it, a refinement spreads it and a
 * wrapper holds it inside. The record's page draws it as prose; a list, a
 * card, a describe line and a search hit say its start with the syntax
 * taken out (`excerptOf`).
 *
 * A hosted page builds a document's fields up front, and a module both its
 * first chunk and a fetched one reach is a chunk of its own: so a
 * document's field is marked where it is built (`fieldSchema`, by the same
 * `Symbol.for`), and this is reached only by what declares, draws or
 * describes a record.
 */
export const MARKDOWN = Symbol.for("@graview/core:markdown");

/** Marks a schema as holding Markdown. */
export const markMarkdown = <T extends object>(schema: T): T => (((defOf(schema) as Record<symbol, unknown>)[MARKDOWN] = 1), schema);

/** Whether a field holds Markdown — under optional, default and nullable. */
export function isMarkdownField(schema: unknown): boolean {
  const def = defOf(schema) as { [MARKDOWN]?: 1; innerType?: unknown } | undefined;
  return !!def && (def[MARKDOWN] === 1 || isMarkdownField(def.innerType));
}
