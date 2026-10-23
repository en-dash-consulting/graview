import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, openRemote } from "../../src/index.js";

/**
 * A RECORD KEEPS THE ID IT WAS MADE WITH (Roadmap f-1-0-client-ids).
 *
 * A press applies here first and goes to the server after. The call that
 * made a record goes with the id it was made with, so the server makes it
 * under that id and the rebase keeps it — a press after it that names the
 * record, sent before the server answered, names the one the server holds.
 * An id somebody took meanwhile is refused and the change taken back; the
 * record is never renamed under the person.
 */
const list = defineNode("list", { fields: z.object({ label: z.string().min(1) }), edges: { holds: { to: ["task"] } } });
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }) });
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);
const addTask = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ listId: nodeRef(["list"]), label: z.string().min(1) }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "task");
    ctx.addNode({ id, kind: "task", label: args.label, done: false });
    ctx.addEdge({ kind: "holds", from: args.listId, to: id });
  },
});
const finish = defineMutation("finish", {
  title: "Finish",
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { done: true });
  },
});
const app = defineApp({ name: "ids", schema, mutations: [addTask, finish], version: 1 });
const ana: Principal = { kind: "human", id: "ana" };
const seed = { nodes: [{ id: "today", kind: "list", label: "Today" }], edges: [] };

async function served() {
  const store = new Store({ schema, mutations: app.mutations ?? [], snapshot: seed as never });
  const handler = await createStoreHandler({ app, store, seatOf: () => ana });
  const posted: { calls?: { name: string; args: Record<string, unknown> }[] }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" && String(url).endsWith("/graview/ops")) posted.push(JSON.parse(String(init.body)));
    return handler.handle(new Request(url, init));
  }) as typeof fetch;
  const remote = await openRemote({ app, url: "https://store.example", principal: ana, fetch: fetcher, pollMs: 0 });
  return { store, remote, posted };
}

describe("a record keeps the id it was made with across the wire", () => {
  it("is sent with the id it was made with here, and a press naming it before the answer lands on it", async () => {
    const { store, remote, posted } = await served();
    const made = remote.store.apply({ name: "add-task", args: { listId: "today", label: "Buy milk" } });
    const id = made.minted?.[0];
    expect(id).toBe("task:buy-milk");
    remote.store.apply({ name: "finish", args: { taskId: id } });
    await remote.settled();
    expect(posted[0]?.calls?.[0]?.args).toMatchObject({ id: "task:buy-milk", label: "Buy milk" });
    expect(store.graph.getNode("task:buy-milk")).toMatchObject({ done: true });
    expect(remote.store.graph.getNode("task:buy-milk")).toMatchObject({ done: true });
    expect(remote.store.graph.allNodes().map((node) => node.id).sort()).toEqual(store.graph.allNodes().map((node) => node.id).sort());
    remote.close();
  });

  it("is refused, and taken back, when somebody took the id meanwhile — never renamed", async () => {
    const { store, remote } = await served();
    // Somebody else's record, landed on the server after this page loaded and before it heard of it.
    store.apply({ name: "add-task", args: { listId: "today", label: "Buy milk" } }, { author: { kind: "human", id: "bo" } });
    const refusals: string[] = [];
    remote.onRefusal((sentence) => refusals.push(sentence));
    remote.store.apply({ name: "add-task", args: { listId: "today", label: "Buy milk" } });
    await remote.settled();
    expect(refusals.join(" ")).toMatch(/already taken/);
    expect(store.graph.nodesOfKind("task").map((node) => node.id)).toEqual(["task:buy-milk"]);
    expect(remote.store.graph.getNode("task:buy-milk-2")).toBeUndefined();
    remote.close();
  });
});
