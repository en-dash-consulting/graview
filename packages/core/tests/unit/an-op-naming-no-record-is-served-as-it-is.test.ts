import { describe, expect, it } from "vitest";
import { z } from "zod";
import { storeOf, world } from "../support/unseen-worlds.js";
import { createSchema, defineNode, edgeId, hidesFrom, isWithheld, logSeenBy, redact, seatLens, seesId, Store, type AnySchema, type GraphEdge, type Operation, type Policy, type Primitive, type Principal } from "../../src/index.js";

/**
 * AN OP NAMING AN ID THAT IS NO RECORD IS SERVED AS IT IS (FR-67).
 *
 * Graview Cloud's repair removes a dangling link — `fills: vendor:bloom →
 * category:ghost`, whose far end was never a record — and the app's own
 * owner, from whom nothing is hidden, was served it as "a change you cannot
 * see": the seat view judged the link by whether both its ends were records
 * served, and `category:ghost` was no record at all. An id that names no
 * record is nothing to keep from anybody, as `seesId` already said.
 *
 * The other half is FR-55's: an id that names a record that WAS there and
 * was hidden from the seat — removed later, earlier, or in the same op as
 * the link — is still never served to it.
 */
const vendor = defineNode("vendor", { fields: z.object({ title: z.string() }), edges: { fills: { to: ["category"], cardinality: "many" } } });
const category = defineNode("category", { fields: z.object({ title: z.string() }) });
const schema = createSchema([vendor, category]) as unknown as AnySchema;

const BLOOM = { id: "vendor:bloom", kind: "vendor", title: "Bloom" };
const GHOST: GraphEdge = { kind: "fills", from: "vendor:bloom", to: "category:ghost" };
const HIDDEN = { id: "category:hidden", kind: "category", title: "Hidden" };
const TO_HIDDEN: GraphEdge = { kind: "fills", from: "vendor:bloom", to: "category:hidden" };

/** Vendors are seen by the viewer; categories by nobody but the owner. */
const SIGHTED: Policy = { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["viewer", "owner"], kinds: ["vendor"] }, { roles: ["owner"], kinds: ["category"] }] };
const viewer: Principal = { kind: "human", id: "u2", roles: ["viewer"] };
const owner: Principal = { kind: "human", id: "u1", roles: ["owner"] };

let seq = 0;
const opOf = (primitives: Primitive[], intent = "Repair"): Operation => ({
  id: `op${seq + 1}`,
  seq: seq++,
  batch: `served:batch:repair:${seq}`,
  author: { kind: "system", id: "repair" },
  intent,
  mutation: null,
  primitives,
  inverse: [],
  reads: [],
  writes: [],
  at: "2026-10-04T00:00:00.000Z",
});
const logOf = (...steps: Primitive[][]): Operation[] => {
  seq = 0;
  return steps.map((primitives) => opOf(primitives));
};

/**
 * A LINK WHOSE END IS NOT THERE, put straight into a running graph as
 * Cloud's test does: no fold or load makes one, but a store that was
 * written by something older can hold one, and a repair removes it.
 */
const dangle = (store: Store<AnySchema>, edge: GraphEdge): void => {
  const graph = store.graph as unknown as { edges: Map<string, GraphEdge>; outIndex: Map<string, Set<string>>; inIndex: Map<string, Set<string>> };
  graph.edges.set(edgeId(edge), edge);
  for (const [index, end] of [[graph.outIndex, edge.from], [graph.inIndex, edge.to]] as const) index.set(end, new Set([...(index.get(end) ?? []), edgeId(edge)]));
};

