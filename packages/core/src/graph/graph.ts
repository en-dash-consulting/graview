import { humaniseField, labelOf } from "../schema/define-node.js";
import type { AnySchema, NodeOfSchema } from "../schema/schema.js";
import { SchemaError } from "../schema/schema.js";
import { diffSnapshots, type GraphDiff } from "./diff.js";
import { isUnset, type Primitive } from "./primitives.js";
import { edgeId, type GraphEdge, type GraphReader, type GraphSnapshot } from "./types.js";

export interface GraphOptions {
  /**
   * Hold every WRITE to the declaration: a node added or patched must fit
   * its kind, an edge must be declared between its ends. What is LOADED is
   * held as it is (FR-28): a graph opens over records an older declaration
   * wrote, and `validateGraph` says what no longer fits.
   */
  readonly validate?: boolean;
}

export interface ApplyPrimitivesOptions {
  /**
   * The primitives put back what was there — an undo, or history folded
   * again — rather than write something new. Records are then held as they
   * are, as a load holds them: an undo of a repair puts back the misfit it
   * repaired. A node still has to be there to be patched or removed.
   */
  readonly restoring?: boolean;
  /**
   * What is put back goes back WHERE IT STOOD, not at the end: a rollback
   * (`Store.rebase`) undoing ops this graph applied is exact, order and all.
   * An undo is not a rollback — it adds at the end, as a client that loaded
   * after the removal would, so every copy of the graph agrees.
   */
  readonly inPlace?: boolean;
}

export type GraphListener<S extends AnySchema> = (
  diff: GraphDiff<NodeOfSchema<S>>,
) => void;

/**
 * A validator's complaint, said in words.
 *
 * Zod's own `message` is the whole issue list as JSON. Each issue already
 * carries a readable sentence and the path it is about, so the field is
 * named the way the rest of the interface names it and the sentences are
 * joined — nothing else in the object is for a person.
 */
function readably(error: unknown): string {
  const issues = (error as { issues?: readonly { path?: readonly PropertyKey[]; message?: string }[] })
    ?.issues;
  if (!Array.isArray(issues) || issues.length === 0) {
    return error instanceof Error ? error.message : String(error);
  }
  return issues
    .map((issue) => {
      const field = issue.path?.length ? humaniseField(String(issue.path.at(-1))) : null;
      const said = issue.message ?? "is not what the declaration allows";
      return field ? `${field}: ${said}` : said;
    })
    .join("; ");
}

export class GraphError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(hint ? `${message}\n  ${hint}` : message);
    this.name = "GraphError";
  }
}


