import type { GraphReader } from "../graph/types.js";
import type { AnySchema } from "../schema/schema.js";
import { humanizeField } from "../schema/define-node.js";
import { computedOf } from "./computed.js";
import { computedValues, type ComputedValues } from "./computed-values.js";

/*
 * THE WHOLE GRAPH'S FACTS, READ — in a module of their own, reached only by
 * what reads them (`@graview/core/blocks`, the place describer): imported
 * beside a record's computed values, which a face draws with up front, they
 * would ride in its first chunk.
 */

/**
 * THE WHOLE GRAPH'S FACTS (a document's top-level `computed`), worked out
 * over `graph` — the seat's, as a record's computed values are — each under
 * its own budget; one that cannot be worked out is `refused`, not thrown.
 * What `fact('<name>')` reads in a block, a rule or a template, as data for
 * a face of the app's own and for an agent.
 */
export function factValues(schema: AnySchema, graph: GraphReader, options: { readonly budget?: number; readonly today?: string } = {}): ComputedValues {
  return computedValues(schema, graph, null, options);
}

/** The facts' names, in declaration order, each with the words it is shown by. */
export function factNames(schema: AnySchema): readonly { readonly name: string; readonly label: string; readonly description?: string }[] {
  return [...computedOf(schema)].map(([name, entry]) => ({ name, label: entry.label ?? humanizeField(name), ...(entry.description ? { description: entry.description } : {}) }));
}
