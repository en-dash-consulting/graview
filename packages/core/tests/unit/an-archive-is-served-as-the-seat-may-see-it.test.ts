import { describe, expect, it } from "vitest";
import { z } from "zod";
import "../../src/field-sight.js";
import { createSchema, defineNode, isWithheld, logSeenBy, OperationLog, Store, type AnySchema, type Epoch, type LogArchive, type Operation, type Principal } from "../../src/index.js";
import type { HistoryHost } from "../../src/history.js";
import { askArchived, pastAt } from "../../src/past.js";
import { archivedSeenBy } from "../../src/seat.js";
import { canonical, fold, leaked, MUTATIONS, policyOf, rng, schemaOf, storeAt, unsaidUnseen, world } from "../support/unseen-worlds.js";

/**
 * THE ARCHIVE IS SERVED AS THE SEAT MAY SEE IT (FR-198).
 *
 * A host answering `HistoryHost.archived(from, to)` for a seat had to judge
 * the slice over a store rebuilt from the whole history — a compacted
 * store's own seat view does not know a record made and removed behind its
 * horizon, and would serve its id — and had no way to hand the seat an
 * epoch judged for it, so every seat in an app with sights folded the past
 * from seq 0. `archivedSeenBy(store, archive, seat, { from, to })` answers
 * with the ops and the epochs both judged for the seat: the property, for
 * any graph, history, compaction, sights and seat, is that no string that
 * is an unseen record's id is anywhere in the answer, the ops are the ones
 * the seat of the never-compacted store is served, and each epoch is the
 * graph those ops fold to at its seq — so playback from it draws only what
 * the seat may see.
 */
const WORLDS = 1000;
const CHUNK = 8;

/** The store as a host holds it after compacting at each of `at`, reopened from its checkpoint and tail, and what the compactions archived, together. */
function compacted(w: ReturnType<typeof world>, at: readonly number[]): { opened: Store<AnySchema>; archive: LogArchive } {
  const s = storeAt(w, w.ops.length);
  const archives: LogArchive[] = [];
  for (const seq of at) {
    const checkpoint = s.checkpoint({ seq });
    if (checkpoint) archives.push(s.compact(checkpoint));
  }
  const opened = new Store<AnySchema>({ schema: schemaOf(w), mutations: MUTATIONS as never, policy: policyOf(w), log: s.log.all(), epochs: s.log.epochs() });
  return { opened, archive: { ops: archives.flatMap((one) => one.ops), epochs: archives.flatMap((one) => one.epochs) } };
}

