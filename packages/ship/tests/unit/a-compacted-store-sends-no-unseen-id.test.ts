import { createSchema, defineApp, defineNode, Store, type AnySchema, type GraviewApp, type Operation, type Principal } from "@graview/core";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { canonical, leaked, MUTATIONS, policyOf, rng, schemaOf, storeAt, unsaidUnseen, world, type World } from "../../../core/tests/support/unseen-worlds.js";
import { createStoreHandler, liveProtocol, type LivePeer, type LiveServerMessage } from "../../src/index.js";

/**
 * A COMPACTED STORE SENDS NO UNSEEN ID (FR-199).
 *
 * Graview Cloud opens a room compacted: the checkpoint behind its undo
 * horizon and the tail after it. That store never read the ops behind the
 * horizon, so a record made and removed there was no record to it, and a
 * field still naming one went down the wire as it stood — the hidden
 * record's id in the welcome a seat opens with and in `/graview/state`.
 * For random worlds compacted twice and reopened, what the live protocol
 * and the routes send a seat names no unseen id, and the welcome's state is
 * the one the store that was never compacted sends it.
 */
const WORLDS = 1000;

const appOf = (w: World): GraviewApp<AnySchema> => defineApp({ name: "worlds", schema: schemaOf(w), mutations: MUTATIONS as never, policy: policyOf(w), version: 1 });

/** The store as a host holds it after compacting twice: reopened from its checkpoint and tail. */
function reopened(w: World): Store<AnySchema> {
  const r = rng(w.seed * 104_729);
  const last = Math.max(2, Math.floor(w.ops.length * (0.5 + r() * 0.45)));
  const s = storeAt(w, w.ops.length);
  for (const seq of [Math.floor(last / 2), last]) {
    const checkpoint = s.checkpoint({ seq });
    if (checkpoint) s.compact(checkpoint);
  }
  return new Store<AnySchema>({ schema: schemaOf(w), mutations: MUTATIONS as never, policy: policyOf(w), log: s.log.all(), epochs: s.log.epochs() });
}

type Welcome = Extract<LiveServerMessage, { t: "welcome" }>;

/** The welcome a seat opening fresh is sent, as the client parses it. */
async function welcomeOf(store: Store<AnySchema>, seat: Principal): Promise<{ text: string; welcome: Welcome }> {
  // One key for both stores, so a withheld batch is tagged alike in each.
  const live = liveProtocol({ store, version: 1, withheldKey: "the-same-host" });
  const heard: string[] = [];
  const peer: LivePeer = Object.assign(live.open(seat, "web"), { send: (text: string) => void heard.push(text) });
  await live.receive(peer, JSON.stringify({ t: "hello", protocol: 1 }));
  const text = heard.find((one) => (JSON.parse(one) as LiveServerMessage).t === "welcome")!;
  return { text, welcome: JSON.parse(text) as Welcome };
}

describe("a compacted store sends no unseen id", () => {
  it(`sends a seat no unseen id in its welcome, its state or its export, and the welcome the never-compacted store sends — ${WORLDS.toLocaleString("en")} random worlds compacted twice and reopened`, async () => {
    const leaking: string[] = [];
    const differing: string[] = [];
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed, { required: seed % 2 === 0 });
      const opened = reopened(w);
      const unseen = unsaidUnseen(w);
      const { text, welcome } = await welcomeOf(opened, w.viewer);
      const handler = await createStoreHandler({ app: appOf(w), store: opened, seatOf: () => w.viewer });
      const routes = await Promise.all(["/graview/state", "/graview/since?seq=-1", "/graview/export"].map(async (path) => [path, await (await handler.handle(new Request(`https://store.example${path}`))).text()] as const));
      for (const [where, said] of [["welcome", text], ...routes] as const) {
        const id = leaked(JSON.parse(said), unseen);
        if (id !== undefined) leaking.push(`seed ${seed}: ${where} names unseen ${id}`);
      }
      // The same state the store that was never compacted opens the seat with: its graph, and its log from the horizon on.
      const never = (await welcomeOf(storeAt(w, w.ops.length), w.viewer)).welcome.state!;
      const state = welcome.state!;
      if (canonical(state.snapshot as never) !== canonical(never.snapshot as never)) differing.push(`seed ${seed}: the welcome's graph`);
      else if (!isDeepStrictEqual(state.log, (never.log as Operation[]).slice(opened.log.horizon))) differing.push(`seed ${seed}: the welcome's log`);
    }
    expect(leaking).toEqual([]);
    expect(differing).toEqual([]);
  }, 300_000);

  it("sends Cloud's reproduction without the seed secret removed behind the horizon", async () => {
    const pub = defineNode("pub", { fields: z.object({ title: z.string(), ref: z.string().optional() }) });
    const secret = defineNode("secret", { fields: z.object({ title: z.string() }) });
    const schema = createSchema([pub, secret]) as unknown as AnySchema;
    const policy = { grants: [{ roles: "*" as const, mutations: "*" as const }], sees: [{ roles: ["viewer"], kinds: ["pub"] }] };
    const viewer: Principal = { kind: "human", id: "u2", roles: ["viewer"] };
    const author: Principal = { kind: "human", id: "u1" };
    const store = new Store<AnySchema>({
      schema,
      policy,
      snapshot: { nodes: [{ id: "pub:p0", kind: "pub", title: "Seeded", ref: "secret:s0" }, { id: "secret:s0", kind: "secret", title: "Seeded secret" }], edges: [] } as never,
    });
    store.applyPrimitives([{ op: "remove-node", node: { id: "secret:s0", kind: "secret", title: "Seeded secret" } }], { author });
    store.applyPrimitives([{ op: "add-node", node: { id: "pub:p1", kind: "pub", title: "One" } }], { author });
    store.compact(store.checkpoint({ seq: 1 })!);
    const opened = new Store<AnySchema>({ schema, policy, log: store.log.all(), epochs: store.log.epochs() });
    const { text, welcome } = await welcomeOf(opened, viewer);
    expect(text).not.toContain("secret:s0");
    expect(welcome.state?.snapshot.nodes).toContainEqual({ id: "pub:p0", kind: "pub", title: "Seeded" });
    const handler = await createStoreHandler({ app: defineApp({ name: "repro", schema, policy, version: 1 }), store: opened, seatOf: () => viewer });
    for (const path of ["/graview/state", "/graview/since?seq=-1", "/graview/export"]) {
      expect(await (await handler.handle(new Request(`https://store.example${path}`))).text(), path).not.toContain("secret:s0");
    }
  });
});
