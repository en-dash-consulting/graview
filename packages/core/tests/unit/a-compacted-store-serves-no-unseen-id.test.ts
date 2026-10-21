import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import "../../src/field-sight.js";
import { createSchema, defineNode, logSeenBy, Store, type AnySchema, type Epoch, type Principal } from "../../src/index.js";
import { canonical, leaked, MUTATIONS, policyOf, rng, schemaOf, storeAt, unsaidUnseen, world, type World } from "../support/unseen-worlds.js";

/**
 * A COMPACTED STORE SERVES NO UNSEEN ID (FR-199).
 *
 * A store opened compacted — a checkpoint and the tail after it, as a host
 * holds one after `store.compact` — never read the ops behind its horizon,
 * so a record made and removed there was, to it, no record at all: a field
 * still naming it was served as it stood to a seat that may not see its
 * kind, the hidden record's id (minted from its label) with it. The
 * checkpoint now keeps the kind of every record behind it that its graph
 * does not hold, and the store judges from that as it would from the whole
 * log. The property, for any graph, history, two compactions, sights and
 * seat: the seat's live view of the reopened store names no unseen id in
 * its graph, its log or its epochs, and is the view the never-compacted
 * store serves the seat.
 */
const WORLDS = 1000;

/** The store as a host holds it after compacting at each of `at`: reopened from its checkpoint and tail. */
function reopened(w: World, at: readonly number[], keep: (epoch: Epoch) => Epoch = (epoch) => epoch): Store<AnySchema> {
  const s = storeAt(w, w.ops.length);
  for (const seq of at) {
    const checkpoint = s.checkpoint({ seq });
    if (checkpoint) s.compact(checkpoint);
  }
  return new Store<AnySchema>({ schema: schemaOf(w), mutations: MUTATIONS as never, policy: policyOf(w), log: s.log.all(), epochs: s.log.epochs().map(keep) });
}

/** The places two compactions go in a world's history. */
function compactions(w: World): number[] {
  const r = rng(w.seed * 104_729);
  const last = Math.max(2, Math.floor(w.ops.length * (0.5 + r() * 0.45)));
  return [Math.floor(last / 2), last];
}

/** A checkpoint as a build before FR-199 wrote it: without the kinds of the records behind it. */
const asWrittenBefore = (epoch: Epoch): Epoch => {
  const { removed: _removed, writers: _writers, ...rest } = epoch;
  return rest;
};

