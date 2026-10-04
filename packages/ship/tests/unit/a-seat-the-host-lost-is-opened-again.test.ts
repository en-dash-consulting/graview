import { createSchema, defineApp, defineMutation, defineNode, Store, type Operation, type Policy, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, openRemote, type LiveClientMessage, type LivePeer, type LiveServerMessage, type LiveSocketLike } from "../../src/runtime.js";

/**
 * A SEAT THE HOST LOST IS OPENED AGAIN, AND A SEAT'S KEY IS NOBODY'S TAB.
 *
 * Graview Cloud's spike kept seat keys the way the README sketched them,
 * `seatOf: (key) => seats.get(key)` over a map in memory — and the first
 * wake lost every one: each socket was told `error`, "no longer known",
 * and served nothing again, and `openRemote` ignored the error, so a tab
 * sat open and deaf. And a key built from the principal with its session
 * made `publish` build one view per tab, not per seat. Now a socket whose
 * seat key the host no longer resolves is told so, and that it should open
 * the socket again — `{ t: "error", reopen: true }` — and the protocol
 * closes it when the host can; `openRemote` opens a new socket, the host
 * reads the seat from its upgrade again, and what the tab had not had
 * answered is sent again and lands once. And the key the handler asks for
 * is the seat's, never the tab's: `seatKey` is handed the seat without its
 * session, and a sight is one per seat however many sessions hold it.
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
const policy: Policy = { grants: [{ roles: ["member"], mutations: "*" }], sees: [{ roles: ["member"], kinds: ["task"] }] };
const app = defineApp({ name: "lost", schema, mutations: [add], policy, version: 1 });
const ada: Principal = { kind: "human", id: "ada", name: "Ada", roles: ["member"] };
const hostsStore = (sees: Policy = policy) => new Store({ schema, mutations: [add], policy: sees, snapshot: { nodes: [], edges: [] } as never });
const tick = (ms = 5) => new Promise((done) => setTimeout(done, ms));

function peerOf(state: ReturnType<ReturnType<typeof liveProtocol>["open"]>) {
  const heard: LiveServerMessage[] = [];
  const closed: { code?: number; reason?: string }[] = [];
  const peer: LivePeer = { ...state, send: (text) => void heard.push(JSON.parse(text) as LiveServerMessage), close: (code, reason) => void closed.push({ code, reason }) };
  return { peer, heard, closed };
}

describe("a seat the host lost is opened again", () => {
  it("tells a socket whose seat key the host no longer knows to open it again, in a sentence that says the host lost it, and closes it", async () => {
    const live = liveProtocol({ store: hostsStore(), seatOf: () => undefined });
    const { peer, heard, closed } = peerOf(live.open("user:ada", "web"));
    peer.cursor = 3;
    await live.receive(peer, JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "add", args: { id: "a", label: "A" } }] }));
    expect(heard).toEqual([{ t: "error", reopen: true, sentence: expect.stringMatching(/host no longer knows who this socket is/) }]);
    expect(peer.cursor).toBeUndefined();
    expect(closed).toEqual([{ code: 4000, reason: expect.stringMatching(/open it again/i) }]);
  });

  it("tells a socket the same when ops are published to it after the host lost its seat, and sends it nothing else", async () => {
    const seats = new Map([["user:ada", ada]]);
    const store = hostsStore();
    const before = liveProtocol({ store, seatOf: (key) => seats.get(key) });
    const { peer, heard, closed } = peerOf(before.open("user:ada", "web"));
    await before.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
    // A wake: the map in memory is gone, and the protocol is made again.
    seats.clear();
    const after = liveProtocol({ store, seatOf: (key) => seats.get(key) });
    const { ops } = store.apply({ name: "add", args: { id: "a", label: "A" } }, { author: ada });
    after.publish(ops, [peer]);
    after.publish(ops, [peer]);
    expect(heard.slice(1)).toEqual([{ t: "error", reopen: true, sentence: expect.stringMatching(/open it again/) }]);
    expect(closed).toHaveLength(1);
    after.tell([], [peer]);
    expect(heard).toHaveLength(2);
  });

  it("opens the socket again from openRemote, and the call the host could not answer lands once", async () => {
    // The host keeps seat keys in memory, as the spike did, and loses them on a wake.
    const keys = new Map<string, Principal>();
    const handler = await createStoreHandler({
      app,
      store: hostsStore(),
      seatOf: () => ada,
      seatKey: (seat) => {
        const key = `user:${seat.id}`;
        keys.set(key, seat);
        return key;
      },
      seatOfKey: (key) => keys.get(key),
    });
    const fetcher = ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
    let opened = 0;
    const said: LiveClientMessage[] = [];
    const socket = (url: string): LiveSocketLike => {
      opened++;
      const fake: LiveSocketLike & { readyState: number } = {
        readyState: 0,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
        send: (text) => {
          said.push(JSON.parse(text) as LiveClientMessage);
          void connected.then((connection) => connection.receive(text));
        },
        close(code = 1000, reason = "") {
          if (fake.readyState === 3) return;
          fake.readyState = 3;
          void connected.then((connection) => connection.close());
          setTimeout(() => fake.onclose?.({ code, reason }), 0);
        },
      };
      const connected = handler
        .connect(new Request(url.replace(/^ws/, "http")), {
          send: (text) => setTimeout(() => fake.onmessage?.({ data: text }), 0),
          close: (code, reason) => fake.close(code, reason),
        })
        .then((connection) => {
          if (connection instanceof Response) throw new Error("refused");
          fake.readyState = 1;
          setTimeout(() => fake.onopen?.({}), 0);
          return connection;
        });
      return fake;
    };
    const remote = await openRemote({ app, url: "https://store.example", principal: ada, fetch: fetcher, live: true, pollMs: 0, socket, backoff: () => 5 });
    await tick(20);
    expect(opened).toBe(1);

    keys.clear();
    remote.store.apply({ name: "add", args: { id: "after-the-wake", label: "After the wake" } });
    await remote.settled();
    await tick(20);
    expect(opened).toBe(2);
    expect(said.filter((message) => message.t === "hello")).toHaveLength(2);
    expect(handler.store.log.all().filter((op: Operation) => op.writes.includes("after-the-wake"))).toHaveLength(1);
    expect(remote.pending()).toBe(0);
    remote.close();
    await handler.close();
  });
});

describe("a seat's key is nobody's tab", () => {
  it("hands seatKey the seat without its session, for it and for the person an agent acts for", async () => {
    const asked: Principal[] = [];
    const tab: Principal = { kind: "agent", id: "claude", session: "tab-7", roles: ["member"], onBehalfOf: { kind: "human", id: "ada", session: "tab-3", roles: ["member"] } };
    const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => tab, seatKey: (seat) => (asked.push(seat), `agent:${seat.id}`), seatOfKey: () => tab });
    const state = await handler.seatFor(new Request("https://store.example/graview/live"));
    expect(state).toMatchObject({ seat: "agent:claude" });
    expect(asked).toEqual([{ kind: "agent", id: "claude", roles: ["member"], onBehalfOf: { kind: "human", id: "ada", roles: ["member"] } }]);
    await handler.close();
  });

  it("serves two tabs of one seat one view, whatever their sessions", async () => {
    // How many times the policy's sights are read: one view's worth, or two.
    let reads = 0;
    const counted = new Proxy(policy, {
      get(target, property, receiver) {
        if (property === "sees") reads++;
        return Reflect.get(target, property, receiver);
      },
    });
    const sightsRead = (sessions: readonly string[]): number => {
      const store = hostsStore(counted);
      const { ops } = store.apply({ name: "add", args: { id: "a", label: "A" } }, { author: ada });
      const live = liveProtocol({ store });
      const peers = sessions.map((session) => {
        const { peer } = peerOf(live.open({ ...ada, session }, "web"));
        peer.cursor = -1;
        return peer;
      });
      reads = 0;
      live.publish(ops, peers);
      return reads;
    };
    expect(sightsRead(["tab-1", "tab-2"])).toBe(sightsRead(["tab-1"]));
  });
});
