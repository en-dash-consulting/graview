import { isUnset, UNSET, type Primitive } from "../graph/primitives.js";
import { edgeId, type AnyGraphNode, type GraphEdge } from "../graph/types.js";
import type { Operation } from "./types.js";

/**
 * A SERVED LOG FOLDS TO THE SERVED SNAPSHOT (FR-55).
 *
 * A seat is served a record as its lens serves it — a field naming a hidden
 * record cleared, or the record withheld whole when that field is required.
 * Whether a record is served therefore changes as it changes: a patch that
 * points a required field at a hidden record takes it out of what the seat
 * has, and one that points it back puts it in. So a primitive cannot be
 * judged alone. It is judged by whether the record was served just before
 * it and just after:
 *
 *   served → served      the patch, as the seat is served the record
 *   not served → served  `add-node` of the record as now served, and every
 *                        link it has to a record the seat is served
 *   served → not served  `remove-node`, which takes its links with it
 *   neither              nothing
 *
 * and a link is served when both its ends are. Folding what a seat is
 * served, from what it was served, then reaches what it is served now —
 * the property a client's copy of the graph lives by.
 *
 * Knowing each record "just before" an op needs the graph as it stood
 * there. The graph as it stands now is the store's; the walk takes the
 * log's ops back from the end to the first op asked about, then forward,
 * reading and writing only an overlay of what differs from now.
 */

/** The graph as it stands now, read by the walk. */
export interface Present {
  getNode(id: string): AnyGraphNode | undefined;
  outEdges(id: string): readonly GraphEdge[];
  inEdges(id: string): readonly GraphEdge[];
}

/** What a walk needs of a store: the graph now and the log that led to it. */
export interface Timeline {
  readonly present: Present;
  readonly log: { all(): readonly Operation[] };
}

/** How the walk judges one record or one link for the seat. */
export interface ServedJudge {
  /** The record as the seat is served it, or undefined when it is not. */
  served(node: AnyGraphNode): AnyGraphNode | undefined;
  /** Whether a link names nothing the seat may not see (its ends are judged as records). */
  edgeClean(edge: GraphEdge): boolean;
}

/** The graph at one moment of the log: now, with what differs held apart. */
class Moment {
  private readonly nodes = new Map<string, AnyGraphNode | null>();
  private readonly edges = new Map<string, GraphEdge | null>();
  private readonly touching = new Map<string, Set<string>>();

  constructor(private readonly present: Present) {}

  node(id: string): AnyGraphNode | undefined {
    if (this.nodes.has(id)) return this.nodes.get(id) ?? undefined;
    return this.present.getNode(id);
  }

  setNode(id: string, node: AnyGraphNode | null): void {
    this.nodes.set(id, node);
  }

  setEdge(edge: GraphEdge, there: boolean): void {
    const key = edgeId(edge);
    this.edges.set(key, there ? edge : null);
    for (const end of [edge.from, edge.to]) {
      let keys = this.touching.get(end);
      if (!keys) this.touching.set(end, (keys = new Set()));
      keys.add(key);
    }
  }

  /** Every link a record has at this moment. */
  incident(id: string): GraphEdge[] {
    const out = new Map<string, GraphEdge>();
    for (const edge of [...this.present.outEdges(id), ...this.present.inEdges(id)]) {
      const key = edgeId(edge);
      if (!this.edges.has(key)) out.set(key, edge);
    }
    for (const key of this.touching.get(id) ?? []) {
      const edge = this.edges.get(key);
      if (edge) out.set(key, edge);
    }
    return [...out.values()];
  }

  /** A primitive, taken back: the moment just before it. */
  undo(primitive: Primitive): void {
    switch (primitive.op) {
      case "add-node":
        this.setNode(primitive.node.id, null);
        return;
      case "remove-node":
        this.setNode(primitive.node.id, primitive.node);
        return;
      case "patch-node": {
        const node = this.node(primitive.id);
        if (!node) return;
        this.setNode(primitive.id, patched(node, primitive.before));
        return;
      }
      case "add-edge":
        this.setEdge(primitive.edge, false);
        return;
      case "remove-edge":
        this.setEdge(primitive.edge, true);
        return;
    }
  }

  /** A primitive, applied: the moment just after it. A removed record takes its links with it, as a graph's does. */
  apply(primitive: Primitive): void {
    switch (primitive.op) {
      case "add-node":
        this.setNode(primitive.node.id, primitive.node);
        return;
      case "remove-node":
        for (const edge of this.incident(primitive.node.id)) this.setEdge(edge, false);
        this.setNode(primitive.node.id, null);
        return;
      case "patch-node": {
        const node = this.node(primitive.id);
        if (!node) return;
        this.setNode(primitive.id, patched(node, primitive.after));
        return;
      }
      case "add-edge":
        this.setEdge(primitive.edge, true);
        return;
      case "remove-edge":
        this.setEdge(primitive.edge, false);
        return;
    }
  }
}

function patched(node: AnyGraphNode, fields: Readonly<Record<string, unknown>>): AnyGraphNode {
  const next: Record<string, unknown> = { ...node };
  for (const [key, value] of Object.entries(fields)) {
    if (isUnset(value)) delete next[key];
    else next[key] = value;
  }
  return next as AnyGraphNode;
}

