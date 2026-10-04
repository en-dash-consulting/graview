import { createSchema, defineApp, defineMutation, defineNode, Store, type Operation, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, openRemote, type LivePeer, type LiveServerMessage } from "../../src/index.js";

/**
 * A CHANGE IS ACKED ONLY ONCE IT IS DURABLE, AND HANDED TO THE HOST'S FLUSH.
 *
 * `flush` was handed nothing, so a host that writes what landed — Graview
 * Cloud commits ops to its ledger — found them by a high-water mark of its
 * own. And a flush that failed rejected out of `receive`: the client heard
 * nothing, its call hung, and the op stayed in the store as though it were
 * durable. Now `flush(landed)` is handed every op not yet durable, in seq
 * order; when it rejects, the client is told `unavailable` in words and
 * keeps the change, the socket's cursor does not move, the op is held back
 * from every socket, and the change sent again is flushed again — answered
 * only once it holds, and never made twice.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }) });
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const schema = createSchema([task]);
const app = defineApp({ name: "durable", schema, mutations: [add], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const ada: Principal = { kind: "human", id: "ada", name: "Ada", roles: ["keeper"] };
const bo: Principal = { kind: "human", id: "bo", name: "Bo", roles: ["keeper"] };

const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } as never });

/** A ledger that fails the next `failures` writes, and keeps what it was handed. */
function aLedger(failures = 1) {
  const handed: (readonly Operation[])[] = [];
  const durable: Operation[] = [];
  let failing = failures;
  return {
    handed,
    durable,
    fail(times = 1) {
      failing = times;
    },
    async flush(landed: readonly Operation[]) {
      handed.push(landed);
      if (failing > 0) {
        failing--;
        throw new Error("The ledger could not be written: disk full.");
      }
      for (const op of landed) if (!durable.some((one) => one.id === op.id)) durable.push(op);
    },
  };
}

function peerOf(live: ReturnType<typeof liveProtocol<typeof schema>>, seat: Principal) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...live.open(seat, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  return { peer, heard, said: (cid: string) => heard.filter((message) => "cid" in message && message.cid === cid) };
}

const call = (cid: string, batch: string, id: string) => JSON.stringify({ t: "call", cid, batch, calls: [{ name: "add", args: { id, label: id } }] });

describe("a failed flush is never acked", () => {
  it("hands flush the ops that just landed", async () => {
    const ledger = aLedger(0);
    const store = hostsStore();
    const live = liveProtocol({ store, flush: ledger.flush });
    const a = peerOf(live, ada);
    await live.receive(a.peer, JSON.stringify({ t: "hello", seq: -1 }));
    const received = await live.receive(a.peer, call("c1", "batch:adatab:1", "one"));
    expect(ledger.handed).toHaveLength(1);
    expect(ledger.handed[0]!.map((op) => op.batch)).toEqual(["batch:adatab:1"]);
    expect(received.landed).toEqual(ledger.handed[0]);
  });

  it("tells the client unavailable in words, keeps its cursor, holds the op back, and acks the change sent again once — never twice", async () => {
    const ledger = aLedger(1);
    const store = hostsStore();
    const live = liveProtocol({ store, flush: ledger.flush });
    const a = peerOf(live, ada);
    const b = peerOf(live, bo);
    await live.receive(a.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(b.peer, JSON.stringify({ t: "hello", seq: -1 }));
    const before = a.peer.cursor;

    const failed = await live.receive(a.peer, call("c1", "batch:adatab:1", "one"));
    expect(a.said("c1")).toEqual([{ t: "refused", cid: "c1", reason: "unavailable", sentence: expect.stringMatching(/could not be saved/) }]);
    expect(JSON.stringify(a.heard)).not.toContain("disk full");
    expect(a.peer.cursor).toBe(before);
    expect(failed.cursor).toBe(before);
    expect(failed.landed).toBeUndefined();
    // Not durable, so nobody is sent it.
    live.publish(store.log.all(), [a.peer, b.peer]);
    expect([...a.heard, ...b.heard].some((message) => message.t === "ops")).toBe(false);

    // Sent again: flushed again, acked once it holds, and made once.
    const again = await live.receive(a.peer, call("c1", "batch:adatab:1", "one"));
    expect(a.said("c1").at(-1)).toMatchObject({ t: "ack", batch: "batch:adatab:1" });
    expect(store.log.all().filter((op) => op.batch === "batch:adatab:1")).toHaveLength(1);
    expect(ledger.durable.map((op) => op.batch)).toEqual(["batch:adatab:1"]);
    expect(again.landed?.map((op) => op.batch)).toEqual(["batch:adatab:1"]);
    live.publish(again.landed!, [b.peer]);
    expect(b.heard.filter((message) => message.t === "ops").flatMap((message) => (message as { ops: Operation[] }).ops.map((op) => op.batch))).toEqual(["batch:adatab:1"]);
  });

  it("makes the change durable with the next one that flushes, and hands it over first", async () => {
    const ledger = aLedger(1);
    const store = hostsStore();
    const live = liveProtocol({ store, flush: ledger.flush });
    const a = peerOf(live, ada);
    const b = peerOf(live, bo);
    await live.receive(a.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(b.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(a.peer, call("c1", "batch:adatab:1", "one"));
    const next = await live.receive(b.peer, call("b1", "batch:botab:1", "two"));
    expect(ledger.handed.at(-1)!.map((op) => op.batch)).toEqual(["batch:adatab:1", "batch:botab:1"]);
    expect(next.landed?.map((op) => op.batch)).toEqual(["batch:adatab:1", "batch:botab:1"]);
    // Bo is sent Ada's op before the ack of his own, in seq order, none skipped.
    expect(b.heard.slice(-2).map((message) => message.t)).toEqual(["ops", "ack"]);
    // Ada's sent again: it is durable now, and answered without a second write.
    const writes = ledger.handed.length;
    await live.receive(a.peer, call("c1", "batch:adatab:1", "one"));
    expect(a.said("c1").at(-1)).toMatchObject({ t: "ack" });
    expect(ledger.handed).toHaveLength(writes);
  });

  it("answers 503 unavailable over HTTP, and the post sent again lands once", async () => {
    const ledger = aLedger(1);
    const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => ada, flush: ledger.flush });
    const post = () => handler.handle(new Request("https://store.example/graview/ops", { method: "POST", body: JSON.stringify({ batch: "batch:adatab:1", calls: [{ name: "add", args: { id: "one", label: "One" } }] }) }));
    const failed = await post();
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ refused: true, reason: "unavailable" });
    const again = await post();
    expect(again.status).toBe(200);
    expect(handler.store.log.all().filter((op) => op.batch === "batch:adatab:1")).toHaveLength(1);
    expect(ledger.durable).toHaveLength(1);
    await handler.close();
  });

  it("keeps a client's change through a failed write, and lands it once", async () => {
    const ledger = aLedger(2);
    const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => ada, flush: ledger.flush });
    const fetcher = ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
    const remote = await openRemote({ app, url: "https://store.example", principal: ada, fetch: fetcher, pollMs: 0, backoff: () => 5 });
    const refused: string[] = [];
    remote.onRefusal((sentence) => refused.push(sentence));
    remote.store.apply({ name: "add", args: { id: "one", label: "One" } });
    await remote.settled();
    expect(refused).toEqual([]);
    expect(ledger.handed.length).toBeGreaterThanOrEqual(3);
    expect(handler.store.log.length).toBe(1);
    expect(ledger.durable).toHaveLength(1);
    expect(remote.pending()).toBe(0);
    remote.close();
    await handler.close();
  });
});
