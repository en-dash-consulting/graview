import type { AnyGraphNode, GraphEdge } from "./types.js";

/**
 * The five primitive operations every mutation compiles down to. Keeping the
 * primitive set this small is what makes inverses mechanical and the fold
 * over the log total.
 */
export type Primitive =
  | { readonly op: "add-node"; readonly node: AnyGraphNode }
  | { readonly op: "remove-node"; readonly node: AnyGraphNode }
  | {
      readonly op: "patch-node";
      readonly id: string;
      readonly before: Readonly<Record<string, unknown>>;
      readonly after: Readonly<Record<string, unknown>>;
    }
  | { readonly op: "add-edge"; readonly edge: GraphEdge }
  | { readonly op: "remove-edge"; readonly edge: GraphEdge };

/** Every primitive's inverse is another primitive — no special cases. */
export function invert(primitive: Primitive): Primitive {
  switch (primitive.op) {
    case "add-node":
      return { op: "remove-node", node: primitive.node };
    case "remove-node":
      return { op: "add-node", node: primitive.node };
    case "patch-node":
      return {
        op: "patch-node",
        id: primitive.id,
        before: primitive.after,
        after: primitive.before,
      };
    case "add-edge":
      return { op: "remove-edge", edge: primitive.edge };
    case "remove-edge":
      return { op: "add-edge", edge: primitive.edge };
  }
}

/** Node ids a primitive writes to. */
export function writesOf(primitive: Primitive): string[] {
  switch (primitive.op) {
    case "add-node":
    case "remove-node":
      return [primitive.node.id];
    case "patch-node":
      return [primitive.id];
    case "add-edge":
    case "remove-edge":
      return [primitive.edge.from, primitive.edge.to];
  }
}
