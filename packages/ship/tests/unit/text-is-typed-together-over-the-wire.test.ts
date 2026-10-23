import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, FORMATS, PUBLISH, Store, TYPE_TEXT, type Operation, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createStoreHandler,
  liveProtocol,
  openRemote,
  type LiveConnection,
  type LivePeer,
  type LiveServerMessage,
  type LiveSocketLike,
  type RemoteConflict,
  type RemoteStore,
  type StoreHandler,
} from "../../src/index.js";

/**
 * COLLABORATIVE TEXT, PHASE 3: THE WIRE (Roadmap f-collab-text).
 *
 * Two pages type into one text at once and both keep their words, letter
 * for letter, over a real handler and in-process sockets: a page sends at
 * most one run of typing per field and holds the rest, carried over what
 * others type until its turn; a reader that never said it reads op format
 * 3 is sent every splice as the whole text, and converges all the same; a
 * whole write over the wire merges three ways with what was typed since;
 * and a keystroke typed against history the log no longer holds is a
 * conflict, which a compaction never makes for an open socket.
 */
const note = defineNode("note", { fields: z.object({ title: z.string(), body: z.string().max(5000).optional() }) });
const memo = defineNode("memo", { fields: z.object({ flag: z.boolean() }) });
const schema = createSchema([note, memo]);
const { defineMutation } = bindSchema(schema);
const setBody = defineMutation("set-body", {
  title: "Set the body",
  subject: { kinds: ["note"], arg: "id" },
  writes: ["body"],
  input: z.object({ id: z.string(), body: z.string().max(5000) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { body: args.body });
  },
});
/** One act that writes a text the seat sees and flags a record it does not: the op is withheld from that seat, its splice is not. */
const flagBoth = defineMutation("flag-both", {
  title: "Rewrite and flag",
  subject: { kinds: ["note"], arg: "id" },
  writes: ["body"],
  input: z.object({ id: z.string(), other: z.string(), body: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { body: args.body });
    ctx.patchNode(args.other, { flag: true });
  },
});
const app = defineApp({ name: "notes", schema, mutations: [setBody, flagBoth], version: 1 });
const ana: Principal = { kind: "human", id: "ana", name: "Ana" };
const ben: Principal = { kind: "human", id: "ben", name: "Ben" };
const HELLO = { nodes: [{ id: "n1", kind: "note", title: "Plan", body: "Hello world" }], edges: [] };

const tick = () => new Promise((done) => setTimeout(done, 1));
async function until(holds: () => boolean, what = "it"): Promise<void> {
  for (let tries = 0; !holds(); tries++) {
    if (tries > 500) throw new Error(`${what} never came true.`);
    await tick();
  }
}

/** A socket between a page and the handler, in this process: either way can be held, as a slow network holds it. */
interface Line {
  /** Held: what the page sends waits here. */
  up: boolean;
  /** Held: what the server sends waits here. */
  down: boolean;
  release(): void;
  drop(): void;
}

function harness(handler: StoreHandler<typeof schema>) {
  /** While set, the server cannot be reached: a socket closes as it opens, and a request fails. */
  const net = { offline: false };
  const socketFor = (lines: Line[]) => (url: string, headers: Readonly<Record<string, string>>): LiveSocketLike => {
    const upHeld: string[] = [];
    const downHeld: string[] = [];
    let connection: LiveConnection | undefined;
    const client: LiveSocketLike & { readyState: number } = {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send(text) {
        if (line.up) upHeld.push(text);
        else queueMicrotask(() => connection?.receive(text));
      },
      close() {
        if (client.readyState === 3) return;
        client.readyState = 3;
        connection?.close();
        queueMicrotask(() => client.onclose?.({ code: 1000, reason: "" }));
      },
    };
    const line: Line = {
      up: false,
      down: false,
      release() {
        line.up = false;
        line.down = false;
        for (const text of upHeld.splice(0)) connection?.receive(text);
        for (const text of downHeld.splice(0)) client.onmessage?.({ data: text });
      },
      drop() {
        upHeld.length = 0;
        downHeld.length = 0;
        client.close();
      },
    };
    lines.push(line);
    if (net.offline) {
      queueMicrotask(() => client.close());
      return client;
    }
    void handler
      .connect(new Request(url.replace(/^ws/, "http"), { headers }), {
        send(text) {
          if (client.readyState === 3) return;
          if (line.down) downHeld.push(text);
          else queueMicrotask(() => client.onmessage?.({ data: text }));
        },
        close: () => client.close(),
      })
      .then((made) => {
        if (made instanceof Response) throw new Error(`refused: ${made.status}`);
        connection = made;
        client.readyState = 1;
        client.onopen?.({});
      });
    return client;
  };
  const fetcher = ((url: string, init?: RequestInit) => (net.offline ? Promise.reject(new TypeError("offline")) : handler.handle(new Request(url, init)))) as typeof fetch;
  const page = async (principal: Principal) => {
    const lines: Line[] = [];
    const remote = await openRemote({ app, url: "https://store.example", principal, live: true, fetch: fetcher, socket: socketFor(lines), pollMs: 0, backoff: () => 5 });
    return { remote, line: () => lines[lines.length - 1]! };
  };
  return { page, net };
}

