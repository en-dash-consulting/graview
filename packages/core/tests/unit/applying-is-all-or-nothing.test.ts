import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, Graph, GraphError, ReceiveError, Store, type Operation } from "../../src/index.js";

/**
 * FR-26. A primitive that fails used to leave the ones before it applied, so
 * a host rehearsed every repair and migration on a copy before trusting it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const seed = { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit" }] as never, edges: [] };

describe("applying primitives is all or nothing", () => {
  it("a batch whose third primitive fails leaves the graph byte-identical, and says nothing changed", () => {
    const graph = Graph.from(schema, seed);
    const before = JSON.stringify(graph.snapshot());
    const heard: unknown[] = [];
    graph.subscribe((diff) => heard.push(diff));
    expect(() =>
      graph.applyPrimitives([
        { op: "add-node", node: { id: "t2", kind: "task", label: "Book the van" } },
        { op: "patch-node", id: "t1", before: { label: "Pay the deposit" }, after: { label: "Pay it" } },
        { op: "remove-node", node: { id: "t9", kind: "task", label: "Not there" } },
      ] as never),
    ).toThrow(GraphError);
    expect(JSON.stringify(graph.snapshot())).toBe(before);
    expect(heard).toEqual([]);
  });

  it("Store.receive of a failing op leaves the store unchanged and throws a typed error naming the op", () => {
    const store = new Store({ schema, mutations: [], snapshot: seed });
    const op = (id: string, primitives: unknown[]): Operation =>
      ({ id, seq: 0, batchId: `b-${id}`, intent: id, author: { kind: "human", id: "nick" }, at: "2026-10-02T00:00:00Z", primitives }) as never;
    const before = JSON.stringify(store.graph.snapshot());
    let thrown: unknown;
    try {
      store.receive([
        op("op-good", [{ op: "add-node", node: { id: "t2", kind: "task", label: "Book the van" } }]),
        op("op-bad", [{ op: "patch-node", id: "t9", before: {}, after: { label: "x" } }]),
      ]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ReceiveError);
    expect((thrown as ReceiveError).op.id).toBe("op-bad");
    expect((thrown as Error).message).toContain("op-bad");
    expect(JSON.stringify(store.graph.snapshot())).toBe(before);
    expect(store.log.all()).toHaveLength(0);
  });
});
