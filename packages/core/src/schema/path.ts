import type { AnySchema } from "./schema.js";

/**
 * WHERE A PATH OF EDGES GOES, by kind, read off the declaration.
 *
 * A lens that walks a relationship through a node — offers that apply to
 * cars that are on show at showrooms — names its edges from one end to the
 * other, each followed in either direction. Named the wrong way round it
 * reaches nothing, and the picture said "6 offers with no showroom" of six
 * offers on show at every showroom (the seventh walk). Asked of the schema,
 * a path that cannot reach its far end is a binding error, not a picture.
 */
export function walkKinds(
  schema: AnySchema,
  from: string,
  path: readonly string[],
): { readonly ok: true; readonly reached: ReadonlySet<string> } | { readonly ok: false; readonly at: number } {
  let here = new Set([from]);
  for (const [at, step] of path.entries()) {
    const edge = schema.edge(step);
    if (!edge) return { ok: false, at };
    const froms = edge.from as readonly string[];
    const tos = edge.to === "*" ? (schema.kinds as readonly string[]) : (edge.to as readonly string[]);
    const next = new Set<string>();
    for (const kind of here) {
      if (froms.includes(kind)) for (const one of tos) next.add(one);
      if (edge.to === "*" || tos.includes(kind)) for (const one of froms) next.add(one);
    }
    if (next.size === 0) return { ok: false, at };
    here = next;
  }
  return { ok: true, reached: here };
}
