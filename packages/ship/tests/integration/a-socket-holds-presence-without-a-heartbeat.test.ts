import { createMemoryAdapter, createSchema, defineApp, defineNode, foldPresence, REMOTE_PRESENCE_TTL_MS, type Presence, type Principal } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, openRemote, seatHeaders, type LiveServerMessage, type LiveSocketLike, type RemoteStore, type StoreHandler } from "../../src/index.js";

/**
 * A SOCKET HOLDS PRESENCE WITHOUT A HEARTBEAT.
 *
 * On the socket, presence lasted only by time: a client dropped anybody
 * whose word was older than `REMOTE_PRESENCE_TTL_MS`, so `openRemote` said
 * `here` again every `presenceEveryMs` from every visible tab — and on a
 * hibernating host each one woke the room, rewrote an attachment and told
 * every socket (fifty tabs, about forty wakes and two thousand presence
 * messages a second). Now a presence a socket holds is stamped
 * `held: "socket"` by the server and stands as long as the socket does: the
 * client says `here` only when where it stands changes, nobody expires it
 * while the server still lists it, and a socket that closes is gone at once.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const app = defineApp({ name: "room", schema, mutations: [], version: 1 });
const sam: Principal = { kind: "human", id: "sam", name: "Sam", roles: [] };
const ana: Principal = { kind: "human", id: "ana", name: "Ana", roles: [] };

const until = async (holds: () => boolean, ms = 3000) => {
  const start = performance.now();
  while (!holds()) {
    if (performance.now() - start > ms) throw new Error("It never came true.");
    await new Promise((tick) => setTimeout(tick, 2));
  }
};

/** Sockets onto the handler, each counting what its client says, each closable as a network drops it. */
function aHost(handler: StoreHandler<typeof schema>, principal: Principal) {
  const sent: string[] = [];
  const drops: (() => void)[] = [];
  const socket = (url: string): LiveSocketLike => {
    let deliver: (text: string) => void = () => {};
    let closeServer: () => void = () => {};
    const fake = {
      readyState: 0,
      onopen: null as null | ((event: unknown) => void),
      onmessage: null as null | ((event: { data: unknown }) => void),
      onclose: null as null | ((event: { code: number; reason: string }) => void),
      onerror: null as null | ((event: unknown) => void),
      send(text: string) {
        sent.push(text);
        deliver(text);
      },
      close() {
        if (fake.readyState === 3) return;
        fake.readyState = 3;
        closeServer();
        fake.onclose?.({ code: 1006, reason: "" });
      },
    };
    drops.push(() => fake.close());
    void handler
      .connect(new Request(url.replace(/^ws/, "http"), { headers: seatHeaders(principal) }), {
        send: (text) => setTimeout(() => fake.readyState === 1 && fake.onmessage?.({ data: text }), 0),
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
  const fetch = ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof globalThis.fetch;
  return { socket, fetch, sent, said: () => sent.filter((text) => text.includes('"t":"here"')).length, drop: () => drops.at(-1)?.() };
}

const opened: RemoteStore<typeof schema>[] = [];
afterEach(() => {
  vi.useRealTimers();
  for (const remote of opened.splice(0)) remote.close();
});

const where = (who: string, stop: string): Presence => ({ participant: `human:${who}:tab`, name: who, hue: 1, stop, at: new Date().toISOString() });

describe("a socket holds presence without a heartbeat", () => {
  it("an idle socket client says nothing for a minute and stays listed, by the server and by everybody else", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: { nodes: [], edges: [] } as never, trustSeatHeaders: true });
    const samHost = aHost(handler, sam);
    const anaHost = aHost(handler, ana);
    const samRemote = await openRemote({ app, url: "http://room.example", principal: sam, live: true, pollMs: 0, socket: samHost.socket, fetch: samHost.fetch });
    const anaRemote = await openRemote({ app, url: "http://room.example", principal: ana, live: true, pollMs: 0, socket: anaHost.socket, fetch: anaHost.fetch });
    opened.push(samRemote, anaRemote);
    let anaSees: readonly Presence[] = [];
    anaRemote.presence.onWho((who) => (anaSees = who));

    samRemote.presence.here(where("sam", "/tasks"));
    await until(() => anaSees.some((one) => one.name === "Sam"));
    expect(samHost.said()).toBe(1);

    // A minute passes. The shell's heartbeat calls `here` as it always has: nothing has moved, so nothing is said.
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.now();
    for (let second = 1; second <= 60; second++) {
      vi.setSystemTime(start + second * 1000);
      samRemote.presence.here(where("sam", "/tasks"));
    }
    expect(samHost.said()).toBe(1);

    // The server still lists Sam: his socket is open.
    const who = (await (await handler.handle(new Request("http://room.example/graview/who", { headers: seatHeaders(ana) }))).json()) as { who: Presence[] };
    expect(who.who.map((one) => one.name)).toContain("Sam");
    expect(who.who.find((one) => one.name === "Sam")).toMatchObject({ held: "socket" });
    // And Ana, folding what she was told through the TTL a minute on, as the scene does, still draws him.
    const drawn = foldPresence(new Map(), anaSees, Date.now(), REMOTE_PRESENCE_TTL_MS);
    expect([...drawn.values()].map((one) => one.name)).toContain("Sam");
    vi.useRealTimers();

    // A change of place is said at once.
    samRemote.presence.here(where("sam", "/tasks/t1"));
    expect(samHost.said()).toBe(2);
    await until(() => anaSees.some((one) => one.stop === "/tasks/t1"));
  });

  it("a socket that closes is gone at once, without waiting out a time to live", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: { nodes: [], edges: [] } as never, trustSeatHeaders: true, presenceTtlMs: 600_000 });
    const samHost = aHost(handler, sam);
    const anaHost = aHost(handler, ana);
    const samRemote = await openRemote({ app, url: "http://room.example", principal: sam, live: true, pollMs: 0, socket: samHost.socket, fetch: samHost.fetch, backoff: () => 60_000 });
    const anaRemote = await openRemote({ app, url: "http://room.example", principal: ana, live: true, pollMs: 0, socket: anaHost.socket, fetch: anaHost.fetch });
    opened.push(samRemote, anaRemote);
    let anaSees: readonly Presence[] = [];
    anaRemote.presence.onWho((who) => (anaSees = who));
    samRemote.presence.here(where("sam", "/tasks"));
    await until(() => anaSees.some((one) => one.name === "Sam"));
    // The network drops Sam's socket: no `bye` is said.
    samHost.drop();
    await until(() => !anaSees.some((one) => one.name === "Sam"), 200);
  });

  it("a client whose own socket dropped lets the held ones go once it has not heard the server for a time to live", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: { nodes: [], edges: [] } as never, trustSeatHeaders: true });
    const samHost = aHost(handler, sam);
    const anaHost = aHost(handler, ana);
    const samRemote = await openRemote({ app, url: "http://room.example", principal: sam, live: true, pollMs: 0, socket: samHost.socket, fetch: samHost.fetch });
    const anaRemote = await openRemote({ app, url: "http://room.example", principal: ana, live: true, pollMs: 0, socket: anaHost.socket, fetch: anaHost.fetch, backoff: () => 600_000 });
    opened.push(samRemote, anaRemote);
    let anaSees: readonly Presence[] = [];
    anaRemote.presence.onWho((who) => (anaSees = who));
    samRemote.presence.here(where("sam", "/tasks"));
    await until(() => anaSees.some((one) => one.name === "Sam"));

    vi.useFakeTimers();
    anaHost.drop();
    vi.advanceTimersByTime(REMOTE_PRESENCE_TTL_MS - 1);
    expect(anaSees.map((one) => one.name)).toEqual(["Sam"]);
    vi.advanceTimersByTime(2);
    expect(anaSees).toEqual([]);
  });

  it("is the server's word: a client that claims `held` over HTTP is held by time like any poller", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: { nodes: [], edges: [] } as never, trustSeatHeaders: true });
    const answer = (await (
      await handler.handle(
        new Request("http://room.example/graview/here", { method: "POST", headers: { "content-type": "application/json", ...seatHeaders(sam) }, body: JSON.stringify({ presence: { ...where("sam", "/"), held: "socket" } }) }),
      )
    ).json()) as { participant: string };
    const who = (await (await handler.handle(new Request("http://room.example/graview/who", { headers: seatHeaders(ana) }))).json()) as { who: Presence[] };
    const polled = who.who.find((one) => one.participant === answer.participant);
    expect(polled).toBeDefined();
    expect(polled!.held).toBeUndefined();

    // On the protocol a hibernating host holds, the `here` a socket says comes back held.
    const protocol = liveProtocol({ store: handler.store });
    const heard: LiveServerMessage[] = [];
    const peer = { ...protocol.open(sam, "web"), send: (text: string) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await protocol.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
    const received = await protocol.receive(peer, JSON.stringify({ t: "here", presence: where("sam", "/") }));
    expect(received.presence).toMatchObject({ held: "socket", participant: peer.participant });
  });
});