/** One primitive as the seat receives it, and whether that is the primitive itself. */
interface Served {
  readonly primitives: readonly Primitive[];
  readonly faithful: boolean;
}

const idOf = (primitive: Primitive): string | undefined =>
  primitive.op === "add-node" || primitive.op === "remove-node" ? primitive.node.id : primitive.op === "patch-node" ? primitive.id : undefined;

/** Judges one primitive at a moment, and moves the moment past it. */
function serveOne(primitive: Primitive, moment: Moment, judge: ServedJudge): Served {
  const servedAt = (id: string): AnyGraphNode | undefined => {
    const node = moment.node(id);
    return node ? judge.served(node) : undefined;
  };
  const id = idOf(primitive);
  if (id === undefined) {
    const edge = (primitive as { edge: GraphEdge }).edge;
    const served = judge.edgeClean(edge) && servedAt(edge.from) !== undefined && servedAt(edge.to) !== undefined;
    moment.apply(primitive);
    return served ? { primitives: [primitive], faithful: true } : { primitives: [], faithful: false };
  }
  const was = moment.node(id);
  const before = was ? judge.served(was) : undefined;
  moment.apply(primitive);
  const now = moment.node(id);
  const after = now ? judge.served(now) : undefined;
  if (!before && !after) return { primitives: [], faithful: false };
  if (!before && after) {
    // Into what the seat is served: the record as it is served, and its links to what the seat is served.
    const links: Primitive[] = moment
      .incident(id)
      .filter((edge) => judge.edgeClean(edge) && servedAt(edge.from === id ? edge.to : edge.from) !== undefined)
      .map((edge) => ({ op: "add-edge", edge }));
    const faithful = primitive.op === "add-node" && after === primitive.node && links.length === 0;
    return { primitives: faithful ? [primitive] : [{ op: "add-node", node: after }, ...links], faithful };
  }
  if (before && !after) {
    // Out of it: removed, with its links, from the seat's copy.
    const faithful = primitive.op === "remove-node" && before === was;
    return { primitives: faithful ? [primitive] : [{ op: "remove-node", node: before }], faithful };
  }
  // Served before and after: what changed, as the seat is served it.
  if (primitive.op === "patch-node") {
    // The patch as written, when no field it writes was cleared for the seat on either side.
    const kept = (served: AnyGraphNode, held: AnyGraphNode | undefined) => (field: string) => field in served === (held !== undefined && field in held);
    if (Object.keys(primitive.after).every((field) => kept(before!, was)(field) && kept(after!, now)(field))) return { primitives: [primitive], faithful: true };
    const side = (node: AnyGraphNode) => Object.fromEntries(Object.keys(primitive.after).map((field) => [field, field in node ? node[field] : UNSET]));
    return { primitives: [{ op: "patch-node", id, before: side(before!), after: side(after!) }], faithful: false };
  }
  // An add of a record already there, or a remove that leaves it: a log that does not fold here; say the record as it is.
  return { primitives: [{ op: "remove-node", node: before! }, { op: "add-node", node: after! }], faithful: false };
}

/** What `redactAlong` hands back for one op: its primitives as served, and whether they are its own. */
export interface ServedOp {
  readonly op: Operation;
  readonly primitives: readonly Primitive[];
  readonly faithful: boolean;
}

/**
 * The ops asked about, each with its primitives as the seat is served
 * them, judged at the moment of the log each stood at. Ops that are in the
 * timeline's log are placed there; when any is not (a preview, an op from
 * elsewhere), they are judged in order from the graph as it stands now.
 */
export function serveAlong(ops: readonly Operation[], timeline: Timeline, judge: ServedJudge): ServedOp[] {
  if (ops.length === 0) return [];
  const log = timeline.log.all();
  const base = log[0]?.seq ?? 0;
  const placed = ops.every((op) => log[op.seq - base]?.id === op.id);
  const moment = new Moment(timeline.present);
  if (!placed) {
    return ops.map((op) => {
      const served = op.primitives.map((primitive) => serveOne(primitive, moment, judge));
      return { op, primitives: served.flatMap((one) => one.primitives), faithful: served.every((one) => one.faithful) };
    });
  }
  const wanted = new Set(ops.map((op) => op.seq));
  const first = Math.min(...wanted) - base;
  const last = Math.max(...wanted) - base;
  for (let at = log.length - 1; at >= first; at--) {
    const primitives = log[at]!.primitives;
    for (let index = primitives.length - 1; index >= 0; index--) moment.undo(primitives[index]!);
  }
  const answer = new Map<number, ServedOp>();
  for (let at = first; at <= last; at++) {
    const op = log[at]!;
    if (!wanted.has(op.seq)) {
      for (const primitive of op.primitives) moment.apply(primitive);
      continue;
    }
    const served = op.primitives.map((primitive) => serveOne(primitive, moment, judge));
    answer.set(op.seq, { op, primitives: served.flatMap((one) => one.primitives), faithful: served.every((one) => one.faithful) });
  }
  return ops.map((op) => answer.get(op.seq)!);
}

/** Primitives not yet in any log — a preview — as the seat would be served them, from the graph as it stands. */
export function servePrimitives(primitives: readonly Primitive[], present: Present, judge: ServedJudge): Primitive[] {
  const moment = new Moment(present);
  return primitives.flatMap((primitive) => serveOne(primitive, moment, judge).primitives);
}
