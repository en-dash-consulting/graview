import { bindSchema, createSchema, defineApp, defineNode, Store, type Author, type Policy, type Principal } from "@graview/core";
import { stoppedKind, stoppedSuggestions, suggest, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, isClientBatch, liveProtocol, openRemote, type LivePeer, type LiveServerMessage, type LiveSocketLike } from "../../src/index.js";

/**
 * "DON'T SUGGEST THIS KIND OF THING" CROSSES THE WIRE AS AN UNDO WITH A
 * LINEAGE, AS A CLIENT SAYS IT (Roadmap f-inbox-needs-you-first; the review of
 * #537). So the host's store judges it: a no-role reader and a signed-out seat
 * can neither stop a kind by naming the batch nor lift one.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), note: z.string().optional() }), label: (node) => node.label });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const touch = defineMutation("touch", { title: "Touch", subject: { kinds: ["task"], arg: "id" }, writes: ["label"], input: z.object({ id: z.string() }), apply(ctx, args) { ctx.patchNode(args.id, { label: "Touched" }); } });
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true, tidying: true };
const keeper: Principal = { kind: "human", id: "kay", name: "Kay", roles: ["keeper"] };
const reader: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };
const anonymous: Principal = { kind: "human", id: "anonymous", roles: ["reader"], shared: true };
const policy: Policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }], sees: [{ roles: "*", kinds: ["task"] }] };
const STOP = { basis: "Stop it", stopsKind: true as const };

function hosted() {
  const store = new Store({ schema, mutations: [touch], policy, snapshot: { nodes: [{ id: "a", kind: "task", label: "A" }, { id: "b", kind: "task", label: "B" }], edges: [] } as never });
  const made = suggest(store, [{ name: "edit-task", args: { id: "a", note: "typo" } }], { author: actor, lineage: { basis: "It reads better" } })!;
  return { store, made, live: liveProtocol({ store }) };
}

async function seated(live: ReturnType<typeof hosted>["live"], seat: Principal) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...live.open(seat, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
  return { peer, heard };
}

describe("a stop said over the wire", () => {
  it("is refused from a no-role reader and from a signed-out seat, and nothing is kept", async () => {
    for (const seat of [reader, anonymous]) {
      const { store, made, live } = hosted();
      const { peer, heard } = await seated(live, seat);
      await live.receive(peer, JSON.stringify({ t: "undo", cid: "u1", batches: [made.batch], lineage: STOP }));
      expect(JSON.stringify(heard)).toMatch(/"ok":false|refus|rejected|"t":"nack"/i);
      expect(suggestions(store)).toHaveLength(1);
      expect(stoppedKind(store, made.suggests!)).toBeUndefined();
    }
  });

  it("is kept from whoever may decide it", async () => {
    const { store, made, live } = hosted();
    const { peer } = await seated(live, keeper);
    await live.receive(peer, JSON.stringify({ t: "undo", cid: "u1", batches: [made.batch], intent: "Stopped suggesting changes", lineage: STOP }));
    expect(suggestions(store)).toEqual([]);
    expect(stoppedKind(store, made.suggests!)).toBeDefined();
  });

  it("cannot be lifted by a reader or a signed-out seat, and can by whoever may decide it", async () => {
    const { store, made, live } = hosted();
    const stopper = await seated(live, keeper);
    await live.receive(stopper.peer, JSON.stringify({ t: "undo", cid: "u1", batch: "undo:kay:1", batches: [made.batch], lineage: STOP }));
    const stop = store.log.all().at(-1)!;
    for (const [at, seat] of [reader, anonymous].entries()) {
      const { peer } = await seated(live, seat);
      await live.receive(peer, JSON.stringify({ t: "undo", cid: `u${at + 2}`, batches: [stop.batch] }));
      expect(stoppedKind(store, made.suggests!)).toBeDefined();
    }
    await live.receive(stopper.peer, JSON.stringify({ t: "undo", cid: "u9", batches: [stop.batch] }));
    expect(stoppedKind(store, made.suggests!)).toBeUndefined();
  });

  it("can be lifted over the wire after a checkpoint archived it", async () => {
    const { store, made, live } = hosted();
    const stopper = await seated(live, keeper);
    await live.receive(stopper.peer, JSON.stringify({ t: "undo", cid: "u1", batches: [made.batch], lineage: STOP }));
    const stop = store.log.all().at(-1)!;
    store.apply({ name: "touch", args: { id: "b" } }, { author: keeper });
    store.apply({ name: "edit-task", args: { id: "b", note: "x" } }, { author: keeper });
    store.compact(store.checkpoint({ keepOps: 1, keepDays: 0 })!);
    expect(store.log.get(stop.id)).toBeUndefined();
    expect(stoppedKind(store, made.suggests!)).toBeDefined();
    const again = await seated(live, reader);
    await live.receive(again.peer, JSON.stringify({ t: "undo", cid: "u2", batches: [stop.batch] }));
    expect(stoppedKind(store, made.suggests!)).toBeDefined();
    await live.receive(stopper.peer, JSON.stringify({ t: "undo", cid: "u3", batches: [stop.batch] }));
    expect(stoppedKind(store, made.suggests!)).toBeUndefined();
  });
});

describe("a template's example batch", () => {
  it("is not an id a client may name, in Cloud's form or the command line's", () => {
    expect(isClientBatch("examples")).toBe(false);
    expect(isClientBatch("examples:vendor-shortlist:abc")).toBe(false);
  });
});

describe("a lineage only the store writes", () => {
  it("is refused over a POST, and the keeper may still undo the change", async () => {
    const { store, live } = hosted();
    const answer = await live.post(JSON.stringify({ batch: "batch:tab:9", lineage: { basis: "x", liftedStop: true }, calls: [{ name: "touch", args: { id: "b" } }] }), { seat: keeper, via: "api" });
    expect(answer.status).toBeGreaterThanOrEqual(400);
    expect(store.log.all().some((op) => op.batch === "batch:tab:9")).toBe(false);
  });
});

describe("what a host says of the stops a page does not hold", () => {
  function stoppedAndGone() {
    const { store, made } = hosted();
    const stop = store.undo(made.batch, { author: keeper, intent: "Stopped suggesting changes to the note of tasks", lineage: STOP });
    for (const label of ["One", "Two", "Three"]) store.apply({ name: "edit-task", args: { id: "b", note: label } }, { author: keeper });
    return { store, made, stop, live: liveProtocol({ store, openTail: 1 }) };
  }

  it("is on the state and the welcome, for a seat that may lift it", async () => {
    const { live, stop } = stoppedAndGone();
    const state = live.state({ seat: keeper, via: "web" } as never) as unknown as { body: { log: { batch: string }[]; stops?: { batch: string; words: string }[] } };
    expect(state.body.log.some((op) => op.batch === stop.batch)).toBe(false);
    expect(state.body.stops?.map((one) => [one.batch, one.words])).toEqual([[stop.batch, "Stopped suggesting changes to the note of tasks"]]);
    const { heard } = await seated(live, keeper);
    const welcome = heard.find((message) => message.t === "welcome") as unknown as { stops?: { batch: string }[] };
    expect(welcome.stops?.map((one) => one.batch)).toEqual([stop.batch]);
  });

  it("gives a seat that may not lift it no words and no batch", async () => {
    const { live } = stoppedAndGone();
    const state = live.state({ seat: reader, via: "web" } as never) as unknown as { body: { stops?: unknown[] } };
    expect(state.body.stops ?? []).toEqual([]);
  });

  it("is absent where nothing is stopped: an older client reads nothing new", () => {
    const { live } = hosted();
    const state = live.state({ seat: keeper, via: "web" } as never) as unknown as { body: Record<string, unknown> };
    expect("stops" in state.body).toBe(false);
    expect("stoppedKinds" in state.body).toBe(false);
  });

  it("tells a seat kept from a stop's record only the kind of a suggestion it holds", () => {
    const secret = createSchema([task, defineNode("secret", { fields: z.object({ label: z.string() }), label: (node) => node.label })]);
    const sees: Policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }], sees: [{ roles: ["keeper"], kinds: ["task", "secret"] }, { roles: ["reader"], kinds: ["task"] }] };
    const store = new Store({ schema: secret, policy: sees, snapshot: { nodes: [{ id: "a", kind: "task", label: "A" }, { id: "s", kind: "secret", label: "Layoffs" }], edges: [] } as never });
    const seen = suggest(store, [{ name: "edit-task", args: { id: "a", note: "n" } }], { author: actor, lineage: { basis: "b" } })!;
    const hidden = suggest(store, [{ name: "edit-secret", args: { id: "s", label: "Layoffs, final" } }], { author: actor, lineage: { basis: "b" } })!;
    store.undo(hidden.batch, { author: keeper, intent: "Stopped suggesting changes to the name of secrets", lineage: STOP });
    const live = liveProtocol({ store });
    const told = JSON.stringify((live.state({ seat: reader, via: "web" } as never) as unknown as { body: unknown }).body);
    expect(told).not.toMatch(/Layoffs|Stopped suggesting|edit-secret/);
    expect(seen).toBeDefined();
  });
});

describe("a page whose log no longer holds a stop", () => {
  it("lists it from what the host said, and lifts it through the host", async () => {
    const app = defineApp({ name: "stops", schema, mutations: [touch], policy, version: 1 });
    const { store, made } = hosted();
    const stop = store.undo(made.batch, { author: keeper, intent: "Stopped suggesting changes to the note of tasks", lineage: STOP });
    for (const label of ["One", "Two", "Three"]) store.apply({ name: "edit-task", args: { id: "b", note: label } }, { author: keeper });
    const handler = await createStoreHandler({ app, store, seatOf: () => keeper, openTail: 1 } as never);
    const fetcher = (async (url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
    const remote = await openRemote({ app, url: "https://store.example", principal: keeper, fetch: fetcher, pollMs: 0 });
    expect(remote.store.log.all().some((op) => op.batch === stop.batch)).toBe(false);
    expect(stoppedSuggestions(remote.store, keeper).map((one) => one.words)).toEqual(["Stopped suggesting changes to the note of tasks"]);
    expect(remote.store.mayUndo(stop.batch, keeper).ok).toBe(true);
    remote.store.undo(stop.batch, { author: keeper });
    await remote.settled();
    expect(stoppedKind(store, made.suggests!)).toBeUndefined();
    expect(stoppedSuggestions(remote.store, keeper)).toEqual([]);
    remote.close();
  });
});

describe("a page and a stop, after a lift", () => {
  const app = defineApp({ name: "stops", schema, mutations: [touch], policy, version: 1 });
  /** With `tail`, a page that holds only the last op; else one that holds the whole log, the stop and the suggestion among it. */
  async function pageOn({ tail = false, socket }: { readonly tail?: boolean; readonly socket?: () => LiveSocketLike } = {}) {
    const { store, made } = hosted();
    const stop = store.undo(made.batch, { author: keeper, intent: "Stopped suggesting changes to the note of tasks", lineage: STOP });
    for (const note of ["One", "Two", "Three"]) store.apply({ name: "edit-task", args: { id: "b", note } }, { author: keeper });
    const handler = await createStoreHandler({ app, store, seatOf: () => keeper, ...(tail ? { openTail: 1 } : {}) } as never);
    const fetcher = (async (url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
    const remote = await openRemote({ app, url: "https://store.example", principal: keeper, fetch: fetcher, pollMs: 0, ...(socket ? { live: true, openTimeoutMs: 30, socket } : {}) });
    return { store, made, stop, remote };
  }

  it("sees its own Suggest again in its tray, and a second press is not offered", async () => {
    const { store, stop, remote } = await pageOn();
    expect(suggestions(remote.store, keeper)).toEqual([]);
    remote.store.undo(stop.batch, { author: keeper });
    await remote.settled();
    expect(suggestions(store)).toHaveLength(1);
    expect(suggestions(remote.store, keeper)).toHaveLength(1);
    expect(stoppedSuggestions(remote.store, keeper)).toEqual([]);
    await remote.pull();
    expect(suggestions(remote.store, keeper)).toHaveLength(1);
    expect(stoppedSuggestions(remote.store, keeper)).toEqual([]);
  });

  it("hears another page's lift when it next asks", async () => {
    const { store, stop, remote } = await pageOn();
    expect(suggestions(remote.store, keeper)).toEqual([]);
    store.undo(stop.batch, { author: keeper });
    await remote.pull();
    expect(suggestions(store)).toHaveLength(1);
    expect(suggestions(remote.store, keeper)).toHaveLength(1);
    expect(stoppedSuggestions(remote.store, keeper)).toEqual([]);
  });

  it("no longer lists a stop its log never held, once another page lifts it", async () => {
    const { store, stop, remote } = await pageOn({ tail: true });
    expect(stoppedSuggestions(remote.store, keeper).map((one) => one.batch)).toEqual([stop.batch]);
    store.undo(stop.batch, { author: keeper });
    await remote.pull();
    expect(stoppedSuggestions(remote.store, keeper)).toEqual([]);
  });

  it("hears another page's lift on its socket", async () => {
    let fake: (LiveSocketLike & { readyState: number }) | undefined;
    const socket = (): LiveSocketLike => {
      fake = { readyState: 0, onopen: null, onmessage: null, onclose: null, onerror: null, send: () => {}, close() {} } as never;
      setTimeout(() => {
        fake!.readyState = 1;
        fake!.onopen?.({});
      }, 0);
      return fake!;
    };
    const { store, stop, remote } = await pageOn({ socket });
    await new Promise((done) => setTimeout(done, 10));
    expect(suggestions(remote.store, keeper)).toEqual([]);
    const lifted = store.undo(stop.batch, { author: keeper });
    fake!.onmessage?.({ data: JSON.stringify({ t: "ops", seq: "x", ops: lifted.ops }) } as never);
    await remote.settled();
    await new Promise((done) => setTimeout(done, 10));
    expect(suggestions(remote.store, keeper)).toHaveLength(1);
    expect(stoppedSuggestions(remote.store, keeper)).toEqual([]);
    remote.close();
  });

  it("asks the host nothing of stops when a poll brings no ops", () => {
    const { store, made } = hosted();
    store.undo(made.batch, { author: keeper, lineage: STOP });
    const live = liveProtocol({ store });
    const head = store.log.all().at(-1)!.seq;
    const quiet = live.since(head, { seat: keeper, via: "web" } as never) as unknown as { body: Record<string, unknown> };
    expect("stops" in quiet.body).toBe(false);
    const moved = live.since(head - 1, { seat: keeper, via: "web" } as never) as unknown as { body: Record<string, unknown> };
    expect("stops" in moved.body).toBe(true);
  });
});
