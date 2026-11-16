/*
 * A FIELD THAT SAYS IT IS CITED (Roadmap f-field-cites-marker).
 *
 * A claim's figure, a quote, a date somebody looked up: a value that should
 * say where it came from. The field's declaration names, on the same kind,
 * the field or the relation that holds its citation (`cites: "source"`),
 * and from that the checker, the app's own actor and a worker view can each
 * say which records hold a value in it with nothing cited.
 *
 * The mark is on the schema's def, as the collaborative mark is
 * (`collaborative.ts`), so a clone shares it and a wrapper holds it inside:
 * `markCites(z.number(), "source")` in a `defineNode`, and a document's field
 * says `"cites": "source"`, marked where it is built (`fieldSchema`) by the
 * same `Symbol.for`. Read without zod, so a page carries no zod helper for it.
 */
export const CITES = Symbol.for("@graview/core:cites");
type Def = { readonly innerType?: unknown; readonly [key: symbol]: unknown };
const defOf = (schema: unknown): Def | undefined => (typeof schema === "object" && schema !== null ? (schema as { _zod?: { def?: Def } })._zod?.def : undefined);

/** Marks a field as cited by another field or a relation of its kind, named. */
export const markCites = <T extends object>(schema: T, by: string): T => {
  const def = defOf(schema) as Record<symbol, unknown> | undefined;
  if (def) def[CITES] = by;
  return schema;
};

/** What a field's own schema says cites it, under optional, default and nullable; undefined when nothing does. */
export function citedBy(schema: unknown): string | undefined {
  let at = schema;
  for (let depth = 0; depth < 6; depth++) {
    const def = defOf(at);
    if (!def) return undefined;
    const by = def[CITES];
    if (typeof by === "string") return by;
    if (def.innerType === undefined) return undefined;
    at = def.innerType;
  }
  return undefined;
}

type Schemaish = { tryDefinition(kind: string): unknown };
const shapeOf = (schema: Schemaish, kind: string) => (schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape;

/** The field or relation that cites one field of a kind, as declared; undefined for a field nothing cites, or the kind does not declare. */
export function citesOf(schema: Schemaish, kind: string | undefined, field: string): string | undefined {
  if (kind === undefined) return undefined;
  const shape = shapeOf(schema, kind);
  return shape && Object.prototype.hasOwnProperty.call(shape, field) ? citedBy(shape[field]) : undefined;
}

/** Every cited field of a kind, each with what cites it: `{ population: "source" }`; `{}` for a kind with none. */
export function citedFieldsOf(schema: Schemaish, kind: string): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [field, one] of Object.entries(shapeOf(schema, kind) ?? {})) {
    const by = citedBy(one);
    if (by !== undefined) out[field] = by;
  }
  return out;
}

/** Whether a value says anything: not undefined, null, blank words or an empty list. */
export const holdsValue = (value: unknown): boolean => !(value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0));
