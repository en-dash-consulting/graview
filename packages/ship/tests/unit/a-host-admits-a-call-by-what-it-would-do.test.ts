import { bindSchema, createSchema, defineApp, defineNode, Store, type AnySchema, type PlannedChange, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, type LimitAsked, type LivePeer, type LiveProtocol, type LiveServerMessage } from "../../src/runtime.js";

/**
 * A HOST ADMITS A CALL BY WHAT IT WOULD DO.
 *
 * A host's caps were in its own act() wrapper — Graview Cloud's "an app
 * holds at most so many records" and "an agent may remove at most 25
 * records in one call" — and `live.post` and the socket go round it, so
 * they had to move into `limit`. But `limit` is asked before a call is
 * compiled, and cannot count what the call would do: the spike rehearsed
 * every agent call on a copy of the store to count its removals. Now
 * `liveProtocol({ admit })` is asked after the calls are compiled and
 * applied, before anything is kept, with what they would do — their ops
 * and primitives, the records and links they add, remove and change, and
 * how many records the store would hold — from the store's own plan, not
 * a second rehearsal. Its answers mean what `limit`'s do: `refuse` is
 * `limit` (413 over HTTP), `retryAfter` busy, `unavailable` unavailable;
 * and whatever it answers, nothing it refused is kept, flushed or sent.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add tasks",
  creates: ["task"],
  input: z.object({ labels: z.array(z.string()) }),
  describe: (args) => `Add ${args.labels.length}`,
  apply(ctx, args) {
    for (const label of args.labels) ctx.addNode({ id: `task:${label}`, kind: "task", label });
  },
});
const clear = defineMutation("clear", {
  title: "Clear tasks",
  input: z.object({ ids: z.array(z.string()) }),
  describe: (args) => `Clear ${args.ids.length}`,
  apply(ctx, args) {
    for (const id of args.ids) ctx.removeNode(id);
  },
});
const app = defineApp({ name: "caps", schema, mutations: [add, clear], version: 1 });
const claude: Principal = { kind: "agent", id: "claude", name: "Claude" };
const seeded = (count: number) => ({ nodes: Array.from({ length: count }, (_, at) => ({ id: `task:t${at}`, kind: "task", label: `T${at}` })), edges: [] });
const hostsStore = (count = 30) => new Store<AnySchema>({ schema: schema as unknown as AnySchema, mutations: [add, clear] as never, snapshot: seeded(count) as never });
const ids = (count: number) => Array.from({ length: count }, (_, at) => `task:t${at}`);

const MAX_REMOVALS = 25;
const MAX_NODES = 31;
/** Graview Cloud's caps, as a host's admit says them. */
const cloudsCaps = (asked: LimitAsked, planned: PlannedChange) => {
  if (asked.seat.kind === "agent" && planned.removed.nodes > MAX_REMOVALS) {
    return { refuse: `That would remove ${planned.removed.nodes} records; an agent may remove at most ${MAX_REMOVALS} in one call. Ask a person to do it, or do it in smaller steps.` };
  }
  if (planned.nodesAfter > MAX_NODES) return { refuse: `This app holds ${MAX_NODES} records, the most an app may hold for now.` };
  return undefined;
};

function peerOf(live: Pick<LiveProtocol<AnySchema>, "open">, seat: Principal) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...live.open(seat, "mcp:Claude"), send: (text) => void heard.push(JSON.parse(text) as LiveServerMessage) };
  return { peer, heard };
}

