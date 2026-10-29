import { describe, expect, it } from "vitest";
import { lastRunWords, runCount, type RunSaid } from "../../src/scene.js";

/*
 * A RUN SAID IN COUNTS READS AS ONE SAID IN IDS (Roadmap
 * f-workflow-runs-say-more, request workflow-run-said-takes-counts): a
 * host that keeps only how many records a run made, changed, set aside or
 * suggested hands the Scene the numbers, and the words under the workflow
 * are the same as from the ids.
 */

const NOW = "2026-11-01T16:00:00.000Z";
const FINISHED = "2026-11-01T14:00:00.000Z";
const ids = (n: number) => Array.from({ length: n }, (_, at) => `record:${at}`);

describe("a run said in counts", () => {
  it("reads as the same run said in ids, real or dry", () => {
    for (const dry of [false, true]) {
      const byIds: RunSaid = { finished: FINISHED, outcome: "ok", dry, made: ids(3), changed: ids(1), archived: [], suggested: ids(2) };
      const byCounts: RunSaid = { finished: FINISHED, outcome: "ok", dry, made: 3, changed: 1, archived: 0, suggested: 2 };
      expect(lastRunWords(byCounts, NOW)).toBe(lastRunWords(byIds, NOW));
    }
    expect(lastRunWords({ finished: FINISHED, outcome: "ok", dry: false, made: 3, changed: 1, archived: 0, suggested: 2 }, NOW)).toBe("Last ran 2 hours ago: made 3, changed 1, suggested 2");
  });

  it("says nothing new for counts of none, and may mix counts and ids", () => {
    expect(lastRunWords({ finished: FINISHED, outcome: "nothing-new", dry: false, made: 0, changed: 0, archived: 0, suggested: 0 }, NOW)).toBe("Last ran 2 hours ago: nothing new");
    expect(lastRunWords({ finished: FINISHED, outcome: "partial", dry: false, made: ids(2), changed: 4, archived: 0, suggested: [] }, NOW)).toBe("Last ran 2 hours ago: made 2, changed 4 (part of it did not run)");
  });

  it("reads a count that is no whole number above zero as none", () => {
    expect([runCount(-2), runCount(Number.NaN), runCount(2.7), runCount(["a"]), runCount(undefined)]).toEqual([0, 0, 2, 1, 0]);
  });
});
