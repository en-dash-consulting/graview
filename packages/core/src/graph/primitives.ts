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

/**
 * "THIS KEY GOES AWAY", written down.
 *
 * A patch says "remove this field" by carrying the key with the value
 * `undefined` — which is fine in memory and vanishes the moment the op is
 * written to JSON. So every persisted patch that cleared a field came back
 * with an empty `before`, and its inverse — the whole promise of an op log —
 * silently did nothing. A migration that added a field could be "undone"
 * after a reload and leave the field exactly where it was.
 *
 * `UNSET` is that instruction as a value. It survives JSON, it survives an
 * export bundle, and `normalise` puts it in front of every primitive on its
 * way into an operation so nobody writing a mutation has to know.
 */
export const UNSET = "\u0000graview:unset";

/** Whether a patch value means "take this key off the node". */
export const isUnset = (value: unknown): boolean => value === undefined || value === UNSET;

/**
 * A primitive with every "remove this key" said as a value rather than as an
 * absence. Applied where primitives become operations, so the log, the
 * adapters and the export all carry the same instruction.
 */
export function normalise(primitive: Primitive): Primitive {
  if (primitive.op !== "patch-node") return primitive;
  const said = (fields: Readonly<Record<string, unknown>>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, value === undefined ? UNSET : value]),
    );
  return { ...primitive, before: said(primitive.before), after: said(primitive.after) };
}

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
