import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, OperationLog, Store, type Operation } from "../../src/index.js";

/**
 * After a resync — a copy that drifted, or a gap past what `/graview/since`
 * serves — a client takes the server's log and graph wholesale. Graview
 * Cloud's live client did it by emptying the log's private array and
 * pushing the server's ops into it. `adopt` is the public way: swap the
 * graph and the log, apply the pending batches again on top as `rebase`
 * does, and tell subscribers once (FR-53).
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add a task",
  input: z.object({ id: z.string(), label: z.string() }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label } as never);
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), label: z.string() }),
  describe: (args) => `Rename to “${args.label}”`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const finish = defineMutation("finish", {
  title: "Finish",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]) }),
  describe: () => "Finish it",
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const mutations = [add, rename, finish];
const seed = { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] };
const label = (store: Store<typeof schema>, id: string) => (store.graph.getNode(id) as { label?: string } | undefined)?.label;

function serverIds() {
  let n = 0;
  return () => `s${++n}`;
}
function clientIds() {
  let n = 0;
  return () => `local-${++n}`;
}
/** A server and a client opened from the same history, as `openRemote` opens one. */
function pair() {
  const server = new Store({ schema, mutations, snapshot: seed, ids: serverIds() });
  const client = new Store({ schema, mutations, snapshot: server.snapshot(), log: server.log.all(), ids: clientIds() });
  return { server, client };
}

