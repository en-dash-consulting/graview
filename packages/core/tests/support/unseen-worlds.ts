import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, Store, type AnyGraphNode, type AnySchema, type GraphEdge, type Operation, type Policy, type Primitive, type Principal, type Sight } from "../../src/index.js";

/*
 * RANDOM WORLDS FOR THE SEAT VIEW (FR-55), ported from Graview Cloud's
 * room (packages/room/tests/sights.test.ts): a graph, a history that made
 * it, some sights and a viewer — and fields that name other records, which
 * is what the seat view used to leave in. Kinds a, b and c may name another
 * record in an optional `ref`; kind d always does, in a required one.
 * Seeded, so a failing world is named by its seed and comes back the same.
 */

const OPTIONAL = { fields: z.object({ title: z.string(), ref: z.string().optional() }), edges: { rel: { to: ["a", "b", "c", "d"], cardinality: "many" } } } as const;
const REQUIRED = { fields: z.object({ title: z.string(), ref: z.string() }), edges: { rel: { to: ["a", "b", "c", "d"], cardinality: "many" } } } as const;
export const SCHEMA = createSchema([defineNode("a", OPTIONAL), defineNode("b", OPTIONAL), defineNode("c", OPTIONAL), defineNode("d", REQUIRED)]);
const { defineMutation } = bindSchema(SCHEMA);

const ANY = ["a", "b", "c", "d"] as const;
/** Retitle a record: the act a seat takes on what it sees. */
export const retitle = defineMutation("retitle", {
  title: "Retitle",
  subject: { kinds: [...ANY], arg: "id" },
  writes: ["title"],
  input: z.object({ id: nodeRef([...ANY]), title: z.string() }),
  describe: (args) => `Retitle ${args.id}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { title: args.title });
  },
});
/** Point a record's `ref` at whatever string it is given — another record's id, seen or not. */
export const point = defineMutation("point", {
  title: "Point",
  subject: { kinds: [...ANY], arg: "id" },
  writes: ["ref"],
  input: z.object({ id: nodeRef([...ANY]), ref: z.string() }),
  describe: (args) => `Point ${args.id} at ${args.ref}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { ref: args.ref });
  },
});
/** Make a record of kind d naming another. */
export const make = defineMutation("make", {
  title: "Make",
  creates: ["d"],
  input: z.object({ title: z.string(), ref: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.title, "d"), kind: "d", title: args.title, ref: args.ref });
  },
});
export const MUTATIONS = [retitle, point, make];

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROLES = ["r1", "r2", "r3"];
const AUTHORS = ["u1", "u2", "u3"];

export interface World {
  readonly seed: number;
  readonly nodes: AnyGraphNode[];
  readonly edges: GraphEdge[];
  readonly ops: Operation[];
  readonly sights: Sight[] | undefined;
  readonly viewer: Principal & { id: string; roles: readonly string[] };
  readonly kindOf: Map<string, string>;
  readonly creatorOf: Map<string, string>;
  /** A random record id, seen or not: for the calls and presences a test makes. */
  anyId(): string;
  pick<T>(xs: readonly T[]): T;
}

