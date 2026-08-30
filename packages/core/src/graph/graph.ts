import type { AnySchema, NodeOfSchema } from "../schema/schema.js";
import { SchemaError } from "../schema/schema.js";
import { diffSnapshots, type GraphDiff } from "./diff.js";
import type { Primitive } from "./primitives.js";
import { edgeId, type GraphEdge, type GraphReader, type GraphSnapshot } from "./types.js";

export interface GraphOptions {
  /** Validate every node against its declared fields on the way in. */
  readonly validate?: boolean;
}

export type GraphListener<S extends AnySchema> = (
  diff: GraphDiff<NodeOfSchema<S>>,
) => void;

export class GraphError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(hint ? `${message}\n  ${hint}` : message);
    this.name = "GraphError";
  }
}

/**
 * The framework owns the reactive in-memory graph. Owning it — rather than
 * reading someone else's store — is what makes invariants enforceable and
 * agent attribution free; persistence is a pluggable adapter underneath.
 */
export class Graph<S extends AnySchema> implements GraphReader<NodeOfSchema<S>> {
  private readonly nodes = new Map<string, NodeOfSchema<S>>();
  private readonly edges = new Map<string, GraphEdge>();
  private readonly outIndex = new Map<string, Set<string>>();
  private readonly inIndex = new Map<string, Set<string>>();
  private readonly listeners = new Set<GraphListener<S>>();
  private readonly validate: boolean;

  constructor(
    readonly schema: S,
    options: GraphOptions = {},
  ) {
    this.validate = options.validate ?? true;
  }

  static from<S extends AnySchema>(
    schema: S,
    snapshot: GraphSnapshot<NodeOfSchema<S>>,
    options: GraphOptions = {},
  ): Graph<S> {
    const graph = new Graph(schema, options);
    graph.load(snapshot);
    return graph;
  }

  /** Replaces the whole graph without emitting a per-node diff storm. */
  load(snapshot: GraphSnapshot<NodeOfSchema<S>>): GraphDiff<NodeOfSchema<S>> {
    const before = this.snapshot();
    this.nodes.clear();
    this.edges.clear();
    this.outIndex.clear();
    this.inIndex.clear();
    for (const node of snapshot.nodes) this.insertNode(node);
    for (const edge of snapshot.edges) this.insertEdge(edge);
    const diff = diffSnapshots(before, this.snapshot());
    this.emit(diff);
    return diff;
  }

  // ---------------------------------------------------------------- reads

