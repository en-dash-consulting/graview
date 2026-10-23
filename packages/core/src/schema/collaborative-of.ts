import { COLLABORATIVE, defOf } from "./collaborative.js";

/*
 * WHICH FIELDS ARE TYPED TOGETHER, READ (Roadmap f-collab-text). Apart from
 * `./collaborative.ts`, whose mark every declaration may set, so a page that
 * never types carries none of the reading: the store asks through its
 * typing hook, and `@graview/core/typing` exports it.
 */
const MARKDOWN = Symbol.for("@graview/core:markdown");

/** What a string field may hold beyond which it is prose, as a record's page reads it (`isLongText`). */
const PROSE_ALLOWED = 500;

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
