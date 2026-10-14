import { createSchema, defineNode, isoDate, repeatField } from "@graview/core";
import { readableFields, repeatAsRead, repeatingDateAsRead } from "@graview/core/words";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { dateFacts, kindShape } from "../../src/kind-shape.js";
import { placeEachOnCalendar } from "../../src/lens/calendar-placing.js";

/*
 * A DATE THAT REPEATS, AS A PERSON SEES IT: drawn at every occurrence the
 * calendar shows, counted once at its next, and said in words.
 */
const practice = defineNode("practice", {
  fields: z.object({ label: z.string(), startsAt: isoDate, startsAtRepeat: repeatField() }),
  label: (node) => node.label,
});
const schema = createSchema([practice]);
// Tuesdays from Sep 1, 2026, the Oct 13 one skipped.
const tuesdays = { id: "t", kind: "practice", label: "Tuesday run", startsAt: "2026-09-01", startsAtRepeat: { every: "week", except: ["2026-10-13"] } } as const;
const bindings = { practice: { start: "startsAt" } };

describe("a repeating date, drawn", () => {
  it("is an entry at each occurrence the calendar shows, marked as a repeat", () => {
    const entries = placeEachOnCalendar(tuesdays as never, bindings, schema, { from: "2026-09-28", to: "2026-11-08" });
    expect(entries.map((entry) => entry.from)).toEqual(["2026-09-29", "2026-10-06", "2026-10-20", "2026-10-27", "2026-11-03"]);
    expect(entries.every((entry) => entry.repeats && entry.id === "t")).toBe(true);
  });

  it("is one entry, its next, where the calendar is a glance; a date that does not repeat is itself", () => {
    expect(placeEachOnCalendar(tuesdays as never, bindings, schema, { next: "2026-10-21" }).map((entry) => entry.from)).toEqual(["2026-10-27"]);
    const once = { ...tuesdays, startsAtRepeat: undefined };
    expect(placeEachOnCalendar(once as never, bindings, schema, { from: "2026-08-31", to: "2026-09-30" }).map((entry) => [entry.from, entry.repeats])).toEqual([["2026-09-01", undefined]]);
  });

  it("is counted by a kind's stop at its next occurrence, and opens the stop on a calendar of this month", () => {
    expect(dateFacts(schema, "practice", [tuesdays as never], "2026-10-21")).toMatchObject({ field: "startsAt", soon: 1 });
    expect(kindShape(schema, "practice", [tuesdays as never], "2026-10-21")).toMatchObject({ shape: "calendar", start: "startsAt" });
  });

  it("is said as how it repeats and the next one, in the app's locale", () => {
    expect(repeatingDateAsRead("2026-09-01", tuesdays.startsAtRepeat, { today: "2026-10-21" })).toBe("Every Tuesday, next Oct 27");
    expect(repeatingDateAsRead("2026-09-01", tuesdays.startsAtRepeat, { today: "2026-10-21", locale: "en-GB" })).toBe("Every Tuesday, next 27 Oct");
    expect(repeatAsRead("2026-09-01T18:00", { every: "week", interval: 2, on: ["mon", "thu"], until: "2026-12-15" })).toBe("Every other Monday and Thursday at 6:00 PM, until Dec 15, 2026");
    expect(repeatAsRead("2026-01-31", { every: "month", on: [-1] })).toBe("Every month on the last day");
    expect(repeatAsRead("2026-01-22", { every: "month", interval: 3 })).toBe("Every 3 months on the 22nd");
    expect(repeatAsRead("2028-02-29", { every: "year", count: 4 })).toBe("Every year on Feb 29, 4 times");
    expect(repeatingDateAsRead("2026-09-01", { every: "week", until: "2026-09-15" }, { today: "2026-10-21" })).toBe("Every Tuesday, until Sep 15, 2026, last Sep 15");
    const [said] = readableFields(tuesdays, practice, { glance: true }).filter((field) => field.key === "startsAt");
    expect(said).toMatchObject({ stored: "2026-09-01", repeats: true });
    expect(said?.value).toMatch(/^Every Tuesday, next /);
  });
});