/** The rank keys: nodes and edges share one ranking, under their own prefixes. */
const NODE = "n\u0000";
const EDGE = "e\u0000";

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
  /*
   * WHERE EACH THING STANDS. The maps keep insertion order, and that order
   * is the graph's ("as they come"). Each node and edge takes a rank as it
   * goes in; one taken out keeps its rank here a while, so a rollback that
   * puts it back (`inPlace`) puts it back where it stood.
   */
  private rank = 0;
  private readonly ranks = new Map<string, number>();
  private readonly lapsed = new Map<string, number>();
  private reordered = false;
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
    this.forgetRanks();
    /*
     * HELD AS STORED (FR-28). Loading never parses a node into something
     * else — no default filled, no field stripped or coerced — and never
     * refuses one that no longer fits: what was written stays what it was,
     * and `validateGraph` is how a person hears what does not fit.
     */
    for (const node of snapshot.nodes) this.insertNode(node, true);
    for (const edge of snapshot.edges) this.insertEdge(edge, true);
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
  applyPrimitives(primitives: readonly Primitive[], options: ApplyPrimitivesOptions = {}): GraphDiff<NodeOfSchema<S>> {
    const before = this.snapshot();
    /*
     * ALL OR NOTHING. A primitive that fails used to leave the ones before
     * it applied, so a host rehearsed every repair and migration on a copy
     * before trusting it (FR-26). The snapshot taken for the diff is the
     * way back: on any failure the graph is put back as it was, nobody is
     * told anything changed, and the error goes on up.
     */
    try {
      for (const primitive of primitives) this.applyOne(primitive, options.restoring === true, options.inPlace === true);
      this.settleOrder();
    } catch (error) {
      this.restore(before);
      throw error;
    }
    const diff = diffSnapshots(before, this.snapshot());
    this.emit(diff);
    return diff;
  }

  /** Applies primitives to a throwaway copy — used for previewing a diff. */
  preview(primitives: readonly Primitive[], options: ApplyPrimitivesOptions = {}): GraphDiff<NodeOfSchema<S>> {
    const copy = Graph.from(this.schema, this.snapshot(), { validate: this.validate });
    return copy.applyPrimitives(primitives, options);
  }

  subscribe(listener: GraphListener<S>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ------------------------------------------------------------ internals

  /** Puts the graph back to a snapshot it held, silently: nothing a listener saw ever changed. */
  private restore(snapshot: GraphSnapshot<NodeOfSchema<S>>): void {
    this.nodes.clear();
    this.edges.clear();
    this.outIndex.clear();
    this.inIndex.clear();
    this.forgetRanks();
    for (const node of snapshot.nodes) this.insertNode(node, true);
    for (const edge of snapshot.edges) this.insertEdge(edge, true);
  }

  private forgetRanks(): void {
    this.ranks.clear();
    this.lapsed.clear();
    this.reordered = false;
  }

  /** A rank for what just went in: the one it had, when it is being put back in place; the next one otherwise. */
  private place(key: string, inPlace: boolean): void {
    const was = inPlace ? this.lapsed.get(key) : undefined;
    if (was === undefined) {
      this.ranks.set(key, ++this.rank);
      return;
    }
    this.ranks.set(key, was);
    this.lapsed.delete(key);
    this.reordered = true;
  }

  /** What was taken out keeps its rank, for a while: a rollback only ever reaches the recent past. */
  private lapse(key: string): void {
    const rank = this.ranks.get(key);
    if (rank === undefined) return;
    this.ranks.delete(key);
    this.lapsed.set(key, rank);
    if (this.lapsed.size > 4096) this.lapsed.delete(this.lapsed.keys().next().value!);
  }

  /** After an in-place put-back, the maps in rank order again. */
  private settleOrder(): void {
    if (!this.reordered) return;
    this.reordered = false;
    const byRank = (prefix: string) => (a: [string, unknown], b: [string, unknown]) => this.ranks.get(prefix + a[0])! - this.ranks.get(prefix + b[0])!;
    const nodes = [...this.nodes.entries()].sort(byRank(NODE));
    this.nodes.clear();
    for (const [id, node] of nodes) this.nodes.set(id, node);
    const edges = [...this.edges.entries()].sort(byRank(EDGE));
    this.edges.clear();
    for (const [id, edge] of edges) this.edges.set(id, edge);
  }

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

  private applyOne(primitive: Primitive, restoring: boolean, inPlace: boolean): void {
    switch (primitive.op) {
      case "add-node":
        this.insertNode(primitive.node as NodeOfSchema<S>, restoring, inPlace);
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
        this.lapse(NODE + id);
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
          // `undefined` in memory, `UNSET` once written down: both mean the
          // key goes away. See `normalise` in primitives.ts.
          if (isUnset(value)) delete next[key];
          else next[key] = value;
        }
        this.nodes.set(primitive.id, (restoring ? next : this.checkPatch(current, next, Object.keys(primitive.after))) as NodeOfSchema<S>);
        return;
      }
      case "add-edge":
        this.insertEdge(primitive.edge, restoring, inPlace);
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
      throw this.refusal(node, error);
    }
  }

  /**
   * A PATCH IS JUDGED ON WHAT IT WRITES (FR-28). The fields it writes must
   * fit, and are taken as the declaration reads them (a cleared field with
   * a default takes it). The record as a whole may not come out fitting
   * less than it went in — but a misfit it already held, in a field the
   * patch does not touch, stays as stored: renaming a person is not refused
   * because of an address an older declaration accepted, and nothing the
   * patch did not write is parsed into something else.
   */
  private checkPatch(current: NodeOfSchema<S>, next: Record<string, unknown>, written: readonly string[]): NodeOfSchema<S> {
    if (!this.validate) return next as NodeOfSchema<S>;
    const shape = (this.schema.tryDefinition(String(next["kind"]))?.fields as { shape?: Record<string, { safeParse(value: unknown): { success: boolean; data?: unknown } }> } | undefined)?.shape;
    if (!shape) return this.check(next);
    for (const field of written) {
      if (field === "id" || field === "kind") continue;
      const declared = shape[field];
      // A field the kind does not declare is not written, as a parse would strip it.
      if (!declared) {
        delete next[field];
        continue;
      }
      const read = declared.safeParse(next[field]);
      if (!read.success) continue; // judged with the whole record below, and refused there
      if (read.data === undefined) delete next[field];
      else next[field] = read.data;
    }
    const failing = this.failing(next);
    if (failing === undefined) return next as NodeOfSchema<S>;
    const before = this.failing(current)?.fields ?? new Set<string>();
    if ([...failing.fields].some((field) => written.includes(field) || !before.has(field))) {
      throw this.refusal(next, failing.error);
    }
    return next as NodeOfSchema<S>;
  }

  /** What about a node does not fit: undefined when it fits; `""` stands for a failure that names no field. */
  private failing(node: unknown): { readonly fields: ReadonlySet<string>; readonly error: unknown } | undefined {
    try {
      this.schema.parseNode(node);
      return undefined;
    } catch (error) {
      if (error instanceof SchemaError) throw error;
      const issues = (error as { issues?: readonly { code?: string; path?: readonly PropertyKey[]; keys?: readonly string[] }[] }).issues ?? [];
      const fields = new Set<string>(
        issues.flatMap((issue) =>
          issue.code === "unrecognized_keys" && issue.keys ? [...issue.keys] : typeof issue.path?.[0] === "string" ? [issue.path[0]] : [""],
        ),
      );
      return { fields, error };
    }
  }

  /** Why a node was refused, in the app's own words. */
  private refusal(node: unknown, error: unknown): Error {
    if (error instanceof SchemaError) return error;
    {
      const id = (node as { id?: string })?.id ?? "?";
      const kind = (node as { kind?: string })?.kind ?? "?";
      /*
       * A PERSON READS THIS. It is not only a developer's console message:
       * a refused undo shows its reason in the activity rail, so the raw
       * validator dump — `[ { "code": "invalid_value", "values": [ … ],
       * "path": [ "urgency" ] … } ]` — went straight into the interface,
       * beside a sentence about a thing called "Pay the deposit". The field
       * is named in the app's own words and the node by its label.
       */
      const definition = this.schema.tryDefinition(kind);
      const named =
        definition && node && typeof node === "object"
          ? labelOf(definition, node as never)
          : id;
      return new GraphError(
        `${named} does not match what ${kind} declares`,
        readably(error),
      );
    }
  }

  /** `held`: put in as it is (a load, a restore), not judged as a write. */
  private insertNode(node: NodeOfSchema<S>, held: boolean, inPlace = false): void {
    if (this.nodes.has(node.id)) {
      throw new GraphError(`Duplicate node id "${node.id}"`);
    }
    this.nodes.set(node.id, held ? node : this.check(node));
    this.place(NODE + node.id, inPlace);
  }

  private insertEdge(edge: GraphEdge, held: boolean, inPlace = false): void {
    const from = this.nodes.get(edge.from);
    const to = this.nodes.get(edge.to);
    if (!from || !to) {
      throw new GraphError(
        `Edge "${edge.kind}" references missing node "${from ? edge.to : edge.from}"`,
      );
    }
    if (this.validate && !held && !this.schema.edgeAllowed(edge.kind, from.kind, to.kind)) {
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
    this.place(EDGE + id, inPlace);
    this.index(this.outIndex, edge.from, id);
    this.index(this.inIndex, edge.to, id);
  }

  private deleteEdge(edge: GraphEdge): void {
    const id = edgeId(edge);
    this.edges.delete(id);
    this.lapse(EDGE + id);
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
