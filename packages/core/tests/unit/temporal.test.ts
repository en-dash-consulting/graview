import { describe, expect, it } from "vitest";
import {
  checkpointOn,
  checkpointsBetween,
  isEffectiveBetween,
  isEffectiveOn,
} from "../../src/index.js";

/**
 * When something is true, as one construct rather than two.
 *
 * A household has agreements that come into force and later lapse. A club has
 * a team picked FOR a fixture — the eleven that were true on the fourteenth,
 * not the eleven that are true now. Two domains, one question, and left alone
 * they would have become two constructs with different field names.
 */
describe("effectivity", () => {
  const agreement = { effectiveFrom: "2026-09-01", effectiveUntil: "2026-12-01" };

  it("is HALF-OPEN, so two versions never both hold on the changeover day", () => {
    /*
     * The only convention under which a thing that ends on the first and a
     * thing that starts on the first do not overlap — and getting it wrong is
     * invisible until the one day of the year it matters.
     */
    expect(isEffectiveOn(agreement, "2026-09-01")).toBe(true);
    expect(isEffectiveOn(agreement, "2026-11-30")).toBe(true);
    expect(isEffectiveOn(agreement, "2026-12-01")).toBe(false);
    expect(isEffectiveOn(agreement, "2026-08-31")).toBe(false);
  });

  it("treats an unbounded thing as always true", () => {
    expect(isEffectiveOn({}, "1999-01-01")).toBe(true);
    expect(isEffectiveOn({ effectiveFrom: "2026-01-01" }, "2030-01-01")).toBe(true);
  });

  it("answers the range question without the caller doing the arithmetic", () => {
    expect(isEffectiveBetween(agreement, "2026-08-25", "2026-09-02")).toBe(true);
    expect(isEffectiveBetween(agreement, "2026-08-01", "2026-09-01")).toBe(false);
    expect(isEffectiveBetween(agreement, "2026-12-01", "2026-12-08")).toBe(false);
  });
});

describe("checkpoints", () => {
  const season = [
    { id: "brookend", at: "2026-08-30" },
    { id: "marsden", at: "2026-09-06" },
    { id: "ashfield", at: "2026-09-13" },
  ];

  it("returns the one IN FORCE, not the one matching", () => {
    /*
     * A selection made for the sixth is still what was true on the seventh if
     * nobody has picked a new one. A lookup that returned nothing on any day
     * without its own checkpoint would make every question about a Tuesday
     * unanswerable.
     */
    expect(checkpointOn(season, "2026-09-06")?.id).toBe("marsden");
    expect(checkpointOn(season, "2026-09-09")?.id).toBe("marsden");
    expect(checkpointOn(season, "2026-09-13")?.id).toBe("ashfield");
  });

  it("has nothing to say about a day before the first one", () => {
    // Not "the earliest": there was no team then, and saying there was would
    // be an invention.
    expect(checkpointOn(season, "2026-08-01")).toBeUndefined();
  });

  it("lists a window in order, half-open like everything else here", () => {
    expect(checkpointsBetween(season, "2026-08-30", "2026-09-13").map((c) => c.id)).toEqual([
      "brookend",
      "marsden",
    ]);
  });

  it("does not care what else is on the node", () => {
    // A checkpoint is any node carrying `at`. What being selected AS OF it
    // means is the app's business; the framework guarantees one shape.
    const withExtras = [{ id: "a", at: "2026-01-01", opponent: "Someone", outcome: null }];
    expect(checkpointOn(withExtras, "2026-06-01")?.id).toBe("a");
  });
});
