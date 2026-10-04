import { createSchema, defineApp, defineMutation, defineNode, Store, type Presence, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { liveProtocol, type LivePeer, type LiveServerMessage, type LiveSocketState } from "../../src/runtime.js";

/**
 * A SOCKET'S STATE FITS ITS ATTACHMENT (FR-41).
 *
 * A Durable Object keeps each socket's state in `serializeAttachment`, and
 * Cloudflare refuses one over 2,048 bytes. `LiveSocketState` held the whole
 * seat — a person with fifty roles is most of that alone — and a `cid` of
 * any length, which a busy socket keeps in `held`. Now the seat may be a
 * host's key, which `liveProtocol({ seatOf })` resolves to the principal
 * on each message; a `cid` is at most 64 characters, and a longer one is
 * refused in words. The budget: a socket's state, with a seat key, held
 * and the host's own presence beside it, stays within 1 KB — half of the
 * attachment, the rest the host's.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }) });
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const schema = createSchema([task]);
const roles = Array.from({ length: 50 }, (_, at) => `role-with-a-longish-name-${at}`);
const app = defineApp({ name: "attachment", schema, mutations: [add], policy: { roles, grants: [{ roles: ["role-with-a-longish-name-0"], mutations: "*" }] }, version: 1 });
const SEAT_KEY = "user:6b3f0c5e-9a0d-4c8e-a1f2-2f4f9d1c7e55";
const ada: Principal = { kind: "human", id: "6b3f0c5e-9a0d-4c8e-a1f2-2f4f9d1c7e55", name: "Ada Lovelace-Byron", roles };
const seats = new Map([[SEAT_KEY, ada]]);
const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } as never });
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** Who is here, as a host keeps it beside the socket's state: a long stop, a long name. */
const presence: Presence = {
  participant: `human:${ada.id}:3f9c2a71`,
  kind: "human",
  name: "Ada Lovelace-Byron",
  hue: 213,
  stop: "/task/task:the-very-long-name-of-a-catering-company-from-somewhere?tab=history&focus=quote",
  over: "task:the-very-long-name-of-a-catering-company-from-somewhere",
  at: "2026-10-03T12:00:00.000Z",
};

describe("a socket fits its attachment", () => {
  it("keeps a seat key, resolved by the host's seatOf, and is judged as the seat it names", async () => {
    const store = hostsStore();
    const asked: string[] = [];
    const live = liveProtocol({
      store,
      seatOf: (key) => {
        asked.push(key);
        return seats.get(key)!;
      },
      limit: () => ({ retryAfter: 30_000 }),
    });
    const heard: LiveServerMessage[] = [];
    const state = live.open(SEAT_KEY, "web", { build: "b3c9f1e2a4d5" });
    expect(state.seat).toBe(SEAT_KEY);
    const peer: LivePeer = { ...state, send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await live.receive(peer, JSON.stringify({ t: "hello", seq: -1, build: "b3c9f1e2a4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2" }));
    expect(heard[0]).toMatchObject({ t: "welcome", participant: expect.stringMatching(new RegExp(`^human:${ada.id}:`)) });
    await live.receive(peer, JSON.stringify({ t: "call", cid: "local-k2j3h4-1234567890-abcdefghij-0123456789-zyxwvutsrq", batch: "batch:k2j3h4m5n6p7:1234", calls: [{ name: "add", args: { id: "a", label: "A" } }] }));
    expect(heard.at(-1)).toMatchObject({ t: "busy" });
    expect(asked.every((key) => key === SEAT_KEY)).toBe(true);

    const { send: _send, ...kept } = peer;
    const attachment = { ...kept, presence };
    const size = bytes(attachment);
    // The budget: within 1 KB with a seat key, held and a presence; Cloudflare's limit is 2,048 bytes.
    expect(size).toBeLessThanOrEqual(1024);
    // The same state holding the seat itself is over the whole attachment.
    expect(bytes({ ...attachment, seat: ada })).toBeGreaterThan(2048);
    expect(JSON.parse(JSON.stringify(kept)) as LiveSocketState).toEqual(kept);
  });

  it("refuses a cid over 64 characters in words, and keeps none of it", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store, seatOf: (key) => seats.get(key)!, limit: () => ({ retryAfter: 1000 }) });
    const heard: LiveServerMessage[] = [];
    const peer: LivePeer = { ...live.open(SEAT_KEY, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
    const long = "c".repeat(65);
    await live.receive(peer, JSON.stringify({ t: "call", cid: long, calls: [{ name: "add", args: { id: "a", label: "A" } }] }));
    expect(heard.at(-1)).toEqual({ t: "refused", cid: long, reason: "invalid", sentence: expect.stringMatching(/64 characters/) });
    expect(peer.held).toBeUndefined();
    expect(store.log.length).toBe(0);
  });

  it("answers a seat key the host no longer knows by telling the socket to open again, and serves it nothing", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store, seatOf: (key) => seats.get(key) });
    const heard: LiveServerMessage[] = [];
    const peer: LivePeer = { ...live.open("user:gone", "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
    expect(heard).toEqual([{ t: "error", reopen: true, sentence: expect.stringMatching(/no longer knows/) }]);
    expect(peer.cursor).toBeUndefined();
  });
});