export function world(seed: number): World {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const some = <T>(xs: readonly T[]): T[] => xs.filter(() => r() < 0.5);
  const nodes = new Map<string, AnyGraphNode>();
  const edges = new Map<string, GraphEdge>();
  const kindOf = new Map<string, string>();
  const creatorOf = new Map<string, string>();
  const ops: Operation[] = [];
  let made = 0;
  const live = () => [...nodes.keys()];
  const anyId = () => pick([...kindOf.keys()]);

  for (let i = 0; i < 10 + Math.floor(r() * 50); i++) {
    const author = pick(AUTHORS);
    const prims: Primitive[] = [];
    const roll = r();
    if (roll < 0.4 || nodes.size < 2) {
      const kind = pick(ANY);
      const id = `${kind}:n${++made}`;
      const ref = kind === "d" ? (kindOf.size > 0 ? anyId() : id) : r() < 0.3 && kindOf.size > 0 ? anyId() : undefined;
      const node: AnyGraphNode = { id, kind, title: `T${made}`, ...(ref !== undefined ? { ref } : {}) };
      prims.push({ op: "add-node", node });
      nodes.set(id, node);
      kindOf.set(id, kind);
      creatorOf.set(id, author);
    } else if (roll < 0.55) {
      const edge = { kind: "rel", from: pick(live()), to: pick(live()) };
      prims.push({ op: "add-edge", edge });
      edges.set(`${edge.from}>${edge.to}`, edge);
    } else if (roll < 0.7) {
      const id = pick(live());
      prims.push({ op: "patch-node", id, before: { title: nodes.get(id)!["title"] }, after: { title: `P${i}` } });
      nodes.set(id, { ...nodes.get(id)!, title: `P${i}` });
    } else if (roll < 0.85) {
      // A field that names another record — or stops naming one.
      const id = pick(live());
      const node = nodes.get(id)!;
      const ref = anyId();
      prims.push({ op: "patch-node", id, before: { ref: node["ref"] ?? "\u0000graview:unset" }, after: { ref } });
      nodes.set(id, { ...node, ref });
    } else {
      const id = pick(live());
      for (const [k, e] of edges) {
        if (e.from === id || e.to === id) {
          prims.push({ op: "remove-edge", edge: e });
          edges.delete(k);
        }
      }
      prims.push({ op: "remove-node", node: nodes.get(id)! });
      nodes.delete(id);
    }
    const reads = kindOf.size > 0 ? Array.from({ length: Math.floor(r() * 3) }, anyId) : [];
    const other = r() < 0.3 && kindOf.size > 0 ? anyId() : undefined;
    ops.push({
      id: `op${i + 1}`,
      seq: i,
      batch: `batch:${i + 1}`,
      author: { kind: "human", id: author },
      // Sometimes an op's sentence is nothing but an id, as a describe that quotes its argument would be.
      intent: other !== undefined && r() < 0.5 ? other : `step ${i}`,
      mutation: { name: "act", args: other !== undefined ? { other } : {} },
      primitives: prims,
      inverse: [],
      reads,
      writes: prims.flatMap((p) => (p.op === "patch-node" ? [p.id] : "node" in p ? [p.node.id] : [p.edge.from, p.edge.to])),
      at: "2026-10-02T00:00:00.000Z",
    });
  }

  const sights: Sight[] | undefined =
    r() < 0.15
      ? undefined
      : Array.from({ length: 1 + Math.floor(r() * 3) }, () => {
          const kinds = some([...ANY]);
          return { roles: r() < 0.2 ? ("*" as const) : some(ROLES), kinds: kinds.length > 0 ? kinds : [pick(ANY)], ...(r() < 0.4 ? { own: true } : {}) };
        });
  const viewer = { kind: "human" as const, id: pick(AUTHORS), roles: some(ROLES) };
  return { seed, nodes: [...nodes.values()], edges: [...edges.values()], ops, sights, viewer, kindOf, creatorOf, anyId, pick };
}

/** Everyone may act; who sees what is the world's sights. */
export function policyOf(w: Pick<World, "sights">): Policy {
  return { grants: [{ roles: "*", mutations: "*" }], ...(w.sights ? { sees: w.sights } : {}) };
}

/** The store this world is: its graph, the history that made it, and its policy. */
export function storeOf(w: World): Store<AnySchema> {
  return new Store<AnySchema>({ schema: SCHEMA as unknown as AnySchema, mutations: MUTATIONS as never, policy: policyOf(w), snapshot: { nodes: w.nodes, edges: w.edges }, log: w.ops });
}

/**
 * THE RULE, SAID PLAINLY — written from the policy's sentence, not from the
 * module under test: no sights, everyone sees everything; with sights, a
 * kind no sight names is seen by nobody, a kind one names is seen by the
 * roles it lists, and with `own` only by the one who made the record.
 */
export function oracle(w: World, id: string): boolean {
  if (!w.sights) return true;
  const kind = w.kindOf.get(id)!;
  const mine = (s: Sight) => s.kinds.includes(kind) && (s.roles === "*" || s.roles.some((role) => w.viewer.roles.includes(role)));
  if (w.sights.some((s) => mine(s) && !s.own)) return true;
  return w.sights.some((s) => mine(s) && s.own) && w.creatorOf.get(id) === w.viewer.id;
}

/** The ids of every record this world ever had that its viewer may not see. */
export function unseenIds(w: World): string[] {
  return [...w.kindOf.keys()].filter((id) => !oracle(w, id));
}

/** Whether a payload, as it would be serialised, holds `id` as a whole string anywhere — a value or a key. */
export function mentions(payload: unknown, id: string): boolean {
  return JSON.stringify(payload).includes(JSON.stringify(id));
}

/** The first unseen id a payload names, or undefined. */
export function leaked(payload: unknown, unseen: readonly string[]): string | undefined {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return unseen.find((id) => text.includes(JSON.stringify(id)));
}
