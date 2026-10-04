import { createSchema, defineApp, defineMutation, defineNode, isWithheld, Store, type Operation, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, type LivePeer, type LiveServerMessage } from "../../src/runtime.js";

/**
 * A SEAT IS SEEN ONCE PER PUBLISH, AND A WITHHELD OP'S BATCH SAYS NOBODY'S.
 *
 * `publish` redacted the ops once per socket: two hundred ops to fifty
 * sockets took 40–46 ms in Graview Cloud's spike, though fifty sockets are
 * a handful of seats. Now each seat's view is made once per publish — its
 * key resolved once, each run of ops redacted and written once — and sent
 * down every socket it holds. And a withheld op kept the batch its author's
 * client minted, `batch:<that browser's tag>:<n>`: a seat that may not see
 * a change could still tell which session made it, and link it to the
 * changes it may see. A withheld op now carries an opaque batch the server
 * mints from it — the same for every op of one batch, and not one a seat
 * can work back to the session — except to the seat that made it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }) });
const secret = defineNode("secret", { fields: z.object({ label: z.string() }) });
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string() }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const hide = defineMutation("hide", {
  title: "Hide two things",
  creates: ["secret"],
  input: z.object({ id: z.string() }),
  describe: () => "Hide two things",
  apply(ctx, args) {
    ctx.addNode({ id: `${args.id}-a`, kind: "secret", label: "A" });
  },
});
const schema = createSchema([task, secret]);
const policy = {
  grants: [{ roles: ["keeper", "viewer"], mutations: "*" }],
  sees: [
    { roles: ["keeper"], kinds: ["task", "secret"] },
    { roles: ["viewer"], kinds: ["task"] },
  ],
};
const app = defineApp({ name: "sights", schema, mutations: [add, hide], policy, version: 1 });
const ada: Principal = { kind: "human", id: "ada", name: "Ada", roles: ["viewer"] };
const bo: Principal = { kind: "human", id: "bo", name: "Bo", roles: ["keeper"] };
const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], policy, snapshot: { nodes: [], edges: [] } as never });

describe("a seat is seen once, and a withheld batch says nobody's", () => {
  it("resolves each seat key once and writes each seat's view once, however many sockets it holds", async () => {
    const store = hostsStore();
    const resolved: string[] = [];
    const seats = new Map([
      ["user:ada", ada],
      ["user:bo", bo],
    ]);
    const live = liveProtocol({
      store,
      seatOf: (key) => {
        resolved.push(key);
        return seats.get(key);
      },
    });
    const texts: string[] = [];
    const peers: LivePeer[] = [];
    for (let at = 0; at < 50; at++) {
      const peer: LivePeer = { ...live.open(at % 2 ? "user:ada" : "user:bo", "web"), send: (text) => void texts.push(text) };
      await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
      peers.push(peer);
    }
    const ops: Operation[] = [];
    for (let at = 0; at < 20; at++) ops.push(...store.apply(at % 4 ? { name: "add", args: { id: `t${at}`, label: `T${at}` } } : { name: "hide", args: { id: `s${at}` } }, { author: bo }).ops);
    texts.length = 0;
    resolved.length = 0;
    live.publish(ops, peers);
    expect(resolved.sort()).toEqual(["user:ada", "user:bo"]);
    expect(texts).toHaveLength(50);
    // Two seats, two views: every socket of a seat is sent the same words.
    expect(new Set(texts).size).toBe(2);
    const adas = JSON.parse(texts[1]!) as Extract<LiveServerMessage, { t: "ops" }>;
    expect(adas.ops.filter(isWithheld)).toHaveLength(5);
    // And told who is here, a key resolved once per seat too.
    resolved.length = 0;
    live.tell([], peers);
    expect(resolved.sort()).toEqual(["user:ada", "user:bo"]);
  });

  it("serves a withheld op under an opaque batch, the same for one batch, and its maker its own", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store });
    const heard = new Map<string, LiveServerMessage[]>();
    const peerOf = async (seat: Principal) => {
      heard.set(seat.id!, []);
      const peer: LivePeer = { ...live.open(seat, "web"), send: (text) => heard.get(seat.id!)!.push(JSON.parse(text) as LiveServerMessage) };
      await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
      return peer;
    };
    const adaPeer = await peerOf(ada);
    const boPeer = await peerOf(bo);
    // Bo's client hides two things in one batch, and adds a task.
    await live.receive(boPeer, JSON.stringify({ t: "call", cid: "h", batch: "batch:botab7q2x9k1:4", calls: [{ name: "hide", args: { id: "s1" } }, { name: "hide", args: { id: "s2" } }] }));
    await live.receive(boPeer, JSON.stringify({ t: "call", cid: "a", batch: "batch:botab7q2x9k1:5", calls: [{ name: "add", args: { id: "t1", label: "Seen" } }] }));
    live.publish(store.log.all(), [adaPeer]);
    const pushed = heard.get("ada")!.flatMap((message) => (message.t === "ops" ? message.ops : []));
    const withheld = pushed.filter(isWithheld);
    expect(withheld).toHaveLength(2);
    expect(new Set(withheld.map((op) => op.batch)).size).toBe(1);
    expect(withheld[0]!.batch).toMatch(/^withheld:[0-9a-f]{16}$/);
    expect(JSON.stringify(withheld)).not.toContain("botab7q2x9k1");
    // What Ada may see keeps its batch: the opaque one is only for what she may not.
    expect(pushed.find((op) => !isWithheld(op))!.batch).toBe("batch:botab7q2x9k1:5");
    // The same over the routes, and in the state a welcome carries.
    const since = live.since(-1, { seat: ada, via: "api" }).body.ops as Operation[];
    expect(since.filter(isWithheld).map((op) => op.batch)).toEqual(withheld.map((op) => op.batch));
    const state = live.state({ seat: ada, via: "api" }).body.log as Operation[];
    expect(state.filter(isWithheld).map((op) => op.batch)).toEqual(withheld.map((op) => op.batch));
    // Bo's own ops, to Bo, are his own batch.
    expect((heard.get("bo")!.find((message) => message.t === "ack" && message.cid === "h") as Extract<LiveServerMessage, { t: "ack" }>).ops.map((op) => op.batch)).toEqual(["batch:botab7q2x9k1:4", "batch:botab7q2x9k1:4"]);
  });

  it("is the same opaque batch on every route of a handler, export included", async () => {
    const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: (request) => (request.headers.get("x-who") === "bo" ? bo : ada) });
    const as = (who: string, path: string, init: RequestInit = {}) => handler.handle(new Request(`https://store.example${path}`, { ...init, headers: { "x-who": who } }));
    await as("bo", "/graview/ops", { method: "POST", body: JSON.stringify({ batch: "batch:botab7q2x9k1:4", calls: [{ name: "hide", args: { id: "s1" } }] }) });
    const since = ((await (await as("ada", "/graview/since?seq=-1")).json()) as { ops: Operation[] }).ops;
    const exported = ((await (await as("ada", "/graview/export")).json()) as { log: Operation[] }).log;
    const batch = since[0]!.batch;
    expect(batch).toMatch(/^withheld:/);
    expect(exported.map((op) => op.batch)).toEqual([batch]);
    await handler.close();
  });

  it("names the op a withheld undo takes back by the id the seat was served it under, and no session", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store });
    const heard: LiveServerMessage[] = [];
    const bos: LivePeer = { ...live.open(bo, "web"), send: () => {} };
    const adas: LivePeer = { ...live.open(ada, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await live.receive(bos, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(adas, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(bos, JSON.stringify({ t: "call", cid: "h", batch: "batch:botab7q2x9k1:4", calls: [{ name: "hide", args: { id: "s1" } }] }));
    await live.receive(bos, JSON.stringify({ t: "undo", cid: "u", batch: "undo:botab7q2x9k1:5", batches: ["batch:botab7q2x9k1:4"] }));
    live.publish(store.log.all(), [adas]);
    const [made, undone] = heard.flatMap((message) => (message.t === "ops" ? message.ops : []));
    expect(isWithheld(made!) && isWithheld(undone!)).toBe(true);
    // `undoes` is an op's id, minted by the server and served on the op itself: it points where it should, and names no session.
    expect(undone!.undoes).toBe(made!.id);
    expect(JSON.stringify([made, undone])).not.toContain("botab7q2x9k1");
  });
});
