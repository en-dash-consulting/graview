import { bindSchema, createSchema, defineApp, defineNode, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, openRemote, type LiveServerMessage, type LiveSocketLike, type LiveSocketState, type StoreHandler } from "../../src/index.js";

/**
 * BUSY IS NOT REFUSED (FR-45).
 *
 * A host's rate limit and its message-size cap are tenancy protections,
 * and ship had one word for them: `refused`, on which the client takes the
 * change back. A person whose edit vanished because the room was busy lost
 * work for nothing. Now a host's `limit` may answer `{ retryAfter }`: the
 * socket says `{ t: "busy", cid, retryAfter }` and `POST /graview/ops`
 * answers 429 with `Retry-After`, and `openRemote` keeps the change shown
 * and pending and sends it again after the wait — in the order it was made.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }) });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const app = defineApp({
  name: "busy",
  schema,
  mutations: [add],
  policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] },
  version: 1,
});
const kim: Principal = { kind: "human", id: "kim", name: "Kim", roles: ["keeper"] };
const BURST = 12;
const WINDOW = 40;
const PER_WINDOW = 3;

/** The host's rate: three changes in every forty milliseconds, and after that, wait. */
function aBucket() {
  let start = Date.now();
  let used = 0;
  let asked = 0;
  let busy = 0;
  const limit = () => {
    asked++;
    const now = Date.now();
    if (now - start >= WINDOW) {
      start = now;
      used = 0;
    }
    if (used < PER_WINDOW) {
      used++;
      return undefined;
    }
    busy++;
    return { retryAfter: Math.max(1, WINDOW - (now - start)) };
  };
  return { limit, said: () => ({ asked, busy }) };
}

function hostsStore() {
  return new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } as never });
}

const until = async (holds: () => boolean, ms = 4000) => {
  const start = Date.now();
  while (!holds()) {
    if (Date.now() - start > ms) throw new Error("It never came true.");
    await new Promise((tick) => setTimeout(tick, 2));
  }
};

/** `openRemote` over the handler, in process. */
function wired(handler: StoreHandler<typeof schema>) {
  const fetcher = ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
  const socket = (url: string): LiveSocketLike => {
    let deliver: (text: string) => void = () => {};
    const fake: LiveSocketLike & { readyState: number } = {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: (text) => deliver(text),
      close() {
        fake.readyState = 3;
      },
    };
    void handler
      .connect(new Request(url.replace(/^ws/, "http")), { send: (text) => setTimeout(() => fake.onmessage?.({ data: text }), 0) })
      .then((connection) => {
        if (connection instanceof Response) throw new Error("refused");
        deliver = (text) => connection.receive(text);
        fake.readyState = 1;
        fake.onopen?.({});
      });
    return fake;
  };
  return { fetch: fetcher, socket };
}

describe("busy is not refused", () => {
  it("says busy on the socket, with the cid and the wait, and keeps every later change on that socket behind it", async () => {
    const store = hostsStore();
    let busyNow = true;
    const protocol = liveProtocol({ store, limit: () => (busyNow ? { retryAfter: 250 } : undefined) });
    const heard: LiveServerMessage[] = [];
    const peer: LiveSocketState & { send(text: string): void } = { ...protocol.open(kim, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await protocol.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
    await protocol.receive(peer, JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "add", args: { id: "a", label: "A" } }] }));
    expect(heard.at(-1)).toMatchObject({ t: "busy", cid: "c1" });
    const wait = (heard.at(-1) as Extract<LiveServerMessage, { t: "busy" }>).retryAfter;
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(250);
    // What the socket holds between messages is still plain JSON: a hibernating host keeps it.
    expect(JSON.parse(JSON.stringify(peer))).toMatchObject({ held: { cid: "c1" } });
    // The rate has room again, but c2 was made after c1: it waits behind it rather than overtaking it.
    busyNow = false;
    await protocol.receive(peer, JSON.stringify({ t: "call", cid: "c2", calls: [{ name: "add", args: { id: "b", label: "B" } }] }));
    expect(heard.at(-1)).toMatchObject({ t: "busy", cid: "c2" });
    expect(store.log.length).toBe(0);
    await protocol.receive(peer, JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "add", args: { id: "a", label: "A" } }] }));
    await protocol.receive(peer, JSON.stringify({ t: "call", cid: "c2", calls: [{ name: "add", args: { id: "b", label: "B" } }] }));
    expect(heard.slice(-2).map((message) => message.t)).toEqual(["ack", "ack"]);
    expect(store.log.all().map((op) => op.intent)).toEqual(["Add “A”", "Add “B”"]);
    expect(heard.some((message) => message.t === "refused")).toBe(false);
  });

  it("answers 429 with Retry-After over HTTP, and refuses nothing", async () => {
    const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => kim, limit: () => ({ retryAfter: 1500, sentence: "The room is busy." }) });
    const response = await handler.handle(new Request("https://store.example/graview/ops", { method: "POST", body: JSON.stringify({ calls: [{ name: "add", args: { id: "a", label: "A" } }] }) }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("2");
    expect(await response.json()).toEqual({ error: "The room is busy.", busy: true, retryAfter: 1500 });
    expect(handler.store.log.length).toBe(0);
  });

  for (const live of [true, false]) {
    it(`lands a burst over the rate, all of it, in order, none refused, and the client drains (${live ? "socket" : "HTTP"})`, async () => {
      const bucket = aBucket();
      const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => kim, limit: bucket.limit });
      const remote = await openRemote({ app, url: "https://store.example", principal: kim, live, pollMs: 0, ...wired(handler) });
      expect(remote.transport()).toBe(live ? "socket" : "poll");
      const refused: string[] = [];
      remote.onRefusal((sentence) => refused.push(sentence));
      const labels = Array.from({ length: BURST }, (_, at) => `Task ${at + 1}`);
      for (const [at, label] of labels.entries()) remote.store.apply({ name: "add", args: { id: `t${at + 1}`, label } });
      // Shown at once, every one of them, while the host makes them wait.
      expect(remote.store.graph.allNodes().map((node) => (node as { label: string }).label)).toEqual(labels);
      await remote.settled();
      expect(bucket.said().busy).toBeGreaterThan(0);
      expect(refused).toEqual([]);
      expect(handler.store.log.all().map((op) => op.intent)).toEqual(labels.map((label) => `Add “${label}”`));
      // Drained: what the browser holds is the server's log, op for op, with nothing provisional left in it.
      await until(() => remote.store.log.all().map((op) => op.id).join() === handler.store.log.all().map((op) => op.id).join());
      expect(remote.store.log.all().some((op) => op.id.startsWith("local-"))).toBe(false);
      expect(remote.store.graph.allNodes().map((node) => (node as { label: string }).label)).toEqual(labels);
      remote.close();
    });
  }
});
