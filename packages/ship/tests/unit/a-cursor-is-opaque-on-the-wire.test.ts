import { bindSchema, createSchema, defineApp, defineNode, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, cursorAt, liveProtocol, openRemote, seqAt, type LivePeer, type LiveServerMessage } from "../../src/index.js";

/**
 * A CURSOR IS OPAQUE ON THE WIRE (Roadmap f-1-0-opaque-cursor).
 *
 * The store numbers its ops; the wire says where a reader stands as a
 * token only the server that gave it reads — `/graview/since?seq=`, the
 * poll's `seq`, and the socket's `hello`, `welcome`, `ack` and `ops` — so
 * a server that one day merges several writers' logs can keep its
 * clients. A page from before it still sends a number, and is served the
 * same, for one minor.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }) });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const app = defineApp({ name: "cursor", schema, mutations: [add], version: 1 });
const ana: Principal = { kind: "human", id: "ana" };
const withThree = () => {
  const store = new Store({ schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } as never });
  for (const id of ["t1", "t2", "t3"]) store.apply({ name: "add", args: { id, label: id } }, { author: ana });
  return store;
};

describe("a cursor is opaque on the wire", () => {
  it("is a token the server reads back as the seq it stands at, and an old page's number reads the same", () => {
    expect(cursorAt(-1)).toBe("s0");
    expect(typeof cursorAt(41)).toBe("string");
    for (const seq of [-1, 0, 1, 35, 36, 1_000_000]) expect(seqAt(cursorAt(seq))).toBe(seq);
    expect(seqAt(12)).toBe(12);
    expect(seqAt("12")).toBe(12);
    expect(seqAt("-1")).toBe(-1);
    for (const nonsense of ["", "s", "abc", "1.5", -2, 1.5, null, {}]) expect(seqAt(nonsense)).toBeUndefined();
  });

  it("is what a welcome, an ack and an ops message say, and a hello's token or old number is served the ops after it", async () => {
    const store = withThree();
    const live = liveProtocol({ store });
    for (const [at, said] of [cursorAt(0), 0].entries()) {
      const heard: LiveServerMessage[] = [];
      const peer: LivePeer = { ...live.open(ana, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
      const last = store.log.length - 1;
      await live.receive(peer, JSON.stringify({ t: "hello", seq: said }));
      const welcome = heard.find((message) => message.t === "welcome") as Extract<LiveServerMessage, { t: "welcome" }>;
      expect(welcome.seq).toBe(cursorAt(last));
      expect(welcome.ops.map((op) => op.seq)).toEqual(Array.from({ length: last }, (_, n) => n + 1));
      await live.receive(peer, JSON.stringify({ t: "call", cid: "c1", batch: `batch:tab:${at + 1}`, calls: [{ name: "add", args: { id: `t-more-${at}`, label: "More" } }] }));
      const ack = heard.find((message) => message.t === "ack") as Extract<LiveServerMessage, { t: "ack" }>;
      expect(typeof ack.seq).toBe("string");
      expect(seqAt(ack.seq)).toBe(ack.ops.at(-1)!.seq);
    }
    // Somebody else's op reaches an open socket as an ops message with a token.
    const heard: LiveServerMessage[] = [];
    const peer: LivePeer = { ...live.open(ana, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await live.receive(peer, JSON.stringify({ t: "hello", seq: cursorAt(store.log.length - 1) }));
    const landed = store.apply({ name: "add", args: { id: "t9", label: "Late" } }, { author: { kind: "human", id: "bo" } });
    live.publish(landed.ops, [peer]);
    const ops = heard.find((message) => message.t === "ops") as Extract<LiveServerMessage, { t: "ops" }>;
    expect(ops.seq).toBe(cursorAt(landed.ops.at(-1)!.seq));
  });

  it("is what /graview/since takes and answers, an old number too, and a seq that is neither is refused", async () => {
    const handler = await createStoreHandler({ app, store: withThree(), seatOf: () => ana });
    const since = async (seq: string) => {
      const response = await handler.handle(new Request(`https://store.example/graview/since?seq=${encodeURIComponent(seq)}`));
      return { status: response.status, body: (await response.json()) as { ops?: { seq: number }[]; cursor?: string; reason?: string } };
    };
    const byToken = await since(cursorAt(0));
    expect(byToken.body.ops?.map((op) => op.seq)).toEqual([1, 2]);
    expect(byToken.body.cursor).toBe(cursorAt(2));
    expect((await since("0")).body.ops?.map((op) => op.seq)).toEqual([1, 2]);
    expect((await since(byToken.body.cursor!)).body).toMatchObject({ ops: [], cursor: cursorAt(2) });
    expect(await since("nonsense")).toMatchObject({ status: 400, body: { reason: "invalid" } });
  });

  it("is what openRemote sends, never a bare number", async () => {
    const handler = await createStoreHandler({ app, store: withThree(), seatOf: () => ana });
    const asked: string[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      asked.push(String(url));
      return handler.handle(new Request(url, init));
    }) as typeof fetch;
    const remote = await openRemote({ app, url: "https://store.example", principal: ana, fetch: fetcher, pollMs: 0 });
    await remote.pull();
    const polled = asked.find((url) => url.includes("/graview/since"))!;
    expect(new URL(polled).searchParams.get("seq")).toBe(cursorAt(2));
    remote.close();
  });
});
