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
const MARKDOWN = Symbol.for("@graview/core:markdown");

/** What a string field may hold beyond which it is prose, as a record's page reads it (`isLongText`). */
const PROSE_ALLOWED = 500;

type Def = { readonly type?: string; readonly innerType?: unknown; readonly checks?: readonly unknown[]; readonly [key: symbol]: unknown };
const defOf = (schema: unknown): Def | undefined => (typeof schema === "object" && schema !== null ? (schema as { _zod?: { def?: Def } })._zod?.def : undefined);

/** Marks a schema as typed together (`true`, the default) or written whole (`false`), whatever it would be by default. */
export const markCollaborative = <T extends object>(schema: T, on = true): T => {
  const def = defOf(schema) as Record<symbol, unknown> | undefined;
  if (def) def[COLLABORATIVE] = on ? 1 : 0;
  return schema;
};

/**
 * Whether a field is typed together: its mark where it has one, under
 * optional, default and nullable; else whether it is declared prose — a
 * Markdown field, or a string declared to hold more than 500 characters.
 */
export function isCollaborativeField(schema: unknown): boolean {
  let at = schema;
  for (let depth = 0; depth < 6; depth++) {
    const def = defOf(at);
    if (!def) return false;
    if (def[COLLABORATIVE] !== undefined) return def[COLLABORATIVE] === 1;
    if (def[MARKDOWN] === 1) return true;
    if (def.type === "string") {
      return (def.checks ?? []).some((check) => {
        const said = defOf(check) as { readonly check?: string; readonly maximum?: number } | undefined;
        return said?.check === "max_length" && (said.maximum ?? 0) > PROSE_ALLOWED;
      });
    }
    if (def.innerType === undefined) return false;
    at = def.innerType;
  }
  return false;
}

/** Whether one field of a kind is typed together, read off the declaration: false for a field the kind does not declare. */
export function collaborativeFieldOf(schema: { tryDefinition(kind: string): unknown }, kind: string | undefined, field: string): boolean {
  if (kind === undefined || field === "id" || field === "kind") return false;
  const shape = (schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape;
  return !!shape && Object.prototype.hasOwnProperty.call(shape, field) && isCollaborativeField(shape[field]);
}
