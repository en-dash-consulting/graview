import type { ArchivedOption } from "./archived.js";
import type { GraphEdge, GraphNodeBase, GraphReader } from "./types.js";

/**
 * Records every node a mutation looked at.
 *
 * Reads-tracking has to exist from the very first operation — historical
 * reads are not recoverable, so this cannot be retrofitted onto an existing
 * log. That constraint is why the mutation API hands out a reader rather
 * than the graph itself.
 */
export class TrackedReader<N extends GraphNodeBase> implements GraphReader<N> {
  private readonly seen = new Set<string>();

  constructor(private readonly inner: GraphReader<N>) {}

  /** The ids this mutation read, in insertion order. */
  reads(): string[] {
    return [...this.seen];
  }

  private markAll<T extends N>(nodes: T[]): T[] {
    for (const node of nodes) this.seen.add(node.id);
    return nodes;
  }

  private markEdges(edges: GraphEdge[]): GraphEdge[] {
    for (const edge of edges) {
      this.seen.add(edge.from);
      this.seen.add(edge.to);
    }
    return edges;
  }

  getNode(id: string): N | undefined {
    this.seen.add(id);
    return this.inner.getNode(id);
  }

  has(id: string): boolean {
    this.seen.add(id);
    return this.inner.has(id);
  }

  allNodes(options?: ArchivedOption): N[] {
    return this.markAll(this.inner.allNodes(options));
  }

  allEdges(options?: ArchivedOption): GraphEdge[] {
    return this.markEdges(this.inner.allEdges(options));
  }

  nodesOfKind<K extends N["kind"]>(kind: K, options?: ArchivedOption): Extract<N, { kind: K }>[] {
    return this.markAll(this.inner.nodesOfKind(kind, options));
  }

  edgesOfKind(kind: string, options?: ArchivedOption): GraphEdge[] {
    return this.markEdges(this.inner.edgesOfKind(kind, options));
  }

  out(id: string, kind?: string, options?: ArchivedOption): N[] {
    this.seen.add(id);
    return this.markAll(this.inner.out(id, kind, options));
  }

  in(id: string, kind?: string, options?: ArchivedOption): N[] {
    this.seen.add(id);
    return this.markAll(this.inner.in(id, kind, options));
  }

  neighbors(id: string, options?: ArchivedOption): N[] {
    this.seen.add(id);
    return this.markAll(this.inner.neighbors(id, options));
  }
}
