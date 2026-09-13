import { createSchema, defineMutation, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actThatMoves,
  addDays,
  addMonths,
  CalendarBindingError,
  createCalendarLens,
  dayOf,
  daysBetween,
  entriesOn,
  minutesOf,
  placeOnCalendar,
  spanOf,
  startOfWeek,
} from "../../src/index.js";

/**
 * THE CALENDAR, over real dates.
 *
 * The timeline binds minutes of a day in named columns, which is a week grid
 * and nothing more: it cannot say "due on the 14th of next month", or draw a
 * planting sown in March and harvested in July. This is the arithmetic that
 * makes the difference, and all of it is on strings in UTC — mixing
 * `new Date("2026-09-14")` (midnight UTC) with `new Date(2026, 8, 14)`
 * (midnight wherever the reader is) puts an entry on the 13th for half the
 * world.
 */

const task = defineNode("task", {
  fields: z.object({
    label: z.string().min(1),
    due: z.string().optional(),
    until: z.string().optional(),
    done: z.boolean(),
  }),
  plural: "Tasks",
  label: (node) => node.label,
});
const undated = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([task, undated]);
const bindings = { task: { start: "due", end: "until", done: "done", label: "label" } };

const node = (id: string, fields: Record<string, unknown>) =>
  ({ id, kind: "task", done: false, ...fields }) as never;

describe("reading a date off a field", () => {
  it("takes the day from a date or a date-time, and the minutes only from a time", () => {
    expect(dayOf("2026-09-14")).toBe("2026-09-14");
    expect(dayOf("2026-09-14T09:30")).toBe("2026-09-14");
    expect(dayOf("not a date")).toBeNull();
    expect(dayOf(undefined)).toBeNull();
    expect(minutesOf("2026-09-14T09:30")).toBe(570);
    expect(minutesOf("2026-09-14")).toBeNull();
  });
});

describe("date arithmetic that does not depend on where the reader is", () => {
  it("steps days across a month and a year boundary", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(daysBetween("2026-09-01", "2026-10-01")).toBe(30);
  });

  it("clamps a month step to the last day rather than spilling into the next", () => {
    // 31 January plus a month is 28 February, not 3 March, which is what a
    // naive setMonth gives you and what every calendar bug report is about.
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-09-14", 1)).toBe("2026-10-14");
  });

  it("starts a week on the day the app says", () => {
    // 2026-09-14 is a Monday.
    expect(startOfWeek("2026-09-16", 1)).toBe("2026-09-14");
    expect(startOfWeek("2026-09-16", 0)).toBe("2026-09-13");
  });
});

describe("placing a node on the calendar", () => {
  it("places a dated node and leaves an undated one alone", () => {
    const placed = placeOnCalendar(node("t1", { label: "Book it", due: "2026-09-14" }), bindings, schema)!;
    expect(placed).toMatchObject({ id: "t1", from: "2026-09-14", to: "2026-09-14", allDay: true, at: null });
    // A task with no due date is ordinary data, not a mistake.
    expect(placeOnCalendar(node("t2", { label: "Someday" }), bindings, schema)).toBeNull();
    // A kind nobody bound is simply not this lens's business.
    expect(placeOnCalendar({ id: "n1", kind: "note", label: "x" } as never, bindings, schema)).toBeNull();
  });

  it("reads a time off a date-time, and a span off an end", () => {
    const timed = placeOnCalendar(node("t3", { label: "Call", due: "2026-09-14T09:30" }), bindings, schema)!;
    expect(timed).toMatchObject({ at: 570, allDay: false });
    const span = placeOnCalendar(
      node("t4", { label: "Move", due: "2026-09-14", until: "2026-09-17" }),
      bindings,
      schema,
    )!;
    expect(span).toMatchObject({ from: "2026-09-14", to: "2026-09-17" });
  });

  it("treats an end before its start as a typo rather than a span running backwards", () => {
    const span = placeOnCalendar(
      node("t5", { label: "Odd", due: "2026-09-14", until: "2026-09-01" }),
      bindings,
      schema,
    )!;
    expect(span.to).toBe("2026-09-14");
  });

  it("throws only when the DECLARATION is wrong, never for missing data", () => {
    expect(() => placeOnCalendar(node("t6", { label: "x", due: "2026-09-14" }), { task: {} as never }, schema)).toThrow(
      CalendarBindingError,
    );
  });
});

