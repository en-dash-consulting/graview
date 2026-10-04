import { bindSchema, createSchema, defineApp, defineNode, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, isClientBatch, liveProtocol, SEAT_HEADERS, serverBatchIds, type LivePeer, type LiveServerMessage } from "../../src/runtime.js";

/**
 * A BATCH IS ANSWERED ONLY TO WHOEVER MADE IT.
 *
 * A call sent again under its batch is answered with the ops it made the
 * first time (FR-49), and a batch id is the client's to choose. So Bo,
 * sending a call under Ada's batch, was acked with Ada's ops and his own
 * call was never made; and a client could name a batch the host mints for
 * itself (Graview Cloud's `migration:v2`) before the host did, and own it.
 * Now a batch is answered only from the asking seat's own ops, a batch
 * that is somebody else's is refused `invalid` in words, and a client's
 * batch has a shape — what a `Store` mints, `batch:<tag>:<n>` or
 * `undo:<tag>:<n>` — that the server mints its own outside of.
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
const app = defineApp({ name: "batches", schema, mutations: [add], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const ada: Principal = { kind: "human", id: "ada", name: "Ada", roles: ["keeper"] };
const bo: Principal = { kind: "human", id: "bo", name: "Bo", roles: ["keeper"] };
const claude: Principal = { kind: "agent", id: "claude", name: "Claude", roles: ["keeper"], onBehalfOf: { kind: "human", id: "ada", roles: ["keeper"] } };
const claudeForBo: Principal = { kind: "agent", id: "claude", name: "Claude", roles: ["keeper"], onBehalfOf: { kind: "human", id: "bo", roles: ["keeper"] } };

const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } as never });

function peerOf(live: ReturnType<typeof liveProtocol<typeof schema>>, seat: Principal) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...live.open(seat, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  return { peer, heard, said: (cid: string) => heard.find((message) => "cid" in message && message.cid === cid) };
}

const call = (cid: string, batch: string | undefined, id: string) => JSON.stringify({ t: "call", cid, ...(batch ? { batch } : {}), calls: [{ name: "add", args: { id, label: id } }] });

describe("a batch is answered only to its author", () => {
  it("refuses Bo a call under Ada's batch, and makes neither his call nor a second of hers", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store, version: 1 });
    const a = peerOf(live, ada);
    const b = peerOf(live, bo);
    await live.receive(a.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(b.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(a.peer, call("a1", "batch:adatab:1", "t-ada"));
    expect(a.said("a1")).toMatchObject({ t: "ack", batch: "batch:adatab:1" });

    await live.receive(b.peer, call("b1", "batch:adatab:1", "t-bo"));
    const answer = b.said("b1");
    expect(answer).toMatchObject({ t: "refused", reason: "invalid" });
    expect((answer as { sentence: string }).sentence).toMatch(/somebody else's/);
    expect(JSON.stringify(answer)).not.toContain("t-ada");
    expect(store.graph.getNode("t-bo")).toBeUndefined();
    expect(store.log.all().filter((op) => op.batch === "batch:adatab:1")).toHaveLength(1);

    // Ada sending it again is still answered with what she made, once.
    await live.receive(a.peer, call("a1-again", "batch:adatab:1", "t-ada"));
    expect(a.said("a1-again")).toMatchObject({ t: "ack", batch: "batch:adatab:1" });
    expect(store.log.all().filter((op) => op.batch === "batch:adatab:1")).toHaveLength(1);
  });

  it("tells an agent from the same agent acting for somebody else", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store, version: 1 });
    const forAda = peerOf(live, claude);
    const forBo = peerOf(live, claudeForBo);
    await live.receive(forAda.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(forBo.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(forAda.peer, call("c1", "batch:claude1:1", "t-for-ada"));
    expect(forAda.said("c1")).toMatchObject({ t: "ack" });
    await live.receive(forBo.peer, call("c2", "batch:claude1:1", "t-for-bo"));
    expect(forBo.said("c2")).toMatchObject({ t: "refused", reason: "invalid" });
  });

  it("refuses a batch a client did not mint — a host's `migration:v2` — before anything is made", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store, version: 1 });
    const a = peerOf(live, ada);
    await live.receive(a.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(a.peer, call("m", "migration:v2", "t-claimed"));
    const answer = a.said("m");
    expect(answer).toMatchObject({ t: "refused", reason: "invalid" });
    expect((answer as { sentence: string }).sentence).toMatch(/batch:<tag>:<n>/);
    expect(store.graph.getNode("t-claimed")).toBeUndefined();
    expect(store.log.all().some((op) => op.batch === "migration:v2")).toBe(false);
  });

  it("mints a call without a batch outside the client's shape, so no client can name it first", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store, version: 1 });
    const a = peerOf(live, ada);
    await live.receive(a.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(a.peer, call("n", undefined, "t-unnamed"));
    const ack = a.said("n") as Extract<LiveServerMessage, { t: "ack" }>;
    expect(ack.t).toBe("ack");
    expect(isClientBatch(ack.batch)).toBe(false);
    // And a host's own store mints outside it too, when it asks for `serverBatchIds`.
    const minted = serverBatchIds();
    expect(isClientBatch(minted("batch"))).toBe(false);
    expect(isClientBatch(minted("undo"))).toBe(false);
    expect(isClientBatch("batch:k2j3h4m5n6p7:12")).toBe(true);
    expect(isClientBatch("undo:k2j3h4m5n6p7:3")).toBe(true);
  });

  it("over HTTP, answers the same: Bo is refused Ada's batch with a 409 and `invalid`", async () => {
    const handler = await createStoreHandler({ app, store: hostsStore(), trustSeatHeaders: true });
    const post = (seat: Principal, body: unknown) =>
      handler.handle(
        new Request("http://store/graview/ops", {
          method: "POST",
          headers: { "content-type": "application/json", [SEAT_HEADERS.seat]: seat.id!, [SEAT_HEADERS.roles]: "keeper" },
          body: JSON.stringify(body),
        }),
      );
    const first = await post(ada, { batch: "batch:adatab:1", calls: [{ name: "add", args: { id: "t-ada", label: "Ada's" } }] });
    expect(first.status).toBe(200);
    const again = await post(ada, { batch: "batch:adatab:1", calls: [{ name: "add", args: { id: "t-ada", label: "Ada's" } }] });
    expect(again.status).toBe(200);
    const stolen = await post(bo, { batch: "batch:adatab:1", calls: [{ name: "add", args: { id: "t-bo", label: "Bo's" } }] });
    expect(stolen.status).toBe(409);
    expect(await stolen.json()).toMatchObject({ refused: true, reason: "invalid" });
    const claimed = await post(bo, { batch: "migration:v2", calls: [{ name: "add", args: { id: "t-claimed", label: "Claimed" } }] });
    expect(claimed.status).toBe(409);
    expect(await claimed.json()).toMatchObject({ refused: true, reason: "invalid" });
    expect(handler.store.graph.getNode("t-bo")).toBeUndefined();
    expect(handler.store.graph.getNode("t-claimed")).toBeUndefined();
    await handler.close();
  });
});