const bodyOf = (store: Store<typeof schema> | RemoteStore<typeof schema>["store"], id = "n1") => (store.graph.getNode(id) as { body?: string } | undefined)?.body;

async function served(seed = HELLO) {
  const store = new Store({ schema, mutations: app.mutations ?? [], snapshot: seed as never });
  const handler = await createStoreHandler({ app, store, trustSeatHeaders: true });
  return { store, handler, ...harness(handler) };
}

/** Types a word a letter at a time, as an editor would hand it over. */
function typeOut(typing: { splice(at: number, remove: number, insert: string): void }, at: number, word: string) {
  [...word].forEach((letter, index) => typing.splice(at + index, 0, letter));
}

describe("text typed together over the wire", () => {
  it("two clients typing into one field at once converge character for character", async () => {
    const { store, handler, page } = await served();
    const a = await page(ana);
    const b = await page(ben);
    const typingA = await a.remote.typing("n1", "body");
    const typingB = await b.remote.typing("n1", "body");
    // Neither hears the other while they type: both lines held both ways.
    for (const one of [a.line(), b.line()]) (one.up = true), (one.down = true);
    typeOut(typingA, 5, " there");
    typeOut(typingB, 11, ", again");
    typingB.splice(0, 5, "Goodbye");
    typingA.flush();
    typingB.flush();
    expect(bodyOf(a.remote.store)).toBe("Hello there world");
    expect(bodyOf(b.remote.store)).toBe("Goodbye world, again");
    b.line().release();
    a.line().release();
    await until(() => typingA.waiting() === 0 && typingB.waiting() === 0, "every run answered");
    await a.remote.settled();
    await b.remote.settled();
    await until(() => bodyOf(a.remote.store) === bodyOf(store) && bodyOf(b.remote.store) === bodyOf(store), "both pages at the server's text");
    expect(bodyOf(store)).toBe("Goodbye there world, again");
    expect(store.log.all().every((op) => op.primitives.every((one) => one.op === "splice-text"))).toBe(true);
    a.remote.close();
    b.remote.close();
    await handler.close();
  });

  it("a slow client's held batch lands transformed", async () => {
    const { store, handler, page } = await served();
    const slow = await page(ana);
    const quick = await page(ben);
    const typing = await slow.remote.typing("n1", "body");
    const fast = await quick.remote.typing("n1", "body");
    // The slow page's first run goes out and its answer is held: what it types next is held behind it.
    slow.line().down = true;
    typeOut(typing, 11, "!");
    await until(() => store.log.length === 1, "the slow page's first run landed");
    typing.splice(0, 0, "Oh. ");
    typing.flush();
    expect(typing.waiting()).toBe(2);
    // Meanwhile the quick page types into the middle, twice.
    typeOut(fast, 5, ",");
    fast.flush();
    await quick.remote.settled();
    typeOut(fast, 6, " dear");
    fast.flush();
    await until(() => fast.waiting() === 0, "the quick page answered");
    await quick.remote.settled();
    expect(bodyOf(store)).toBe("Hello, dear world!");
    // The slow page hears it all at once: the ack of its first run, the quick page's typing, and then sends its held run, carried over them.
    slow.line().release();
    await until(() => typing.waiting() === 0, "the held run answered");
    await slow.remote.settled();
    await until(() => bodyOf(quick.remote.store) === bodyOf(store), "the quick page caught up");
    expect(bodyOf(store)).toBe("Oh. Hello, dear world!");
    expect(bodyOf(slow.remote.store)).toBe(bodyOf(store));
    // The held run was sent once, as one splice at the head of the text, claiming a revision past the slow page's first run.
    const held = store.log.all().at(-1)!;
    expect(held.mutation).toMatchObject({ name: TYPE_TEXT, args: { at: 0, remove: 0, insert: "Oh. " } });
    expect((held.mutation!.args as { rev: number }).rev).toBeGreaterThanOrEqual(0);
    slow.remote.close();
    quick.remote.close();
    await handler.close();
  });

  it("an old reader (no opFormat 3) converges via patch-node", async () => {
    const { store, handler, page } = await served();
    const writer = await page(ana);
    const live = handler.protocol;
    const heard: LiveServerMessage[] = [];
    const older: LivePeer = { ...live.open(ben, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    const newer: LiveServerMessage[] = [];
    const reads3: LivePeer = { ...live.open(ben, "web"), send: (text) => newer.push(JSON.parse(text) as LiveServerMessage) };
    await live.receive(older, JSON.stringify({ t: "hello", opFormat: 2 }));
    await live.receive(reads3, JSON.stringify({ t: "hello", opFormat: FORMATS.op }));
    const welcome = heard[0] as Extract<LiveServerMessage, { t: "welcome" }>;
    const copy = new Store({ schema, mutations: app.mutations ?? [], snapshot: welcome.state!.snapshot as never });
    const unsubscribe = store.subscribe((_diff, ops) => live.publish(ops, [older, reads3]));
    const typing = await writer.remote.typing("n1", "body");
    typeOut(typing, 11, " and all");
    typing.flush();
    typing.splice(0, 1, "J");
    typing.flush();
    await until(() => typing.waiting() === 0);
    await writer.remote.settled();
    const pushed = (from: LiveServerMessage[]) => from.flatMap((message) => (message.t === "ops" ? message.ops : []));
    const theirs = pushed(heard);
    // Each run a whole text before and after: " ", "and ", "all", then "J".
    expect(theirs.flatMap((op) => op.primitives.map((one) => one.op))).toEqual(["patch-node", "patch-node", "patch-node", "patch-node"]);
    expect(theirs[0]!.primitives[0]).toMatchObject({ before: { body: "Hello world" }, after: { body: "Hello world " } });
    expect(theirs.at(-1)!.primitives[0]).toMatchObject({ before: { body: "Hello world and all" }, after: { body: "Jello world and all" } });
    expect(pushed(newer).flatMap((op) => op.primitives.map((one) => one.op))).toEqual(["splice-text", "splice-text", "splice-text", "splice-text"]);
    copy.receive(theirs);
    expect(bodyOf(copy)).toBe("Jello world and all");
    // And caught up by /graview/since, walked back from the text now: the same whole texts.
    const since = live.since(-1, { seat: ben, via: "web" }).body["ops"] as Operation[];
    expect(since.map((op) => op.primitives[0])).toEqual(theirs.map((op) => op.primitives[0]));
    expect(since.every((op) => Array.isArray(op.inverse))).toBe(true);
    unsubscribe();
    writer.remote.close();
    await handler.close();
  });

  it("a whole write over the wire with a base merges with concurrent typing", async () => {
    const { store, handler, page } = await served();
    const typist = await page(ana);
    const editor = await page(ben);
    const typing = await typist.remote.typing("n1", "body");
    // The editor rewrites the text whole while the typist's keystrokes are on their way and not yet heard.
    editor.line().down = true;
    typeOut(typing, 11, "!");
    typing.flush();
    await until(() => store.log.length === 1);
    editor.remote.store.apply({ name: "set-body", args: { id: "n1", body: "Hello, wide world" } });
    editor.line().release();
    await editor.remote.settled();
    await until(() => bodyOf(typist.remote.store) === bodyOf(store) && bodyOf(editor.remote.store) === bodyOf(store));
    expect(bodyOf(store)).toBe("Hello, wide world!");
    // Merged as a splice against the text the editor read, never refused as stale.
    expect(store.log.all().at(-1)!.primitives[0]).toMatchObject({ op: "splice-text" });
    expect(editor.remote.counters().conflicts).toBe(0);
    typist.remote.close();
    editor.remote.close();
    await handler.close();
  });

  it("a seat whose op is withheld for another reason still converges on the field it sees", async () => {
    const policied = defineApp({
      ...app,
      policy: {
        roles: ["writer", "guest"],
        grants: [{ roles: ["writer", "guest"], mutations: "*" }],
        sees: [
          { roles: ["writer"], kinds: ["note", "memo"] },
          { roles: ["guest"], kinds: ["note"] },
        ],
      },
    });
    const store = new Store({
      schema,
      mutations: policied.mutations ?? [],
      policy: policied.policy!,
      snapshot: { nodes: [{ id: "n1", kind: "note", title: "Open", body: "Hello world" }, { id: "n2", kind: "memo", flag: false }], edges: [] } as never,
    });
    const handler = await createStoreHandler({ app: policied, store, trustSeatHeaders: true });
    const { page } = harness(handler as never);
    const guest = await page({ kind: "human", id: "gus", roles: ["guest"] });
    const writer = await page({ kind: "human", id: "wen", roles: ["writer"] });
    expect(guest.remote.store.graph.getNode("n2")).toBeUndefined();
    const typing = await guest.remote.typing("n1", "body");
    guest.line().down = true;
    typeOut(typing, 11, "!");
    typing.flush();
    await until(() => store.log.length === 1);
    // The writer's act rewrites the text the guest sees and flags a record it does not: withheld from the guest, its splice is not.
    writer.remote.store.apply({ name: "flag-both", args: { id: "n1", other: "n2", body: "Hello, wide world!" } });
    await writer.remote.settled();
    guest.line().release();
    await until(() => typing.waiting() === 0);
    typeOut(typing, 0, ">");
    typing.flush();
    await until(() => typing.waiting() === 0);
    await guest.remote.settled();
    await until(() => bodyOf(guest.remote.store) === bodyOf(store) && bodyOf(writer.remote.store) === bodyOf(store));
    expect(bodyOf(store)).toBe(">Hello, wide world!");
    const withheld = guest.remote.store.log.all().find((op) => op.withheld);
    expect(withheld?.batch).toMatch(/^withheld:[0-9a-f]{16}$/);
    expect(withheld?.primitives).toEqual([expect.objectContaining({ op: "splice-text", id: "n1" })]);
    guest.remote.close();
    writer.remote.close();
    await handler.close();
  });

  it("a type-text behind the horizon is refused as a conflict", async () => {
    const store = new Store({ schema, mutations: app.mutations ?? [], snapshot: HELLO as never });
    for (let at = 0; at < 4; at++) store.apply({ name: TYPE_TEXT, args: { node: "n1", field: "body", at: 11, remove: 0, insert: "." } });
    store.compact(store.checkpoint({ seq: 3 })!);
    const live = liveProtocol({ store });
    const answer = await live.post(JSON.stringify({ calls: [{ name: TYPE_TEXT, args: { node: "n1", field: "body", at: 0, remove: 0, insert: "So. ", rev: 0 } }] }), { seat: ana, via: "web" });
    expect(answer.status).toBe(409);
    expect(answer.body).toMatchObject({ conflict: true, conflicts: [{ node: "n1", field: "body", theirs: "Hello world....", saw: 0 }] });
    // From where the log still holds the text, the same keystroke is carried and lands.
    const fresh = await live.post(JSON.stringify({ calls: [{ name: TYPE_TEXT, args: { node: "n1", field: "body", at: 0, remove: 0, insert: "So. ", rev: 2 } }] }), { seat: ana, via: "web" });
    expect(fresh.status).toBe(200);
    expect(bodyOf(store)).toBe("So. Hello world....");
  });

  it("reconnect after the horizon moved resets, and typing from before it is offered as a conflict", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: HELLO as never, trustSeatHeaders: true });
    const { page, net } = harness(handler);
    const away = await page(ana);
    const typing = await away.remote.typing("n1", "body");
    const conflicts: RemoteConflict[] = [];
    away.remote.onConflict((conflict) => conflicts.push(conflict));
    const others = handler.store;
    others.apply({ name: TYPE_TEXT, args: { node: "n1", field: "body", at: 11, remove: 0, insert: "." } }, { author: ben });
    await until(() => bodyOf(away.remote.store) === "Hello world.");
    // Away: the line drops and its reconnects fail until it is back.
    net.offline = true;
    away.line().drop();
    for (let at = 0; at < 3; at++) others.apply({ name: TYPE_TEXT, args: { node: "n1", field: "body", at: 0, remove: 0, insert: "*" } }, { author: ben });
    typeOut(typing, 12, "?");
    typing.flush();
    // With no socket open nothing pins the horizon: it moves past where the page left off.
    expect(handler.pins()).toEqual([]);
    const compacted = await handler.compact({ seq: others.log.length, keepOps: 0 });
    expect(compacted.horizon).toBe(4);
    net.offline = false;
    await until(() => conflicts.length === 1 && typing.waiting() === 0 && away.remote.counters().resyncs > 0, "the page back, its typing offered as a conflict");
    expect(away.remote.counters().resyncs).toBeGreaterThan(0);
    expect(conflicts[0]!.conflicts[0]).toMatchObject({ node: "n1", field: "body", theirs: "***Hello world.", yours: "Hello world.?" });
    conflicts[0]!.useMine();
    await away.remote.settled();
    expect(bodyOf(others)).toBe("Hello world.?");
    expect(bodyOf(away.remote.store)).toBe("Hello world.?");
    // With a socket open, the horizon stops behind what it was sent.
    expect(handler.pins()).toEqual([others.log.length]);
    others.apply({ name: TYPE_TEXT, args: { node: "n1", field: "body", at: 0, remove: 0, insert: "+" } }, { author: ben });
    await until(() => bodyOf(away.remote.store) === bodyOf(others));
    const pinned = handler.pins()[0]!;
    const held = await handler.compact({ seq: others.log.length + 5, keepOps: 0 });
    expect(held.horizon).toBeLessThanOrEqual(pinned);
    away.remote.close();
    await handler.close();
  });

  it("a reader served behind the head is sent splices only through its served seq, whole when it did not say op format 3", async () => {
    const publishing = defineApp({
      ...app,
      policy: { roles: ["editor", "visitor"], grants: [{ roles: ["editor"], mutations: "*" }] },
      publishing: { mode: "on-publish", working: ["editor"] },
    });
    const store = new Store({ schema, mutations: publishing.mutations ?? [], policy: publishing.policy!, publishing: publishing.publishing!, snapshot: HELLO as never });
    const live = liveProtocol({ store });
    const eve: Principal = { kind: "human", id: "eve", roles: ["editor"] };
    const visitor: Principal = { kind: "human", id: "vic", roles: ["visitor"] };
    const peers: LivePeer[] = [];
    const open = async (seat: Principal, opFormat?: number) => {
      const heard: LiveServerMessage[] = [];
      const peer: LivePeer = { ...live.open(seat, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
      peers.push(peer);
      await live.receive(peer, JSON.stringify({ t: "hello", ...(opFormat !== undefined ? { opFormat } : {}) }), [], peers);
      return { peer, heard };
    };
    const editor = await open(eve, FORMATS.op);
    const older = await open(visitor);
    const newer = await open(visitor, FORMATS.op);
    const act = async (cid: string, name: string, args: Record<string, unknown>) => {
      const before = store.log.length;
      await live.receive(editor.peer, JSON.stringify({ t: "call", cid, calls: [{ name, args }] }), [], peers);
      live.publish(store.log.opsFrom(before), peers);
    };
    await act("e1", TYPE_TEXT, { node: "n1", field: "body", at: 11, remove: 0, insert: "!", rev: -1 });
    await act("e2", PUBLISH, {});
    await act("e3", TYPE_TEXT, { node: "n1", field: "body", at: 0, remove: 5, insert: "Howdy", rev: 1 });
    const pushed = (heard: LiveServerMessage[]) => heard.flatMap((message) => (message.t === "ops" ? message.ops : []));
    // Through the publish, and no further: the draft's splice reaches neither reader.
    expect(pushed(newer.heard).flatMap((op) => op.primitives).filter((one) => one.op === "splice-text")).toEqual([expect.objectContaining({ at: 11, inserted: "!" })]);
    expect(JSON.stringify(newer.heard)).not.toContain("Howdy");
    expect(JSON.stringify(older.heard)).not.toContain("Howdy");
    const olderSplices = pushed(older.heard).flatMap((op) => op.primitives).filter((one) => one.op === "patch-node" || one.op === "splice-text");
    expect(olderSplices[0]).toMatchObject({ op: "patch-node", before: { body: "Hello world" }, after: { body: "Hello world!" } });
    expect(pushed(older.heard).flatMap((op) => op.primitives).some((one) => one.op === "splice-text")).toBe(false);
    // The same on /graview/since: through the publish, whole for a reader before format 3.
    const since = live.since(-1, { seat: visitor, via: "web" }).body["ops"] as Operation[];
    expect(since.flatMap((op) => op.primitives).filter((one) => one.op === "patch-node")[0]).toMatchObject({ after: { body: "Hello world!" } });
    expect(JSON.stringify(since)).not.toContain("Howdy");
    const sinceNew = live.since(-1, { seat: visitor, via: "web", opFormat: FORMATS.op }).body["ops"] as Operation[];
    expect(sinceNew.flatMap((op) => op.primitives).some((one) => one.op === "splice-text")).toBe(true);
  });
});
