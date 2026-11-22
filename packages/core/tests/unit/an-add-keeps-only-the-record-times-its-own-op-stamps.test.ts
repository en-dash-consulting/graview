import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, logSeenBy, Store, touchedOf, type AnySchema, type Operation, type Policy, type Primitive, type Principal } from "../../src/index.js";

/**
 * AN ADD KEEPS ONLY THE RECORD TIMES ITS OWN OP STAMPS (Graview HQ
 * feature:f-received-add-drops-payload-touches). Since 0.2.10 the fold
 * stamps a record an op adds with the op's own time and author, whatever
 * the add's payload said (`makingIn`). The op as kept now says the same:
 * an add's payload carries none of createdAt, createdBy, updatedAt and
 * updatedBy on any door an op enters a store by, so the log, a seat's log
 * and an export say only what this store stamped. An undo's put-back keeps
 * its payload's four, and so does an add of a record its own op removes.
 */

const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }).strict() });
const schema = createSchema([task]);
const ann: Principal = { kind: "human", id: "ann", roles: ["member"] };
const policy: Policy = { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["member"], kinds: ["task"] }] };
const stamped = { createdAt: "2025-01-01T10:00:00.000Z", createdBy: "someone-else", updatedAt: "2025-01-02T10:00:00.000Z", updatedBy: "someone-else" };
const FOUR = /^(created|updated)(At|By)$/;

function opened(nodes: readonly object[] = []): Store<AnySchema> {
  let at = Date.UTC(2026, 10, 20, 12, 0);
  return new Store<AnySchema>({ schema, mutations: [], policy, now: () => new Date((at += 60_000)).toISOString(), snapshot: { nodes, edges: [] } } as never);
}

const handed = (primitives: readonly Primitive[], extra: Partial<Operation> = {}): Operation => ({
  id: "op-from-elsewhere",
  seq: 7,
  batch: "batch-from-elsewhere",
  author: { kind: "human", id: "bo" },
  intent: "Add a task",
  mutation: null,
  primitives,
  reads: [],
  writes: ["t1"],
  at: "2026-11-20T09:00:00.000Z",
  ...extra,
});

const addOf = { op: "add-node", node: { id: "t1", kind: "task", label: "Book the van", ...stamped } } as Primitive;

/** The four any primitive of these ops carries, by name. */
const fourIn = (ops: readonly Operation[]): string[] =>
  ops.flatMap((op) => [...op.primitives, ...(op.inverse ?? [])]).flatMap((primitive) => ("node" in primitive ? Object.keys(primitive.node).filter((key) => FOUR.test(key)) : []));

describe("an op with no undoes keeps its adds without the four their payload said", () => {
  it("received: kept, served to a seat told the four and exported without them, and the record stamped by the op", () => {
    const store = opened();
    const [landed] = store.receive([handed([addOf])]);
    expect(fourIn([landed!])).toEqual([]);
    expect(fourIn(store.log.all())).toEqual([]);
    expect(fourIn(logSeenBy(store, ann))).toEqual([]);
    expect(fourIn(JSON.parse(JSON.stringify(store.log.all())) as Operation[])).toEqual([]);
    expect(touchedOf(store.graph.getNode("t1"))).toEqual({ createdAt: landed!.at, createdBy: "bo", updatedAt: landed!.at, updatedBy: "bo" });
  });

  it("received in a format-1 op: its written-out inverse takes the record back without them too", () => {
    const store = opened();
    const [landed] = store.receive([handed([addOf], { inverse: [{ op: "remove-node", node: (addOf as { node: object }).node } as Primitive] })]);
    expect(fourIn([landed!])).toEqual([]);
  });

  it("a host's primitives applied as a change: kept without them, the record stamped by the op", () => {
    const store = opened();
    const result = store.applyPrimitives([addOf], { author: ann });
    expect(fourIn(result.ops)).toEqual([]);
    expect(fourIn(store.log.all())).toEqual([]);
    expect(touchedOf(store.graph.getNode("t1"))).toEqual({ createdAt: result.ops[0]!.at, createdBy: "ann", updatedAt: result.ops[0]!.at, updatedBy: "ann" });
  });

  it("a host's own ops: kept without them, the record stamped by the op", () => {
    const store = opened();
    const [op] = store.append([{ author: ann, intent: "Add a task", primitives: [addOf] }]);
    expect(fourIn([op!])).toEqual([]);
    expect(touchedOf(store.graph.getNode("t1"))).toMatchObject({ createdAt: op!.at, createdBy: "ann" });
  });

  it("confirmed by a rebase: kept without them, the record stamped by the op", () => {
    const store = opened();
    const { confirmed } = store.rebase({ confirmed: [handed([addOf])], pending: [] });
    expect(fourIn(confirmed)).toEqual([]);
    expect(fourIn(store.log.all())).toEqual([]);
    expect(touchedOf(store.graph.getNode("t1"))).toMatchObject({ createdAt: confirmed[0]!.at, createdBy: "bo" });
  });
});

describe("what makingIn honors is kept as it came", () => {
  it("an undo that puts a record back keeps its payload's four", () => {
    const store = opened();
    const undo = handed([addOf], { id: "op-undo", undoes: "op-earlier" });
    const [landed] = store.receive([undo]);
    expect(Object.keys((landed!.primitives[0] as { node: object }).node).filter((key) => FOUR.test(key)).sort()).toEqual(["createdAt", "createdBy", "updatedAt", "updatedBy"]);
    expect(touchedOf(store.graph.getNode("t1"))).toMatchObject({ createdAt: stamped.createdAt, createdBy: stamped.createdBy });
  });

  it("a remove-then-add of one record in one op keeps what its removal carried", () => {
    const store = opened([{ id: "t1", kind: "task", label: "Book the van", ...stamped }]);
    const other = { createdAt: "2024-06-01T10:00:00.000Z", createdBy: "nobody-here", updatedAt: "2024-06-02T10:00:00.000Z", updatedBy: "nobody-here" };
    const swap = handed([
      { op: "remove-node", node: { id: "t1", kind: "task", label: "Book the van", ...stamped } } as Primitive,
      { op: "add-node", node: { id: "t1", kind: "task", label: "Book the big van", ...other } } as Primitive,
    ]);
    const [landed] = store.receive([swap]);
    expect(touchedOf((landed!.primitives[1] as { node: object }).node)).toEqual({ createdAt: stamped.createdAt, createdBy: stamped.createdBy });
    expect(touchedOf(store.graph.getNode("t1"))).toMatchObject({ createdAt: stamped.createdAt, createdBy: stamped.createdBy });
  });
});
