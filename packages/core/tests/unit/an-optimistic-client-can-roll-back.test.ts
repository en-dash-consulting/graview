import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, GraphError, nodeRef, Store, type Operation } from "../../src/index.js";

/**
 * An optimistic client applies a press at once and sends it; the server's op
 * is the one that stays. Graview Cloud's live client did this by cutting the
 * log's private array and silencing the store's private notify. `rebase` is
 * the public way: roll the pending tail back, land the server's ops, apply
 * the pending calls again on top, and tell subscribers once.
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
    ctx.graph.getNode(args.id);
    ctx.patchNode(args.id, { done: true });
  },
});
const mutations = [add, rename, finish];
const seed = { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] };
const label = (store: Store<typeof schema>, id: string) => (store.graph.getNode(id) as { label?: string } | undefined)?.label;

/** A server and a client opened from the same history, as `openRemote` opens one. */
function pair() {
  const server = new Store({ schema, mutations, snapshot: seed, ids: serverIds() });
  const client = new Store({ schema, mutations, snapshot: server.snapshot(), log: server.log.all() });
  return { server, client };
}
function serverIds() {
  let n = 0;
  return () => `s${++n}`;
}

describe("an optimistic client can roll back", () => {
  it("rolls back pending ops, lands the server's and re-applies the pending calls, through public API only", () => {
    const { server, client } = pair();
    // Two presses here, neither answered yet.
    const mine = client.apply({ name: "rename", args: { id: "t1", label: "Pay it" } });
    const second = client.apply({ name: "add", args: { id: "t2", label: "Book the van" } });
    // Meanwhile somebody else finished the task, on the server.
    const theirs = server.apply({ name: "finish", args: { id: "t1" } });

    const result = client.rebase({ confirmed: theirs.ops, pending: [mine.batch, second.batch] });

    // The server's op is under the pending tail; the pending calls are on top, under the same batches.
    expect(client.log.all().map((op) => op.id).slice(0, 1)).toEqual([theirs.ops[0]!.id]);
    expect(client.log.all().map((op) => op.batch)).toEqual([theirs.batch, mine.batch, second.batch]);
    expect(client.log.all().map((op) => op.seq)).toEqual([0, 1, 2]);
    expect(result.confirmed.map((op) => op.id)).toEqual([theirs.ops[0]!.id]);
    expect(result.pending.map((op) => op.batch)).toEqual([mine.batch, second.batch]);
    expect(result.refused).toEqual([]);
    expect(label(client, "t1")).toBe("Pay it");
    expect((client.graph.getNode("t1") as { done: boolean }).done).toBe(true);
    expect(client.graph.getNode("t2")).toBeDefined();

    // The server answers the first press: its op lands, ours is dropped, the second stays pending.
    const answered = server.applyAll([{ name: "rename", args: { id: "t1", label: "Pay it" } }]);
    client.rebase({ confirmed: answered.ops, pending: [second.batch], drop: [mine.batch] });
    expect(client.log.all().map((op) => op.batch)).toEqual([theirs.batch, answered.batch, second.batch]);
    expect(label(client, "t1")).toBe("Pay it");

    // A refusal drops the press and nothing lands: the graph is the server's again.
    client.rebase({ confirmed: [], pending: [], drop: [second.batch] });
    expect(client.graph.getNode("t2")).toBeUndefined();
    expect(client.snapshot()).toEqual(server.snapshot());
    expect(client.log.all().map((op) => op.id)).toEqual(server.log.all().map((op) => op.id));
  });

  it("subscribers hear one diff per rebase, the net of it", () => {
    const { server, client } = pair();
    const mine = client.apply({ name: "rename", args: { id: "t1", label: "Pay it" } });
    const other = server.apply({ name: "add", args: { id: "t3", label: "Ring the landlord" } });
    const heard: Array<{ diff: { addedNodes: readonly { id: string }[]; changedNodes: readonly unknown[] }; ops: readonly Operation[] }> = [];
    client.subscribe((diff, ops) => heard.push({ diff, ops }));

    client.rebase({ confirmed: other.ops, pending: [mine.batch] });

    expect(heard).toHaveLength(1);
    // The rename was rolled back and applied again: net, only the new task changed.
    expect(heard[0]!.diff.addedNodes.map((node) => node.id)).toEqual(["t3"]);
    expect(heard[0]!.diff.changedNodes).toEqual([]);
    expect(heard[0]!.ops.map((op) => op.batch)).toEqual([other.batch, mine.batch]);

    // A drop alone, with nothing landed, is still heard once.
    client.rebase({ confirmed: [], pending: [], drop: [mine.batch] });
    expect(heard).toHaveLength(2);
    expect(heard[1]!.diff.changedNodes).toHaveLength(1);
  });

  it("a pending call that no longer applies on top is said, not thrown, and the rest still land", () => {
    const { server, client } = pair();
    const mine = client.apply({ name: "add", args: { id: "t2", label: "Book the van" } });
    // The server already has a t2.
    const theirs = server.apply({ name: "add", args: { id: "t2", label: "Someone else's van" } });
    const result = client.rebase({ confirmed: theirs.ops, pending: [mine.batch] });
    expect(result.refused.map((r) => r.batch)).toEqual([mine.batch]);
    expect(label(client, "t2")).toBe("Someone else's van");
    expect(client.log.all().map((op) => op.batch)).toEqual([theirs.batch]);
  });

  it("refuses a rebase that would roll back an op nobody named, and changes nothing", () => {
    const { client } = pair();
    const first = client.apply({ name: "rename", args: { id: "t1", label: "Pay it" } });
    client.apply({ name: "rename", args: { id: "t1", label: "Pay it now" } });
    const before = JSON.stringify(client.snapshot());
    expect(() => client.rebase({ confirmed: [], pending: [first.batch] })).toThrow(GraphError);
    expect(JSON.stringify(client.snapshot())).toBe(before);
    expect(client.log.length).toBe(2);
  });

  it("two stores opened from the same log never mint the same batch id", () => {
    const { server } = pair();
    server.apply({ name: "rename", args: { id: "t1", label: "Pay it" } });
    const one = new Store({ schema, mutations, snapshot: server.snapshot(), log: server.log.all() });
    const two = new Store({ schema, mutations, snapshot: server.snapshot(), log: server.log.all() });
    const minted = (store: Store<typeof schema>) => [
      store.apply({ name: "finish", args: { id: "t1" } }).batch,
      store.applyAll([{ name: "rename", args: { id: "t1", label: "Again" } }]).batch,
      store.undo(store.batches().at(-1)!.id).batch,
      store.applyPrimitives([{ op: "add-node", node: { id: "x", kind: "task", label: "x" } }] as never).batch,
      store.append([{ author: { kind: "system" }, intent: "y", primitives: [{ op: "add-node", node: { id: "y", kind: "task", label: "y" } }] }])[0]!.batch,
    ];
    const ours = minted(one);
    const theirs = minted(two);
    expect(new Set(ours).size).toBe(ours.length);
    expect(ours.filter((id) => theirs.includes(id))).toEqual([]);
    // Nor any the log they opened from already held.
    const held = server.log.all().map((op) => op.batch);
    expect(ours.filter((id) => held.includes(id))).toEqual([]);
  });

  it("a host can tell subscribers of a change it made itself", () => {
    const { client } = pair();
    const heard: number[] = [];
    client.subscribe((_diff, ops) => heard.push(ops.length));
    client.notify(client.graph.applyPrimitives([{ op: "add-node", node: { id: "z", kind: "task", label: "z" } }] as never), []);
    // Nothing changed and nothing done is nothing to tell.
    client.notify({ addedNodes: [], removedNodes: [], changedNodes: [], addedEdges: [], removedEdges: [] }, []);
    expect(heard).toEqual([0]);
  });
});
