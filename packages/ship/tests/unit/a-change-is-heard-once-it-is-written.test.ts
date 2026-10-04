import { createSchema, defineApp, defineMutation, defineNode, Store, type Operation, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, type LivePeer, type LiveServerMessage } from "../../src/runtime.js";

/**
 * A CHANGE OTHERS HEAR IS A CHANGE THAT IS WRITTEN.
 *
 * The author's ack waited for the host's flush, but every other socket was
 * pushed the op the moment it landed in memory — so a flush that then
 * failed left other people looking at a change that was never written.
 * Now an op is pushed to anybody only once its flush has resolved; a flush
 * that fails was heard by nobody, the author is refused `unavailable`, and
 * the change sent again is heard once. A host with no flush pushes at once.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }) });
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string() }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const schema = createSchema([task]);
const app = defineApp({ name: "durable", schema, mutations: [add], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const ada: Principal = { kind: "human", id: "ada", roles: ["keeper"] };
const bo: Principal = { kind: "human", id: "bo", roles: ["keeper"] };
const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } as never });

/** A flush the test lets go of, or fails. */
function aGate() {
  let release: () => void = () => {};
  let refuse: (error: Error) => void = () => {};
  let gate = new Promise<void>((resolve, reject) => {
    release = resolve;
    refuse = reject;
  });
  return {
    flush: () => gate,
    release: () => release(),
    fail: () => refuse(new Error("disk full")),
    reset() {
      gate = new Promise<void>((resolve, reject) => {
        release = resolve;
        refuse = reject;
      });
    },
  };
}
const tick = () => new Promise((done) => setTimeout(done, 5));
const call = (cid: string, batch: string, id: string) => JSON.stringify({ t: "call", cid, batch, calls: [{ name: "add", args: { id, label: id } }] });
const opsOf = (heard: readonly LiveServerMessage[]): Operation[] => heard.flatMap((message) => (message.t === "ops" ? message.ops : []));

describe("a change is heard once it is written", () => {
  it("pushes nothing to another socket while the flush is under way, and once it resolves", async () => {
    const gate = aGate();
    const store = hostsStore();
    const live = liveProtocol({ store, flush: gate.flush });
    const heard: LiveServerMessage[] = [];
    const a: LivePeer = { ...live.open(ada, "web"), send: () => {} };
    const b: LivePeer = { ...live.open(bo, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await live.receive(a, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(b, JSON.stringify({ t: "hello", seq: -1 }));
    const receiving = live.receive(a, call("a1", "batch:adatab:1", "one"));
    await tick();
    expect(store.log.length).toBe(1);
    live.publish(store.log.all(), [b]);
    expect(opsOf(heard)).toEqual([]);
    gate.release();
    const received = await receiving;
    live.publish(received.landed!, [b]);
    expect(opsOf(heard).map((op) => op.batch)).toEqual(["batch:adatab:1"]);
  });

  it("welcomes a socket that says hello mid-flush with what is written, and the rest once it is", async () => {
    const gate = aGate();
    const store = hostsStore();
    const live = liveProtocol({ store, flush: gate.flush });
    const a: LivePeer = { ...live.open(ada, "web"), send: () => {} };
    await live.receive(a, JSON.stringify({ t: "hello", seq: -1 }));
    const receiving = live.receive(a, call("a1", "batch:adatab:1", "one"));
    await tick();
    const heard: LiveServerMessage[] = [];
    const late: LivePeer = { ...live.open(bo, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await live.receive(late, JSON.stringify({ t: "hello", seq: -1 }));
    expect(heard[0]).toMatchObject({ t: "welcome", seq: -1, ops: [] });
    gate.release();
    live.publish((await receiving).landed!, [late]);
    expect(opsOf(heard).map((op) => op.batch)).toEqual(["batch:adatab:1"]);
  });

  it("pushes a change whose flush failed to nobody, and the change sent again once", async () => {
    const gate = aGate();
    const store = hostsStore();
    const live = liveProtocol({ store, flush: gate.flush });
    const told: LiveServerMessage[] = [];
    const heard: LiveServerMessage[] = [];
    const a: LivePeer = { ...live.open(ada, "web"), send: (text) => told.push(JSON.parse(text) as LiveServerMessage) };
    const b: LivePeer = { ...live.open(bo, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await live.receive(a, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(b, JSON.stringify({ t: "hello", seq: -1 }));
    const receiving = live.receive(a, call("a1", "batch:adatab:1", "one"));
    await tick();
    live.publish(store.log.all(), [b]);
    gate.fail();
    await receiving;
    live.publish(store.log.all(), [b]);
    expect(opsOf(heard)).toEqual([]);
    expect(told.at(-1)).toMatchObject({ t: "refused", cid: "a1", reason: "unavailable" });
    gate.reset();
    gate.release();
    const again = await live.receive(a, call("a1", "batch:adatab:1", "one"));
    live.publish(again.landed!, [b]);
    live.publish(store.log.all(), [b]);
    expect(opsOf(heard).map((op) => op.batch)).toEqual(["batch:adatab:1"]);
  });

  it("holds a handler's other sockets back until the flush resolves, and pushes at once with no flush", async () => {
    const gate = aGate();
    for (const flushing of [true, false]) {
      const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: (request) => (request.headers.get("x-who") === "bo" ? bo : ada), ...(flushing ? { flush: gate.flush } : {}) });
      const heard: string[] = [];
      const a = await handler.connect(new Request("https://store.example/graview/live", { headers: { "x-who": "ada" } }), { send: () => {} });
      const b = await handler.connect(new Request("https://store.example/graview/live", { headers: { "x-who": "bo" } }), { send: (text) => void heard.push(text) });
      if (a instanceof Response || b instanceof Response) throw new Error("refused");
      a.receive(JSON.stringify({ t: "hello", seq: -1 }));
      b.receive(JSON.stringify({ t: "hello", seq: -1 }));
      await tick();
      a.receive(call("a1", "batch:adatab:1", "one"));
      await tick();
      const pushed = () => heard.map((text) => JSON.parse(text) as LiveServerMessage).filter((message) => message.t === "ops").length;
      expect(pushed()).toBe(flushing ? 0 : 1);
      if (flushing) {
        gate.release();
        await tick();
        expect(pushed()).toBe(1);
      }
      await handler.close();
    }
  });
});
