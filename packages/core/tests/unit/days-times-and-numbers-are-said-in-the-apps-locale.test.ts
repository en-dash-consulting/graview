import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { describeApp } from "../../src/check.js";
import { parseTemplate } from "../../src/document/template-parse.js";
import { renderTemplate } from "../../src/document/template.js";
import {
  createSchema,
  defineApp,
  defineNode,
  dayAsRead,
  dayOfMonthAsRead,
  daysAsRead,
  localeFor,
  minutesAsRead,
  momentAsRead,
  monthAsRead,
  numberAsRead,
  sayIn,
  SCHEMES,
  timeAsRead,
  weekdayAsRead,
  weekdayName,
} from "../../src/index.js";

/**
 * DAYS, TIMES AND NUMBERS ARE SAID IN THE APP'S LOCALE (FR-178). The eighth
 * walk found "10 Sep 2023" in an app written for the United States: the
 * order was fixed in code. Now every day, time and figure is said through
 * `Intl`, en-US unless the app or its reader says otherwise, and an en-GB
 * app keeps the day first.
 */
afterEach(() => sayIn({}));

describe("said with no locale named", () => {
  it("is en-US: the month first, a twelve-hour clock, a comma between thousands", () => {
    expect(dayAsRead("2023-09-10")).toBe("Sep 10, 2023");
    expect(timeAsRead("2023-09-10T15:30")).toBe("3:30 PM");
    expect(momentAsRead("2023-09-10T15:30")).toBe("Sep 10, 2023, 3:30 PM");
    expect(numberAsRead(1250)).toBe("1,250");
    expect(minutesAsRead(15 * 60 + 30)).toBe("3:30 PM");
    expect(weekdayAsRead("2026-09-17")).toBe("Thursday, Sep 17");
    expect(dayOfMonthAsRead("2026-09-17")).toBe("Sep 17");
    expect(monthAsRead("2026-09-17")).toBe("September 2026");
    expect(weekdayName(1)).toBe("Mon");
    expect(daysAsRead('"Pay the deposit" was due 2026-08-28')).toBe('"Pay the deposit" was due Aug 28, 2026');
  });

  it("leaves what is not a day or a moment as it is", () => {
    expect(dayAsRead("soon")).toBe("soon");
    expect(momentAsRead("2026-08-28")).toBe("2026-08-28");
    expect(daysAsRead("task-2026-08-28")).toBe("task-2026-08-28");
  });
});

describe("said for en-GB", () => {
  // Britain writes September "Sept" or "Sep" by the runtime's ICU; the order is what is pinned.
  it("keeps the day first and the clock at twenty-four hours", () => {
    expect(dayAsRead("2023-09-10", "en-GB")).toMatch(/^10 Sept? 2023$/);
    expect(timeAsRead("2023-09-10T15:30", "en-GB")).toBe("15:30");
    expect(numberAsRead(1250, "en-GB")).toBe("1,250");
    expect(numberAsRead(1250, "de-DE")).toBe("1.250");
  });
});

describe("a template, a block and a description", () => {
  const kinds = new Map([["task", { fields: new Set(["due", "at", "count"]), edges: new Map() }]]) as never;
  const node = { id: "t1", kind: "task", due: "2023-09-10", at: "2023-09-10T15:30", count: 1250 } as never;

  it("say a day, a moment and a figure for en-US unless the app says", () => {
    const parts = parseTemplate("{due} · {due | date} · {at} · {count | money} · {0.44 | percent}");
    expect(renderTemplate(parts, { node, kinds, today: "2023-09-01" })).toBe("Sep 10, 2023 · Sep 10, 2023 · Sep 10, 2023, 3:30 PM · 1,250 · 44%");
    expect(renderTemplate(parts, { node, kinds, today: "2023-09-01", money: { locale: "en-GB", currency: "GBP" } })).toMatch(/^10 Sept? 2023 · 10 Sept? 2023 · 10 Sept? 2023, 15:30 · £1,250 · 44%$/);
  });

  it("describeApp says what the app's locale makes of them", () => {
    const app = defineApp({ name: "Diary", schema: createSchema([defineNode("entry", { fields: z.object({ name: z.string() }), plural: "Entries" })]) });
    expect(describeApp(app)).toContain("Days, times and numbers are written for en-US, the default: Sep 10, 2023, 3:30 PM, 1,250; money is said with no currency.");
    const british = defineApp({ ...app, brand: { name: "Diary", schemes: SCHEMES, locale: "en-GB", currency: "GBP" } });
    expect(describeApp(british)).toMatch(/Days, times and numbers are written for en-GB: 10 Sept? 2023, 15:30, 1,250; money is said in GBP \(£1,250\)\./);
  });
});

describe("whose locale", () => {
  it("is the reader's when a host passed one, over the app's", () => {
    sayIn({ reader: "en-GB", app: "en-US" });
    expect(localeFor("en-US")).toBe("en-GB");
    expect(dayAsRead("2023-09-10", "en-US")).toMatch(/^10 Sept? 2023$/);
  });

  it("is the app's drawn on the page when a value names none", () => {
    sayIn({ app: "en-GB" });
    expect(localeFor()).toBe("en-GB");
    expect(localeFor("en-US")).toBe("en-US");
  });

  it("is en-US for a tag the runtime cannot say anything in, never a thrown page", () => {
    expect(localeFor("not a locale")).toBe("en-US");
    expect(dayAsRead("2023-09-10", "not a locale")).toBe("Sep 10, 2023");
  });

  it("is the next app's when another is drawn with none", () => {
    sayIn({ reader: "en-GB" });
    sayIn({});
    expect(localeFor()).toBe("en-US");
  });
});
