import { createSchema, defineApp, defineMutation, defineNode, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, SEAT_HEADERS, type LivePeer, type LiveServerMessage } from "../../src/runtime.js";

/**
 * A BATCH'S TAG BELONGS TO THE FIRST SEAT THAT USED IT.
 *
 * A batch sent again is answered only with the asker's own ops — but a
 * batch id is `batch:<tag>:<n>`, and a client's tag is in every op it
 * lands, so Bo could name Ada's NEXT batch, `batch:<her tag>:<n+1>`,
 * before she did: her call then met his batch and was refused. And a held
 * store that mints its own batches in the client's shape could have its
 * next one named first, so what the host lands later joined a client's
 * batch. Now a tag belongs to the first seat that used it: a batch whose
 * tag is somebody else's, or the store's own minting tag, is refused
 * `invalid` in words, before anything lands.
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
const app = defineApp({ name: "tags", schema, mutations: [add], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const ada: Principal = { kind: "human", id: "ada", roles: ["keeper"] };
const bo: Principal = { kind: "human", id: "bo", roles: ["keeper"] };
const claude: Principal = { kind: "agent", id: "claude", roles: ["keeper"], onBehalfOf: { kind: "human", id: "ada", roles: ["keeper"] } };
const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } as never });

async function peerOf(live: ReturnType<typeof liveProtocol<typeof schema>>, seat: Principal) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...live.open(seat, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
  return { peer, said: (cid: string) => heard.find((message) => "cid" in message && message.cid === cid) };
}
const call = (cid: string, batch: string, id: string) => JSON.stringify({ t: "call", cid, batch, calls: [{ name: "add", args: { id, label: id } }] });

describe("a batch tag belongs to the first seat that used it", () => {
  it("refuses Bo Ada's next batch, so her call lands under it when she sends it", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store });
    const a = await peerOf(live, ada);
    const b = await peerOf(live, bo);
    await live.receive(a.peer, call("a1", "batch:adatab:1", "one"));
    await live.receive(b.peer, call("b1", "batch:adatab:2", "squat"));
    expect(b.said("b1")).toMatchObject({ t: "refused", reason: "invalid", sentence: expect.stringMatching(/somebody else's/) });
    expect(store.graph.getNode("squat")).toBeUndefined();
    await live.receive(a.peer, call("a2", "batch:adatab:2", "two"));
    expect(a.said("a2")).toMatchObject({ t: "ack", batch: "batch:adatab:2" });
    // An undo under her tag is hers too.
    await live.receive(b.peer, JSON.stringify({ t: "undo", cid: "b2", batch: "undo:adatab:3", batches: ["batch:adatab:1"] }));
    expect(b.said("b2")).toMatchObject({ t: "refused", reason: "invalid" });
  });

  it("tells Claude for Ada from Ada, and keeps the tag through a host that wakes", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store });
    const a = await peerOf(live, ada);
    await live.receive(a.peer, call("a1", "batch:adatab:1", "one"));
    const woken = liveProtocol({ store });
    const c = await peerOf(woken, claude);
    await woken.receive(c.peer, call("c1", "batch:adatab:2", "two"));
    expect(c.said("c1")).toMatchObject({ t: "refused", reason: "invalid" });
  });

  it("refuses a batch under the store's own minting tag, so what the host lands later is never in a client's batch", async () => {
    const store = hostsStore();
    expect(store.batchTag).toMatch(/^[0-9a-z]+$/);
    const live = liveProtocol({ store });
    const b = await peerOf(live, bo);
    await live.receive(b.peer, call("b1", `batch:${store.batchTag}:1`, "squat"));
    expect(b.said("b1")).toMatchObject({ t: "refused", reason: "invalid", sentence: expect.stringMatching(/server's own/) });
    // The host's own land is in a batch no client was let name.
    const landed = store.apply({ name: "add", args: { id: "host", label: "Host" } }, { author: claude });
    expect(landed.batch).toBe(`batch:${store.batchTag}:1`);
    expect(store.log.all().filter((op) => op.batch === landed.batch)).toHaveLength(1);
    // A store that mints its own way has no such tag.
    expect(new Store({ schema, mutations: [add], snapshot: { nodes: [], edges: [] } as never, batchIds: (kind) => `served:${kind}:x:1` }).batchTag).toBeUndefined();
  });

  it("refuses the same over HTTP", async () => {
    const handler = await createStoreHandler({ app, store: hostsStore(), trustSeatHeaders: true });
    const post = (seat: Principal, batch: string, id: string) =>
      handler.handle(new Request("http://store/graview/ops", { method: "POST", headers: { [SEAT_HEADERS.seat]: seat.id!, [SEAT_HEADERS.roles]: "keeper" }, body: JSON.stringify({ batch, calls: [{ name: "add", args: { id, label: id } }] }) }));
    expect((await post(ada, "batch:adatab:1", "one")).status).toBe(200);
    const squatted = await post(bo, "batch:adatab:2", "squat");
    expect(squatted.status).toBe(409);
    expect(await squatted.json()).toMatchObject({ reason: "invalid" });
    expect((await post(ada, "batch:adatab:2", "two")).status).toBe(200);
    await handler.close();
  });
});
