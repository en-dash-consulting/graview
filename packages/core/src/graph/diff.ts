import type { AnyGraphNode, GraphEdge, GraphNodeBase } from "./types.js";
import { edgeId } from "./types.js";

export interface NodeChange<N extends GraphNodeBase = AnyGraphNode> {
  readonly before: N;
  readonly after: N;
  /** Field names whose values differ. */
  readonly fields: readonly string[];
}

export interface GraphDiff<N extends GraphNodeBase = AnyGraphNode> {
  readonly addedNodes: readonly N[];
  readonly removedNodes: readonly N[];
  readonly changedNodes: readonly NodeChange<N>[];
  readonly addedEdges: readonly GraphEdge[];
  readonly removedEdges: readonly GraphEdge[];
  /** Every node id implicated, so a renderer can highlight across planes. */
  readonly touched: readonly string[];
}

export const EMPTY_DIFF: GraphDiff = {
  addedNodes: [],
  removedNodes: [],
  changedNodes: [],
  addedEdges: [],
  removedEdges: [],
  touched: [],
};

export function isEmptyDiff(diff: GraphDiff<never>): boolean {
  return (
    diff.addedNodes.length === 0 &&
    diff.removedNodes.length === 0 &&
    diff.changedNodes.length === 0 &&
    diff.addedEdges.length === 0 &&
    diff.removedEdges.length === 0
  );
}

function changedFields(before: GraphNodeBase, after: GraphNodeBase): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const fields: string[] = [];
  for (const key of keys) {
    const a = (before as unknown as Record<string, unknown>)[key];
    const b = (after as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) fields.push(key);
  }
  return fields.sort();
}

/**
 * Pure structural diff of two snapshots. Used for previewing a mutation (or
 * an undo) before it applies — a human edit and an agent edit produce the
 * same diff shape, which is why watching an agent needs no bespoke layer.
 */
export function diffSnapshots<N extends GraphNodeBase>(
  before: { nodes: readonly N[]; edges: readonly GraphEdge[] },
  after: { nodes: readonly N[]; edges: readonly GraphEdge[] },
): GraphDiff<N> {
  const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]));
  const afterNodes = new Map(after.nodes.map((n) => [n.id, n]));

  const addedNodes = after.nodes.filter((n) => !beforeNodes.has(n.id));
  const removedNodes = before.nodes.filter((n) => !afterNodes.has(n.id));
  const changedNodes: NodeChange<N>[] = [];
  for (const prev of before.nodes) {
    const next = afterNodes.get(prev.id);
    if (!next) continue;
    const fields = changedFields(prev, next);
    if (fields.length > 0) changedNodes.push({ before: prev, after: next, fields });
  }

  const beforeEdges = new Map(before.edges.map((e) => [edgeId(e), e]));
  const afterEdges = new Map(after.edges.map((e) => [edgeId(e), e]));
  const addedEdges = after.edges.filter((e) => !beforeEdges.has(edgeId(e)));
  const removedEdges = before.edges.filter((e) => !afterEdges.has(edgeId(e)));

  const touched = new Set<string>();
  for (const n of addedNodes) touched.add(n.id);
  for (const n of removedNodes) touched.add(n.id);
  for (const c of changedNodes) touched.add(c.after.id);
  for (const e of [...addedEdges, ...removedEdges]) {
    touched.add(e.from);
    touched.add(e.to);
  }

  return {
    addedNodes,
    removedNodes,
    changedNodes,
    addedEdges,
    removedEdges,
    touched: [...touched].sort(),
  };
}