  getNode(id: string): NodeOfSchema<S> | undefined {
    return this.nodes.get(id);
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  allNodes(): NodeOfSchema<S>[] {
    return [...this.nodes.values()];
  }

  allEdges(): GraphEdge[] {
    return [...this.edges.values()];
  }

  nodesOfKind<K extends NodeOfSchema<S>["kind"]>(
    kind: K,
  ): Extract<NodeOfSchema<S>, { kind: K }>[] {
    return this.allNodes().filter(
      (node): node is Extract<NodeOfSchema<S>, { kind: K }> => node.kind === kind,
    );
  }

  edgesOfKind(kind: string): GraphEdge[] {
    return this.allEdges().filter((edge) => edge.kind === kind);
  }

  out(id: string, kind?: string): NodeOfSchema<S>[] {
    return this.resolve(this.outIndex.get(id), kind, "to");
  }

  in(id: string, kind?: string): NodeOfSchema<S>[] {
    return this.resolve(this.inIndex.get(id), kind, "from");
  }

  neighbors(id: string): NodeOfSchema<S>[] {
    const seen = new Map<string, NodeOfSchema<S>>();
    for (const node of [...this.out(id), ...this.in(id)]) seen.set(node.id, node);
    return [...seen.values()];
  }

  /** Edges leaving `id`, optionally of one kind. */
  outEdges(id: string, kind?: string): GraphEdge[] {
    return this.edgesFrom(this.outIndex.get(id), kind);
  }

  /** Edges arriving at `id`, optionally of one kind. */
  inEdges(id: string, kind?: string): GraphEdge[] {
    return this.edgesFrom(this.inIndex.get(id), kind);
  }

  snapshot(): GraphSnapshot<NodeOfSchema<S>> {
    return { nodes: this.allNodes(), edges: this.allEdges() };
  }

  get size(): { nodes: number; edges: number } {
    return { nodes: this.nodes.size, edges: this.edges.size };
  }

  // ------------------------------------------------------------- writes

  /**
   * Applies primitives as one batch and emits a single diff. Nothing outside
   * the op log should call this directly — attribution lives in the log.
   */
  applyPrimitives(primitives: readonly Primitive[]): GraphDiff<NodeOfSchema<S>> {
    const before = this.snapshot();
    for (const primitive of primitives) this.applyOne(primitive);
    const diff = diffSnapshots(before, this.snapshot());
    this.emit(diff);
    return diff;
  }

  /** Applies primitives to a throwaway copy — used for previewing a diff. */
  preview(primitives: readonly Primitive[]): GraphDiff<NodeOfSchema<S>> {
    const copy = Graph.from(this.schema, this.snapshot(), { validate: this.validate });
    return copy.applyPrimitives(primitives);
  }

  subscribe(listener: GraphListener<S>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ------------------------------------------------------------ internals

  private emit(diff: GraphDiff<NodeOfSchema<S>>): void {
    if (
      diff.addedNodes.length === 0 &&
      diff.removedNodes.length === 0 &&
      diff.changedNodes.length === 0 &&
      diff.addedEdges.length === 0 &&
      diff.removedEdges.length === 0
    ) {
      return;
    }
    for (const listener of this.listeners) listener(diff);
  }

  private applyOne(primitive: Primitive): void {
    switch (primitive.op) {
      case "add-node":
        this.insertNode(primitive.node as NodeOfSchema<S>);
        return;
      case "remove-node": {
        const id = primitive.node.id;
        if (!this.nodes.has(id)) {
          throw new GraphError(`Cannot remove missing node "${id}"`);
        }
        for (const edge of [...this.outEdges(id), ...this.inEdges(id)]) {
          this.deleteEdge(edge);
        }
        this.nodes.delete(id);
        this.outIndex.delete(id);
        this.inIndex.delete(id);
        return;
      }
      case "patch-node": {
        const current = this.nodes.get(primitive.id);
        if (!current) {
          throw new GraphError(`Cannot patch missing node "${primitive.id}"`);
        }
        const next = { ...current } as Record<string, unknown>;
        for (const [key, value] of Object.entries(primitive.after)) {
          if (value === undefined) delete next[key];
          else next[key] = value;
        }
        this.nodes.set(primitive.id, this.check(next) as NodeOfSchema<S>);
        return;
      }
      case "add-edge":
        this.insertEdge(primitive.edge);
        return;
      case "remove-edge": {
        if (!this.edges.has(edgeId(primitive.edge))) {
          throw new GraphError(
            `Cannot remove missing edge ${edgeId(primitive.edge)}`,
          );
        }
        this.deleteEdge(primitive.edge);
        return;
      }
    }
  }

  private check(node: unknown): NodeOfSchema<S> {
    if (!this.validate) return node as NodeOfSchema<S>;
    try {
      return this.schema.parseNode(node) as NodeOfSchema<S>;
    } catch (error) {
      if (error instanceof SchemaError) throw error;
      const id = (node as { id?: string })?.id ?? "?";
      const kind = (node as { kind?: string })?.kind ?? "?";
      throw new GraphError(
        `Node "${id}" (${kind}) does not match its declared fields`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private insertNode(node: NodeOfSchema<S>): void {
    if (this.nodes.has(node.id)) {
      throw new GraphError(`Duplicate node id "${node.id}"`);
    }
    this.nodes.set(node.id, this.check(node));
  }

  private insertEdge(edge: GraphEdge): void {
    const from = this.nodes.get(edge.from);
    const to = this.nodes.get(edge.to);
    if (!from || !to) {
      throw new GraphError(
        `Edge "${edge.kind}" references missing node "${from ? edge.to : edge.from}"`,
      );
    }
    if (this.validate && !this.schema.edgeAllowed(edge.kind, from.kind, to.kind)) {
      const declared = this.schema.edge(edge.kind);
      throw new GraphError(
        `Edge "${edge.kind}" is not declared from ${from.kind} to ${to.kind}`,
        declared
          ? `Declared: ${declared.from.join("|")} -> ${
              declared.to === "*" ? "*" : declared.to.join("|")
            }`
          : `No edge kind "${edge.kind}" is declared in this schema`,
      );
    }
    const id = edgeId(edge);
    if (this.edges.has(id)) return;
    this.edges.set(id, edge);
    this.index(this.outIndex, edge.from, id);
    this.index(this.inIndex, edge.to, id);
  }

  private deleteEdge(edge: GraphEdge): void {
    const id = edgeId(edge);
    this.edges.delete(id);
    this.outIndex.get(edge.from)?.delete(id);
    this.inIndex.get(edge.to)?.delete(id);
  }

  private index(map: Map<string, Set<string>>, key: string, id: string): void {
    const set = map.get(key);
    if (set) set.add(id);
    else map.set(key, new Set([id]));
  }

  private edgesFrom(ids: Set<string> | undefined, kind?: string): GraphEdge[] {
    if (!ids) return [];
    const result: GraphEdge[] = [];
    for (const id of ids) {
      const edge = this.edges.get(id);
      if (edge && (kind === undefined || edge.kind === kind)) result.push(edge);
    }
    return result;
  }

  private resolve(
    ids: Set<string> | undefined,
    kind: string | undefined,
    end: "from" | "to",
  ): NodeOfSchema<S>[] {
    const result: NodeOfSchema<S>[] = [];
    for (const edge of this.edgesFrom(ids, kind)) {
      const node = this.nodes.get(edge[end]);
      if (node) result.push(node);
    }
    return result;
  }
}