describe("a host admits a call by what it would do", () => {
  it("refuses an agent's call that would remove 26 records as limit, in the host's sentence, and keeps nothing of it", async () => {
    const store = hostsStore();
    const flushed: number[] = [];
    const planned: PlannedChange[] = [];
    const live = liveProtocol({ store, admit: (asked, plan) => (planned.push(plan), cloudsCaps(asked, plan)), flush: async (ops) => void flushed.push(ops.length) });
    const told: string[] = [];
    store.subscribe(() => told.push("changed"));
    const agent = peerOf(live, claude);
    const other = peerOf(live, { kind: "human", id: "ada" });
    await live.receive(agent.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(other.peer, JSON.stringify({ t: "hello", seq: -1 }));
    const before = store.snapshot();

    const received = await live.receive(agent.peer, JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "clear", args: { ids: ids(26) } }] }));
    expect(agent.heard.at(-1)).toEqual({ t: "refused", cid: "c1", reason: "limit", sentence: "That would remove 26 records; an agent may remove at most 25 in one call. Ask a person to do it, or do it in smaller steps." });
    expect(received.landed).toBeUndefined();
    expect(store.log.length).toBe(0);
    expect(store.snapshot()).toEqual(before);
    expect(flushed).toEqual([]);
    expect(told).toEqual([]);
    live.publish(store.log.all(), [other.peer]);
    expect(other.heard.some((message) => message.t === "ops")).toBe(false);
    // What it was asked with: the store's own plan of the call.
    expect(planned[0]).toMatchObject({ removed: { nodes: 26, edges: 0 }, added: { nodes: 0, edges: 0 }, changed: { nodes: 0 }, nodesAfter: 4 });
    expect(planned[0]!.ops).toHaveLength(1);
    expect(planned[0]!.primitives.filter((primitive) => primitive.op === "remove-node")).toHaveLength(26);

    // Twenty-five is within the cap, and lands.
    await live.receive(agent.peer, JSON.stringify({ t: "call", cid: "c2", calls: [{ name: "clear", args: { ids: ids(25) } }] }));
    expect(agent.heard.at(-1)).toMatchObject({ t: "ack", cid: "c2" });
    expect(store.graph.allNodes()).toHaveLength(5);
  });

  it("refuses an add over the store's ceiling, and lets one up to it land", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store, admit: cloudsCaps });
    const ada = peerOf(live, { kind: "human", id: "ada" });
    await live.receive(ada.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(ada.peer, JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "add", args: { labels: ["a", "b"] } }] }));
    expect(ada.heard.at(-1)).toEqual({ t: "refused", cid: "c1", reason: "limit", sentence: "This app holds 31 records, the most an app may hold for now." });
    expect(store.graph.allNodes()).toHaveLength(30);
    expect(store.log.length).toBe(0);
    await live.receive(ada.peer, JSON.stringify({ t: "call", cid: "c2", calls: [{ name: "add", args: { labels: ["a"] } }] }));
    expect(ada.heard.at(-1)).toMatchObject({ t: "ack", cid: "c2" });
    expect(store.graph.allNodes()).toHaveLength(31);
  });

  it("says busy and unavailable as limit does, and keeps nothing", async () => {
    const store = hostsStore();
    let answer: ReturnType<typeof cloudsCaps> | { retryAfter: number; sentence: string } | { unavailable: string } = { retryAfter: 1200, sentence: "Slow down." };
    const live = liveProtocol({ store, admit: () => answer });
    const ada = peerOf(live, { kind: "human", id: "ada" });
    await live.receive(ada.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(ada.peer, JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "add", args: { labels: ["a"] } }] }));
    expect(ada.heard.at(-1)).toEqual({ t: "busy", cid: "c1", retryAfter: 1200, sentence: "Slow down." });
    answer = { unavailable: "Read-only while it is checked." };
    ada.peer.held = undefined;
    await live.receive(ada.peer, JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "add", args: { labels: ["a"] } }] }));
    expect(ada.heard.at(-1)).toEqual({ t: "refused", cid: "c1", reason: "unavailable", sentence: "Read-only while it is checked." });
    expect(store.log.length).toBe(0);
    expect(store.graph.allNodes()).toHaveLength(30);
  });

  it("refuses over HTTP through createStoreHandler as 413 limit, and keeps nothing", async () => {
    const handler = await createStoreHandler({ app, store: hostsStore() as never, seatOf: () => claude, admit: cloudsCaps });
    const response = await handler.handle(new Request("https://store.example/graview/ops", { method: "POST", body: JSON.stringify({ calls: [{ name: "clear", args: { ids: ids(26) } }] }) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ refused: true, reason: "limit", error: expect.stringMatching(/at most 25/) });
    expect(handler.store.log.length).toBe(0);
    expect(handler.store.graph.allNodes()).toHaveLength(30);
    await handler.close();
  });
});
