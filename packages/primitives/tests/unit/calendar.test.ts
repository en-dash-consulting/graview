import { createSchema, defineMutation, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actThatMoves,
  addDays,
  addMonths,
  CalendarBindingError,
  createCalendarLens,
  placeOnCalendar,
  type CalendarRoles,
  dayOf,
  daysBetween,
  entriesIn,
  entriesOn,
  finerThan,
  minutesOf,
  placeOnCalendar,
  rangesOf,
  spanOf,
  startOfWeek,
  titleOf,
  type PlacedEntry,
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
  const days = (span: { cells: readonly { from: string }[] }) => span.cells.map((cell) => cell.from);

  it("covers six weeks of a month grid, starting on the app's own first day", () => {
    const month = spanOf("month", "2026-09-14");
    expect(month.cells).toHaveLength(42);
    expect(month.grain).toBe("day");
    expect(month.cells[0]?.from).toBe("2026-08-31");
    expect(month.title).toBe("September 2026");
  });

  it("covers exactly the week, the day, and six weeks forward for an agenda", () => {
    expect(days(spanOf("week", "2026-09-16"))).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
    expect(days(spanOf("day", "2026-09-16"))).toEqual(["2026-09-16"]);
    expect(spanOf("agenda", "2026-09-16").cells).toHaveLength(42);
  });
});

/**
 * THE CELL COARSENS WITH THE HORIZON — a week per cell at a quarter, a month
 * per cell at a year and beyond. A range that drew a day per cell at a year
 * would be three hundred and sixty-five cells nobody can read, and one that
 * drew a month per cell at a quarter would say less than the month grid it
 * replaced.
 */
describe("the longer horizons", () => {
  it("draws a quarter as weeks, covering every day of its three months", () => {
    const quarter = spanOf("quarter", "2026-05-14");
    expect(quarter.grain).toBe("week");
    expect(quarter.title).toBe("Q2 2026");
    expect(quarter.cells[0]?.from).toBe("2026-03-30");
    // Every day from 1 April to 30 June falls inside some cell.
    expect(quarter.cells[0]!.from <= "2026-04-01").toBe(true);
    expect(quarter.cells[quarter.cells.length - 1]!.to >= "2026-06-30").toBe(true);
    for (const cell of quarter.cells) expect(daysBetween(cell.from, cell.to)).toBe(6);
  });

  it("draws a year as its twelve months", () => {
    const year = spanOf("year", "2026-09-14");
    expect(year.grain).toBe("month");
    expect(year.title).toBe("2026");
    expect(year.cells).toHaveLength(12);
    expect(year.cells[0]).toMatchObject({ from: "2026-01-01", to: "2026-01-31", label: "Jan" });
    // February knows how long it is, and 2028 knows it is a leap year.
    expect(year.cells[1]?.to).toBe("2026-02-28");
    expect(spanOf("year", "2028-01-01").cells[1]?.to).toBe("2028-02-29");
  });

  it("draws a horizon as many years of months, and says how far it looks", () => {
    const horizon = { years: 3, title: "Three years" };
    const span = spanOf("years", "2026-04-01", { horizon });
    expect(span.grain).toBe("month");
    expect(span.cells).toHaveLength(36);
    expect(span.years).toEqual(["2026", "2027", "2028"]);
    expect(span.title).toBe("Three years · 2026–2028");
    // The cells carry their year, because a grid of thirty-six months that
    // only said "Jan" would be three pictures pretending to be one.
    expect(span.cells[12]?.label).toBe("Jan 27");
  });

  it("draws a horizon past a decade a year to a cell, so a career fits one screen", () => {
    const span = spanOf("years", "1997-01-01", { horizon: { years: 30, title: "The career" } });
    expect(span.grain).toBe("year");
    expect(span.cells).toHaveLength(30);
    expect(span.cells[0]).toEqual({ from: "1997-01-01", to: "1997-12-31", label: "1997" });
    expect(span.title).toBe("The career · 1997–2026");
    // Pressing a year opens its months.
    expect(finerThan("year")).toBe("year");
  });

  it("has no horizon unless the app names one", () => {
    expect(rangesOf({})).not.toContain("years");
    expect(rangesOf({ horizon: { years: 5, title: "Five years" } })).toContain("years");
    // And what it is called on the button is the app's word, not ours.
    expect(titleOf("years", { years: 5, title: "Five years" })).toBe("Five years");
    expect(titleOf("quarter")).toBe("The quarter");
  });

  it("opens one level finer when a cell is pressed", () => {
    expect(finerThan("month")).toBe("month");
    expect(finerThan("week")).toBe("week");
    expect(finerThan("day")).toBe("day");
  });
});

