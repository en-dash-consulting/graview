import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, openRemote } from "../../src/index.js";

/**
 * A RECORD KEEPS THE ID IT WAS MADE WITH, WHEN IT CAN (Roadmap f-1-0-client-ids).
 *
 * Two kinds of id cross the wire. One a caller asked for — an act's `id`
 * argument, an agent's chain naming its records up front — is a demand:
 * made exactly, or refused when taken, never renamed. One this page minted
 * on its own for a press it applied first is a hint (`mintedHint`): the
 * server makes the record under it when it is free, so the rebase keeps
 * it, and mints as ever (`-2`) when somebody took it meanwhile, a later
 * call of the same change following it there. Two people adding the same
 * thing at once both land.
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
const bo: Principal = { kind: "human", id: "bo" };
const seed = { nodes: [{ id: "today", kind: "list", label: "Today" }], edges: [] };

async function served() {
  const store = new Store({ schema, mutations: app.mutations ?? [], snapshot: seed as never });
  const handler = await createStoreHandler({ app, store, seatOf: () => ana });
  const posted: { calls?: { name: string; args: Record<string, unknown>; mintedHint?: string }[] }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" && String(url).endsWith("/graview/ops")) posted.push(JSON.parse(String(init.body)));
    return handler.handle(new Request(url, init));
  }) as typeof fetch;
  const open = (principal: Principal) => openRemote({ app, url: "https://store.example", principal, fetch: fetcher, pollMs: 0 });
  return { store, open, posted };
}

const ids = (store: Store<typeof schema>) => store.graph.nodesOfKind("task").map((node) => node.id).sort();

describe("a record keeps the id it was made with across the wire, when it can", () => {
  it("sends the id this page minted as a hint, and the server makes the record under it, so a press naming it lands on it", async () => {
    const { store, open, posted } = await served();
    const remote = await open(ana);
    const made = remote.store.apply({ name: "add-task", args: { listId: "today", label: "Buy milk" } });
    const id = made.minted?.[0];
    expect(id).toBe("task:buy-milk");
    remote.store.apply({ name: "finish", args: { taskId: id } });
    await remote.settled();
    expect(posted[0]?.calls?.[0]).toMatchObject({ mintedHint: "task:buy-milk", args: { label: "Buy milk" } });
    expect(posted[0]?.calls?.[0]?.args).not.toHaveProperty("id");
    expect(store.graph.getNode("task:buy-milk")).toMatchObject({ done: true });
    // The log keeps the call as asked: the hint is the wire's, not history's.
    expect(store.log.all()[0]!.mutation).toEqual({ name: "add-task", args: { listId: "today", label: "Buy milk" } });
    remote.close();
  });

  it("lands both of two people adding the same thing at once, the second as -2, and both pages agree", async () => {
    const { store, open } = await served();
    const first = await open(ana);
    const second = await open(bo);
    first.store.apply({ name: "add-task", args: { listId: "today", label: "Buy milk" } });
    second.store.apply({ name: "add-task", args: { listId: "today", label: "Buy milk" } });
    await first.settled();
    await second.settled();
    expect(ids(store)).toEqual(["task:buy-milk", "task:buy-milk-2"]);
    await first.pull();
    await second.pull();
    expect(ids(first.store)).toEqual(ids(store));
    expect(ids(second.store)).toEqual(ids(store));
    first.close();
    second.close();
  });

  it("points a later call of the same change at the record the server made when the hint was taken", async () => {
    const { store, open } = await served();
    const remote = await open(bo);
    store.apply({ name: "add-task", args: { listId: "today", label: "Buy milk" } }, { author: ana });
    // This page has not heard of Ana's: it mints task:buy-milk, and finishes it in the same change.
    remote.store.applyAll([
      { name: "add-task", args: { listId: "today", label: "Buy milk" } },
      { name: "finish", args: { taskId: "task:buy-milk" } },
    ]);
    await remote.settled();
    expect(store.graph.getNode("task:buy-milk")).toMatchObject({ done: false });
    expect(store.graph.getNode("task:buy-milk-2")).toMatchObject({ done: true });
    await remote.pull();
    expect(ids(remote.store)).toEqual(ids(store));
    expect(remote.store.graph.getNode("task:buy-milk-2")).toMatchObject({ done: true });
    remote.close();
  });

  it("still refuses an id a caller asked for when somebody holds it, and takes the change back", async () => {
    const { store, open } = await served();
    const remote = await open(bo);
    store.apply({ name: "add-task", args: { listId: "today", label: "Buy milk" } }, { author: ana });
    const refusals: string[] = [];
    remote.onRefusal((sentence) => refusals.push(sentence));
    remote.store.applyAll([
      { name: "add-task", args: { id: "task:buy-milk", listId: "today", label: "Buy milk" } },
      { name: "finish", args: { taskId: "task:buy-milk" } },
    ]);
    await remote.settled();
    expect(refusals.join(" ")).toMatch(/already taken/);
    expect(ids(store)).toEqual(["task:buy-milk"]);
    expect(store.graph.getNode("task:buy-milk")).toMatchObject({ done: false });
    remote.close();
  });
});