describe("what is on a day", () => {
  const lens = createCalendarLens({ bindings, today: "2026-09-14" });
  const entries = lens.place(
    [
      node("span", { label: "Move house", due: "2026-09-14", until: "2026-09-17" }),
      node("timed", { label: "Call the bank", due: "2026-09-15T14:00" }),
      node("early", { label: "Post it", due: "2026-09-15T09:00" }),
      node("allday", { label: "Holiday", due: "2026-09-15" }),
      node("elsewhere", { label: "Later", due: "2026-10-02" }),
    ],
    schema,
  );

  it("draws a multi-day span on every day it covers", () => {
    for (const day of ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17"]) {
      expect(entriesOn(entries, day).map((entry) => entry.id)).toContain("span");
    }
    expect(entriesOn(entries, "2026-09-18").map((entry) => entry.id)).not.toContain("span");
  });

  it("puts all-day entries first and then times in order", () => {
    expect(entriesOn(entries, "2026-09-15").map((entry) => entry.id)).toEqual([
      "allday",
      "span",
      "early",
      "timed",
    ]);
  });
});

describe("the range a stop names", () => {
  it("covers six weeks of a month grid, starting on the app's own first day", () => {
    const month = spanOf("month", "2026-09-14", 1);
    expect(month.days).toHaveLength(42);
    expect(month.days[0]).toBe("2026-08-31");
    expect(month.title).toBe("September 2026");
  });

  it("covers exactly the week, the day, and six weeks forward for an agenda", () => {
    expect(spanOf("week", "2026-09-16", 1).days).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
    expect(spanOf("day", "2026-09-16").days).toEqual(["2026-09-16"]);
    expect(spanOf("agenda", "2026-09-16").days).toHaveLength(42);
  });
});

/**
 * MOVING A DATE IS AN ACT, found in the declaration rather than named in
 * the lens. A calendar you cannot drag in is a picture of a schedule; a
 * calendar that invented its own edit would be a second way of changing the
 * graph, which is the one thing this framework does not have.
 */
describe("the act that moves a date", () => {
  const moved = defineNode("job", {
    fields: z.object({ label: z.string().min(1), on: z.string(), done: z.boolean() }),
    plural: "Jobs",
    label: (node) => node.label,
  });
  const jobs = createSchema([moved]);
  const reschedule = defineMutation("reschedule", {
    title: "Move the date",
    description: "Change when a job is due.",
    subject: { kinds: ["job"], arg: "jobId" },
    writes: ["on"],
    input: z.object({ jobId: nodeRef(["job"]), on: z.string().min(1) }),
    apply(ctx, args) {
      ctx.patchNode(args.jobId, { on: args.on });
    },
  });
  const finish = defineMutation("finish", {
    title: "Finish it",
    description: "Marks a job done.",
    subject: { kinds: ["job"], arg: "jobId" },
    writes: ["done"],
    input: z.object({ jobId: nodeRef(["job"]) }),
    apply(ctx, args) {
      ctx.patchNode(args.jobId, { done: true });
    },
  });

  const store = (mutations: Parameters<typeof Store<typeof jobs>>[0]["mutations"]) =>
    new Store<typeof jobs>({ schema: jobs, mutations });

  it("finds the declared act that writes the bound field and can be told the answer", () => {
    expect(actThatMoves(store([reschedule, finish]), "job", "on")).toEqual({
      name: "reschedule",
      arg: "jobId",
    });
  });

  it("passes over an act that writes the field but cannot be told it", () => {
    // "Finish it" writes `done` and has no opinion you can hand it; asked
    // about `done`, the answer is the derived edit, not finish.
    expect(actThatMoves(store([finish]), "job", "done")?.name).toBe("edit-job");
  });

  it("falls back to the derived edit, which every kind has", () => {
    expect(actThatMoves(store([finish]), "job", "on")).toEqual({ name: "edit-job", arg: "id" });
  });
});
