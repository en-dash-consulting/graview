import { bindSchema, createSchema, defineApp, defineNode, Store, WIRE_PROTOCOL, type AnySchema, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, LIVE_SUBPROTOCOL, LIVE_WIRE, liveProtocol, openRemote, type LiveProtocol, type LiveServerMessage, type LiveSocketLike, type LiveSocketState, type RemoteStatus, type RemoteStore, type StoreHandler } from "../../src/index.js";

/**
 * AN OPEN PAGE IS TOLD THE APP TAKES NO CHANGES FOR NOW (FR-66).
 *
 * A host holding an app read-only — Graview Cloud's quarantine while a
 * repair is checked — answered every write `unavailable` (FR-46), and
 * `openRemote` kept the change and sent it again, backing off, without a
 * word to the person; Cloud said why on the socket as `{ t: "error",
 * sentence }`, which `openRemote` ignores, and watched its own socket for
 * it. Now a host says it holds the app: `liveProtocol`'s `held` (the
 * handler's `hold` and `release`), told to every open socket as `{ t:
 * "held", sentence }` and `sentence: null` on release, in every welcome
 * and on every answer a poll reads. `openRemote` says it — `status()` is
 * `held`, `onHeld` hands the sentence — and a change made meanwhile waits
 * on the hold, not on the network: kept, not backed off, sent on release.
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
const app = defineApp({ name: "quarantine", schema, mutations: [add], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const kim: Principal = { kind: "human", id: "kim", name: "Kim", roles: ["keeper"] };
const HELD = "This app is read-only while it is being repaired: an entry in its history no longer applies.";

const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } as never });

const until = async (holds: () => boolean, ms = 4000) => {
  const start = Date.now();
  while (!holds()) {
    if (Date.now() - start > ms) throw new Error("It never came true.");
    await new Promise((tick) => setTimeout(tick, 2));
  }
};

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

const call = (cid: string, batch: string, id: string) => JSON.stringify({ t: "call", cid, batch, calls: [{ name: "add", args: { id, label: id } }] });
const listening = <S extends AnySchema>(protocol: LiveProtocol<S>) => {
  const heard: LiveServerMessage[] = [];
  const peer: LiveSocketState & { send(text: string): void } = { ...protocol.open(kim, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  return { heard, peer };
};

describe("an app held read-only says so to an open page", () => {
  it("tells every socket that said hello the app is held, in the host's sentence, and that it is released", async () => {
    let held: string | undefined;
    const protocol = liveProtocol({ store: hostsStore(), held: () => held });
    const open = listening(protocol);
    const silent = listening(protocol);
    await protocol.receive(open.peer, JSON.stringify({ t: "hello", seq: -1 }));
    expect(open.heard.at(-1)).not.toHaveProperty("held");

    held = HELD;
    protocol.heldChanged([open.peer, silent.peer]);
    expect(open.heard.at(-1)).toEqual({ t: "held", sentence: HELD });
    // A socket that has not said hello is told in its welcome instead.
    expect(silent.heard).toEqual([]);
    await protocol.receive(silent.peer, JSON.stringify({ t: "hello", seq: -1 }));
    expect(silent.heard.at(-1)).toMatchObject({ t: "welcome", held: HELD, protocol: WIRE_PROTOCOL, wire: LIVE_WIRE });

    held = undefined;
    protocol.heldChanged([open.peer, silent.peer]);
    expect(open.heard.at(-1)).toEqual({ t: "held", sentence: null });
    expect(silent.heard.at(-1)).toEqual({ t: "held", sentence: null });
    // Additive to the codec: its name and number stay, so an older client is still served and ignores the message.
    expect(LIVE_SUBPROTOCOL).toBe(`graview.ship.${WIRE_PROTOCOL}`);
  });

  it("refuses a call while held with `unavailable` in the hold's own sentence, before the host's limit is asked — and answers a call that already landed with its ack", async () => {
    let held: string | undefined;
    let asked = 0;
    const store = hostsStore();
    const protocol = liveProtocol({ store, held: () => held, limit: () => (asked++, undefined) });
    const { heard, peer } = listening(protocol);
    await protocol.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
    await protocol.receive(peer, call("c1", "batch:kimtab:1", "a"));
    expect(heard.at(-1)).toMatchObject({ t: "ack", cid: "c1" });
    held = HELD;
    await protocol.receive(peer, call("c1", "batch:kimtab:1", "a"));
    expect(heard.at(-1)).toMatchObject({ t: "ack", cid: "c1" });
    await protocol.receive(peer, call("c2", "batch:kimtab:2", "b"));
    expect(heard.at(-1)).toEqual({ t: "refused", cid: "c2", reason: "unavailable", sentence: HELD });
    expect(asked).toBe(1);
    expect(store.log.length).toBe(1);
  });

  it("says the hold on every answer a poll reads — the state, since, a refused post and here — and stops saying it on release", async () => {
    const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => kim });
    const ask = async (path: string, init?: RequestInit) => {
      const response = await handler.handle(new Request(`https://store.example${path}`, init));
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    };
    const post = { method: "POST", body: JSON.stringify({ calls: [{ name: "add", args: { id: "a", label: "A" } }] }) };
    const here = { method: "POST", body: JSON.stringify({ presence: { participant: "human:kim:tab", stop: "" }, seq: -1 }) };
    handler.hold(HELD);
    expect((await ask("/graview/state")).body).toMatchObject({ held: HELD });
    expect((await ask("/graview/since?seq=-1")).body).toMatchObject({ held: HELD });
    expect((await ask("/graview/here", here)).body).toMatchObject({ held: HELD });
    expect(await ask("/graview/ops", post)).toMatchObject({ status: 503, body: { error: HELD, refused: true, reason: "unavailable", held: HELD } });
    expect(handler.store.log.length).toBe(0);

    handler.release();
    for (const path of ["/graview/state", "/graview/since?seq=-1"]) expect((await ask(path)).body).not.toHaveProperty("held");
    expect(await ask("/graview/ops", post)).toMatchObject({ status: 200 });
    expect(handler.store.log.length).toBe(1);
  });

  for (const live of [true, false]) {
    it(`says the app is held to the page, keeps a change made meanwhile waiting on the hold rather than the network, and lands it on release, in order, none refused (${live ? "socket" : "HTTP"})`, async () => {
      const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => kim });
      let backedOff = 0;
      const remote = await openRemote({ app, url: "https://store.example", principal: kim, live, pollMs: live ? 0 : 5, backoff: () => (backedOff++, 5), ...wired(handler) });
      const told: (string | null)[] = [];
      const statuses: RemoteStatus[] = [];
      const refused: string[] = [];
      remote.onHeld((sentence) => told.push(sentence));
      remote.onStatus((status) => statuses.push(status));
      remote.onRefusal((sentence) => refused.push(sentence));
      expect(remote.status()).toBe("online");
      expect(remote.held()).toBeUndefined();

      handler.hold(HELD);
      if (!live) await remote.pull();
      await until(() => remote.status() === "held");
      expect(remote.held()).toBe(HELD);
      expect(told).toEqual([HELD]);

      remote.store.apply({ name: "add", args: { id: "t1", label: "First" } });
      remote.store.apply({ name: "add", args: { id: "t2", label: "Second" } });
      await new Promise((tick) => setTimeout(tick, 60));
      // Shown and pending, waiting on the hold: not backed off as if the network were down, and nothing landed.
      expect(remote.pending()).toBe(2);
      expect(remote.store.graph.allNodes()).toHaveLength(2);
      expect(backedOff).toBe(0);
      expect(handler.store.log.length).toBe(0);
      expect(remote.status()).toBe("held");

      handler.release();
      await until(() => remote.pending() === 0);
      await remote.settled();
      expect(told).toEqual([HELD, null]);
      expect(remote.held()).toBeUndefined();
      expect(remote.status()).toBe("online");
      expect(statuses).toEqual(["held", "online"]);
      expect(refused).toEqual([]);
      expect(handler.store.log.all().map((op) => op.intent)).toEqual(["Add “First”", "Add “Second”"]);
      remote.close();
    });

    it(`tells a page opened during a hold that the app is held, from the state and the welcome (${live ? "socket" : "HTTP"})`, async () => {
      const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => kim });
      handler.hold(HELD);
      const remote = await openRemote({ app, url: "https://store.example", principal: kim, live, pollMs: 0, ...wired(handler) });
      expect(remote.held()).toBe(HELD);
      expect(remote.status()).toBe("held");
      // A listener added late is told at once, as `onBuild` tells one.
      const told: (string | null)[] = [];
      remote.onHeld((sentence) => told.push(sentence));
      expect(told).toEqual([HELD]);
      remote.close();
    });
  }

  it("carries the hold and the host's listener to the store a new declaration opens, and tells it the release once", async () => {
    const appAt = (version: number) => defineApp({ ...app, version });
    const handler = await createStoreHandler({ app: appAt(1), store: hostsStore(), seatOf: () => kim });
    const first = await openRemote({ app: appAt(1), url: "https://store.example", principal: kim, live: true, pollMs: 0, resolveApp: appAt, ...wired(handler) });
    const told: (string | null)[] = [];
    first.onHeld((sentence) => told.push(sentence));
    let current: RemoteStore<AnySchema> = first as unknown as RemoteStore<AnySchema>;
    first.onDeclaration((next) => (current = next));
    handler.hold(HELD);
    await until(() => first.held() === HELD);
    await handler.declarationChanged({ app: appAt(2), store: new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: handler.store.snapshot() as never }) as unknown as Store<AnySchema> });
    await until(() => (current as unknown) !== first && current.status() === "held");
    expect(current.held()).toBe(HELD);
    handler.release();
    await until(() => current.status() === "online");
    // Told the hold once and its end once, across both stores.
    expect(told).toEqual([HELD, null]);
    current.close();
  });
});
