import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, openRemote, type LiveServerMessage } from "../../src/index.js";

/**
 * A PAGE OPENS ON THE SNAPSHOT AND A SHORT TAIL (Roadmap f-heavy-apps-fast).
 *
 * A heavy app's `/graview/state` was 6 MB on a phone, 4.9 MB of it the op
 * log: every op ever made rode into every open, though the page draws the
 * snapshot and reaches the log only for its recent history and its undo.
 * `openTail` cuts what an open carries — the state and a welcome's — to
 * the latest ops, said with the horizon they begin at, while the host
 * keeps the whole log. The page's store opens as on a compacted server
 * (FR-23): its undo stops at the horizon and says so, and a field written
 * before the tail is at the seq before it, which the host takes as seen,
 * so editing it is no conflict.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), note: z.string().optional() }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label } as never);
  },
});
const rename = defineMutation("rename-task", {
  title: "Rename the task",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const annotate = defineMutation("annotate-task", {
  title: "Note the task",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), note: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { note: args.note });
  },
});
const app = defineApp({ name: "chores", schema, mutations: [add, rename, annotate], invariants: [] });
const ada: Principal = { kind: "human", id: "ada" };

/** Ten tasks made, then one renamed and noted: twelve ops, the first ten long ago. */
function livedStore() {
  const store = new Store({ schema, mutations: [add, rename, annotate], snapshot: { nodes: [], edges: [] } as never });
  for (let n = 0; n < 10; n++) store.apply({ name: "add-task", args: { id: `t${n}`, label: `Task ${n}` } });
  store.apply({ name: "rename-task", args: { id: "t9", label: "Task nine" } });
  store.apply({ name: "annotate-task", args: { id: "t9", note: "Soon" } });
  return store;
}

const tick = (ms = 5) => new Promise((done) => setTimeout(done, ms));

describe("a page opened on a short tail (openTail)", () => {
  it("is served the snapshot and the latest ops with the horizon they begin at, while the host keeps the whole log", async () => {
    const store = livedStore();
    const handler = await createStoreHandler({ app, store, seatOf: () => ada, openTail: 3 });
    const state = (await (await handler.handle(new Request("http://x/graview/state"))).json()) as { horizon?: number; log: { seq: number }[]; snapshot: { nodes: unknown[] } };
    expect(state.horizon).toBe(9);
    expect(state.log.map((op) => op.seq)).toEqual([9, 10, 11]);
    expect(state.snapshot.nodes).toHaveLength(10);
    expect(store.log.length).toBe(12);
    expect(store.log.horizon).toBe(0);
    // What follows the tail is asked as ever.
    const since = (await (await handler.handle(new Request("http://x/graview/since?seq=10"))).json()) as { ops: { seq: number }[] };
    expect(since.ops.map((op) => op.seq)).toEqual([11]);
    await handler.close();
  });

  it("welcomes a socket that has nothing on the same tail", async () => {
    const handler = await createStoreHandler({ app, store: livedStore(), seatOf: () => ada, openTail: 3 });
    const heard: LiveServerMessage[] = [];
    const connection = await handler.connect(new Request("https://store.example/graview/live"), { send: (text) => void heard.push(JSON.parse(text) as LiveServerMessage) });
    if (connection instanceof Response) throw new Error("refused");
    connection.receive(JSON.stringify({ t: "hello" }));
    await tick();
    const welcome = heard.find((message) => message.t === "welcome") as { state?: { horizon?: number; log: { seq: number }[] } } | undefined;
    expect(welcome?.state?.horizon).toBe(9);
    expect(welcome?.state?.log.map((op) => op.seq)).toEqual([9, 10, 11]);
    await handler.close();
  });

  it("serves the whole log, as before, to a host that says no tail, and never more than the store holds", async () => {
    const whole = await createStoreHandler({ app, store: livedStore(), seatOf: () => ada });
    const all = (await (await whole.handle(new Request("http://x/graview/state"))).json()) as { horizon?: number; log: unknown[] };
    expect(all.log).toHaveLength(12);
    expect(all.horizon).toBeUndefined();
    await whole.close();
    const long = await createStoreHandler({ app, store: livedStore(), seatOf: () => ada, openTail: 50 });
    const roomy = (await (await long.handle(new Request("http://x/graview/state"))).json()) as { horizon?: number; log: unknown[] };
    expect(roomy.log).toHaveLength(12);
    expect(roomy.horizon).toBeUndefined();
    await long.close();
  });

  it("opens a page's store that edits a field written before the tail with no conflict, and undoes only what is in the tail", async () => {
    const store = livedStore();
    const handler = await createStoreHandler({ app, store, seatOf: () => ada, openTail: 3 });
    const fetcher = (async (url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
    const remote = await openRemote({ app, url: "https://store.example", principal: ada, fetch: fetcher, pollMs: 0 });
    expect(remote.store.log.horizon).toBe(9);
    expect(remote.store.graph.allNodes()).toHaveLength(10);
    // t3's label was written at seq 3, long before the tail: renaming it is no conflict.
    remote.store.apply({ name: "rename-task", args: { id: "t3", label: "Task three" } });
    await remote.settled();
    expect(store.graph.getNode("t3")?.label).toBe("Task three");
    expect(remote.held()).toBeUndefined();
    // A batch behind the horizon is refused in words; one in the tail comes undone.
    const early = store.log.all()[2]!.batch;
    expect(remote.store.canUndo(early).ok).toBe(false);
    remote.store.undo(remote.store.log.all().at(-1)!.batch);
    await remote.settled();
    expect(store.graph.getNode("t3")?.label).toBe("Task 3");
    remote.close();
    await handler.close();
  });

  it("still refuses a write over a field somebody changed since the page read it", async () => {
    const store = livedStore();
    const handler = await createStoreHandler({ app, store, seatOf: () => ada, openTail: 3 });
    const fetcher = (async (url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
    const remote = await openRemote({ app, url: "https://store.example", principal: ada, fetch: fetcher, pollMs: 0 });
    // Somebody renames t3 on the host after the page opened.
    store.apply({ name: "rename-task", args: { id: "t3", label: "Theirs" } });
    const conflicts: unknown[] = [];
    remote.onConflict((conflict) => void conflicts.push(conflict));
    remote.store.apply({ name: "rename-task", args: { id: "t3", label: "Mine" } });
    await remote.settled();
    await tick();
    expect(conflicts).toHaveLength(1);
    expect(store.graph.getNode("t3")?.label).toBe("Theirs");
    remote.close();
    await handler.close();
  });
});
