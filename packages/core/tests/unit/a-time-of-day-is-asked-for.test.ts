import { describe, expect, it } from "vitest";
import { z } from "zod";
import { describeArg, formFields, isoDate } from "../../src/index.js";

/**
 * A TIME OF DAY IS ASKED FOR. The gauntlet's workshops start at
 * `YYYY-MM-DDTHH:MM`, and the shape read that pattern as a plain date: every
 * face offered a date picker, the picker gave `2026-09-20`, and the act's own
 * pattern refused it — so no workshop could be made and no talk given a slot,
 * on either face, at either width, with either hand.
 */
const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "expected YYYY-MM-DDTHH:MM");

describe("a date with a time of day in it", () => {
  it("is a date that asks for the time as well", () => {
    expect(describeArg(dateTime)).toEqual({ type: "date", time: true });
    expect(describeArg(dateTime.optional())).toEqual({ type: "date", time: true });
  });

  it("and a plain date is still only a date", () => {
    expect(describeArg(isoDate)).toEqual({ type: "date" });
  });

  it("is a form field that says so", () => {
    expect(formFields(z.object({ startsAt: dateTime, day: isoDate }))).toEqual([
      { control: "date", name: "startsAt", optional: false, time: true },
      { control: "date", name: "day", optional: false },
    ]);
  });
});
