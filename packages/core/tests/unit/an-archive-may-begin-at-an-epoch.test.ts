import { describe, expect, it } from "vitest";
import "../../src/field-sight.js";
import { logSeenBy, Store, type AnySchema, type Epoch, type LogArchive } from "../../src/index.js";
import { archivedSeenBy, archiveFrom } from "../../src/seat.js";
import { canonical, fold, leaked, MUTATIONS, policyOf, rng, schemaOf, storeAt, unsaidUnseen, world } from "../support/unseen-worlds.js";

/**
 * AN ARCHIVE MAY BEGIN AT AN EPOCH (FR-214). `archivedSeenBy` judged a
 * seat's view of the archive over the whole history from seq 0, and threw
 * when any early change was gone — so a host could not delete what lies
 * behind a plan's window without breaking playback inside it. Now a host
 * makes an epoch at any seq of the whole history (`archiveFrom`), which
 * keeps what was removed and who wrote what behind it (FR-199), deletes
 * what lies behind it, and keeps the one epoch: a seat's view of every
 * range after it is judged as the whole archive's was, a range before it
 * is answered with where the archive begins (`keptFrom`) rather than
 * refused, and the epoch made from it later is the one the whole archive
 * makes — so a checkpoint written before FR-199 is mended from it too.
 */
const WORLDS = 300;
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

/** An epoch without what only the store judges by, for comparing two made the same way. */
const judged = (epoch: Epoch | undefined) => epoch && { seq: epoch.seq, base: canonical(epoch.base), creators: epoch.creators ?? {}, removed: epoch.removed, writers: epoch.writers ?? {} };

