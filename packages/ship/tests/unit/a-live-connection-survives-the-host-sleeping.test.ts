import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, isWithheld, nodeRef, type Operation, type Policy, type Principal, type Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { liveProtocol, openStore, type LiveServerMessage, type LiveSocketState } from "../../src/runtime.js";

/**
 * A LIVE CONNECTION A HIBERNATING HOST CAN RESUME (FR-41).
 *
 * `connect()` handed back an object that lived only in memory: who the
 * socket was, the last seq it had been sent, where it said it stood. A
 * Durable Object that hibernates wakes on the next message with none of
 * that left, so a host that wanted ship's wire had to keep its room awake,
 * and pay for it. The protocol is now functions over state the host holds
 * — a JSON object per socket, the kind a Durable Object keeps in
 * `serializeAttachment` — and a store. This test plays such a host, and
 * throws away everything but those two between messages.
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const shopper = defineNode("shopper", { fields: z.object({ label: z.string() }), plural: "Shoppers" });
const enquiry = defineNode("enquiry", {
  fields: z.object({ label: z.string(), answered: z.boolean().optional() }),
  plural: "Enquiries",
  edges: { from: { to: ["shopper"], cardinality: "one", description: "who asked", inverse: "their enquiries" } },
});
const schema = createSchema([car, shopper, enquiry]);
const { defineMutation } = bindSchema(schema);
const ask = defineMutation("ask", {
  title: "Ask",
  subject: { kinds: ["shopper"], arg: "shopperId" },
  creates: ["enquiry"],
  input: z.object({ shopperId: nodeRef(["shopper"]), label: z.string() }),
  describe: (args) => `Ask “${args.label}”`,
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "enquiry");
    ctx.addNode({ id, kind: "enquiry", label: args.label });
    ctx.addEdge({ kind: "from", from: id, to: args.shopperId });
  },
});
const rename = defineMutation("rename-car", {
  title: "Rename the car",
  subject: { kinds: ["car"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["car"]), label: z.string() }),
  describe: (args) => `Call it “${args.label}”`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const policy: Policy = {
  grants: [{ roles: ["shopper"], mutations: ["ask"] }, { roles: ["staff"], mutations: "*" }],
  sees: [
    { roles: "*", kinds: ["car"] },
    { roles: ["staff"], kinds: ["shopper", "enquiry"] },
    { roles: ["shopper"], kinds: ["shopper", "enquiry"], own: true },
  ],
};
const app = defineApp({ name: "showroom", schema, mutations: [ask, rename], policy, version: 1 });
const seed = {
  nodes: [
    { id: "car:golf", kind: "car", label: "Golf" },
    { id: "shopper:bethan", kind: "shopper", label: "Bethan Okonkwo" },
    { id: "shopper:freya", kind: "shopper", label: "Freya Davies" },
  ],
  edges: [],
};
const bethan: Principal = { kind: "human", id: "shopper:bethan", roles: ["shopper"] };
const freya: Principal = { kind: "human", id: "shopper:freya", roles: ["shopper"] };
const rhian: Principal = { kind: "human", id: "staff:rhian", roles: ["staff"] };

/**
 * A HOST THAT SLEEPS. What survives a hibernation is the store and one
 * string per socket — the attachment. Everything else (the protocol, its
 * caches, every closure) is made again on each wake, from those alone.
 */
class Room {
  readonly heard = new Map<string, LiveServerMessage[]>();
  readonly attachments = new Map<string, string>();
  constructor(readonly store: Store<typeof schema>) {}

  /** The host's in-memory half, made on a wake and thrown away on an eviction. */
  private awake: { live: ReturnType<typeof liveProtocol<typeof schema>> } | undefined;
  private wake() {
    this.awake ??= { live: liveProtocol({ store: this.store, version: 1 }) };
    return this.awake.live;
  }
  evict() {
    this.awake = undefined;
  }

  private peer(id: string) {
    const state = JSON.parse(this.attachments.get(id)!) as LiveSocketState;
    return { ...state, send: (text: string) => this.heard.get(id)!.push(JSON.parse(text) as LiveServerMessage) };
  }
  private keep(id: string, peer: LiveSocketState) {
    const { seat, via, cursor, participant } = peer;
    this.attachments.set(id, JSON.stringify({ seat, via, ...(cursor !== undefined ? { cursor } : {}), ...(participant ? { participant } : {}) }));
  }

