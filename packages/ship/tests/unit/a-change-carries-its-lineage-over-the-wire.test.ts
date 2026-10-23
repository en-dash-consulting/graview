import { bindSchema, createSchema, defineApp, defineNode, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, openRemote, type LivePeer, type LiveServerMessage } from "../../src/index.js";

/**
 * A CHANGE CARRIES WHAT IT WAS BASED ON OVER THE WIRE (FR-172). A call or an
 * undo may say its `lineage`, down the socket and over `POST /graview/ops`;
 * the store checks it and keeps it on the ops every client is sent, and a
 * lineage that is not one is refused with nothing kept. `openRemote` sends
 * the lineage a call was applied with.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }) });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const app = defineApp({ name: "lineage", schema, mutations: [add], version: 1 });
const tidying: Principal = { kind: "agent", id: "tidying", name: "Graview, tidying" };
const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } as never });
const sure = { basis: "Named in the email", confidence: 0.7 };

async function opened(live: ReturnType<typeof liveProtocol<typeof schema>>, heard: LiveServerMessage[]) {
  const peer: LivePeer = { ...live.open(tidying, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
  return peer;
}

describe("a change's lineage on the wire", () => {
  it("is kept from a socket's call, an undo and a POST, and sent out on the ops", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store });
    const heard: LiveServerMessage[] = [];
    const peer = await opened(live, heard);
    await live.receive(peer, JSON.stringify({ t: "call", cid: "c1", batch: "batch:tab:1", lineage: sure, calls: [{ name: "add", args: { id: "t1", label: "T1" } }] }));
    await live.post(JSON.stringify({ batch: "batch:tab:2", lineage: { basis: "Same day" }, calls: [{ name: "add", args: { id: "t2", label: "T2" } }] }), { seat: tidying, via: "api" });
    await live.receive(peer, JSON.stringify({ t: "undo", cid: "c3", batches: ["batch:tab:1"], lineage: { basis: "A duplicate", confidence: 0.9 } }));
    const [first, second, undo] = store.log.all();
    expect(first!.lineage).toEqual(sure);
    expect(second!.lineage).toEqual({ basis: "Same day" });
    expect(undo).toMatchObject({ lineage: { basis: "A duplicate", confidence: 0.9 }, undoneLineage: sure });
    expect(JSON.stringify(heard)).toContain("Named in the email");
  });

  it("keeps a key a later build says, and the judge, run and evidence, across the wire and out to every client", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store });
    const heard: LiveServerMessage[] = [];
    const peer = await opened(live, heard);
    const later = { basis: "Named in the email", actor: "links by email", run: "run:2026-10-22", evidence: ["t0"], weighedBy: { judge: "address", votes: [1, 0.5] } };
    await live.receive(peer, JSON.stringify({ t: "call", cid: "c1", batch: "batch:tab:1", lineage: later, calls: [{ name: "add", args: { id: "t1", label: "T1" } }] }));
    await live.post(JSON.stringify({ batch: "batch:tab:2", lineage: { basis: "Same day", nextYear: true }, calls: [{ name: "add", args: { id: "t2", label: "T2" } }] }), { seat: tidying, via: "api" });
    const [first, second] = store.log.all();
    expect(first!.lineage).toEqual(later);
    expect(second!.lineage).toEqual({ basis: "Same day", nextYear: true });
    const sent = heard.flatMap((message) => ("ops" in message ? (message.ops as unknown as { lineage?: unknown }[]) : []));
    expect(sent.map((op) => op.lineage)).toContainEqual(later);
  });

  it("is refused when it is not a lineage, and nothing is kept", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store });
    const heard: LiveServerMessage[] = [];
    const peer = await opened(live, heard);
    await live.receive(peer, JSON.stringify({ t: "call", cid: "c1", batch: "batch:tab:1", lineage: { basis: "x", confidence: 3 }, calls: [{ name: "add", args: { id: "t1", label: "T1" } }] }));
    const answer = await live.post(JSON.stringify({ batch: "batch:tab:2", lineage: "because", calls: [{ name: "add", args: { id: "t2", label: "T2" } }] }), { seat: tidying, via: "api" });
    expect(store.log.length).toBe(0);
    expect(heard.some((message) => message.t === "refused")).toBe(true);
    expect(answer.status).toBeGreaterThanOrEqual(400);
  });

  it("is sent by openRemote with the call it was applied with", async () => {
    const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => tidying });
    const posted: unknown[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") posted.push(JSON.parse(String(init.body)));
      return handler.handle(new Request(url, init));
    }) as typeof fetch;
    const remote = await openRemote({ app, url: "https://store.example", principal: tidying, fetch: fetcher, pollMs: 0 });
    remote.store.apply({ name: "add", args: { id: "p1", label: "P1" } }, { lineage: sure });
    await remote.settled();
    expect(posted).toMatchObject([{ lineage: sure }]);
    expect(remote.store.log.all().at(-1)!.lineage).toEqual(sure);
    remote.close();
  });
});
