import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef, Store, WIRE_PROTOCOL, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createStoreHandler,
  LIVE_PATH,
  LIVE_SUBPROTOCOL,
  LIVE_WIRE,
  liveProtocol,
  liveSubprotocol,
  openRemote,
  seatHeaders,
  serveStore,
  type LivePeer,
  type LiveServerMessage,
  type LiveSocketLike,
  type RemoteStore,
  type ServedStore,
  type StoreHandler,
} from "../../src/index.js";

/**
 * VERSION SKEW ON THE WIRE (FR-44).
 *
 * During a rolling deploy, tabs opened on the last build talk to servers on
 * the next one. Two answers are needed and they are different: "a newer
 * build is out, reload when it suits you" — the tab keeps working and is
 * told once — and "this server no longer speaks your protocol" — the tab
 * must reload now, and nothing it had not sent may be lost. And two codecs
 * on one path need telling apart before either reads the other's hello.
 */

const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }), plural: "Tasks", label: (node) => node.label });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
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
const app = defineApp({
  name: "skew",
  schema,
  mutations: [rename],
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
const label = (store: { graph: { getNode(id: string): unknown } }, id: string) => (store.graph.getNode(id) as { label: string }).label;
const until = async (holds: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!holds()) {
    if (Date.now() - start > ms) throw new Error("It never came true.");
    await new Promise((tick) => setTimeout(tick, 2));
  }
};

/**
 * Sockets onto whichever handler is serving now — the deploy swaps it —
 * with the calls going up held when the test says, and a way to drop the
 * socket as a restarting server would.
 */
function deployment(first: StoreHandler<typeof schema>) {
  const at = { serving: first, holdUp: false, held: [] as string[], hellos: [] as Record<string, unknown>[], protocols: [] as (readonly string[])[], heard: [] as LiveServerMessage[] };
  const open: { drop(): void }[] = [];
  const socket = (url: string, _headers: Readonly<Record<string, string>>, protocols?: readonly string[]): LiveSocketLike => {
    at.protocols.push(protocols ?? []);
    let deliver: (text: string) => void = () => {};
    let closeServer: () => void = () => {};
    const fake = {
      readyState: 0,
      onopen: null as null | ((event: unknown) => void),
      onmessage: null as null | ((event: { data: unknown }) => void),
      onclose: null as null | ((event: { code: number; reason: string }) => void),
      onerror: null as null | ((event: unknown) => void),
      send(text: string) {
        const message = JSON.parse(text) as { t: string };
        if (message.t === "hello") at.hellos.push(message);
        if (at.holdUp && message.t === "call") at.held.push(text);
        else deliver(text);
      },
      close() {
        fake.readyState = 3;
        closeServer();
      },
    };
    open.push({
      drop() {
        if (fake.readyState === 3) return;
        fake.readyState = 3;
        closeServer();
        fake.onclose?.({ code: 1012, reason: "The server is restarting." });
      },
    });
    void at.serving
      .connect(new Request(url.replace(/^ws/, "http"), { headers: seatHeaders(sam) }), {
        send: (text) =>
          setTimeout(() => {
            if (fake.readyState !== 1) return;
            at.heard.push(JSON.parse(text) as LiveServerMessage);
            fake.onmessage?.({ data: text });
          }, 0),
        close: () => fake.close(),
      })
      .then((connection) => {
        if (connection instanceof Response) throw new Error("refused");
        deliver = (text) => connection.receive(text);
        closeServer = () => connection.close();
        fake.readyState = 1;
        fake.onopen?.({});
      });
    return fake;
  };
  const fetch = ((url: string, init?: RequestInit) => at.serving.handle(new Request(url, init))) as typeof globalThis.fetch;
  return { at, socket, fetch, restart: () => open.splice(0).forEach((one) => one.drop()) };
}

let served: ServedStore<typeof schema> | undefined;
const remotes: RemoteStore<typeof schema>[] = [];
afterEach(async () => {
  for (const remote of remotes.splice(0)) remote.close();
  await served?.close();
  served = undefined;
});

describe("version skew on the wire", () => {
  it("keeps a tab on a different build working, and tells it once", async () => {
    const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });
    const handler = await createStoreHandler({ app, store, seatOf: () => sam, build: "2026.10.03-b" });
    const { at, socket, fetch, restart } = deployment(handler);
    const remote = await openRemote({ app, url: "http://store.example", principal: sam, live: true, pollMs: 0, socket, fetch, build: "2026.10.02-a" });
    remotes.push(remote);
    // The hello says which wire and which build this tab speaks.
    expect(at.hellos[0]).toMatchObject({ t: "hello", protocol: WIRE_PROTOCOL, wire: LIVE_WIRE, build: "2026.10.02-a" });
    // The socket asks for ship's codec by subprotocol, so a host serving two codecs on one path can tell.
    expect(at.protocols[0]).toEqual([LIVE_SUBPROTOCOL]);
    expect(at.heard.find((message) => message.t === "welcome")).toMatchObject({ build: "2026.10.03-b", wire: LIVE_WIRE });

    const told: string[] = [];
    remote.onBuild((build) => told.push(build));
    expect(told).toEqual(["2026.10.03-b"]);
    // It keeps working.
    remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
    await remote.settled();
    expect(label(store, "t1")).toBe("Book the big hall");
    // A reconnect says the build again; the tab is not told again.
    restart();
    await until(() => at.hellos.length === 2 && remote.transport() === "socket");
    remote.store.apply({ name: "rename", args: { id: "t2", label: "Pay it" } });
    await remote.settled();
    expect(label(store, "t2")).toBe("Pay it");
    expect(told).toEqual(["2026.10.03-b"]);

    // A tab on the same build is never told.
    const same = await openRemote({ app, url: "http://store.example", principal: sam, live: true, pollMs: 0, socket, fetch, build: "2026.10.03-b" });
    remotes.push(same);
    const quiet: string[] = [];
    same.onBuild((build) => quiet.push(build));
    expect(quiet).toEqual([]);
    await handler.close();
  });

  it("answers a hello on a protocol it no longer serves with reload, and nothing else", async () => {
    const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });
    const heard: LiveServerMessage[] = [];
    const peer: LivePeer = { seat: sam, via: "web", send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    const protocol = liveProtocol({ store, minProtocol: WIRE_PROTOCOL - 1 });
    // A tab two protocols behind.
    await protocol.receive(peer, JSON.stringify({ t: "hello", protocol: WIRE_PROTOCOL - 2 }));
    expect(heard).toHaveLength(1);
    expect(heard[0]).toMatchObject({ t: "reload", protocol: WIRE_PROTOCOL - 1 });
    expect((heard[0] as { reason: string }).reason).toMatch(/protocol/);
    expect(peer.cursor).toBeUndefined();
    // Its calls are not served.
    await protocol.receive(peer, JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "rename", args: { id: "t1", label: "x" } }] }));
    expect(heard.at(-1)).toMatchObject({ t: "refused", cid: "c1" });
    expect(store.log.length).toBe(0);
    // One protocol behind is still served.
    await protocol.receive(peer, JSON.stringify({ t: "hello", protocol: WIRE_PROTOCOL - 1 }));
    expect(heard.at(-1)).toMatchObject({ t: "welcome" });
  });

  it("carries a tab's unsent calls across the reload a protocol it no longer serves asks for, and lands them on the next open", async () => {
    const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });
    const before = await createStoreHandler({ app, store, seatOf: () => sam });
    const { at, socket, fetch, restart } = deployment(before);
    const storage = new Map<string, string>();
    const carry = {
      key: "graview:pending:skew",
      storage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value), removeItem: (key: string) => void storage.delete(key) },
    };
    const reloads: number[] = [];
    const tab = await openRemote({ app, url: "http://store.example", principal: sam, live: true, pollMs: 0, socket, fetch, carry, reloadPage: () => reloads.push(1) });
    remotes.push(tab);
    const refusals: string[] = [];
    tab.onRefusal((sentence) => refusals.push(sentence));

    // Two changes leave the keyboard and never reach the server.
    at.holdUp = true;
    tab.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
    tab.store.apply({ name: "rename", args: { id: "t2", label: "Pay it" } });
    expect(at.held).toHaveLength(2);

    // The deploy: the new server serves from a protocol past this tab's, and restarts every socket.
    at.serving = await createStoreHandler({ app, store, seatOf: () => sam, minProtocol: WIRE_PROTOCOL + 2 });
    at.holdUp = false;
    at.held.length = 0;
    restart();
    await until(() => reloads.length === 1);
    expect(at.heard.at(-1)).toMatchObject({ t: "reload", protocol: WIRE_PROTOCOL + 2 });
    // Kept, not lost, and not said to be refused.
    expect(JSON.parse(storage.get(carry.key)!)).toHaveLength(2);
    expect(refusals).toEqual([]);
    expect(store.log.length).toBe(0);
    await tab.settled();

    // The page reloads onto the build that speaks the server's protocol, with the same storage.
    at.serving = await createStoreHandler({ app, store, seatOf: () => sam });
    const after = await openRemote({ app, url: "http://store.example", principal: sam, live: true, pollMs: 0, socket, fetch, carry });
    remotes.push(after);
    await after.settled();
    expect(label(store, "t1")).toBe("Book the big hall");
    expect(label(store, "t2")).toBe("Pay it");
    expect(label(after.store, "t1")).toBe("Book the big hall");
    expect(store.log.length).toBe(2);
    // Offered once: the storage forgets them.
    expect(storage.has(carry.key)).toBe(false);
    expect(after.store.log.all().map((op) => op.id)).toEqual(store.log.all().map((op) => op.id));
  });

  it("refuses in words, and reloads, when a tab with nowhere to carry its calls is told to", async () => {
    const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });
    const { at, socket, fetch, restart } = deployment(await createStoreHandler({ app, store, seatOf: () => sam }));
    const reloads: number[] = [];
    const tab = await openRemote({ app, url: "http://store.example", principal: sam, live: true, pollMs: 0, socket, fetch, reloadPage: () => reloads.push(1) });
    remotes.push(tab);
    const refusals: string[] = [];
    tab.onRefusal((sentence) => refusals.push(sentence));
    at.holdUp = true;
    tab.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
    at.serving = await createStoreHandler({ app, store, seatOf: () => sam, minProtocol: WIRE_PROTOCOL + 1 });
    at.holdUp = false;
    restart();
    await until(() => reloads.length === 1);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toMatch(/not sent/);
  });

  it("names ship's codec by subprotocol on a served store, and does not welcome a hello in another codec", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true, build: "b1" });
    const socket = new WebSocket(`${served!.url.replace(/^http/, "ws")}${LIVE_PATH}`, { protocols: [LIVE_SUBPROTOCOL], headers: seatHeaders(sam) } as never);
    const heard: LiveServerMessage[] = [];
    socket.onmessage = (event) => heard.push(JSON.parse(String(event.data)) as LiveServerMessage);
    await new Promise<void>((ready, fail) => {
      socket.onopen = () => ready();
      socket.onerror = () => fail(new Error("The socket did not open."));
    });
    expect(socket.protocol).toBe(LIVE_SUBPROTOCOL);
    // What a Worker answers its upgrade with, from the same offer.
    const offer = (value: string) => new Request("https://store.example/graview/live", { headers: { "sec-websocket-protocol": value } });
    expect(liveSubprotocol(offer(`cloud.room.2, ${LIVE_SUBPROTOCOL}`))).toBe(LIVE_SUBPROTOCOL);
    expect(liveSubprotocol(offer("cloud.room.2"))).toBeUndefined();
    socket.send(JSON.stringify({ t: "hello", wire: "cloud.room", protocol: 2 }));
    await until(() => heard.length > 0);
    expect(heard[0]).toMatchObject({ t: "error" });
    expect((heard[0] as { sentence: string }).sentence).toContain(LIVE_WIRE);
    socket.send(JSON.stringify({ t: "hello", wire: LIVE_WIRE, protocol: WIRE_PROTOCOL }));
    await until(() => heard.some((message) => message.t === "welcome"));
    expect(heard.find((message) => message.t === "welcome")).toMatchObject({ wire: LIVE_WIRE, build: "b1", version: 1 });
    socket.close();
  });
});
