import { isUnset, unknownPrimitive, type Primitive } from "@graview/core";

/**
 * A stored graph mid-migration is BETWEEN schemas, so nothing here
 * validates: the applier moves plain data structurally, and the new-schema
 * store validates the final shape when it folds. Validation in the middle
 * would refuse exactly the states migrations exist to pass through.
 */
export interface GraphSnapshot {
  readonly nodes: readonly ({ readonly id: string; readonly kind: string } & Record<string, unknown>)[];
  /** A link's own `id` and `data` are reserved (Roadmap f-1-0-edge-fields) and carried as they are. */
  readonly edges: readonly { readonly kind: string; readonly from: string; readonly to: string; readonly id?: string; readonly data?: Readonly<Record<string, unknown>> }[];
}

export function applyToSnapshot(
  snapshot: GraphSnapshot,
  primitives: readonly Primitive[],
): GraphSnapshot {
  let nodes = [...snapshot.nodes];
  let edges = [...snapshot.edges];
  for (const primitive of primitives) {
    switch (primitive.op) {
      case "add-node":
        nodes.push(primitive.node as GraphSnapshot["nodes"][number]);
        break;
      case "remove-node":
        nodes = nodes.filter((node) => node.id !== primitive.node.id);
        edges = edges.filter(
          (edge) => edge.from !== primitive.node.id && edge.to !== primitive.node.id,
        );
        break;
      case "patch-node":
        nodes = nodes.map((node) => {
          if (node.id !== primitive.id) return node;
          const patched: Record<string, unknown> = { ...node, ...primitive.after };
          // A key patched away is a removal, not a stored undefined — said
          // as `undefined` in memory and as `UNSET` once the op has been
          // written down, because JSON cannot carry the first one.
          for (const [key, value] of Object.entries(primitive.after)) {
            if (isUnset(value)) delete patched[key];
          }
          return patched as GraphSnapshot["nodes"][number];
        });
        break;
      case "add-edge":
        edges.push(primitive.edge);
        break;
      case "remove-edge": {
        // By its own id when the primitive names one, as a graph removes it; else by where it stands.
        const { id, kind, from, to } = primitive.edge;
        edges = edges.filter((edge) => !(id !== undefined ? edge.id === id : edge.kind === kind && edge.from === from && edge.to === to));
        break;
      }
      default:
        // A primitive a newer build wrote: a migration refuses it rather than carry a graph that skipped it.
        unknownPrimitive(primitive);
    }
  }
  return { nodes, edges };
}
