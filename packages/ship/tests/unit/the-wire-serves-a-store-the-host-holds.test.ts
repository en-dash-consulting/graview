import { createMemoryAdapter, createSchema, defineApp, defineMutation, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, LIVE_PATH, openStore, WIRE, type LiveServerMessage } from "../../src/runtime.js";

/**
 * THE WIRE OVER A STORE THE HOST ALREADY HOLDS (FR-42).
 *
 * `createStoreHandler` opened its own store from a `PersistenceAdapter`,
 * so a host with its own durability — snapshots in parts, epochs,
 * quarantine and restore, its own meter — had to give all of that up to
 * get ship's wire, or keep a second copy of the protocol. A host now hands
 * the handler the `Store` it opened, migrates and heals itself, and the
 * same routes and the same socket answer from it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }) });
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const schema = createSchema([task]);
const app = defineApp({
  name: "held",
  schema,
  mutations: [finish],
  policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: ["finish"] }] },
  version: 3,
});
const keeper: Principal = { kind: "human", id: "u1", roles: ["keeper"] };
const at = (path: string, init: RequestInit = {}) => new Request(`https://store.example${path}`, init);

/** The host's own store: made by the host, holding what the host loaded. Nothing of ship's opened it. */
function hostsOwnStore() {
  return new Store({
    schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: {
      nodes: [
        { id: "t1", kind: "task", label: "Book the hall", done: false },
        { id: "t2", kind: "task", label: "Pay", done: false },
      ],
      edges: [],
    } as never,
  });
}

describe("the wire over a store the host holds", () => {
  it("answers every WIRE route from the host's own Store instance, with no adapter", async () => {
    const store = hostsOwnStore();
    let flushed = 0;
    const handler = await createStoreHandler({ app, store, seatOf: () => keeper, flush: async () => void flushed++, where: "the host's ledger" });
    expect(handler.store).toBe(store);
    for (const route of WIRE) {
      const response = await handler.handle(
        at(`${route.path}${route.path.endsWith("since") ? "?seq=-1" : ""}`, {
          method: route.method,
          ...(route.method === "POST" ? { body: JSON.stringify(route.path.endsWith("here") ? { presence: { participant: "human:u1:s", stop: "/" } } : {}) } : {}),
        }),
      );
      expect(response.status, `${route.method} ${route.path}`).toBe(route.path === LIVE_PATH ? 426 : 200);
    }
    const posted = await handler.handle(at("/graview/ops", { method: "POST", body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }] }) }));
    expect(posted.status).toBe(200);
    expect(store.graph.getNode("t1")).toMatchObject({ done: true });
    expect(flushed).toBeGreaterThan(0);
    const state = (await (await handler.handle(at("/graview/state"))).json()) as { version: number; log: unknown[]; snapshot: { nodes: unknown[] } };
    expect(state.version).toBe(3);
    expect(state.log).toHaveLength(1);
    expect(state.snapshot.nodes).toHaveLength(2);
    const health = (await (await handler.handle(at("/graview/health"))).json()) as { where: string };
    expect(health.where).toBe("the host's ledger");
    // The store is the host's: closing the handler does not close it.
    await handler.close();
    store.apply({ name: "finish", args: { id: "t1" } }, { author: keeper });
  });

  it("serves the live wire from the host's store, and pushes what the host itself applies", async () => {
    const store = hostsOwnStore();
    const handler = await createStoreHandler({ app, store, seatOf: () => keeper });
    const heard: LiveServerMessage[] = [];
    const connection = await handler.connect(at(LIVE_PATH), { send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) });
    if (connection instanceof Response) throw new Error(`refused: ${connection.status}`);
    connection.receive(JSON.stringify({ t: "hello", seq: -1 }));
    connection.receive(JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "finish", args: { id: "t1" } }] }));
    const until = async (holds: () => boolean) => {
      for (let tries = 0; !holds(); tries++) {
        if (tries > 200) throw new Error("It never came true.");
        await new Promise((tick) => setTimeout(tick, 1));
      }
    };
    await until(() => heard.some((message) => message.t === "ack"));
    expect(heard.map((message) => message.t)).toEqual(["welcome", "ack"]);
    expect(store.log.length).toBe(1);
    // An op the host lands on its own store goes down the socket.
    store.apply({ name: "finish", args: { id: "t2" } }, { author: keeper });
    await until(() => heard.some((message) => message.t === "ops"));
    expect((heard.at(-1) as Extract<LiveServerMessage, { t: "ops" }>).seq).toBe(1);
    connection.close();
    await handler.close();
  });

  it("keeps the adapter form working as a thin layer over the held one", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: { nodes: [{ id: "t1", kind: "task", label: "Book", done: false }], edges: [] } as never, seatOf: () => keeper });
    expect(handler.opened.store).toBe(handler.store);
    const posted = await handler.handle(at("/graview/ops", { method: "POST", body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }] }) }));
    expect(posted.status).toBe(200);
    await handler.close();
  });

  it("serves a store the host opened with openStore and keeps migrating itself", async () => {
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: { nodes: [{ id: "t1", kind: "task", label: "Book", done: false }], edges: [] } as never });
    const handler = await createStoreHandler({ app, store: opened.store, flush: opened.flush, migrated: ["Moved every task"], seatOf: () => keeper });
    const state = (await (await handler.handle(at("/graview/state"))).json()) as { migrated: string[] };
    expect(state.migrated).toEqual(["Moved every task"]);
    await handler.close();
    opened.close();
  });
});
