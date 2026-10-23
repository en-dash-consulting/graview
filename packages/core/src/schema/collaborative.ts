/*
 * TEXT TYPED TOGETHER (Roadmap f-collab-text, phase 2).
 *
 * Whether two people may type into one text field at once — each keystroke
 * a splice, transformed over the others — is the declaration's to say, and
 * never the value's: an empty draft of an essay is typed together as the
 * essay is. Declared prose is, unless it says otherwise: a Markdown field,
 * a document's `text`, a string declared to hold more than 500 characters
 * (`z.string().max(5000)`). A short string — a name, a code, a status — is
 * written whole, and a stale write of it is a conflict to choose over.
 *
 * The mark is on the schema's def, as Markdown's is (`markdown.ts`), so a
 * clone shares it and a wrapper holds it inside; `markCollaborative(schema,
 * false)` says a long field is written whole, and a document's field says
 * `"collaborative": false | true`, marked where it is built (`fieldSchema`)
 * by the same `Symbol.for`. Read without zod, so the store carries it and
 * not zod's helpers.
 */
export const COLLABORATIVE = Symbol.for("@graview/core:collaborative");
type Def = { readonly type?: string; readonly innerType?: unknown; readonly checks?: readonly unknown[]; readonly [key: symbol]: unknown };
export const defOf = (schema: unknown): Def | undefined => (typeof schema === "object" && schema !== null ? (schema as { _zod?: { def?: Def } })._zod?.def : undefined);

/** Marks a schema as typed together (`true`, the default) or written whole (`false`), whatever it would be by default. */
export const markCollaborative = <T extends object>(schema: T, on = true): T => {
  const def = defOf(schema) as Record<symbol, unknown> | undefined;
  if (def) def[COLLABORATIVE] = on ? 1 : 0;
  return schema;
};