describe("an archive is served as the seat may see it", () => {
  it(`names no unseen id in the ops or the epochs of any range, serves the ops the whole store serves, and each epoch is what they fold to — ${WORLDS.toLocaleString("en")} random compacted worlds`, () => {
    let behind = 0;
    let epochs = 0;
    let withheld = 0;
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed, { required: seed % 2 === 0 });
      const schema = schemaOf(w);
      const r = rng(seed * 104_729);
      const n = w.ops.length;
      const last = Math.max(2, Math.floor(n * (0.5 + r() * 0.45)));
      const { opened, archive } = compacted(w, [Math.floor(last / 2), last]);
      const horizon = opened.log.horizon;
      expect(horizon, `seed ${seed}`).toBeGreaterThan(0);
      // The whole store, never compacted: what the seat is served of it is the judgment to meet.
      const served = logSeenBy(storeAt(w, n), w.viewer);
      const unseen = unsaidUnseen(w);
      // The generator reached what a compacted store cannot judge alone: an unseen record made and removed behind the horizon, named in the archive.
      const removedBehind = new Set(archive.ops.flatMap((op) => op.primitives.flatMap((p) => (p.op === "remove-node" ? [p.node.id] : []))));
      if (unseen.some((id) => removedBehind.has(id) && leaked(archive, [id]))) behind++;

      for (let from = 0; from < horizon; from += CHUNK) {
        const to = Math.min(from + CHUNK, horizon);
        const answer = archivedSeenBy(opened, archive, w.viewer, { from, to });
        const id = leaked(answer, unseen);
        expect(id, `seed ${seed}, [${from}, ${to}) names unseen ${id}`).toBeUndefined();
        expect(answer.ops.map((op) => op.seq), `seed ${seed}, [${from}, ${to})`).toEqual(Array.from({ length: to - from }, (_, at) => from + at));
        expect(answer.ops, `seed ${seed}, [${from}, ${to})`).toEqual(served.slice(from, to));
        withheld += answer.ops.filter(isWithheld).length;
        for (const epoch of answer.epochs) {
          expect(epoch.seq).toBeGreaterThanOrEqual(from);
          expect(epoch.seq).toBeLessThan(to);
          let folded: ReturnType<typeof fold>;
          try {
            folded = fold(schema, served.slice(0, epoch.seq));
          } catch (error) {
            throw new Error(`seed ${seed}, epoch ${epoch.seq}: ${(error as Error).message}`);
          }
          expect(canonical(epoch.base), `seed ${seed}, epoch ${epoch.seq} is what the seat's ops fold to there`).toBe(canonical(folded));
          // And the ops after it fold onto it, as a client playing back from it does, to the present the seat is served.
          expect(canonical(fold(schema, served.slice(epoch.seq), epoch.base)), `seed ${seed}, from epoch ${epoch.seq}`).toBe(canonical(storeAt(w, n).seenBy(w.viewer).snapshot()));
          // Who made what, only for the records the epoch serves, when anything is kept from the seat.
          const shown = new Set(epoch.base.nodes.map((node) => node.id));
          if (w.sights) for (const made of Object.keys(epoch.creators ?? {})) expect(shown.has(made), `seed ${seed}: epoch ${epoch.seq} names the maker of ${made}`).toBe(true);
          epochs++;
        }
      }
      // A range past the archive is the store's own ops, judged the same way; a full range is a log a client takes.
      const all = archivedSeenBy(opened, archive, w.viewer, { from: 0, to: opened.log.length });
      expect(all.ops).toEqual(served);
      expect(() => OperationLog.from(all.ops)).not.toThrow();
    }
    expect(behind).toBeGreaterThan(WORLDS / 10);
    expect(epochs).toBeGreaterThan(WORLDS / 2);
    expect(withheld).toBeGreaterThan(1000);
  }, 300_000);

  /*
   * EVERY SIGHT, NOT ONLY A KIND: a relation's sight (`via`) shows a giver
   * the match they give and not one they do not, a field's sight (`hide`)
   * keeps a phone number off every card, and a card naming a match made and
   * removed behind the horizon is served without the name. The store is
   * opened from its checkpoint and tail, as a host holds it.
   */
  it("judges a via sight, a hidden field and a record made and removed behind the horizon, in the ops and the epochs", () => {
    const person = defineNode("person", { fields: z.object({ name: z.string() }) });
    const match = defineNode("match", { fields: z.object({ title: z.string() }), edges: { givenBy: { to: ["person"], cardinality: "many" } } });
    const card = defineNode("card", { fields: z.object({ title: z.string(), phone: z.string().optional(), ref: z.string().optional() }) });
    const schema = createSchema([person, match, card]) as unknown as AnySchema;
    const policy = {
      grants: [],
      sees: [
        { roles: ["giver"], kinds: ["person", "card"], hide: ["phone"] },
        { roles: ["giver"], kinds: ["match"], via: "givenBy" },
      ],
    };
    const ann: Principal = { kind: "human", id: "person:ann", roles: ["giver"] };
    const host: Principal = { kind: "human", id: "u1" };
    const store = new Store<AnySchema>({ schema, policy });
    const steps = [
      [{ op: "add-node", node: { id: "person:ann", kind: "person", name: "Ann" } }, { op: "add-node", node: { id: "person:bob", kind: "person", name: "Bob" } }],
      [
        { op: "add-node", node: { id: "match:mine", kind: "match", title: "Ann gives" } },
        { op: "add-edge", edge: { kind: "givenBy", from: "match:mine", to: "person:ann" } },
        { op: "add-node", node: { id: "match:bobs-secret", kind: "match", title: "Bob gives" } },
        { op: "add-edge", edge: { kind: "givenBy", from: "match:bobs-secret", to: "person:bob" } },
      ],
      [{ op: "add-node", node: { id: "card:c1", kind: "card", title: "C", phone: "555-0100-SECRET", ref: "match:bobs-secret" } }],
      [{ op: "patch-node", id: "card:c1", before: { title: "C" }, after: { title: "Card" } }],
      [{ op: "remove-edge", edge: { kind: "givenBy", from: "match:bobs-secret", to: "person:bob" } }, { op: "remove-node", node: { id: "match:bobs-secret", kind: "match", title: "Bob gives" } }],
      [{ op: "patch-node", id: "card:c1", before: { phone: "555-0100-SECRET" }, after: { phone: "555-0199-SECRET" } }],
      [{ op: "add-node", node: { id: "card:c2", kind: "card", title: "D" } }],
    ] as const;
    for (const primitives of steps) store.applyPrimitives(primitives as never, { author: host });
    const archives = [store.compact(store.checkpoint({ seq: 3 })!), store.compact(store.checkpoint({ seq: 6 })!)];
    const archive = { ops: archives.flatMap((one) => one.ops), epochs: archives.flatMap((one) => one.epochs) };
    const opened = new Store<AnySchema>({ schema, policy, log: store.log.all(), epochs: store.log.epochs() });

    const answer = archivedSeenBy(opened, archive, ann, { from: 0, to: 6 });
    const text = JSON.stringify(answer);
    for (const kept of ["match:bobs-secret", "Bob gives", "555-0100-SECRET", "555-0199-SECRET"]) expect(text).not.toContain(kept);
    expect(answer.ops.map((op) => op.seq)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(answer.epochs.map((epoch) => epoch.seq)).toEqual([3]);
    const [epoch] = answer.epochs;
    expect(new Set(epoch!.base.nodes)).toEqual(
      new Set([
        { id: "person:ann", kind: "person", name: "Ann" },
        { id: "person:bob", kind: "person", name: "Bob" },
        { id: "match:mine", kind: "match", title: "Ann gives" },
        { id: "card:c1", kind: "card", title: "C" },
      ]),
    );
    expect(epoch!.base.edges).toEqual([{ kind: "givenBy", from: "match:mine", to: "person:ann" }]);
    // The epoch is what the seat's ops fold to there, and the rest fold on from it.
    expect(canonical(fold(schema, answer.ops.slice(0, 3)))).toBe(canonical(epoch!.base));
    expect(canonical(fold(schema, answer.ops.slice(3), epoch!.base))).toBe(canonical(fold(schema, answer.ops)));
  });

  it("refuses an archive with a gap behind the horizon, rather than judge what the gap held by nothing", () => {
    const w = world(7);
    const { opened, archive } = compacted(w, [Math.floor(w.ops.length / 2)]);
    const gapped = { ops: archive.ops.filter((op) => op.seq !== 1), epochs: archive.epochs };
    expect(() => archivedSeenBy(opened, gapped, w.viewer, { from: 0, to: 4 })).toThrow(/missing the change at seq 1/);
    expect(() => archivedSeenBy(opened, archive, w.viewer, { from: 4, to: 2 })).toThrow(RangeError);
  });

  /*
   * PLAYBACK OVER IT. A seat that may not see one kind scrubs a compacted
   * app to seq 1: the host answers `archived` with `archivedSeenBy`, the
   * page holds only what the seat is served, and the moment is folded from
   * the seed's epoch the archive handed — drawing the seat's records as
   * they stood, and nothing it may not see anywhere it was handed.
   */
  it("lets a seat with a hidden kind scrub a compacted app to seq 1 from the epochs it is served", async () => {
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
    store.applyPrimitives([{ op: "add-node", node: { id: "secret:s1", kind: "secret", title: "Hidden" } }, { op: "add-node", node: { id: "pub:p1", kind: "pub", title: "One", ref: "secret:s1" } }], { author });
    store.applyPrimitives([{ op: "patch-node", id: "pub:p1", before: { title: "One" }, after: { title: "One, renamed" } }], { author });
    store.applyPrimitives([{ op: "remove-node", node: { id: "secret:s1", kind: "secret", title: "Hidden" } }, { op: "remove-node", node: { id: "secret:s0", kind: "secret", title: "Seeded secret" } }], { author });
    store.applyPrimitives([{ op: "patch-node", id: "pub:p1", before: { ref: "secret:s1" }, after: { ref: "pub:p0" } }], { author });
    store.applyPrimitives([{ op: "add-node", node: { id: "pub:p2", kind: "pub", title: "Two" } }], { author });
    const archive = store.compact(store.checkpoint({ seq: 4 })!);
    expect(archive.epochs.map((epoch) => epoch.seq)).toEqual([0]);
    const opened = new Store<AnySchema>({ schema, policy, log: store.log.all(), epochs: store.log.epochs() });

    // What the host hands the seat's page: the archive judged for it, a range at a time.
    const handed: unknown[] = [];
    const asked: [number, number][] = [];
    const hostOf: HistoryHost = {
      archived: async (from, to) => {
        asked.push([from, to]);
        const answer = archivedSeenBy(opened, archive, viewer, { from, to });
        handed.push(answer);
        return answer;
      },
    };
    // The seat's page holds only what it is served: its view's graph and tail, from the checkpoint it is served.
    const view = opened.seenBy(viewer);
    const page = new Store<AnySchema>({ schema, log: view.log.all() as Operation[], epochs: view.log.epochs() as Epoch[], snapshot: view.snapshot() });
    for (let turn = 0; turn < 10; turn++) {
      const answer = askArchived(page, 1, hostOf);
      if (!answer) break;
      if (!("waiting" in answer)) throw new Error("refused" in answer ? answer.refused : "before what the archive keeps");
      await answer.waiting;
    }
    const past = pastAt(page, 1, hostOf);
    // Folded from the seed's epoch, served to the seat without the hidden record or the field that named it.
    expect(past.past).toMatchObject({ seq: 1, foldedFrom: 0, folded: 1 });
    expect(new Set(past.graph.snapshot().nodes)).toEqual(
      new Set([
        { id: "pub:p0", kind: "pub", title: "Seeded" },
        { id: "pub:p1", kind: "pub", title: "One" },
      ]),
    );
    expect(asked).toEqual([[0, 4]]);
    const text = JSON.stringify({ handed, past: past.graph.snapshot(), log: past.log.all() });
    for (const kept of ["secret:s0", "secret:s1", "Hidden", "Seeded secret"]) expect(text).not.toContain(kept);
    // Every moment behind the horizon is drawn as the seat's served log folds to it. (From the horizon on, the page draws from the checkpoint its live view serves.)
    const served = logSeenBy(new Store<AnySchema>({ schema, policy, log: [...archive.ops, ...store.log.all()], epochs: [{ seq: 0, base: seed as never }], snapshot: store.graph.snapshot() }), viewer);
    for (let seq = 0; seq < 4; seq++) {
      expect(askArchived(page, seq, hostOf)).toBeUndefined();
      expect(canonical(pastAt(page, seq, hostOf).graph.snapshot()), `seq ${seq}`).toBe(canonical(fold(schema, served.slice(0, seq), (handed[0] as { epochs: Epoch[] }).epochs[0]!.base)));
    }
  });
});