describe("an archive may begin at an epoch", () => {
  it(`serves a seat every range after the epoch as the whole archive does, names no unseen id, and answers a range before it with where it begins — ${WORLDS} random compacted worlds`, () => {
    let windows = 0;
    let stopped = 0;
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed, { required: seed % 2 === 0 });
      const schema = schemaOf(w);
      const r = rng(seed * 7919);
      const n = w.ops.length;
      const last = Math.max(3, Math.floor(n * (0.5 + r() * 0.45)));
      const { opened, archive } = compacted(w, [Math.floor(last / 2), last]);
      const horizon = opened.log.horizon;
      // The plan's window begins somewhere behind the horizon: everything before it goes, and the epoch made there stays.
      const window = archiveFrom(opened, archive, 1 + Math.floor(r() * (horizon - 1)));
      const begins = window.epochs[0]!;
      expect(begins.seq, `seed ${seed}`).toBeLessThanOrEqual(horizon);
      expect(begins.removed, `seed ${seed}: the epoch keeps what was removed behind it`).toBeDefined();
      expect(window.ops.every((op) => op.seq >= begins.seq && op.seq < horizon)).toBe(true);
      expect(window.epochs.every((epoch) => epoch.seq >= begins.seq && epoch.seq < horizon)).toBe(true);
      const served = logSeenBy(storeAt(w, n), w.viewer);
      const unseen = unsaidUnseen(w);
      for (let from = 0; from < horizon; from += CHUNK) {
        const to = Math.min(from + CHUNK, horizon);
        const answer = archivedSeenBy(opened, window, w.viewer, { from, to });
        expect(leaked(answer, unseen), `seed ${seed}, [${from}, ${to})`).toBeUndefined();
        const wholly = archivedSeenBy(opened, archive, w.viewer, { from, to });
        // From the epoch on, the ops the whole archive serves, each in its place; before it, none, and where the archive begins.
        expect(answer.ops, `seed ${seed}, [${from}, ${to})`).toEqual(wholly.ops.filter((op) => op.seq >= begins.seq));
        expect(answer.ops).toEqual(served.slice(Math.max(from, begins.seq), to));
        if (from < begins.seq) expect(answer.keptFrom, `seed ${seed}, [${from}, ${to})`).toBe(begins.seq);
        else expect(answer.keptFrom).toBeUndefined();
        for (const epoch of answer.epochs) {
          expect(epoch.seq).toBeGreaterThanOrEqual(Math.max(from, begins.seq));
          // Each epoch is what the seat's ops fold to there, the epoch the archive begins at included.
          expect(canonical(epoch.base), `seed ${seed}, epoch ${epoch.seq}`).toBe(canonical(fold(schema, served.slice(0, epoch.seq))));
        }
        if (begins.seq >= from && begins.seq < to) expect(answer.epochs.map((epoch) => epoch.seq)).toContain(begins.seq);
      }
      // An earlier checkpoint kept behind the window is a stop the seat is served on its own, judged as a store opened on it judges.
      const stops = archive.epochs.filter((epoch) => epoch.seq > 0 && epoch.seq < begins.seq && epoch.removed !== undefined);
      if (stops.length > 0) {
        const answer = archivedSeenBy(opened, { ops: window.ops, epochs: [...stops, ...window.epochs] }, w.viewer, { from: 0, to: begins.seq });
        expect(answer.ops).toEqual([]);
        expect(answer.keptFrom).toBe(begins.seq);
        expect(answer.epochs.map((epoch) => epoch.seq)).toEqual(stops.map((epoch) => epoch.seq));
        expect(leaked(answer, unseen), `seed ${seed}, the stops behind the window`).toBeUndefined();
        for (const epoch of answer.epochs) expect(canonical(epoch.base), `seed ${seed}, stop ${epoch.seq}`).toBe(canonical(fold(schema, served.slice(0, epoch.seq))));
        stopped++;
      }
      // The epoch made later from the window is the one the whole archive makes there.
      const later = begins.seq + Math.floor(r() * (horizon - begins.seq + 1));
      expect(judged(archiveFrom(opened, window, later).epochs[0]), `seed ${seed}, at ${later}`).toEqual(judged(archiveFrom(opened, archive, later).epochs[0]));
      windows++;
    }
    expect(windows).toBe(WORLDS);
    expect(stopped).toBeGreaterThan(WORLDS / 10);
  }, 300_000);

  it("mends a checkpoint written before it kept what was removed, from an archive that begins at an epoch", () => {
    const w = world(11);
    const { opened, archive } = compacted(w, [Math.floor(w.ops.length / 3), Math.floor((w.ops.length * 2) / 3)]);
    const horizon = opened.log.horizon;
    const window = archiveFrom(opened, archive, Math.floor(horizon / 2));
    // The store as an older build left it: its checkpoint without `removed` and `writers`.
    const checkpoint = opened.log.epochs().find((epoch) => epoch.horizon)!;
    const { removed: _removed, writers: _writers, ...older } = checkpoint;
    const aged = new Store<AnySchema>({ schema: schemaOf(w), mutations: MUTATIONS as never, policy: policyOf(w), log: opened.log.all(), epochs: [older, ...opened.log.epochs().filter((epoch) => epoch.seq > horizon)] });
    const mended = archiveFrom(aged, window, horizon);
    expect(mended.ops).toEqual([]);
    expect(judged(mended.epochs[0])).toEqual(judged(checkpoint));
  });

  it("is made at seq 0 of a whole archive with nothing removed behind it, and refused before the epoch an archive begins at", () => {
    const w = world(23);
    const { opened, archive } = compacted(w, [Math.floor(w.ops.length / 2)]);
    const start = archiveFrom(opened, archive, 0);
    expect(start.epochs[0]).toMatchObject({ seq: 0, removed: {} });
    expect(start.ops).toEqual(archive.ops);
    const window = archiveFrom(opened, archive, opened.log.horizon - 1);
    expect(window.epochs[0]!.seq).toBeGreaterThan(0);
    expect(() => archiveFrom(opened, window, window.epochs[0]!.seq - 1)).toThrow(/begins at seq/);
    expect(() => archiveFrom(opened, archive, opened.log.horizon + 1)).toThrow(RangeError);
  });

  it("still refuses an archive with a gap and no epoch after it that keeps what was removed", () => {
    const w = world(7);
    const { opened, archive } = compacted(w, [Math.floor(w.ops.length / 2)]);
    const gapped = { ops: archive.ops.filter((op) => op.seq !== 1), epochs: archive.epochs.map(({ removed: _removed, ...epoch }) => epoch) };
    expect(() => archivedSeenBy(opened, gapped, w.viewer, { from: 0, to: 4 })).toThrow(/missing the change at seq 1/);
  });
});
