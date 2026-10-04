import { bindSchema, createSchema, defineApp, defineNode, REFUSAL_REASONS, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, openRemote, type LimitAnswer, type LiveServerMessage, type LiveSocketLike, type LiveSocketState, type StoreHandler } from "../../src/index.js";

/**
 * A CALL THAT LANDED IS NEVER TOLD TO WAIT; A HOST THAT CANNOT TAKE CHANGES
 * FOR A WHILE SAYS SO (FR-45, FR-46).
 *
 * The socket asked the host's `limit` before it looked whether the call had
 * already landed: a call sent again after a lost ack, into a busy room, was
 * told `busy` (or refused at a cap) for a change that was already made.
 * And a host had two words, busy with a known wait and a final `limit`,
 * for a room that is read-only for a while — Graview Cloud's quarantine —
 * so it refused, and the person's change was taken back. Now `answered`
 * comes first, and `limit` may answer `{ unavailable }`: refused with the
 * reason `unavailable`, which a client does not take back but keeps
 * pending and sends again, backing off, until the host takes it.
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
const READ_ONLY = "This app is read-only while it is checked; your change is kept and sent again shortly.";

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

describe("a call that landed is never told to wait, and unavailable is waited out", () => {
  it("answers a call sent again after it landed with its ack, however busy or capped the host is now", async () => {
    const store = hostsStore();
    let now: LimitAnswer | undefined;
    let asked = 0;
    const protocol = liveProtocol({
      store,
      limit: () => {
        asked++;
        return now;
      },
    });
    const heard: LiveServerMessage[] = [];
    const peer: LiveSocketState & { send(text: string): void } = { ...protocol.open(kim, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await protocol.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
    await protocol.receive(peer, call("c1", "batch:kimtab:1", "a"));
    expect(heard.at(-1)).toMatchObject({ t: "ack", cid: "c1" });
    expect(asked).toBe(1);
    for (const answer of [{ retryAfter: 500 }, { refuse: "Too big." }, { unavailable: READ_ONLY }] satisfies LimitAnswer[]) {
      now = answer;
      await protocol.receive(peer, call("c1", "batch:kimtab:1", "a"));
      expect(heard.at(-1)).toMatchObject({ t: "ack", cid: "c1", batch: "batch:kimtab:1" });
    }
    // The host was not asked about a change it had already taken.
    expect(asked).toBe(1);
    expect(store.log.length).toBe(1);
  });

  it("refuses with the reason `unavailable` on the socket and 503 over HTTP, and makes nothing", async () => {
    expect(REFUSAL_REASONS).toContain("unavailable");
    const store = hostsStore();
    const protocol = liveProtocol({ store, limit: () => ({ unavailable: READ_ONLY }) });
    const heard: LiveServerMessage[] = [];
    const peer: LiveSocketState & { send(text: string): void } = { ...protocol.open(kim, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await protocol.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
    await protocol.receive(peer, call("c1", "batch:kimtab:1", "a"));
    expect(heard.at(-1)).toEqual({ t: "refused", cid: "c1", reason: "unavailable", sentence: READ_ONLY });
    // Not held like busy: the next call is asked about on its own.
    expect(peer.held).toBeUndefined();
    expect(store.log.length).toBe(0);

    const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => kim, limit: () => ({ unavailable: READ_ONLY }) });
    const response = await handler.handle(new Request("https://store.example/graview/ops", { method: "POST", body: JSON.stringify({ calls: [{ name: "add", args: { id: "a", label: "A" } }] }) }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: READ_ONLY, refused: true, reason: "unavailable" });
    expect(handler.store.log.length).toBe(0);
  });

  for (const live of [true, false]) {
    it(`keeps a change through a read-only spell and lands it once the host takes changes again, in order, none refused (${live ? "socket" : "HTTP"})`, async () => {
      let readOnly = true;
      let unavailable = 0;
      let backedOff = 0;
      const handler = await createStoreHandler({
        app,
        store: hostsStore(),
        seatOf: () => kim,
        limit: () => {
          if (!readOnly) return undefined;
          unavailable++;
          return { unavailable: READ_ONLY };
        },
      });
      const remote = await openRemote({ app, url: "https://store.example", principal: kim, live, pollMs: 0, backoff: () => (backedOff++, 5), ...wired(handler) });
      const refused: string[] = [];
      remote.onRefusal((sentence) => refused.push(sentence));
      remote.store.apply({ name: "add", args: { id: "t1", label: "First" } });
      remote.store.apply({ name: "add", args: { id: "t2", label: "Second" } });
      await until(() => unavailable >= 3);
      expect(remote.pending()).toBe(2);
      // Waited out by backing off, as a reconnect is: there is no known wait to keep to.
      expect(backedOff).toBeGreaterThanOrEqual(2);
      expect(remote.status()).toBe("online");
      expect(remote.store.graph.allNodes()).toHaveLength(2);
      readOnly = false;
      await remote.settled();
      expect(refused).toEqual([]);
      expect(handler.store.log.all().map((op) => op.intent)).toEqual(["Add “First”", "Add “Second”"]);
      await until(() => remote.pending() === 0);
      remote.close();
    });
  }
});
