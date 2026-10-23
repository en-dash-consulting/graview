import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineNode,
  EDGE_FIELDS,
  Graph,
  GraphError,
  MissingRecordError,
  nodeRef,
  snapshotHash,
  Store,
  type GraphEdge,
} from "../../src/index.js";

/**
 * A LINK'S OWN FIELDS, RESERVED FOR 1.0 (Roadmap f-1-0-edge-fields).
 *
 * A link may carry an `id` and a small JSON `data` object. No act the
 * framework derives writes them yet, and a second link of one kind
 * between one pair is still refused — but every reader keeps and folds
 * them, so a version that opens them needs nothing stored rewritten.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), edges: { "assigned-to": { to: ["duty"] } } });
const duty = defineNode("duty", { fields: z.object({ label: z.string() }) });
const schema = createSchema([person, duty]);
const { defineMutation } = bindSchema(schema);

const seed = {
  nodes: [
    { id: "ana", kind: "person", label: "Ana" },
    { id: "bo", kind: "person", label: "Bo" },
    { id: "morning", kind: "duty", label: "Morning" },
  ],
  edges: [],
};

const assign = defineMutation("assign", {
  title: "Assign",
  description: "Put a person on a duty, the link carrying its own id and data.",
  input: z.object({ personId: nodeRef(["person"]), dutyId: nodeRef(["duty"]), linkId: z.string().optional(), hours: z.number().optional() }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "assigned-to", from: args.personId, to: args.dutyId, ...(args.linkId ? { id: args.linkId } : {}), ...(args.hours !== undefined ? { data: { hours: args.hours } } : {}) });
  },
});
const unassign = defineMutation("unassign", {
  title: "Unassign",
  description: "Take a link off by its own id.",
  input: z.object({ linkId: z.string() }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "assigned-to", from: "", to: "", id: args.linkId });
  },
});
const mutations = [assign, unassign];
const open = () => new Store({ schema, mutations, snapshot: seed as never });
const shift: GraphEdge = { kind: "assigned-to", from: "ana", to: "morning", id: "shift-1", data: { hours: 4 } };

describe("a link keeps its own id and data", () => {
  it("reserves the fields, and still allows one link of a kind per pair", () => {
    expect(EDGE_FIELDS).toEqual({ idLength: 200, dataLength: 4096, sameKindPerPair: 1 });
  });

  it("is kept by the graph, its snapshot, the log and a store folded again from the log as JSON", () => {
    const store = open();
    store.apply({ name: "assign", args: { personId: "ana", dutyId: "morning", linkId: "shift-1", hours: 4 } });
    expect(store.graph.snapshot().edges).toEqual([shift]);
    const written = JSON.parse(JSON.stringify(store.log.all()));
    expect(written[0].primitives[0].edge).toEqual(shift);
    const again = new Store({ schema, mutations, log: written, epochs: [{ seq: 0, base: seed }] as never });
    expect(again.graph.snapshot().edges).toEqual([shift]);
    expect(again.verify().ok).toBe(true);
    expect(Graph.from(schema, JSON.parse(JSON.stringify(store.graph.snapshot()))).snapshot().edges).toEqual([shift]);
  });

  it("is removed by its own id, and put back whole by an undo", () => {
    const store = open();
    store.apply({ name: "assign", args: { personId: "ana", dutyId: "morning", linkId: "shift-1", hours: 4 } });
    const removed = store.apply({ name: "unassign", args: { linkId: "shift-1" } });
    expect(store.graph.snapshot().edges).toEqual([]);
    store.undo(removed.batch);
    expect(store.graph.snapshot().edges).toEqual([shift]);
  });

  it("is removed by where it stands when the removal names no id, as before", () => {
    const graph = Graph.from(schema, { ...seed, edges: [shift] } as never);
    graph.applyPrimitives([{ op: "remove-edge", edge: { kind: "assigned-to", from: "ana", to: "morning" } }]);
    expect(graph.size.edges).toBe(0);
  });

  it("refuses a removal that names an id no link holds, as missing", () => {
    const graph = Graph.from(schema, { ...seed, edges: [shift] } as never);
    expect(() => graph.applyPrimitives([{ op: "remove-edge", edge: { kind: "assigned-to", from: "ana", to: "morning", id: "shift-9" } }])).toThrow(MissingRecordError);
    expect(graph.size.edges).toBe(1);
  });

  it("refuses a second link of one kind between one pair, and an id another link holds", () => {
    const store = open();
    store.apply({ name: "assign", args: { personId: "ana", dutyId: "morning", linkId: "shift-1" } });
    expect(() => store.apply({ name: "assign", args: { personId: "ana", dutyId: "morning", linkId: "shift-2" } })).toThrow(/not allowed yet/);
    expect(() => store.apply({ name: "assign", args: { personId: "bo", dutyId: "morning", linkId: "shift-1" } })).toThrow(/Link id "shift-1" is already taken/);
    // The same link again is nothing new, as it always was.
    store.apply({ name: "assign", args: { personId: "ana", dutyId: "morning", linkId: "shift-1" } });
    expect(store.graph.size.edges).toBe(1);
  });

  it("refuses data that is not a small JSON object, and an id with a space in it", () => {
    const graph = Graph.from(schema, seed as never);
    const add = (edge: Partial<GraphEdge>) => () => graph.applyPrimitives([{ op: "add-edge", edge: { kind: "assigned-to", from: "ana", to: "morning", ...edge } as GraphEdge }]);
    expect(add({ data: [1, 2] as never })).toThrow(GraphError);
    expect(add({ data: { note: "x".repeat(EDGE_FIELDS.dataLength) } })).toThrow(/at most 4096 characters/);
    expect(add({ id: "two words" })).toThrow(/no space/);
    expect(graph.size.edges).toBe(0);
  });

  it("hashes a graph without them as it always did, and one with them by them", () => {
    const plain = { nodes: seed.nodes, edges: [{ kind: "assigned-to", from: "ana", to: "morning" }] };
    expect(snapshotHash(plain as never)).toBe(snapshotHash({ ...plain, edges: [{ to: "morning", from: "ana", kind: "assigned-to" }] } as never));
    expect(snapshotHash({ ...plain, edges: [shift] } as never)).not.toBe(snapshotHash(plain as never));
    expect(snapshotHash({ ...plain, edges: [shift] } as never)).not.toBe(snapshotHash({ ...plain, edges: [{ ...shift, data: { hours: 5 } }] } as never));
  });

  it("moves whole when the record it ends at is merged into another", () => {
    const merge = defineMutation("merge-person", {
      title: "Merge",
      description: "Merge one person into another.",
      input: z.object({ gone: z.string(), into: z.string() }),
      apply(ctx, args) {
        ctx.mergeNode(args.gone, args.into);
      },
    });
    const store = new Store({ schema, mutations: [...mutations, merge], snapshot: { ...seed, edges: [shift] } as never });
    store.apply({ name: "merge-person", args: { gone: "ana", into: "bo" } });
    expect(store.graph.snapshot().edges).toEqual([{ ...shift, from: "bo" }]);
  });
});
