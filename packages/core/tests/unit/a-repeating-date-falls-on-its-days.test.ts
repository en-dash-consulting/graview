import { describe, expect, it } from "vitest";
import { dateOn, nextOccurrence, occurrences, repeatSchema, type Repeat } from "../../src/repeat.js";
import * as z from "../../src/schema/zod.js";

/*
 * A REPEATING DATE'S DAYS are worked out from its first, never stored:
 * a weekly practice, a monthly bill, a birthday on Feb 29.
 */
describe("a repeating date", () => {
  it("falls weekly on its own weekday, or on the weekdays it names, every other week when asked", () => {
    // 2026-10-20 is a Tuesday.
    expect(occurrences("2026-10-20", { every: "week" }, { limit: 3 })).toEqual(["2026-10-20", "2026-10-27", "2026-11-03"]);
    expect(occurrences("2026-10-20", { every: "week", on: ["tue", "thu"] }, { limit: 4 })).toEqual(["2026-10-20", "2026-10-22", "2026-10-27", "2026-10-29"]);
    expect(occurrences("2026-10-20", { every: "week", interval: 2, on: ["mon", "tue"] }, { limit: 3 })).toEqual(["2026-10-20", "2026-11-02", "2026-11-03"]);
  });

  it("keeps a moment's time on the wall across a clock change, and an offset where one is written", () => {
    // The US clocks go back on 2026-11-01: a practice at six stays at six.
    expect(occurrences("2026-10-27T18:00", { every: "week" }, { limit: 2 })).toEqual(["2026-10-27T18:00", "2026-11-03T18:00"]);
    expect(occurrences("2026-10-27T22:00:00Z", { every: "week" }, { limit: 2 })).toEqual(["2026-10-27T22:00:00Z", "2026-11-03T22:00:00Z"]);
    // Europe's go back on 2026-10-25; a daily standup across it.
    expect(occurrences("2026-10-24T09:30", { every: "day" }, { limit: 3 })).toEqual(["2026-10-24T09:30", "2026-10-25T09:30", "2026-10-26T09:30"]);
  });

  it("falls monthly on the month's last day when the month is short, and on -1 always the last", () => {
    expect(occurrences("2026-01-31", { every: "month" }, { limit: 4 })).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(occurrences("2028-01-15", { every: "month", on: [15, -1] }, { limit: 4 })).toEqual(["2028-01-15", "2028-01-31", "2028-02-15", "2028-02-29"]);
    expect(occurrences("2026-11-30", { every: "month", interval: 3 }, { limit: 3 })).toEqual(["2026-11-30", "2027-02-28", "2027-05-30"]);
  });

  it("keeps Feb 29 in a leap year and falls on Feb 28 in the others", () => {
    expect(occurrences("2028-02-29", { every: "year" }, { limit: 5 })).toEqual(["2028-02-29", "2029-02-28", "2030-02-28", "2031-02-28", "2032-02-29"]);
  });

  it("stops at its until day and after its count, skipped days counted", () => {
    expect(occurrences("2026-10-20", { every: "week", until: "2026-11-10" })).toEqual(["2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"]);
    expect(occurrences("2026-10-20", { every: "week", count: 3, except: ["2026-10-27"] })).toEqual(["2026-10-20", "2026-11-03"]);
    expect(occurrences("2026-10-01", { every: "day", until: "2026-10-03" }, { from: "2026-09-01" })).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });

  it("leaves out the days it skips, and draws only the days asked for", () => {
    const practice: Repeat = { every: "week", on: ["tue"], except: ["2026-11-03"] };
    expect(occurrences("2026-10-20", practice, { from: "2026-10-28", to: "2026-11-30" })).toEqual(["2026-11-10", "2026-11-17", "2026-11-24"]);
  });

  it("reads as its next occurrence on a day, its last once ended, and as kept when it repeats nothing", () => {
    expect(nextOccurrence("2026-10-20", { every: "week" }, "2026-10-21")).toBe("2026-10-27");
    expect(nextOccurrence("2026-10-20", { every: "week" }, "2026-10-27")).toBe("2026-10-27");
    expect(nextOccurrence("2026-10-20T18:00", { every: "week", except: ["2026-10-27"] }, "2026-10-21")).toBe("2026-11-03T18:00");
    expect(nextOccurrence("2026-10-20", { every: "week", until: "2026-11-03" }, "2026-12-01")).toBe("2026-11-03");
    expect(nextOccurrence("2026-10-20", null, "2026-12-01")).toBe("2026-10-20");
    expect(dateOn({ due: "2026-01-05", dueRepeat: { every: "month" } }, "due", "2026-10-13")).toBe("2026-11-05");
  });

  it("finds a daily series begun years ago without walking it day by day", () => {
    const started = performance.now();
    for (let i = 0; i < 1000; i++) nextOccurrence("2001-01-01", { every: "day", interval: 3 }, "2026-10-13");
    expect(nextOccurrence("2001-01-01", { every: "day", interval: 3 }, "2026-10-13")).toBe("2026-10-14");
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("is refused when it is not a repeat: weekdays on a monthly one, an interval of none", () => {
    const schema = repeatSchema();
    expect(z.safeParse(schema, { every: "week", on: ["tue"] }).success).toBe(true);
    expect(z.safeParse(schema, { every: "month", on: [31, -1] }).success).toBe(true);
    expect(z.safeParse(schema, { every: "month", on: ["tue"] }).success).toBe(false);
    expect(z.safeParse(schema, { every: "week", interval: 0 }).success).toBe(false);
    expect(z.safeParse(schema, { every: "fortnight" }).success).toBe(false);
    expect(z.safeParse(schema, { every: "week", hourly: true }).success).toBe(false);
  });
});
