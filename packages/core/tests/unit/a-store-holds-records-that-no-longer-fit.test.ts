import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, GraphError, OperationLog, repairPlan, Store, type GraphSnapshot, type Operation } from "../../src/index.js";

/**
 * FR-28. A declaration changes; records stored under the old one stay. A
 * store used either refused to open over them, or checked nothing at all —
 * and a check that parsed could quietly change what it read. Now a store
 * opens over records that no longer fit, says what they are, and still
 * holds every new write to the declaration.
 */
const person = defineNode("person", {
  fields: z.object({ label: z.string(), email: z.string().email().optional(), role: z.enum(["chair", "member"]).default("member") }),
  edges: { knows: { to: ["person"] } },
  plural: "People",
});
const team = defineNode("team", { fields: z.object({ label: z.string(), size: z.number() }), plural: "Teams" });
const schema = createSchema([person, team]);

/** What was stored under an older declaration. */
const stored: GraphSnapshot = {
  nodes: [
    { id: "p1", kind: "person", label: "Ada", email: "not-an-address", role: "chair" },
    // No role (the declaration now defaults it) and a field it no longer declares.
    { id: "p2", kind: "person", label: "Grace", nickname: "Amazing" },
    { id: "t1", kind: "team", label: "Rota", size: "two" },
    { id: "v1", kind: "vehicle", label: "Van" },
  ],
  edges: [
    { kind: "knows", from: "p1", to: "p2" },
    { kind: "knows", from: "p2", to: "t1" },
    { kind: "drives", from: "p1", to: "v1" },
  ],
};
const copy = (): GraphSnapshot => JSON.parse(JSON.stringify(stored));
const codes = (store: Store<typeof schema>) => store.findings().map((f) => `${f.code} ${f.id}${f.detail ? ` ${f.detail}` : ""}`);

describe("a store holds records that no longer fit", () => {
  it("opens over records that no longer fit, reports them, and still refuses a new write that does not fit", () => {
    const store = new Store({ schema, mutations: [], snapshot: copy() as never });
    expect(codes(store)).toEqual([
      "kind-unknown v1",
      "node-shape p1 email",
      "node-shape t1 size",
      "edge-disallowed knows:p2->t1",
    ]);
    expect(() =>
      store.applyPrimitives([{ op: "add-node", node: { id: "p3", kind: "person", label: "Linus", email: "nope" } }]),
    ).toThrow(GraphError);
    expect(() => store.applyPrimitives([{ op: "patch-node", id: "p2", before: {}, after: { role: "treasurer" } }])).toThrow(GraphError);
    expect(() => store.applyPrimitives([{ op: "add-edge", edge: { kind: "knows", from: "p1", to: "v1" } }])).toThrow(GraphError);
    expect(() => store.applyPrimitives([{ op: "add-node", node: { id: "w1", kind: "vehicle", label: "Bus" } }])).toThrow();
    expect(store.log.all()).toHaveLength(0);
  });

  it("opening never changes a stored node's fields", () => {
    const store = new Store({ schema, mutations: [], snapshot: copy() as never });
    expect(store.snapshot()).toEqual(stored);
    // Nor on a fold of the log: an op an older declaration accepted is held as it was written, not refused.
    const add: Operation = {
      id: "op1",
      seq: 0,
      batch: "batch:1",
      author: { kind: "human" },
      intent: "Add Ada",
      mutation: null,
      primitives: [{ op: "add-node", node: { id: "p1", kind: "person", label: "Ada", email: "not-an-address" } }],
      inverse: [{ op: "remove-node", node: { id: "p1", kind: "person", label: "Ada", email: "not-an-address" } }],
      reads: [],
      writes: ["p1"],
      at: "2026-10-02T00:00:00Z",
    };
    const folded = new Store({ schema, mutations: [], log: [add] });
    expect(folded.snapshot().nodes).toEqual([{ id: "p1", kind: "person", label: "Ada", email: "not-an-address" }]);
    expect(folded.findings().map((f) => `${f.code} ${f.id} ${f.detail}`)).toEqual(["node-shape p1 email"]);
    expect(OperationLog.from([add]).fold(schema).getNode("p1")).toEqual({ id: "p1", kind: "person", label: "Ada", email: "not-an-address" });
  });

  it("a new write still fits as it always did: a default is filled in on the way in", () => {
    const store = new Store({ schema, mutations: [], snapshot: copy() as never });
    store.applyPrimitives([{ op: "add-node", node: { id: "p3", kind: "person", label: "Linus" } }]);
    expect(store.graph.getNode("p3")).toEqual({ id: "p3", kind: "person", label: "Linus", role: "member" });
  });

  it("an edit that fits is taken on a record that holds an old misfit, and leaves the rest of the record as stored", () => {
    const store = new Store({ schema, mutations: [], snapshot: copy() as never });
    store.apply({ name: "edit-team", args: { id: "t1", label: "Weekend rota" } });
    expect(store.graph.getNode("t1")).toEqual({ id: "t1", kind: "team", label: "Weekend rota", size: "two" });
    store.applyPrimitives([{ op: "patch-node", id: "p1", before: { label: "Ada" }, after: { label: "Ada Lovelace" } }]);
    expect(store.graph.getNode("p1")).toEqual({ id: "p1", kind: "person", label: "Ada Lovelace", email: "not-an-address", role: "chair" });
    // Nothing the edit did not write is parsed into something else: no default filled, no field stripped.
    store.applyPrimitives([{ op: "patch-node", id: "p2", before: { label: "Grace" }, after: { label: "Grace Hopper" } }]);
    expect(store.graph.getNode("p2")).toEqual({ id: "p2", kind: "person", label: "Grace Hopper", nickname: "Amazing" });
    // But writing the misfit field itself must fit.
    expect(() => store.applyPrimitives([{ op: "patch-node", id: "t1", before: { size: "two" }, after: { size: "three" } }])).toThrow(GraphError);
  });

  it("repairs on a store that checks its writes, and the undo puts the misfits back as they were", () => {
    const store = new Store({ schema, mutations: [], snapshot: copy() as never });
    const before = codes(store);
    const repair = store.applyPrimitives(repairPlan(store.findings()).primitives, { author: { kind: "human", id: "nick" }, intent: "Repair" });
    expect(store.findings()).toEqual([]);
    expect(store.previewUndo(repair.batch).ok).toBe(true);
    store.undo(repair.batch);
    expect(codes(store)).toEqual(before);
    const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
    expect([...store.snapshot().nodes].sort(byId)).toEqual([...stored.nodes].sort(byId));
  });
});
