import type { GraphEdge } from "./graph/types.js";
import type { Batch, Operation } from "./ops/types.js";
import { actingAs, isSystem } from "./permissions/policy.js";
import { sees } from "./permissions/sight.js";
import type { Principal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";
import type { Store } from "./store.js";

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
  if (!store.policy?.sees?.length) return store;
  // Keyed by the seat the policy judges: an agent for Nick is not the same agent alone.
  const judged = isSystem(principal) ? principal : actingAs(principal);
  const key = `${principal.kind}|${judged.id ?? ""}|${(judged.roles ?? []).join(",")}|${principal.onBehalfOf ? "for" : ""}`;
  let views = VIEWS.get(store);
  if (!views) VIEWS.set(store, (views = new Map()));
  const held = views.get(key);
  if (held) return held as Store<S>;

  const full = store.graph;
  const seenNode = (node: { id: string; kind: string } | undefined): boolean =>
    node !== undefined && sees(store.policy, principal, node as never, full as never);
  const seenId = (id: string): boolean => seenNode(full.getNode(id) as never);
  const seenEdge = (edge: GraphEdge): boolean => seenId(edge.from) && seenId(edge.to);
  const touchesOnlySeen = (op: Operation): boolean => op.writes.every((id) => !full.has(id) || seenId(id));

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

  const log = new Proxy(store.log, {
    get(target, prop) {
      if (prop === "all") return () => target.all().filter(touchesOnlySeen);
      if (prop === "live") return () => target.live().filter(touchesOnlySeen);
      if (prop === "batches") return () => target.batches().filter((batch: Batch) => batch.ops.every(touchesOnlySeen));
      return bound(target, prop);
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
          return () => target.batches().filter((batch) => batch.ops.every(touchesOnlySeen));
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
