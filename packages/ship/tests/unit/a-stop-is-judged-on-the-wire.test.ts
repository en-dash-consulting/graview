import { bindSchema, createSchema, defineNode, Store, type Author, type Policy, type Principal } from "@graview/core";
import { stoppedKind, suggest, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isClientBatch, liveProtocol, type LivePeer, type LiveServerMessage } from "../../src/index.js";

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
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const keeper: Principal = { kind: "human", id: "kay", name: "Kay", roles: ["keeper"] };
const reader: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };
const anonymous: Principal = { kind: "human", id: "anonymous", roles: ["reader"], shared: true };
const policy: Policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }], sees: [{ roles: "*", kinds: ["task"] }] };
const STOP = { basis: "Stop it", stopsKind: true };

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
