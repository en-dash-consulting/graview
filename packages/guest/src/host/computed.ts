import type { AnySchema } from "@graview/core";
import { computedNames, computedValues } from "@graview/core/blocks";
import type { ComputedOn } from "./manifest.js";

/**
 * A RECORD'S COMPUTED VALUES, AS A WORKER VIEW IS HANDED THEM (Roadmap
 * f-computed-in-views): each computed field of the record worked out over
 * the graph handed in — the viewer's, `store.seenBy(principal).graph`, never
 * the store's — beside its stored fields. A value that names a record is
 * `{ id, kind, label }`, a set a list of them; one that cannot be worked out
 * is left off, as a field with no value is. Its own module, fetched before a
 * view whose kinds have computed values starts, so registering a view
 * carries no evaluator.
 */
export function computedOn(schema: AnySchema): ComputedOn {
  const names = new Map<string, number>();
  return (graph, node) => {
    const kind = (node as { readonly kind: string }).kind;
    let count = names.get(kind);
    if (count === undefined) names.set(kind, (count = computedNames(schema, kind).length));
    return count === 0 ? {} : computedValues(schema, graph as never, node as never).values;
  };
}
