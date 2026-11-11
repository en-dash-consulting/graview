import { assertKnownValues, unknownPrimitive } from "../format-error.js";
import type { AnySchema, NodeOfSchema } from "../schema/schema.js";
import { applySplice } from "../text/splice.js";
import { edgeFieldsProblem } from "./edge-fields.js";
import { GraphError, MissingRecordError, NO_SUCH_LINK, NO_SUCH_RECORD, type Graph } from "./graph.js";
import { isUnset, type Primitive } from "./primitives.js";
import { edgeId, type GraphEdge } from "./types.js";

/** What of a graph its own checks read: the records and links it holds, and how it judges a record and a patch. */
interface Held<S extends AnySchema> {
  readonly nodes: ReadonlyMap<string, NodeOfSchema<S>>;
  readonly edges: ReadonlyMap<string, GraphEdge>;
  readonly linkIds: ReadonlyMap<string, string>;
  readonly validate: boolean;
  readonly schema: S;
  check(node: unknown): NodeOfSchema<S>;
  checkPatch(current: NodeOfSchema<S>, next: Record<string, unknown>, written: readonly string[]): NodeOfSchema<S>;
}

/**
 * WHAT APPLYING THESE WOULD REFUSE, WITHOUT APPLYING THEM OR COPYING THE
 * GRAPH: the error `Graph.applyPrimitives` would throw — a record or a link
 * not there, an id taken, a link the schema does not declare, a record or a
 * patch that does not fit its kind (the graph's own `check` and
 * `checkPatch`, in the words they refuse in) — or undefined where they
 * would all land. Read over what the earlier ones in the list would leave;
 * nothing is written and nobody is told. Apart from the graph, so a page
 * that never asks it (`mayRun`, `@graview/core/seat`) carries none of it.
 */
export function wouldRefuse<S extends AnySchema>(graph: Graph<S>, primitives: readonly Primitive[]): unknown {
  const held = graph as unknown as Held<S>;
  const nodes = new Map<string, NodeOfSchema<S> | null>();
  const edges = new Map<string, GraphEdge | null>();
  const nodeAt = (id: string) => (nodes.has(id) ? (nodes.get(id) ?? undefined) : held.nodes.get(id));
  const edgeAt = (key: string) => (edges.has(key) ? (edges.get(key) ?? undefined) : held.edges.get(key));
  try {
    for (const primitive of primitives) {
      switch (primitive.op) {
        case "add-node": {
          assertKnownValues(primitive.node);
          if (nodeAt(primitive.node.id)) throw new GraphError(`Duplicate node id "${primitive.node.id}"`);
          nodes.set(primitive.node.id, held.check(primitive.node));
          break;
        }
        case "remove-node": {
          const id = primitive.node.id;
          if (!nodeAt(id)) throw new MissingRecordError(id, NO_SUCH_RECORD.remove);
          nodes.set(id, null);
          for (const edge of [...graph.outEdges(id), ...graph.inEdges(id)]) edges.set(edgeId(edge), null);
          for (const [key, edge] of edges) if (edge && (edge.from === id || edge.to === id)) edges.set(key, null);
          break;
        }
        case "patch-node": {
          const current = nodeAt(primitive.id);
          if (!current) throw new MissingRecordError(primitive.id, NO_SUCH_RECORD.change);
          assertKnownValues(primitive.after);
          const next = { ...current } as Record<string, unknown>;
          for (const [key, value] of Object.entries(primitive.after)) {
            if (isUnset(value)) delete next[key];
            else next[key] = value;
          }
          nodes.set(primitive.id, held.checkPatch(current, next, Object.keys(primitive.after)));
          break;
        }
        case "splice-text": {
          const current = nodeAt(primitive.id);
          if (!current) throw new MissingRecordError(primitive.id, NO_SUCH_RECORD.change);
          const text = (current as Record<string, unknown>)[primitive.field];
          let spliced: string | undefined;
          try {
            if (typeof text === "string" && primitive.field !== "id" && primitive.field !== "kind") spliced = applySplice(text, primitive);
          } catch {
            // Said below.
          }
          if (spliced === undefined) throw new GraphError(`Cannot splice ${primitive.id}.${primitive.field}: it does not hold ${JSON.stringify(primitive.removed)} at ${primitive.at}`);
          nodes.set(primitive.id, held.checkPatch(current, { ...current, [primitive.field]: spliced }, [primitive.field]));
          break;
        }
        case "add-edge": {
          const edge = primitive.edge;
          const from = nodeAt(edge.from);
          const to = nodeAt(edge.to);
          if (!from || !to) throw new MissingRecordError(from ? edge.to : edge.from, NO_SUCH_RECORD.link);
          if (held.validate && !held.schema.edgeAllowed(edge.kind, from.kind, to.kind)) throw new GraphError(`Edge "${edge.kind}" is not declared from ${from.kind} to ${to.kind}`);
          const key = edgeId(edge);
          if (edge.id !== undefined || edge.data !== undefined) {
            const there = edgeAt(key);
            const problem = edgeFieldsProblem(edge) ?? (there && edge.id !== undefined && there.id !== edge.id ? `A second "${edge.kind}" link between two records is not allowed yet` : (held.linkIds.get(edge.id!) ?? key) !== key ? `Link id "${edge.id}" is already taken` : undefined);
            if (problem) throw new GraphError(problem);
          }
          if (!edgeAt(key)) edges.set(key, edge);
          break;
        }
        case "remove-edge": {
          const named = primitive.edge.id === undefined ? primitive.edge : graph.linkById(primitive.edge.id);
          if (!named || !edgeAt(edgeId(named))) throw new MissingRecordError(primitive.edge.id ?? edgeId(primitive.edge), NO_SUCH_LINK);
          edges.set(edgeId(named), null);
          break;
        }
        default:
          unknownPrimitive(primitive);
      }
    }
  } catch (error) {
    return error;
  }
  return undefined;
}