/**
 * A SPAN IS DRAWN ACROSS THE CELLS IT COVERS, whatever the cells are. A
 * planting sown in March and lifted in July is one thing running across five
 * cells of a year, exactly as a fortnight runs across cells of a week.
 */
describe("an entry that spans cells", () => {
  const planting: PlacedEntry = {
    id: "p1",
    kind: "planting",
    label: "Leeks",
    from: "2026-03-12",
    to: "2026-07-04",
    at: null,
    allDay: true,
    done: false,
  };

  it("is in every month cell it touches, and in none it does not", () => {
    const year = spanOf("year", "2026-01-01");
    const touched = year.cells.filter((cell) => entriesIn([planting], cell.from, cell.to).length > 0);
    expect(touched.map((cell) => cell.label)).toEqual(["Mar", "Apr", "May", "Jun", "Jul"]);
  });

  it("is in the weeks of a quarter it runs through", () => {
    const quarter = spanOf("quarter", "2026-04-01");
    expect(quarter.cells.every((cell) => entriesIn([planting], cell.from, cell.to).length === 1)).toBe(true);
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

/**
 * A DOMAIN WHOSE COMPLETION IS A STATE CAN STILL SAY SO.
 *
 * `done` draws an entry struck and receded, which is the one thing that
 * makes a calendar of past work readable — and it accepted a field only when
 * that field held literally `true`. Meanwhile the framework pushes every app
 * away from booleans: `lifecycle: { field: "status", retired: ["done"] }` is
 * the documented way to express completion, and every worked example uses an
 * enum. None of them could bind it. The choices were a boolean duplicating
 * the status and free to drift out of step with it, or no struck-through
 * past at all.
 */
const job = defineNode("job", {
  fields: z.object({ label: z.string(), on: z.string(), status: z.string() }),
  plural: "Jobs",
  label: (node) => node.label,
  lifecycle: { field: "status", retired: ["done", "skipped"] },
});
const jobs = createSchema([job]);
const placeJob = (status: string, done: CalendarRoles["done"]) =>
  placeOnCalendar(
    { id: "j1", kind: "job", label: "Cut the back lawn", on: "2026-09-14", status } as never,
    { job: { start: "on", ...(done === undefined ? {} : { done }) } },
    jobs,
  );

describe("the done role", () => {
  it("still reads a boolean field, which is what it always did", () => {
    const entries = [
      node("t1", { label: "Post", due: "2026-09-14", done: true }),
      node("t2", { label: "Pack", due: "2026-09-14", done: false }),
    ].map((n) => placeOnCalendar(n, bindings, schema));
    expect(entries.map((entry) => entry?.done)).toEqual([true, false]);
  });

  it("reads a state the way lifecycle does — a field and the values that finish it", () => {
    const finished = ["done", "skipped"];
    expect(placeJob("done", { field: "status", is: finished })?.done).toBe(true);
    expect(placeJob("skipped", { field: "status", is: finished })?.done).toBe(true);
    expect(placeJob("open", { field: "status", is: finished })?.done).toBe(false);
  });

  it("is simply false when the app binds nothing, rather than guessing", () => {
    expect(placeJob("done", undefined)?.done).toBe(false);
  });
});
