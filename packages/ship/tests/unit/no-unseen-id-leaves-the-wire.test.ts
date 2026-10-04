import { createMemoryAdapter, createSchema, defineApp, defineNode, OperationLog, Store, type AnySchema, type GraviewApp, type Operation, type Presence, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { leaked, MUTATIONS, policyOf, SCHEMA, storeOf, unseenIds, world, type World } from "../../../core/tests/support/unseen-worlds.js";
import { createStoreHandler, liveProtocol, seatHeaders, serveStore, type LivePeer, type LiveServerMessage } from "../../src/index.js";

/**
 * NO ID A SEAT MAY NOT SEE LEAVES THE WIRE (FR-55).
 *
 * The seat view served a hidden record's id in a seen record's field and
 * in a withheld op's primitives, and every surface built on it served it
 * on: the live wire's welcome, ops, acks and conflicts, and the HTTP
 * routes. Graview Cloud's property, against ship's own wire: for random
 * worlds, every message a seat is sent — as the text it is sent in — holds
 * no string that is an unseen record's id.
 */
const WORLDS = 1000;
const HOST: Principal = { kind: "system", id: "host" };

const appOf = (w: World): GraviewApp<AnySchema> =>
  defineApp({ name: "worlds", schema: SCHEMA as unknown as AnySchema, mutations: MUTATIONS as never, policy: policyOf(w), version: 1 });

/** A socket that keeps every text it is sent. */
function socket(state: ReturnType<ReturnType<typeof liveProtocol>["open"]>, heard: string[]): LivePeer {
  return Object.assign(state, { send: (text: string) => void heard.push(text) });
}

/** Everything the live wire sends this world's viewer, as text. */
async function overTheSocket(w: World): Promise<string[]> {
  const store = storeOf(w);
  const live = liveProtocol({ store, version: 1 });
  const heard: string[] = [];
  const fresh = socket(live.open(w.viewer, "web"), heard);
  const behind = socket(live.open(w.viewer, "web"), heard);
  const other = (session: string): Presence => ({ participant: `human:u9:${session}`, kind: "human", hue: 1, stop: `/a/${w.anyId()}?id=${encodeURIComponent(w.anyId())}`, over: w.anyId(), at: new Date().toISOString() });
  const who = [other("one"), other("two")];
  await live.receive(fresh, JSON.stringify({ t: "hello", protocol: 1 }), who);
  await live.receive(behind, JSON.stringify({ t: "hello", protocol: 1, seq: -1 }), who);

  // Somebody else changes things: the host, which may name anything.
  const live_ = () => store.graph.allNodes().map((node) => node.id);
  for (const call of [
    { name: "point", args: { id: w.pick(live_()), ref: w.anyId() } },
    { name: "make", args: { title: "Made", ref: w.anyId() } },
  ]) {
    try {
      const result = store.applyAll([call], { author: HOST });
      live.publish(result.ops, [fresh, behind]);
    } catch {
      // A call the store refuses changes nothing to publish.
    }
  }

  // The seat itself acts: on records it may or may not see, naming ids it may or may not see, against a stale base.
  const ids = [...w.kindOf.keys()];
  let cid = 0;
  for (let round = 0; round < 4; round++) {
    const id = w.pick(ids);
    const calls = [round % 2 === 0 ? { name: "point", args: { id, ref: w.anyId() } } : { name: "retitle", args: { id, title: `R${round}` } }];
    const base = round === 3 ? [{ node: id, field: "ref", rev: -1 }, { node: w.pick(ids), field: "title", rev: -1 }] : undefined;
    await live.receive(fresh, JSON.stringify({ t: "call", cid: `c${++cid}`, calls, ...(base ? { base } : {}) }));
  }
  await live.receive(fresh, JSON.stringify({ t: "undo", cid: `c${++cid}`, batches: [w.pick(store.log.all()).batch] }));
  live.tell([...who, other("three")], [fresh, behind]);
  return heard;
}

/** Everything the HTTP routes answer this world's viewer, as text. */
async function overHttp(w: World): Promise<string[]> {
  const store = storeOf(w);
  const handler = await createStoreHandler({ app: appOf(w), store, seatOf: () => w.viewer });
  const at = (path: string, init: RequestInit = {}) => handler.handle(new Request(`https://store.example${path}`, { ...init, headers: { "content-type": "application/json" } }));
  const post = (path: string, body: unknown) => at(path, { method: "POST", body: JSON.stringify(body) });
  const texts: string[] = [];
  const keep = async (response: Response) => void texts.push(await response.text());
  await keep(await at("/graview/state"));
  await keep(await at("/graview/since?seq=-1"));
  await keep(await at(`/graview/since?seq=${Math.floor(store.log.length / 2)}`));
  await keep(await at("/graview/export"));
  const ids = [...w.kindOf.keys()];
  for (let round = 0; round < 3; round++) {
    const id = w.pick(ids);
    await keep(await post("/graview/ops", { calls: [{ name: "point", args: { id, ref: w.anyId() } }], ...(round === 2 ? { base: [{ node: id, field: "ref", rev: -1 }] } : {}) }));
  }
  // The batch sent again is answered with what it made the first time.
  const again = { calls: [{ name: "retitle", args: { id: w.pick(ids), title: "Again" } }], batch: `again:${w.seed}` };
  await keep(await post("/graview/ops", again));
  await keep(await post("/graview/ops", again));
  await keep(await post("/graview/here", { presence: { participant: "human:u1:tab", hue: 1, stop: `/a/${w.anyId()}`, over: w.anyId(), at: "" }, seq: -1 }));
  await keep(await at("/graview/who"));
  return texts;
}

describe("no id a seat may not see leaves the wire", () => {
  it("serves Cloud's reproduction without the hidden record's id, over the socket and over HTTP", async () => {
    const pub = defineNode("pub", { fields: z.object({ title: z.string(), ref: z.string().optional() }) });
    const secret = defineNode("secret", { fields: z.object({ title: z.string() }) });
    const schema = createSchema([pub, secret]) as unknown as AnySchema;
    const policy = { grants: [], sees: [{ roles: ["viewer"], kinds: ["pub"] }] };
    const op1: Operation = {
      id: "op1",
      seq: 0,
      batch: "b1",
      author: { kind: "human", id: "u1" },
      intent: "Point P at S",
      mutation: null,
      primitives: [{ op: "patch-node", id: "pub:p1", before: { ref: "\u0000graview:unset" }, after: { ref: "secret:s1" } }],
      inverse: [],
      reads: [],
      writes: ["pub:p1"],
      at: "2026-10-02T00:00:00.000Z",
    };
    const store = new Store<AnySchema>({
      schema,
      policy,
      snapshot: { nodes: [{ id: "pub:p1", kind: "pub", title: "P", ref: "secret:s1" }, { id: "secret:s1", kind: "secret", title: "S" }], edges: [] },
      log: [op1],
    });
    const viewer: Principal = { kind: "human", id: "u2", roles: ["viewer"] };
    const heard: string[] = [];
    const live = liveProtocol({ store });
    await live.receive(socket(live.open(viewer, "web"), heard), JSON.stringify({ t: "hello" }));
    const welcome = JSON.parse(heard[0]!) as Extract<LiveServerMessage, { t: "welcome" }>;
    expect(welcome.state?.snapshot.nodes).toEqual([{ id: "pub:p1", kind: "pub", title: "P" }]);
    expect(heard.join("\n")).not.toContain("secret:s1");

    const handler = await createStoreHandler({ app: defineApp({ name: "repro", schema, policy, version: 1 }), store, seatOf: () => viewer });
    for (const path of ["/graview/state", "/graview/since?seq=-1", "/graview/export"]) {
      expect(await (await handler.handle(new Request(`https://store.example${path}`))).text(), path).not.toContain("secret:s1");
    }
  });

  it(`never sends an unseen id down the live wire — ${WORLDS.toLocaleString("en")} random worlds`, async () => {
    let messages = 0;
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed);
      const unseen = unseenIds(w);
      for (const text of await overTheSocket(w)) {
        messages++;
        // As a client receives it: parsed from the text it was sent in.
        const message = JSON.parse(text) as LiveServerMessage;
        const id = leaked(message, unseen);
        expect(id, `seed ${seed}: ${message.t} names unseen ${id}: ${text.slice(0, 400)}`).toBeUndefined();
        if (message.t === "welcome" && message.state) expect(() => OperationLog.from(message.state!.log as Operation[])).not.toThrow();
      }
    }
    expect(messages).toBeGreaterThan(WORLDS * 8);
  }, 300_000);

  it(`never answers an unseen id over HTTP — ${WORLDS.toLocaleString("en")} random worlds`, async () => {
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed);
      const unseen = unseenIds(w);
      for (const text of await overHttp(w)) {
        const id = leaked(JSON.parse(text), unseen);
        expect(id, `seed ${seed}: names unseen ${id}: ${text.slice(0, 400)}`).toBeUndefined();
      }
    }
  }, 300_000);

  it("serves `graview serve`'s store through the same view: no hidden id in what it answers", async () => {
    const pub = defineNode("pub", { fields: z.object({ title: z.string(), ref: z.string().optional() }) });
    const secret = defineNode("secret", { fields: z.object({ title: z.string() }) });
    const schema = createSchema([pub, secret]) as unknown as AnySchema;
    const app = defineApp({ name: "repro", schema, policy: { grants: [], sees: [{ roles: ["viewer"], kinds: ["pub"] }] }, version: 1 });
    const served = await serveStore({
      app,
      adapter: createMemoryAdapter(),
      seed: { nodes: [{ id: "pub:p1", kind: "pub", title: "P" }, { id: "secret:s1", kind: "secret", title: "S" }], edges: [] } as never,
      trustSeatHeaders: true,
      port: 0,
      host: "127.0.0.1",
    });
    try {
      served.store.applyPrimitives([{ op: "patch-node", id: "pub:p1", before: {}, after: { ref: "secret:s1" } }], { author: { kind: "human", id: "u1" } });
      const viewer: Principal = { kind: "human", id: "u2", roles: ["viewer"] };
      for (const path of ["/graview/state", "/graview/since?seq=-1", "/graview/export"]) {
        const text = await (await fetch(`${served.url}${path}`, { headers: seatHeaders(viewer) })).text();
        expect(text, path).toContain("pub:p1");
        expect(text, path).not.toContain("secret:s1");
      }
    } finally {
      await served.close();
    }
  });
});
