import type { GraphEdge } from "./graph/types.js";
import { batchesOf, undoneIn, type LogReading } from "./ops/log.js";
import { checkUndo } from "./ops/undo.js";
import type { Batch, Operation } from "./ops/types.js";
import { redact } from "./ops/withheld.js";
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
  };
  readonly log: LogReading;
  /** The kinds of the modules this workspace has off (FR-12), kept from every seat as a sight keeps a record. */
  readonly modules?: { readonly disabledKinds: ReadonlySet<string> };
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

/** The store's log as one seat may read it: every op in its place, the ones it may not see withheld (FR-16). */
export function logSeenBy(store: Judged, principal: Principal): readonly Operation[] {
  if (!hidesFrom(store, principal)) return store.log.all();
  return redact(store.log.all(), seesId(store, principal));
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
  const seenNode = (node: { id: string; kind: string } | undefined): boolean =>
    node !== undefined && !turnedOff(store, principal).has(node.kind) && sees(store.policy, principal, node as never, full as never, recordsOf(store.log));
  const seenId = (id: string): boolean => seenNode(full.getNode(id) as never);
  const seenEdge = (edge: GraphEdge): boolean => seenId(edge.from) && seenId(edge.to);
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
          return (id: string) => {
            const node = target.getNode(id);
            return seenNode(node as never) ? node : undefined;
          };
        case "has":
          return (id: string) => seenId(id);
        case "allNodes":
          return () => target.allNodes().filter((node) => seenNode(node as never));
        case "nodesOfKind":
          return (kind: never) => target.nodesOfKind(kind).filter((node) => seenNode(node as never));
        case "allEdges":
          return () => target.allEdges().filter(seenEdge);
        case "edgesOfKind":
          return (kind: string) => target.edgesOfKind(kind).filter(seenEdge);
        case "out":
          return (id: string, kind?: string) => (seenId(id) ? target.out(id, kind).filter((node) => seenNode(node as never)) : []);
        case "in":
          return (id: string, kind?: string) => (seenId(id) ? target.in(id, kind).filter((node) => seenNode(node as never)) : []);
        case "neighbors":
          return (id: string) => (seenId(id) ? target.neighbors(id).filter((node) => seenNode(node as never)) : []);
        case "outEdges":
          return (id: string, kind?: string) => target.outEdges(id, kind).filter(seenEdge);
        case "inEdges":
          return (id: string, kind?: string) => target.inEdges(id, kind).filter(seenEdge);
        case "snapshot":
          return () => {
            const snapshot = target.snapshot();
            return { ...snapshot, nodes: snapshot.nodes.filter((node) => seenNode(node as never)), edges: snapshot.edges.filter(seenEdge) };
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
          return (...args: Parameters<Store<S>["violations"]>) =>
            target.violations(...args).filter((violation) => (violation.subjectId === undefined || seenId(violation.subjectId)) && violation.nodeIds.every((id) => !full.has(id) || seenId(id)));
        case "seenBy":
          return (other: Principal) => seenBy(target, other);
        case "seenFor":
          return principal;
        default:
          return bound(target, prop);
      }
    },
  }) as Store<S>;
  views.set(key, view);
  return view;
}
