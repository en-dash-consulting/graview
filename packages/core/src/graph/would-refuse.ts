import type { AnySchema, NodeOfSchema } from "../schema/schema.js";
import { personSeatOf } from "./archived.js";
import type { Graph, GraphReading, GraphWrite } from "./graph.js";
import type { Primitive } from "./primitives.js";
import { edgeId, type GraphEdge } from "./types.js";

/**
 * WHAT APPLYING THESE WOULD REFUSE, WITHOUT APPLYING THEM OR COPYING THE
 * GRAPH: each primitive judged by the graph's own `judged` — the checks
 * `applyPrimitives` makes, in the words it refuses in — over what the
 * earlier ones in the list would leave, kept here as a layer over the
 * graph. Undefined where they would all land. Apart from the graph, so a
 * page that never asks it (`mayRun`, `@graview/core/seat`) carries none of it.
 */
export function wouldRefuse<S extends AnySchema>(graph: Graph<S>, primitives: readonly Primitive[]): unknown {
  const base = graph.reading;
  const nodes = new Map<string, NodeOfSchema<S> | null>();
  const edges = new Map<string, GraphEdge | null>();
  const at: GraphReading<S> = {
    node: (id) => (nodes.has(id) ? (nodes.get(id) ?? undefined) : base.node(id)),
    edge: (key) => (edges.has(key) ? (edges.get(key) ?? undefined) : base.edge(key)),
    edgesAt: (id) => {
      const out = new Map<string, GraphEdge>();
      for (const edge of base.edgesAt(id)) out.set(edgeId(edge), edge);
      for (const [key, edge] of edges) {
        if (edge === null) out.delete(key);
        else if (edge.from === id || edge.to === id) out.set(key, edge);
      }
      return [...out.values()];
    },
    linkKey: (id) => {
      for (const [key, edge] of edges) if (edge?.id === id) return key;
      const key = base.linkKey(id);
      return key !== undefined && edges.get(key) !== null ? key : undefined;
    },
    seated: (seat) => {
      const ids = new Set(base.seated(seat).filter((id) => !nodes.has(id)));
      for (const [id, node] of nodes) if (node && personSeatOf(node) === seat) ids.add(id);
      return [...ids];
    },
  };
  const take = (w: GraphWrite<S>) => {
    if (w.op === "add-node") nodes.set(w.node.id, w.node);
    else if (w.op === "patch-node") nodes.set(w.current.id, w.next);
    else if (w.op === "add-edge") edges.set(edgeId(w.edge), w.edge);
    else if (w.op === "remove-edge") edges.set(edgeId(w.edge), null);
    else if (w.op === "remove-node") {
      for (const edge of at.edgesAt(w.node.id)) edges.set(edgeId(edge), null);
      nodes.set(w.node.id, null);
    }
  };
  try {
    for (const primitive of primitives) take(graph.judged(primitive, at));
  } catch (error) {
    return error;
  }
  return undefined;
}