describe("a compacted store serves no unseen id", () => {
  it(`names no unseen id in a seat's graph, log or epochs, and serves the seat what the never-compacted store does — ${WORLDS.toLocaleString("en")} random worlds compacted twice and reopened`, () => {
    const leaking: string[] = [];
    const differing: string[] = [];
    let removedBehind = 0;
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed, { required: seed % 2 === 0 });
      const opened = reopened(w, compactions(w));
      const horizon = opened.log.horizon;
      expect(horizon, `seed ${seed}`).toBeGreaterThan(0);
      const whole = storeAt(w, w.ops.length);
      const unseen = unsaidUnseen(w);
      // The generator reached what this is about: an unseen record made and removed behind the horizon.
      if (unseen.some((id) => w.ops.slice(0, horizon).some((op) => op.primitives.some((p) => p.op === "remove-node" && p.node.id === id)))) removedBehind++;

      const view = opened.seenBy(w.viewer);
      const served = { snapshot: view.snapshot(), log: logSeenBy(opened, w.viewer), viewLog: view.log.all(), epochs: view.log.epochs(), checkpoint: view.log.lastEpoch() };
      const id = leaked(served, unseen);
      if (id !== undefined) leaking.push(`seed ${seed} serves unseen ${id}`);
      // What a seat kept from anything is served of an epoch is its graph and its makers: never the store's own record of what was behind it.
      if (w.sights) for (const epoch of served.epochs) for (const kept of ["removed", "writers"]) expect(Object.keys(epoch), `seed ${seed}`).not.toContain(kept);
      // The same view the never-compacted store serves the seat: its graph, and its log from the horizon on.
      if (canonical(served.snapshot) !== canonical(whole.seenBy(w.viewer).snapshot())) differing.push(`seed ${seed}: the seat's graph`);
      else if (!isDeepStrictEqual(served.log, logSeenBy(whole, w.viewer).slice(horizon))) differing.push(`seed ${seed}: the seat's log`);
    }
    expect(leaking).toEqual([]);
    expect(differing).toEqual([]);
    expect(removedBehind).toBeGreaterThan(WORLDS / 10);
  }, 300_000);

  it(`serves no unseen id from a checkpoint written before it kept the kinds behind it — ${WORLDS.toLocaleString("en")} random worlds — by taking an id it cannot place as one the seat may not see`, () => {
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed, { required: seed % 2 === 0 });
      const opened = reopened(w, compactions(w), asWrittenBefore);
      const view = opened.seenBy(w.viewer);
      const id = leaked({ snapshot: view.snapshot(), log: logSeenBy(opened, w.viewer), epochs: view.log.epochs() }, unsaidUnseen(w));
      expect(id, `seed ${seed}: the reopened store serves unseen ${id}`).toBeUndefined();
    }
  }, 300_000);

  /*
   * MENDING AN OLD CHECKPOINT: a host that holds the archive opens the
   * whole history once, takes the checkpoint again at the same seq, and
   * stores it in place of the old one — the same graph, now with what was
   * behind it — and the reopened store serves every seat what the store
   * that was never compacted does.
   */
  it(`mends a checkpoint written before it by taking it again over the archive — ${WORLDS.toLocaleString("en")} random worlds`, () => {
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed, { required: seed % 2 === 0 });
      const s = storeAt(w, w.ops.length);
      const archived = compactions(w).flatMap((seq) => {
        const checkpoint = s.checkpoint({ seq });
        return checkpoint ? s.compact(checkpoint).ops : [];
      });
      const [old, ...after] = s.log.epochs().map(asWrittenBefore);
      const whole = new Store<AnySchema>({ schema: schemaOf(w), mutations: MUTATIONS as never, policy: policyOf(w), log: [...archived, ...s.log.all()], snapshot: s.graph.snapshot() });
      const mended = whole.checkpoint({ seq: old!.seq })!;
      expect(canonical(mended.base), `seed ${seed}: the same graph`).toBe(canonical(old!.base));
      const opened = new Store<AnySchema>({ schema: schemaOf(w), mutations: MUTATIONS as never, policy: policyOf(w), log: s.log.all(), epochs: [mended, ...after] });
      const never = storeAt(w, w.ops.length);
      expect(canonical(opened.seenBy(w.viewer).snapshot()), `seed ${seed}: the seat's graph`).toBe(canonical(never.seenBy(w.viewer).snapshot()));
      expect(isDeepStrictEqual(logSeenBy(opened, w.viewer), logSeenBy(never, w.viewer).slice(opened.log.horizon)), `seed ${seed}: the seat's log`).toBe(true);
    }
  }, 300_000);

  /*
   * THE REPRODUCTION: a seed `secret` removed behind the horizon, still
   * named by a `pub` the seat sees. Reopened, the store served the seat
   * `pub:p0.ref = "secret:s0"`; now it serves `pub:p0` without the field,
   * as the store that was never compacted does — and a checkpoint compacted
   * again from the reopened store still knows it.
   */
  it("serves a pub without the field naming a seed secret removed behind the horizon, reopened and compacted again", () => {
    const pub = defineNode("pub", { fields: z.object({ title: z.string(), ref: z.string().optional() }) });
    const secret = defineNode("secret", { fields: z.object({ title: z.string() }) });
    const schema = createSchema([pub, secret]) as unknown as AnySchema;
    const policy = { grants: [{ roles: "*" as const, mutations: "*" as const }], sees: [{ roles: ["viewer"], kinds: ["pub"] }] };
    const viewer: Principal = { kind: "human", id: "u2", roles: ["viewer"] };
    const author: Principal = { kind: "human", id: "u1" };
    const seed = {
      nodes: [
        { id: "pub:p0", kind: "pub", title: "Seeded", ref: "secret:s0" },
        { id: "secret:s0", kind: "secret", title: "Seeded secret" },
      ],
      edges: [],
    };
    const store = new Store<AnySchema>({ schema, policy, snapshot: seed as never });
    store.applyPrimitives([{ op: "remove-node", node: { id: "secret:s0", kind: "secret", title: "Seeded secret" } }], { author });
    store.applyPrimitives([{ op: "patch-node", id: "pub:p0", before: { title: "Seeded" }, after: { title: "Seeded, renamed" } }], { author });
    store.applyPrimitives([{ op: "add-node", node: { id: "pub:p1", kind: "pub", title: "One" } }], { author });
    const never = new Store<AnySchema>({ schema, policy, log: store.log.all(), epochs: store.log.epochs(), snapshot: store.graph.snapshot() });
    store.compact(store.checkpoint({ seq: 2 })!);
    const opened = new Store<AnySchema>({ schema, policy, log: store.log.all(), epochs: store.log.epochs() });
    expect(opened.log.horizon).toBe(2);
    const served = opened.seenBy(viewer).snapshot();
    expect(JSON.stringify(served)).not.toContain("secret:s0");
    expect(served.nodes).toContainEqual({ id: "pub:p0", kind: "pub", title: "Seeded, renamed" });
    expect(canonical(served)).toBe(canonical(never.seenBy(viewer).snapshot()));
    // The store itself still holds the field: only what the seat is served goes without it.
    expect(opened.graph.getNode("pub:p0")).toMatchObject({ ref: "secret:s0" });

    // Compacted again from the reopened store, and reopened: the kind it never read an op for is still known.
    opened.compact(opened.checkpoint({ seq: 3 })!);
    const again = new Store<AnySchema>({ schema, policy, log: opened.log.all(), epochs: opened.log.epochs() });
    expect(JSON.stringify(again.seenBy(viewer).snapshot())).not.toContain("secret:s0");
    expect(JSON.stringify(again.seenBy(viewer).log.epochs())).not.toContain("secret:s0");
  });
});