describe("a store adopts the server's whole state", () => {
  it("swaps the graph and the log, re-applies the pending batches on top, and tells subscribers once", () => {
    const { server, client } = pair();
    // This copy drifted: an op the server never had sits in its confirmed prefix.
    client.append([{ intent: "Drifted", author: { kind: "system", id: "drift" }, mutation: null, primitives: [{ op: "add-node", node: { id: "ghost", kind: "task", label: "Ghost", done: false } as never }], inverse: [{ op: "remove-node", node: { id: "ghost", kind: "task", label: "Ghost", done: false } as never }] }]);
    // Two presses here, neither answered; one the server has already refused.
    const mine = client.apply({ name: "rename", args: { id: "t1", label: "Pay it" } });
    const refused = client.apply({ name: "add", args: { id: "t9", label: "Refused" } });
    // Meanwhile the server moved on.
    server.apply({ name: "add", args: { id: "t2", label: "Book the van" } });
    server.apply({ name: "finish", args: { id: "t1" } });

    const heard: { added: number; ops: readonly Operation[] }[] = [];
    client.subscribe((diff, ops) => heard.push({ added: diff.addedNodes.length, ops }));

    const result = client.adopt({ snapshot: server.snapshot(), log: server.log.all(), epochs: server.log.epochs(), pending: [mine.batch], drop: [refused.batch] });

    // The server's log, then the pending batch on top under its own id.
    expect(client.log.all().map((op) => op.id).slice(0, 2)).toEqual(server.log.all().map((op) => op.id));
    expect(client.log.all().map((op) => op.batch)).toEqual([...server.log.all().map((op) => op.batch), mine.batch]);
    expect(client.log.all().map((op) => op.seq)).toEqual([0, 1, 2]);
    expect(client.graph.getNode("ghost")).toBeUndefined();
    expect(client.graph.getNode("t9")).toBeUndefined();
    expect(client.graph.getNode("t2")).toBeDefined();
    expect((client.graph.getNode("t1") as { done: boolean }).done).toBe(true);
    expect(label(client, "t1")).toBe("Pay it");

    expect(result.adopted.map((op) => op.id)).toEqual(server.log.all().map((op) => op.id));
    expect(result.pending.map((op) => op.batch)).toEqual([mine.batch]);
    expect(result.refused).toEqual([]);

    // One change, the net diff, with the ops this store did not have and the re-applied ones.
    expect(heard).toHaveLength(1);
    expect(heard[0]!.ops.map((op) => op.batch)).toEqual([...server.log.all().map((op) => op.batch), mine.batch]);

    // Once the server answers, the copy is the server's exactly.
    const answered = server.applyAll([{ name: "rename", args: { id: "t1", label: "Pay it" } }]);
    client.rebase({ confirmed: answered.ops, pending: [], drop: [mine.batch] });
    expect(client.snapshot()).toEqual(server.snapshot());
    expect(client.log.all().map((op) => op.id)).toEqual(server.log.all().map((op) => op.id));
    expect(client.verify()).toMatchObject({ ok: true });
  });

  it("takes the graph in the server's order, not the order this copy held it in", () => {
    const { server, client } = pair();
    server.apply({ name: "add", args: { id: "t2", label: "Second" } });
    server.apply({ name: "add", args: { id: "t3", label: "Third" } });
    const reordered = { nodes: [...server.snapshot().nodes].reverse(), edges: [] };
    client.adopt({ snapshot: reordered as never, log: server.log.all() });
    expect(client.snapshot().nodes.map((node) => node.id)).toEqual(["t3", "t2", "t1"]);
  });

  it("adopts a log compacted behind an undo horizon (FR-23), and keeps counting from it", () => {
    const server = new Store({ schema, mutations, snapshot: seed, ids: serverIds() });
    for (let i = 2; i <= 9; i++) server.apply({ name: "add", args: { id: `t${i}`, label: `Task ${i}` } });
    server.compact(server.checkpoint({ seq: 5 })!);
    expect(server.log.horizon).toBe(5);

    const client = new Store({ schema, mutations, snapshot: seed, ids: clientIds() });
    const mine = client.apply({ name: "rename", args: { id: "t1", label: "Mine" } });

    // Handed the tail and the horizon, as `/graview/state` hands them.
    client.adopt({ snapshot: server.snapshot(), log: server.log.all(), horizon: server.log.horizon, pending: [mine.batch] });
    expect(client.log.horizon).toBe(5);
    expect(client.log.all().map((op) => op.seq)).toEqual([5, 6, 7, 8]);
    expect(client.log.length).toBe(9);
    expect(label(client, "t1")).toBe("Mine");
    expect(client.graph.getNode("t9")).toBeDefined();

    // Handed the checkpoint as an epoch instead, it folds and verifies.
    const other = new Store({ schema, mutations, snapshot: seed, ids: clientIds() });
    other.adopt({ snapshot: server.snapshot(), log: server.log.all(), epochs: server.log.epochs() });
    expect(other.log.horizon).toBe(5);
    expect(other.verify()).toMatchObject({ ok: true });
    expect(other.snapshot()).toEqual(server.snapshot());
  });

  it("refuses a log that is not intact, and is the store it was", () => {
    const { server, client } = pair();
    server.apply({ name: "add", args: { id: "t2", label: "Second" } });
    const mine = client.apply({ name: "rename", args: { id: "t1", label: "Mine" } });
    const before = { snapshot: client.snapshot(), log: client.log.all().map((op) => op.id) };
    const gapped = server.log.all().map((op) => ({ ...op, seq: op.seq + 3 }));
    expect(() => client.adopt({ snapshot: server.snapshot(), log: gapped, pending: [mine.batch] })).toThrow(/seq/);
    expect(client.snapshot()).toEqual(before.snapshot);
    expect(client.log.all().map((op) => op.id)).toEqual(before.log);
  });

  it("says a pending batch that no longer applies on the server's graph in refused, and leaves it off", () => {
    const { client } = pair();
    const mine = client.apply({ name: "rename", args: { id: "t1", label: "Mine" } });
    // The server's state has no t1 at all.
    const empty = new Store({ schema, mutations, ids: serverIds() });
    const result = client.adopt({ snapshot: empty.snapshot(), log: empty.log.all(), pending: [mine.batch] });
    expect(result.refused.map((entry) => entry.batch)).toEqual([mine.batch]);
    expect(client.log.all()).toEqual([]);
    expect(client.graph.getNode("t1")).toBeUndefined();
  });

  it("is the public way to replace an op log", () => {
    const log = OperationLog.from([]);
    const store = new Store({ schema, mutations, snapshot: seed, ids: serverIds() });
    store.apply({ name: "add", args: { id: "t2", label: "Second" } });
    log.replace(store.log.all(), store.log.epochs());
    expect(log.all().map((op) => op.id)).toEqual(store.log.all().map((op) => op.id));
    expect(() => log.replace([{ ...store.log.all()[0]!, seq: 3 }])).toThrow(/horizon/);
    expect(log.all().map((op) => op.id)).toEqual(store.log.all().map((op) => op.id));
  });
});