describe("an op naming no record is served as it is", () => {
  it("serves a repair removing a dangling link to a seat from whom nothing is hidden, unchanged: Cloud's reproduction", () => {
    const ops = logOf([{ op: "remove-edge", edge: GHOST }]);
    const store = new Store<AnySchema>({ schema, snapshot: { nodes: [BLOOM], edges: [] }, log: ops });
    const seat: Principal = { kind: "human", id: "u1" };
    expect(hidesFrom(store, seat)).toBe(false);
    expect(seesId(store, seat)("category:ghost")).toBe(true);

    const served = redact(store.log.all(), seatLens(store, seat));
    expect(served).toEqual(store.log.all());
    expect(served.some(isWithheld)).toBe(false);
    expect(logSeenBy(store, seat).some(isWithheld)).toBe(false);
  });

  it("returns the ops unchanged to any seat from whom nothing is hidden", () => {
    const ops = logOf([{ op: "add-node", node: HIDDEN }], [{ op: "remove-edge", edge: GHOST }], [{ op: "remove-node", node: HIDDEN }]);
    const store = new Store<AnySchema>({ schema, snapshot: { nodes: [BLOOM], edges: [] }, log: ops });
    const seat: Principal = { kind: "human", id: "u3", roles: ["anyone"] };
    expect(hidesFrom(store, seat)).toBe(false);
    expect(redact(store.log.all(), seatLens(store, seat))).toEqual(store.log.all());
  });

  it("serves it as it is to a seat with sights that sees the link's one record", () => {
    const ops = logOf([{ op: "remove-edge", edge: GHOST }]);
    const store = new Store<AnySchema>({ schema, policy: SIGHTED, snapshot: { nodes: [BLOOM], edges: [] }, log: ops });
    expect(hidesFrom(store, viewer)).toBe(true);
    expect(redact(store.log.all(), seatLens(store, viewer))).toEqual(store.log.all());
    expect(logSeenBy(store, viewer)).toEqual(store.log.all());
  });

  it("serves the repair as it is when it lands on a graph that holds the dangling link, to the owner and the viewer alike", () => {
    const store = new Store<AnySchema>({ schema, policy: SIGHTED, snapshot: { nodes: [BLOOM], edges: [] } });
    dangle(store, GHOST);
    const { ops } = store.applyPrimitives([{ op: "remove-edge", edge: GHOST }], { author: { kind: "system", id: "repair" }, intent: "Remove a link to a record that is not there" });
    expect(store.graph.allEdges()).toEqual([]);
    for (const seat of [owner, viewer]) {
      expect(redact(ops, seatLens(store, seat))).toEqual(ops);
      expect(logSeenBy(store, seat)).toEqual(store.log.all());
    }
  });

  it("still withholds a link to a record the seat may not see, removed later in the log", () => {
    const ops = logOf([{ op: "add-node", node: HIDDEN }, { op: "add-edge", edge: TO_HIDDEN }], [{ op: "remove-edge", edge: TO_HIDDEN }], [{ op: "remove-node", node: HIDDEN }]);
    const store = new Store<AnySchema>({ schema, policy: SIGHTED, snapshot: { nodes: [BLOOM], edges: [] }, log: ops });
    const served = redact(store.log.all(), seatLens(store, viewer));
    expect(served.map(isWithheld)).toEqual([true, true, true]);
    expect(JSON.stringify({ served, log: logSeenBy(store, viewer), snapshot: store.seenBy(viewer).snapshot() })).not.toContain("category:hidden");
    // The owner sees all of it, as it is.
    expect(redact(store.log.all(), seatLens(store, owner))).toEqual(store.log.all());
  });

  for (const order of ["the link first", "the record first"] as const) {
    it(`still withholds a link to a record the seat may not see, removed in the same op — ${order}`, () => {
      const removal: Primitive[] = order === "the link first" ? [{ op: "remove-edge", edge: TO_HIDDEN }, { op: "remove-node", node: HIDDEN }] : [{ op: "remove-node", node: HIDDEN }, { op: "remove-edge", edge: TO_HIDDEN }];
      const ops = logOf([{ op: "add-node", node: HIDDEN }], [{ op: "add-edge", edge: TO_HIDDEN }], removal);
      const store = new Store<AnySchema>({ schema, policy: SIGHTED, snapshot: { nodes: [BLOOM], edges: [] }, log: ops });
      const served = redact(store.log.all(), seatLens(store, viewer));
      expect(isWithheld(served[2]!)).toBe(true);
      expect(JSON.stringify({ served, log: logSeenBy(store, viewer) })).not.toContain("category:hidden");
    });
  }

  it("still withholds a dangling link to a record the seat may not see that was removed before it, and does not serve the link", () => {
    // The record was made and removed; its link outlived it, as a graph loaded from storage may hold one.
    const ops = logOf([{ op: "add-node", node: HIDDEN }], [{ op: "remove-node", node: HIDDEN }], [{ op: "remove-edge", edge: TO_HIDDEN }]);
    const before = new Store<AnySchema>({ schema, policy: SIGHTED, snapshot: { nodes: [BLOOM], edges: [] }, log: ops.slice(0, 2) });
    dangle(before, TO_HIDDEN);
    expect(before.seenBy(viewer).snapshot().edges).toEqual([]);
    const store = new Store<AnySchema>({ schema, policy: SIGHTED, snapshot: { nodes: [BLOOM], edges: [] }, log: ops });
    const served = redact(store.log.all(), seatLens(store, viewer));
    expect(served.map(isWithheld)).toEqual([true, true, true]);
    expect(JSON.stringify({ served, log: logSeenBy(store, viewer), was: before.seenBy(viewer).snapshot() })).not.toContain("category:hidden");
    // A seat that may see categories is served the same op as it is.
    expect(redact(store.log.all(), seatLens(store, owner))[2]).toEqual(store.log.all()[2]);
  });

  it("serves every seat from whom nothing is kept its log as it is — 1,000 random worlds", () => {
    let unsighted = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const w = world(seed);
      const store = storeOf(w);
      const all = store.log.all();
      // The host's own seat is kept from nothing, whatever the sights; a world without them keeps nothing from anybody.
      for (const seat of [{ kind: "system", id: "host" } as Principal, ...(w.sights ? [] : [w.viewer])]) {
        expect(hidesFrom(store, seat)).toBe(false);
        expect(redact(all, seatLens(store, seat)), `seed ${seed}`).toEqual(all);
      }
      if (!w.sights) unsighted++;
    }
    expect(unsighted).toBeGreaterThan(50);
  });
});
