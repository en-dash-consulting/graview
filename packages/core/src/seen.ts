import type { GraphDiff, NodeChange } from "./graph/diff.js";
import type { GraphNodeBase } from "./graph/types.js";
import type { Primitive } from "./graph/primitives.js";
import type { AnyGraphNode, GraphEdge, GraphSnapshot } from "./graph/types.js";
import type { Violation } from "./invariants/types.js";
import { batchesOf, undoneIn, type LogReading } from "./ops/log.js";
import { checkUndo } from "./ops/undo.js";
import type { Batch, Operation } from "./ops/types.js";
import { servePrimitives, type FieldWriter, type Timeline } from "./ops/served.js";
import { writersOf, type Writers } from "./ops/writers.js";
import { namesUnseen, redact, WITHHELD_INTENT, type SeatLens } from "./ops/withheld.js";
import { actingAs, isSystem } from "./permissions/policy.js";
import { recordsOf, sees } from "./permissions/sight.js";
import type { Policy, Principal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";
import type { Store } from "./store.js";

/** What a store reads to judge a seat's sight: its policy, its graph and its log. */
interface Judged {
  readonly policy: Policy | undefined;
  readonly graph: {
    getNode(id: string): { readonly id: string; readonly kind: string } | undefined;
    out(id: string): readonly { readonly id: string }[];
    in(id: string): readonly { readonly id: string }[];
    /** A store's own graph says its links, so an op can be judged where it stood (FR-55). */
    outEdges?(id: string): readonly GraphEdge[];
    inEdges?(id: string): readonly GraphEdge[];
  };
  readonly log: LogReading;
  /** The kinds of the modules this workspace has off (FR-12), kept from every seat as a sight keeps a record. */
  readonly modules?: { readonly disabledKinds: ReadonlySet<string> };
  /** The declaration, to say which of a kind's fields a record may be served without (FR-55). */
  readonly schema?: { tryDefinition(kind: string): { readonly fields: unknown } | undefined };
}

const NOTHING: ReadonlySet<string> = new Set();

/**
 * The kinds kept from a seat because their module is off (FR-12): from
 * every seat but the system itself, which keeps the records and is the
 * one that turns the module on again.
 */
function turnedOff(store: Judged, principal: Principal): ReadonlySet<string> {
  return isSystem(principal) ? NOTHING : (store.modules?.disabledKinds ?? NOTHING);
}

/**
 * WHETHER ANYTHING IS KEPT FROM THIS SEAT: a sight the policy declares
 * (FR-02), or a module the workspace has off (FR-12). When neither, every
 * read is the store's own and nothing needs redacting.
 */
export function hidesFrom(store: Judged, principal: Principal): boolean {
  if (isSystem(principal)) return false;
  return (store.policy?.sees?.length ?? 0) > 0 || turnedOff(store, principal).size > 0;
}

/**
 * WHETHER ONE SEAT SEES A RECORD, BY ID — one in the graph by what it is
 * now; one since removed by the kind the log says it was, and so never by
 * an edge it no longer has; and a string that names no record at all (a
 * label in a call's arguments) is nothing to keep from anybody.
 *
 * THE JUDGEMENT FOLLOWS THE STORE (FR-51). It reads the policy, the
 * modules that are off and who made each record as it is asked, not as it
 * was taken: one taken before a commit and asked after it knows the record
 * just made is its maker's own. Asking costs nothing more for that — who
 * made what is an index the log keeps as it goes (`recordsOf`).
 */
export function seesId(store: Judged, principal: Principal): (id: string) => boolean {
  return (id) => {
    const off = turnedOff(store, principal);
    if (!store.policy?.sees?.length && off.size === 0) return true;
    const records = recordsOf(store.log);
    const node = store.graph.getNode(id);
    if (node) return !off.has(node.kind) && sees(store.policy, principal, node, store.graph, records);
    const kind = records.kindOf(id);
    if (kind === undefined) return true;
    return !off.has(kind) && sees(store.policy, principal, { id, kind }, { out: () => [], in: () => [] }, records);
  };
}

/** Whether a kind's field may be left off a record: declared optional, or not declared at all. Unknown kinds keep every field. */
function optionalIn(schema: Judged["schema"]): (kind: string, field: string) => boolean {
  const known = new Map<string, boolean>();
  return (kind, field) => {
    const key = `${kind}\u0000${field}`;
    let optional = known.get(key);
    if (optional === undefined) {
      const shape = (schema?.tryDefinition(kind)?.fields as { shape?: Record<string, { safeParse?(value: unknown): { success: boolean } }> } | undefined)?.shape;
      const declared = shape?.[field];
      optional = shape !== undefined && (declared === undefined || declared.safeParse?.(undefined).success === true);
      known.set(key, optional);
    }
    return optional;
  };
}

/**
 * WHAT ONE SEAT IS SERVED (FR-55) — the judgement every surface built on
 * the seat view reads, so a snapshot, a log, an answer and the wire cannot
 * disagree about it.
 *
 * Its sight (`seesId`) says which records it may be told of. An id is
 * minted from a label, so a seen record's field that holds the id of one
 * it may not see tells it that record's name: such a field is CLEARED in
 * what the seat is served — the record stays, usable, without it — when
 * the kind's declaration lets a record be without it. When the field is
 * one the record cannot do without, clearing it would serve a record that
 * fails its own declaration, and a client refuses to load that: the record
 * is WITHHELD from the seat whole instead, as if its sight did not reach
 * it — not in the graph, the snapshot, the log's primitives or an edge.
 * Which ids a field names is judged by the seat's sight alone, so a record
 * naming one withheld this way still names a record the seat may see.
 */
export function seatLens(store: Judged, principal: Principal): SeatLens {
  const sees = seesId(store, principal);
  const optional = optionalIn(store.schema);
  /*
   * A SEAT IS SERVED ITS OWN WORDS (FR-55). A field whose value this seat
   * wrote — or the person an agent acts for — is served as written, though
   * it name a record the seat may not see: saying back what a seat said
   * tells it nothing, and judging it like anybody else's would tell a seat
   * that guessed an id whether the guess was real.
   */
  const actor = isSystem(principal) ? undefined : actingAs(principal).id;
  const writers = (): Writers => writersOf(store.log as never);
  const length = (): number => (store.log as { readonly length?: number }).length ?? store.log.all().length;
  // The same record served the same way is the same object, so a view read twice is equal by identity.
  const cleared = new WeakMap<object, { readonly without: string; readonly node: unknown }>();
  const servedWith = <N extends { readonly id: string; readonly kind: string }>(node: N, writer: FieldWriter): N | undefined => {
    if (!sees(node.id)) return undefined;
    let without: string[] | undefined;
    for (const [field, value] of Object.entries(node)) {
      if (field === "id" || field === "kind" || !namesUnseen(value, sees)) continue;
      if (actor !== undefined && writer(field) === actor) continue;
      if (!optional(node.kind, field)) return undefined;
      (without ??= []).push(field);
    }
    if (!without) return node;
    const key = without.join("\u0000");
    const held = cleared.get(node);
    if (held?.without === key) return held.node as N;
    const out = Object.fromEntries(Object.entries(node).filter(([field]) => !without.includes(field))) as N;
    cleared.set(node, { without: key, node: out });
    return out;
  };
  const served = <N extends { readonly id: string; readonly kind: string }>(node: N): N | undefined => {
    const now = length();
    const known = writers();
    return servedWith(node, (field) => known.writerAt(node.id, field, now));
  };
  const shows = (id: string): boolean => {
    if (!sees(id)) return false;
    const node = store.graph.getNode(id);
    return node === undefined || served(node) !== undefined;
  };
  const kindOf = (id: string): string | undefined => store.graph.getNode(id)?.kind ?? recordsOf(store.log).kindOf(id);
  const graph = store.graph;
  const timeline: Timeline | undefined =
    graph.outEdges && graph.inEdges
      ? {
          present: {
            getNode: (id) => graph.getNode(id) as AnyGraphNode | undefined,
            outEdges: (id) => graph.outEdges!(id),
            inEdges: (id) => graph.inEdges!(id),
          },
          log: store.log as Timeline["log"],
          get writers() {
            return writers();
          },
        }
      : undefined;
  return { sees, shows, served, servedWith, optional, kindOf, ...(actor !== undefined ? { actor } : {}), ...(timeline ? { timeline } : {}) };
}

/** The store's log as one seat may read it: every op in its place, the ones it may not see withheld (FR-16), and no id it may not see in any of them (FR-55). */
export function logSeenBy(store: Judged, principal: Principal): readonly Operation[] {
  if (!hidesFrom(store, principal)) return store.log.all();
  return redact(store.log.all(), seatLens(store, principal));
}

/** Whether a rule's finding or violation is one a seat may be told: about records it is served, naming none it may not see. */
function violationShown(lens: SeatLens, has: (id: string) => boolean, violation: Pick<Violation, "subjectId" | "nodeIds">): boolean {
  return (
    (violation.subjectId === undefined || !has(violation.subjectId) || lens.shows(violation.subjectId)) &&
    violation.nodeIds.every((id) => !has(id) || lens.shows(id)) &&
    !namesUnseen(violation, lens.sees)
  );
}

/**
 * A CHANGE'S ANSWER AS ONE SEAT MAY BE TOLD IT (FR-55) — the diff, the
 * primitives, the ops and the rules it would break or mend of a preview,
 * an apply or an undo, for a surface that hands a seat what its own act
 * did: an act may touch what its own seat may not see. Records and edges
 * it is not served go, a field naming one it may not see is cleared as
 * the view clears it, the ops are redacted as its log is, and a sentence
 * that names what it may not see says only that a change it cannot see
 * happened. With nothing kept from the seat, the answer as it is.
 */
export function answerSeenBy<
  A extends {
    readonly diff?: GraphDiff<GraphNodeBase>;
    readonly primitives?: readonly unknown[];
    readonly reads?: readonly string[];
    readonly writes?: readonly string[];
    readonly intent?: string;
    readonly introduces?: readonly Violation[];
    readonly resolves?: readonly Violation[];
    readonly violationsAfter?: readonly Violation[];
    readonly ops?: readonly Operation[];
  },
>(store: Judged, principal: Principal, answer: A): A {
  if (!hidesFrom(store, principal)) return answer;
  const lens = seatLens(store, principal);
  const has = (id: string) => store.graph.getNode(id) !== undefined || recordsOf(store.log).kindOf(id) !== undefined;
  const out: Record<string, unknown> = { ...answer };
  if (answer.diff) {
    const diff = answer.diff as GraphDiff;
    /*
     * EACH SIDE AS WHO WROTE IT THEN (FR-55): the seat's own words are served
     * as written, and the words a change replaced were somebody's before it.
     * Before is judged as of the first op the answer made (now, for a
     * preview); after as of now — and, for a preview, what it would write
     * is the caller's.
     */
    const writers = writersOf(store.log as never);
    const end = (store.log as { readonly length?: number }).length ?? store.log.all().length;
    const first = answer.ops?.[0]?.seq ?? end;
    const actor = actingAs(principal).id;
    const wroteAt = (id: string, seq: number) => (field: string) => writers.writerAt(id, field, seq);
    const node = <N extends { id: string; kind: string }>(one: N, writer: FieldWriter) => (lens.shows(one.id) ? lens.servedWith(one, writer) : undefined);
    const nodes = <N extends { id: string; kind: string }>(all: readonly N[], writer: (id: string) => FieldWriter) => all.flatMap((one) => node(one, writer(one.id)) ?? []);
    const edge = (one: GraphEdge) => lens.shows(one.from) && lens.shows(one.to) && !namesUnseen(one, lens.sees);
    const madeBy = (id: string, fields?: readonly string[]): FieldWriter =>
      answer.ops ? wroteAt(id, end) : (field) => (fields === undefined || fields.includes(field) ? actor : writers.writerAt(id, field, end));
    out["diff"] = {
      addedNodes: nodes(diff.addedNodes, (id) => madeBy(id)),
      removedNodes: nodes(diff.removedNodes, (id) => wroteAt(id, first)),
      changedNodes: diff.changedNodes.flatMap((change: NodeChange) => {
        const before = node(change.before, wroteAt(change.before.id, first));
        const after = node(change.after, madeBy(change.after.id, change.fields));
        return before && after ? [{ before, after, fields: change.fields.filter((field) => field in before || field in after) }] : [];
      }),
      addedEdges: diff.addedEdges.filter(edge),
      removedEdges: diff.removedEdges.filter(edge),
      touched: diff.touched.filter(lens.shows),
    };
  }
  if (answer.ops) out["ops"] = redact(answer.ops, lens);
  if (answer.primitives) {
    // An apply's primitives are its ops'; a preview's are not in the log yet, and are judged from the graph as it stands.
    const ops = out["ops"] as readonly Operation[] | undefined;
    out["primitives"] = ops
      ? ops.flatMap((op) => op.primitives)
      : lens.timeline
        ? servePrimitives(answer.primitives as readonly Primitive[], lens.timeline, { served: (node, writer) => lens.servedWith(node, writer), edgeClean: (edge) => !namesUnseen(edge, lens.sees) }, actingAs(principal).id)
        : redact([{ id: "", seq: 0, batch: "", author: { kind: "system" }, intent: "", mutation: null, primitives: answer.primitives as never, inverse: [], reads: [], writes: [], at: "" }], lens)[0]!.primitives;
  }
  if (answer.reads) out["reads"] = answer.reads.filter(lens.shows);
  if (answer.writes) out["writes"] = answer.writes.filter(lens.shows);
  if (answer.intent !== undefined && namesUnseen(answer.intent, lens.sees)) out["intent"] = WITHHELD_INTENT;
  for (const key of ["introduces", "resolves", "violationsAfter"] as const) {
    const violations = answer[key];
    if (violations) out[key] = violations.filter((violation) => violationShown(lens, has, violation));
  }
  return out as A;
}

/** A log reading over a seat's redacted ops, for `checkUndo`. */
export function readingOf(ops: readonly Operation[], epochs: LogReading["epochs"]): LogReading {
  return { all: () => ops, undoneIds: () => undoneIn(ops), epochs };
}

const VIEWS = new WeakMap<object, Map<string, unknown>>();

const bound = (target: object, prop: PropertyKey): unknown => {
  const value = Reflect.get(target, prop, target);
  return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
};

/**
 * THE STORE AS ONE PRINCIPAL MAY SEE IT.
 *
 * Every surface reads `store.graph` — the scene, the pages, Find, the
 * chat, an agent's tools — and none of them asked who was looking: a
 * storefront showed a stranger every customer's name, email and finance
 * question, because a policy could only say who may ACT. With the policy's
 * `sees` declared, this is the store a surface is handed: its graph, its
 * log, its history and its problems hold only what the principal may see,
 * and every act still goes to the store itself, judged there as always.
 * With no `sees`, it is the store, unchanged.
 */
export function seenBy<S extends AnySchema>(store: Store<S>, principal: Principal): Store<S> {
  // A module off keeps its kinds from every seat as a sight would (FR-12); the view reads which are off as it goes.
  if (!store.policy?.sees?.length && store.modules.disabledKinds.size === 0) return store;
  // Keyed by the seat the policy judges: an agent for Nick is not the same agent alone.
  const judged = isSystem(principal) ? principal : actingAs(principal);
  const key = `${principal.kind}|${judged.id ?? ""}|${(judged.roles ?? []).join(",")}|${principal.onBehalfOf ? "for" : ""}`;
  let views = VIEWS.get(store);
  if (!views) VIEWS.set(store, (views = new Map()));
  const held = views.get(key);
  if (held) return held as Store<S>;

  const full = store.graph;
  /*
   * WHAT THIS SEAT IS SERVED (FR-55): a record its sight reaches, with any
   * field that names one it may not see cleared — or, when that field is
   * one the record cannot do without, not the record at all.
   */
  const lens = seatLens(store as never, principal);
  const served = <N>(node: N | undefined): N | undefined => (node === undefined ? undefined : (lens.served(node as never) as N | undefined));
  const seenNode = (node: { id: string; kind: string } | undefined): boolean => served(node) !== undefined;
  const seenId = (id: string): boolean => seenNode(full.getNode(id) as never);
  const seenEdge = (edge: GraphEdge): boolean => seenId(edge.from) && seenId(edge.to) && !namesUnseen(edge, lens.sees);
  const servedAll = <N>(nodes: readonly N[]): N[] => nodes.flatMap((node) => served(node) ?? []);
  /** A graph of another moment — an epoch's base, at `seq` — as this seat is served it: its records, as who wrote them then, and its links between them. */
  const servedGraph = (snapshot: GraphSnapshot, seq: number): GraphSnapshot => {
    const writers = writersOf(store.log as never);
    const nodes = snapshot.nodes.flatMap((node) => lens.servedWith(node, (field) => writers.writerAt(node.id, field, seq)) ?? []);
    const kept = new Set(nodes.map((node) => node.id));
    return { nodes, edges: snapshot.edges.filter((edge) => kept.has(edge.from) && kept.has(edge.to) && !namesUnseen(edge, lens.sees)) };
  };
  /*
   * THE LOG, REDACTED RATHER THAN GAPPED (FR-16): every op in its place,
   * and one that touched what this seat may not see withheld — so the log
   * still loads, folds and undoes, and says something happened there.
   */
  const ops = (): readonly Operation[] => logSeenBy(store as never, principal);
  const reading = (): LogReading => readingOf(ops(), () => store.log.epochs());

  const graph = new Proxy(full, {
    get(target, prop) {
      switch (prop) {
        case "getNode":
          return (id: string) => served(target.getNode(id));
        case "has":
          return (id: string) => seenId(id);
        case "allNodes":
          return () => servedAll(target.allNodes());
        case "nodesOfKind":
          return (kind: never) => servedAll(target.nodesOfKind(kind));
        case "allEdges":
          return () => target.allEdges().filter(seenEdge);
        case "edgesOfKind":
          return (kind: string) => target.edgesOfKind(kind).filter(seenEdge);
        case "out":
          return (id: string, kind?: string) => (seenId(id) ? servedAll(target.out(id, kind)) : []);
        case "in":
          return (id: string, kind?: string) => (seenId(id) ? servedAll(target.in(id, kind)) : []);
        case "neighbors":
          return (id: string) => (seenId(id) ? servedAll(target.neighbors(id)) : []);
        case "outEdges":
          return (id: string, kind?: string) => target.outEdges(id, kind).filter(seenEdge);
        case "inEdges":
          return (id: string, kind?: string) => target.inEdges(id, kind).filter(seenEdge);
        case "snapshot":
          return () => {
            const snapshot = target.snapshot();
            return { ...snapshot, nodes: servedAll(snapshot.nodes), edges: snapshot.edges.filter(seenEdge) };
          };
        case "size": {
          const nodes = target.allNodes().filter((node) => seenNode(node as never)).length;
          return { nodes, edges: target.allEdges().filter(seenEdge).length };
        }
        default:
          return bound(target, prop);
      }
    },
  });

  const batches = (): Batch[] => {
    const all = ops();
    return batchesOf(all, undoneIn(all));
  };
  const log = new Proxy(store.log, {
    get(target, prop) {
      switch (prop) {
        case "all":
        case "toJSON":
          return () => [...ops()];
        // Each epoch's base as this seat is served it, so its log folds from there to what it is served (FR-55).
        case "epochs":
          return () => target.epochs().map((epoch) => ({ ...epoch, base: servedGraph(epoch.base, epoch.seq) }));
        case "lastEpoch":
          return () => {
            const epoch = target.lastEpoch();
            return epoch && { ...epoch, base: servedGraph(epoch.base, epoch.seq) };
          };
        case "live":
          return () => {
            const all = ops();
            const undone = undoneIn(all);
            return all.filter((op) => !undone.has(op.id));
          };
        case "get":
          return (id: string) => ops().find((op) => op.id === id);
        case "opsInBatch":
          return (batch: string) => ops().filter((op) => op.batch === batch);
        case "batches":
          return batches;
        default:
          return bound(target, prop);
      }
    },
  });

  const view = new Proxy(store, {
    get(target, prop) {
      switch (prop) {
        case "graph":
          return graph;
        case "log":
          return log;
        case "snapshot":
          return () => (graph as unknown as { snapshot(): unknown }).snapshot();
        case "batches":
          return batches;
        // Judged over what this seat sees, so the sentence never names a change it may not (FR-16).
        case "canUndo":
          return (batchIds: string | readonly string[]) => checkUndo(reading(), typeof batchIds === "string" ? [batchIds] : batchIds);
        case "violations":
          return (...args: Parameters<Store<S>["violations"]>) => target.violations(...args).filter((violation) => violationShown(lens, (id) => full.has(id), violation));
        // What no longer fits, about records this seat is served and naming none it may not see (FR-55).
        case "findings":
          return () =>
            target.findings().filter((finding) => {
              const ids = finding.id.includes("->") ? finding.id.split("->").map((end, at) => (at === 0 ? end.slice(end.indexOf(":") + 1) : end)) : [finding.id];
              return ids.every((id) => !full.has(id) || seenId(id)) && !namesUnseen(finding, lens.sees);
            });
        case "seenBy":
          return (other: Principal) => seenBy(target, other);
        case "seenFor":
          return principal;
        // A checkpoint taken through the seat's view is the one it is served.
        case "checkpoint":
          return (...args: Parameters<Store<S>["checkpoint"]>) => {
            const epoch = target.checkpoint(...args);
            return epoch && { ...epoch, base: servedGraph(epoch.base, epoch.seq) };
          };
        default:
          return bound(target, prop);
      }
    },
  }) as Store<S>;
  views.set(key, view);
  return view;
}