  accept(id: string, seat: Principal) {
    this.heard.set(id, []);
    this.keep(id, this.wake().open(seat, "web"));
  }

  async message(id: string, text: string) {
    const live = this.wake();
    const peer = this.peer(id);
    const received = await live.receive(peer, text);
    this.keep(id, peer);
    expect(received.cursor).toBe(peer.cursor);
    if (received.landed?.length) this.publish(received.landed, id);
    return received;
  }

  /** Every other socket, each as its own seat sees the ops. */
  publish(ops: readonly Operation[], except?: string) {
    const live = this.wake();
    const peers = [...this.attachments.keys()].filter((id) => id !== except).map((id) => [id, this.peer(id)] as const);
    live.publish(
      ops,
      peers.map(([, peer]) => peer),
    );
    for (const [id, peer] of peers) this.keep(id, peer);
  }
}

const said = (room: Room, id: string, t: LiveServerMessage["t"]) => room.heard.get(id)!.filter((message) => message.t === t);

describe("a live connection a hibernating host can resume", () => {
  it("serves the second message on a socket from its serialized state alone, after the host was evicted between them", async () => {
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: seed as never });
    const room = new Room(opened.store);
    room.accept("bethan", bethan);
    room.accept("rhian", rhian);
    await room.message("bethan", JSON.stringify({ t: "hello" }));
    await room.message("rhian", JSON.stringify({ t: "hello", seq: -1 }));
    expect(said(room, "bethan", "welcome")).toHaveLength(1);

    // While the host sleeps, somebody else's op lands — through the host's HTTP route, say.
    room.evict();
    const { ops: freyas } = opened.store.apply({ name: "ask", args: { shopperId: "shopper:freya", label: "Finance on the Golf" } }, { author: freya });
    room.evict();

    // Every in-memory object but the store is gone; the attachments are strings.
    for (const [id, text] of room.attachments) expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(JSON.parse(text))), id);
    const before = room.attachments.get("bethan")!;
    expect(JSON.parse(before)).toEqual({ seat: bethan, via: "web", cursor: -1 });

    const received = await room.message("bethan", JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "ask", args: { shopperId: "shopper:bethan", label: "Is it still there" } }] }));
    const bethans = said(room, "bethan", "ops") as Extract<LiveServerMessage, { t: "ops" }>[];
    const acks = said(room, "bethan", "ack") as Extract<LiveServerMessage, { t: "ack" }>[];
    // The op she missed while the host slept came first, withheld (it is Freya's), and once.
    expect(bethans.flatMap((message) => message.ops.map((op) => op.seq))).toEqual([freyas[0]!.seq]);
    expect(isWithheld(bethans[0]!.ops[0]!)).toBe(true);
    expect(JSON.stringify(bethans)).not.toContain("Finance");
    // Her own call landed as her seat, through the host's channel, and was answered in the ack.
    expect(acks).toHaveLength(1);
    expect(acks[0]!.cid).toBe("c1");
    expect(acks[0]!.ops.map((op) => op.intent)).toEqual(["Ask “Is it still there”"]);
    const landed = opened.store.log.all().at(-1)!;
    expect(landed.author).toMatchObject({ id: "shopper:bethan" });
    expect(landed.via).toBe("web");
    expect(received.cursor).toBe(landed.seq);
    expect(JSON.parse(room.attachments.get("bethan")!).cursor).toBe(landed.seq);
  });

  it("reaches every socket after the wake with its own sights applied, and catches each up from its own cursor", async () => {
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: seed as never });
    const room = new Room(opened.store);
    for (const [id, seat] of [["bethan", bethan], ["freya", freya], ["rhian", rhian]] as const) {
      room.accept(id, seat);
      await room.message(id, JSON.stringify({ t: "hello", seq: -1 }));
    }
    room.evict();

    // After the wake, Freya asks: Rhian (staff) sees it whole, Bethan sees it withheld, Freya has it in her ack.
    await room.message("freya", JSON.stringify({ t: "call", cid: "f1", calls: [{ name: "ask", args: { shopperId: "shopper:freya", label: "Finance on the Golf" } }] }));
    room.evict();
    // And a change on the host's own side, published to everybody from the attachments alone.
    const { ops: renamed } = opened.store.apply({ name: "rename-car", args: { id: "car:golf", label: "Golf GTI" } }, { author: rhian });
    room.publish(renamed);

    const pushed = (id: string) => (said(room, id, "ops") as Extract<LiveServerMessage, { t: "ops" }>[]).flatMap((message) => message.ops);
    const asked = opened.store.log.all().find((op) => op.intent === "Ask “Finance on the Golf”")!;
    expect(pushed("rhian").map((op) => op.seq)).toEqual([asked.seq, renamed[0]!.seq]);
    expect(isWithheld(pushed("rhian")[0]!)).toBe(false);
    expect(JSON.stringify(pushed("rhian"))).toContain("Finance");
    expect(pushed("bethan").map((op) => op.seq)).toEqual([asked.seq, renamed[0]!.seq]);
    expect(isWithheld(pushed("bethan")[0]!)).toBe(true);
    expect(isWithheld(pushed("bethan")[1]!)).toBe(false);
    expect(JSON.stringify(pushed("bethan"))).not.toContain("Finance");
    // Freya's own op reached her once, in the ack; the push carried only the rename.
    expect(pushed("freya").map((op) => op.seq)).toEqual([renamed[0]!.seq]);
    expect((said(room, "freya", "ack")[0] as Extract<LiveServerMessage, { t: "ack" }>).ops.map((op) => op.seq)).toEqual([asked.seq]);
    for (const id of ["bethan", "freya", "rhian"]) expect(JSON.parse(room.attachments.get(id)!).cursor).toBe(renamed[0]!.seq);
  });

  it("keeps a stale write a conflict across a wake: the field's revision is read off the store, not a cache that slept", async () => {
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: seed as never });
    const room = new Room(opened.store);
    room.accept("rhian", rhian);
    await room.message("rhian", JSON.stringify({ t: "hello", seq: -1 }));
    room.evict();
    opened.store.apply({ name: "rename-car", args: { id: "car:golf", label: "Golf GTI" } }, { author: { ...rhian, id: "staff:owain" } });
    room.evict();
    await room.message("rhian", JSON.stringify({ t: "call", cid: "r1", calls: [{ name: "rename-car", args: { id: "car:golf", label: "Golf R" } }], base: [{ node: "car:golf", field: "label", rev: -1 }] }));
    expect(said(room, "rhian", "conflict")).toHaveLength(1);
    expect(opened.store.graph.getNode("car:golf")).toMatchObject({ label: "Golf GTI" });
  });

  it("refuses a call on a socket that never said hello, from the state alone", async () => {
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: seed as never });
    const room = new Room(opened.store);
    room.accept("bethan", bethan);
    room.evict();
    await room.message("bethan", JSON.stringify({ t: "call", cid: "c0", calls: [] }));
    expect(said(room, "bethan", "refused")).toHaveLength(1);
  });

  it("builds a socket's presence from its seat and hands it to the host to hold, and forgets it on bye", async () => {
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: seed as never });
    const room = new Room(opened.store);
    room.accept("bethan", bethan);
    await room.message("bethan", JSON.stringify({ t: "hello" }));
    room.evict();
    const here = await room.message("bethan", JSON.stringify({ t: "here", presence: { participant: "human:staff:rhian:tab1", stop: "/", over: null, at: "" } }));
    // A client never names itself: the key is built from the seat the socket was opened as.
    expect(here.presence?.participant).toBe("human:shopper:bethan:tab1");
    expect(JSON.parse(room.attachments.get("bethan")!).participant).toBe("human:shopper:bethan:tab1");
    const gone = await room.message("bethan", JSON.stringify({ t: "bye" }));
    expect(gone.presence).toBeNull();
    expect(JSON.parse(room.attachments.get("bethan")!).participant).toBeUndefined();
  });
});
