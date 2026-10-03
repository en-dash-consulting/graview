import { createMemoryAdapter, createSchema, defineApp, defineMutation, defineNode, nodeRef, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { openRemote, serveStore, type RemoteStore, type ServedStore } from "../../src/index.js";

/**
 * A CLIENT THAT CANNOT CATCH UP TAKES THE SERVER'S STATE (FR-53).
 *
 * `openRemote` lands the server's ops under its pending ones by
 * `store.rebase`, which numbers each op it lands at the end of the log it
 * holds. When the server compacted past where the client left off,
 * `/graview/since` begins at the horizon, and the ops between never come:
 * the client numbered the server's ops out of the server's order and went
 * on with a graph that was not the server's. A copy that drifted refused
 * the server's next op and stopped. Either way it now fetches the state and
 * adopts it, with its unanswered calls applied again on top.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string().min(1), done: z.boolean() }),
  plural: "Tasks",
  label: (node) => node.label,
});
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  describe: (args) => `Rename to “${args.label}”`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label, done: false });
  },
});
const schema = createSchema([task]);
const app = defineApp({
  name: "behind",
  schema,
  mutations: [rename, add],
  policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*", describe: "The keeper keeps everything." }] },
  version: 1,
});
const seed = {
  nodes: [
    { id: "t1", kind: "task", label: "Book the hall", done: false },
    { id: "t2", kind: "task", label: "Pay the deposit", done: false },
  ],
  edges: [],
};
const sam: Principal = { kind: "human", id: "sam", name: "Sam", roles: ["keeper"] };
const ana: Principal = { kind: "human", id: "ana", name: "Ana", roles: ["keeper"] };
const label = (remote: RemoteStore<typeof schema>, id: string) => (remote.store.graph.getNode(id) as { label?: string } | undefined)?.label;
const ids = (ops: readonly { id: string }[]) => ops.map((op) => op.id);
const until = async (holds: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!holds()) {
    if (Date.now() - start > ms) throw new Error("It never came true.");
    await new Promise((tick) => setTimeout(tick, 5));
  }
};

let served: ServedStore<typeof schema> | undefined;
const opened: RemoteStore<typeof schema>[] = [];
afterEach(async () => {
  for (const remote of opened.splice(0)) remote.close();
  await served?.close();
  served = undefined;
});

describe("a client that falls behind adopts the server's state", () => {
  it("adopts a server that compacted behind what it has seen, and its pending call lands once", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    // The client's call to the server is held, so it is still pending when the client falls behind.
    let release!: () => void;
    const gate = new Promise<void>((done) => (release = done));
    const held: typeof fetch = async (input, init) => {
      if (String(input).endsWith("/graview/ops")) await gate;
      return fetch(input, init);
    };
    const client = await openRemote({ app, url: served.url, principal: sam, live: false, pollMs: 0, fetch: held });
    opened.push(client as never);
    client.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });

    // Meanwhile the server moved on, and compacted past where the client left off.
    for (let n = 3; n <= 8; n++) served.store.apply({ name: "add", args: { id: `t${n}`, label: `Task ${n}` } }, { author: ana });
    served.store.compact(served.store.checkpoint({ seq: 4 })!);
    expect(served.store.log.horizon).toBe(4);

    await client.pull();
    expect(client.store.graph.getNode("t8")).toBeDefined();
    expect(label(client, "t1")).toBe("Book the big hall");
    expect(client.store.log.horizon).toBe(4);
    expect(client.store.log.all().map((op) => op.seq)).toEqual([4, 5, 6]);

    release();
    await client.settled();
    expect(client.store.snapshot()).toEqual(served.store.snapshot());
    expect(ids(client.store.log.all())).toEqual(ids(served.store.log.all()));
    expect(served.store.log.all().filter((op) => op.intent === "Rename to “Book the big hall”")).toHaveLength(1);
    expect(client.seq()).toBe(served.store.log.length - 1);
    // Counted, for a host's beacon (FR-49).
    expect(client.counters().resyncs).toBe(1);
  });

  it("recovers a copy that drifted by adopting the server's state, and carries on live", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const client = await openRemote({ app, url: served.url, principal: sam, live: true, pollMs: 0 });
    opened.push(client as never);
    expect(client.transport()).toBe("socket");

    // This copy drifted: t2 is gone here, and nothing in its log says so.
    client.store.graph.load({ nodes: client.store.snapshot().nodes.filter((node) => node.id !== "t2"), edges: [] });

    // The server's next op touches t2, which this copy cannot apply.
    served.store.apply({ name: "rename", args: { id: "t2", label: "Pay it on Friday" } }, { author: ana });
    await until(() => label(client, "t2") === "Pay it on Friday");
    await client.settled();
    expect(client.store.snapshot()).toEqual(served.store.snapshot());
    expect(ids(client.store.log.all())).toEqual(ids(served.store.log.all()));

    // And still live: the next op arrives down the socket, and the client's own goes up it.
    served.store.apply({ name: "add", args: { id: "t3", label: "Hire chairs" } }, { author: ana });
    await until(() => client.store.graph.getNode("t3") !== undefined);
    client.store.apply({ name: "rename", args: { id: "t3", label: "Hire forty chairs" } });
    await client.settled();
    await until(() => (served!.store.graph.getNode("t3") as { label: string }).label === "Hire forty chairs");
    expect(client.transport()).toBe("socket");
    expect(client.store.snapshot()).toEqual(served.store.snapshot());
    expect(ids(client.store.log.all())).toEqual(ids(served.store.log.all()));
  });
});
