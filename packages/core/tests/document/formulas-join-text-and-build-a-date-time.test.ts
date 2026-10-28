import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { createSchema, defineNode, Graph, Store, z, type AnySchema, type GraviewApp } from "../../src/index.js";
import { ExprEvalError, evaluateExpr, parseExpr, patternProblem, type EvalContext, type KindShape } from "../../src/document/index.js";

/**
 * Roadmap f-formula-text-datetime. FORMULAS JOIN TEXT AND BUILD A DATE-TIME.
 * A computed event title or an act's start time could not be built: the
 * language counted days and added numbers, and had no way to say "Tue, Oct
 * 27 · 9:30 AM" or to make the instant a plan item's day reaches at 9:30.
 * Now `concat` joins words (nothing joining as no words), `format` says a
 * moment by a closed pattern in the app's locale and on its clock,
 * `datetime` / `at` make the instant a day reaches at a wall time in the
 * app's zone, `addMinutes` moves a moment, `weekday` names its day and
 * `startOfWeek` finds its Monday (or the day it is told). Each is total,
 * each is typed by the checker, and the clock is the app's — judged here
 * on the days New York's clock changes.
 */
const schema = createSchema([
  defineNode("event", {
    fields: z.object({ title: z.string(), place: z.string().optional(), day: z.string().optional(), start: z.string().optional(), startTime: z.string().optional(), hours: z.number().optional() }),
  }),
] as const);
const graph = Graph.from(schema as never, {
  nodes: [
    { id: "e1", kind: "event", title: "Picnic", place: "the park", day: "2026-10-27", start: "2026-10-27T13:30:00Z", startTime: "09:30", hours: 2 },
    { id: "e2", kind: "event", title: "Nothing set" },
  ],
  edges: [],
} as never);
const kinds = new Map<string, KindShape>([["event", { fields: new Set(["title", "place", "day", "start", "startTime", "hours"]), edges: new Map() }]]);

const NEW_YORK: Partial<EvalContext> = { timeZone: "America/New_York", locale: "en-US" };
const at = (source: string, subject = "e1", ctx: Partial<EvalContext> = NEW_YORK) =>
  evaluateExpr(parseExpr(source), { graph: graph as never, subject: graph.getNode(subject)!, kinds, today: "2026-10-27", now: "2026-10-27T12:00:00Z", ...ctx });

describe("concat joins words, beside + which already did", () => {
  it.each([
    ["concat(title, ' · ', place)", "Picnic · the park"],
    ["title + ' · ' + place", "Picnic · the park"],
    ["concat(hours, ' h')", "2 h"],
    ["concat('one')", "one"],
  ])("%s → %j", (source, expected) => {
    expect(at(source)).toBe(expected);
  });

  it("joins nothing as no words, where + makes the whole nothing", () => {
    expect(at("concat(title, ' · ', place)", "e2")).toBe("Nothing set · ");
    expect(at("title + ' · ' + place", "e2")).toBe(null);
  });

  it("refuses a record or a set where it needs a word", () => {
    expect(() => at("concat(all('event'))")).toThrow(/concat\(…\) needs a word/);
  });
});

describe("format says a moment by a pattern, in the app's locale, on its clock", () => {
  it.each([
    ["format(day, 'EEE, MMM d')", "Tue, Oct 27"],
    ["format(day, 'EEEE d MMMM yyyy')", "Tuesday 27 October 2026"],
    // 13:30Z is 9:30 in the morning in New York, in summer time.
    ["format(start, 'h:mm a')", "9:30 AM"],
    ["format(start, 'HH:mm')", "09:30"],
    ["format(start, 'EEE d MMM · h:mm a')", "Tue 27 Oct · 9:30 AM"],
    // Words of the pattern's own go in single quotes; two quotes say one.
    ["format(day, \"'on' EEE\")", "on Tue"],
    ["format(day, \"EEE 'o''clock'\")", "Tue o'clock"],
    // A wall time written without a zone is said as written, whatever the clock.
    ["format('2026-10-27T15:00', 'h:mm a')", "3:00 PM"],
    // A month or a year alone reads as its first day.
    ["format('2016-05', 'MMMM yyyy')", "May 2016"],
  ])("%s → %j", (source, expected) => {
    expect(at(source)).toBe(expected);
  });

  it("says the names in the app's locale, never the reader's", () => {
    expect(at("format(day, 'EEEE d MMMM')", "e1", { ...NEW_YORK, locale: "de-DE" })).toBe("Dienstag 27 Oktober");
    expect(at("format(day, 'EEE')", "e1", { ...NEW_YORK, locale: "fr-FR" })).toMatch(/^mar/);
  });

  it("reads an instant on the app's clock: the same instant is another day in another zone", () => {
    expect(at("format('2026-10-28T03:30:00Z', 'EEE h:mm a')")).toBe("Tue 11:30 PM");
    expect(at("format('2026-10-28T03:30:00Z', 'EEE h:mm a')", "e1", { timeZone: "UTC", locale: "en-US" })).toBe("Wed 3:30 AM");
  });

  it("says the time pieces of a day with no time as nothing", () => {
    expect(at("format(day, 'HH:mm')")).toBe(":");
  });

  it("refuses a pattern piece it does not know, a pattern not in quotes, and what is not a date", () => {
    expect(() => at("format(day, 'EEE Q')")).toThrow(/"Q" is not a piece of a date pattern/);
    expect(patternProblem("EEE Q")).toMatch(/"Q" is not a piece/);
    expect(patternProblem("'never closed")).toMatch(/never closed/);
    expect(patternProblem("EEE, d MMM yyyy 'at' h:mm a")).toBeUndefined();
    // A pattern read from a field is judged as a pattern: the checker is what says to write one in quotes.
    expect(() => at("format(day, title)")).toThrow(/"Picnic" is not a piece of a date pattern/);
    expect(() => at("format(day, hours)")).toThrow(/says its pattern in quotes/);
    expect(() => at("format(hours, 'EEE')")).toThrow(/format\(…\) needs a date, and was given number/);
    expect(() => at("format('tomorrow', 'EEE')")).toThrow(/"tomorrow" is not one/);
  });
});

describe("datetime and at make the instant a day reaches at a wall time in the app's zone", () => {
  it.each([
    ["datetime(day, '09:30')", "2026-10-27T13:30:00Z"],
    ["at(day, startTime)", "2026-10-27T13:30:00Z"],
    ["datetime(day, '9:30')", "2026-10-27T13:30:00Z"],
    // A moment given as the day: its day on the app's wall.
    ["datetime(start, '17:00')", "2026-10-27T21:00:00Z"],
    // The day the clock springs forward (March 8, 2026): 9:30 is already summer time.
    ["datetime('2026-03-08', '09:30')", "2026-03-08T13:30:00Z"],
    // The day before, the same wall time is an hour later in UTC.
    ["datetime('2026-03-07', '09:30')", "2026-03-07T14:30:00Z"],
    // The day the clock falls back (November 1, 2026): 9:30 is standard time again.
    ["datetime('2026-11-01', '09:30')", "2026-11-01T14:30:00Z"],
    ["datetime('2026-10-31', '09:30')", "2026-10-31T13:30:00Z"],
    // A time the clock skips lands where a typed one lands (`instantIn`): read on the clock before it jumps.
    ["datetime('2026-03-08', '02:30')", "2026-03-08T06:30:00Z"],
  ])("%s → %j", (source, expected) => {
    expect(at(source)).toBe(expected);
  });

  it("builds on UTC when the app says no zone, so a server and a page agree", () => {
    expect(at("datetime(day, '09:30')", "e1", {})).toBe("2026-10-27T09:30:00Z");
  });

  it("refuses a time not written as hours and minutes, and a day that is not one", () => {
    expect(() => at("datetime(day, '24:00')")).toThrow(/needs a time of day written like '09:30', and was given "24:00"/);
    expect(() => at("datetime(day, 930)")).toThrow(/needs a time of day/);
    expect(() => at("at(hours, '09:30')")).toThrow(/at\(…\) needs a date/);
  });
});

describe("addMinutes, weekday and startOfWeek", () => {
  it.each([
    ["addMinutes(start, 90)", "2026-10-27T15:00:00Z"],
    // An instant stays an instant across the fall back: ninety minutes are ninety minutes.
    ["addMinutes('2026-11-01T05:30:00Z', 60)", "2026-11-01T06:30:00Z"],
    // A wall time stays a wall time, and crosses midnight by the calendar.
    ["addMinutes('2026-10-27T23:30', 45)", "2026-10-28T00:15"],
    // A day with no time becomes the wall time after its midnight; backwards is the day before.
    ["addMinutes(day, 90)", "2026-10-27T01:30"],
    ["addMinutes(day, -30)", "2026-10-26T23:30"],
    ["weekday(day)", "tue"],
    ["weekday(start)", "tue"],
    // 03:30Z on Wednesday is still Tuesday night in New York.
    ["weekday('2026-10-28T03:30:00Z')", "tue"],
    ["weekday('2006')", "sun"],
    ["startOfWeek(day)", "2026-10-26"],
    ["startOfWeek(day, 'sun')", "2026-10-25"],
    ["startOfWeek('2026-10-26')", "2026-10-26"],
    ["startOfWeek(start, 'wed')", "2026-10-21"],
  ])("%s → %j", (source, expected) => {
    expect(at(source)).toBe(expected);
  });

  it("reads the weekday on UTC when the app says no zone", () => {
    expect(at("weekday('2026-10-28T03:30:00Z')", "e1", {})).toBe("wed");
  });

  it("refuses minutes that are not a number and a first day it does not know", () => {
    expect(() => at("addMinutes(day, 'soon')")).toThrow(/addMinutes\(…\) needs a number of minutes/);
    expect(() => at("startOfWeek(day, 'tomorrow')")).toThrow(/starts the week on a day said 'mon' to 'sun'/);
  });
});

describe("each is total: nothing in is nothing out", () => {
  it.each(["format(day, 'EEE')", "datetime(day, '09:30')", "at(day, startTime)", "at(day, startTime)", "addMinutes(start, 5)", "weekday(day)", "startOfWeek(day)"])("%s on a record with nothing set → null", (source) => {
    expect(at(source, "e2")).toBe(null);
  });

  it("every type mistake is a sentence, never a crash", () => {
    for (const source of ["format(all('event'), 'EEE')", "datetime(title, '09:30')", "addMinutes(title, 5)", "weekday(hours)", "startOfWeek(true)", "concat(out('x'))"]) {
      expect(() => at(source), source).toThrow(ExprEvalError);
    }
  });
});

/* ── the checker ────────────────────────────────────────────────────────── */

const document = (over: { computed?: Record<string, string>; acts?: Record<string, unknown>; rules?: Record<string, unknown> } = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Plans",
  brand: { timeZone: "America/New_York", locale: "en-US" },
  kinds: {
    item: {
      fields: { name: { type: "string", required: true }, day: { type: "date" }, start: { type: "datetime" }, hours: { type: "number" }, title: { type: "string" } },
      ...(over.computed ? { computed: over.computed } : {}),
    },
  },
  acts: { "add-item": { creates: "item" }, ...(over.acts ?? {}) },
  ...(over.rules ? { rules: over.rules } : {}),
});

describe("the checker types the date functions", () => {
  const codes = (doc: unknown) => compileDocument(doc).findings.filter((f) => f.severity === "error").map((f) => [f.code, f.path, f.message]);

  it("a format of a number field, a pattern piece it does not know, and a time of a date that has none are findings at the expression's path", () => {
    expect(codes(document({ computed: { bad: "format(hours, 'EEE')" } }))).toEqual([["expr-type", "kinds.item.computed.bad", 'format(…) needs a date, and "hours" is a number']]);
    expect(codes(document({ computed: { bad: "format(day, 'EEE Q')" } }))).toEqual([["format-pattern", "kinds.item.computed.bad", expect.stringMatching(/"Q" is not a piece of a date pattern/)]]);
    expect(codes(document({ computed: { bad: "format(day, 'h:mm a')" } }))).toEqual([["format-pattern", "kinds.item.computed.bad", expect.stringMatching(/"day" is a date with no time of day/)]]);
    expect(codes(document({ computed: { bad: "format(day, name)" } }))).toEqual([["format-pattern", "kinds.item.computed.bad", expect.stringMatching(/says its pattern in quotes/)]]);
  });

  it("a time not written HH:MM, minutes that are words and a first day it does not know are findings", () => {
    expect(codes(document({ computed: { bad: "datetime(day, '9:75')" } }))).toEqual([["expr-type", "kinds.item.computed.bad", expect.stringMatching(/needs a time of day written like '09:30', and was given "9:75"/)]]);
    expect(codes(document({ computed: { bad: "addMinutes(start, name)" } }))).toEqual([["expr-type", "kinds.item.computed.bad", expect.stringMatching(/needs a number of minutes, and "name" is words/)]]);
    expect(codes(document({ computed: { bad: "startOfWeek(day, 'tomorrow')" } }))).toEqual([["expr-type", "kinds.item.computed.bad", expect.stringMatching(/starts the week on a day said 'mon' to 'sun'/)]]);
    expect(codes(document({ computed: { bad: "weekday(name)" } }))).toEqual([["expr-type", "kinds.item.computed.bad", 'weekday(…) needs a date, and "name" is words']]);
  });

  it("judges a rule's expression and a value an act sets the same way, at their paths", () => {
    expect(codes(document({ rules: { odd: { over: "item", require: "format(hours, 'EEE') == 'Tue'" } } }))).toEqual([["expr-type", "rules.odd.require", 'format(…) needs a date, and "hours" is a number']]);
    expect(codes(document({ acts: { retitle: { on: "item", sets: { title: { expr: "format(hours, 'EEE')" } } } } }))).toEqual([["expr-type", "acts.retitle.set", 'format(…) needs a date, and "hours" is a number']]);
  });

  it("says nothing of what it cannot tell: a name of no declared type, a date built by the language, a literal day", () => {
    expect(
      codes(
        document({
          computed: {
            heading: "concat(name, ' · ', format(day, 'EEE d MMM'))",
            startsAt: "datetime(day, '09:30')",
            said: "format(start, 'h:mm a')",
            later: "format(addMinutes(start, 90), 'HH:mm')",
            week: "format(startOfWeek(today()), 'MMM d')",
            fixed: "weekday('2026-10-27')",
            theirs: "format(first(all('item')).start, 'EEE')",
          },
        }),
      ),
    ).toEqual([]);
  });
});

describe("compiled, the app says a moment in its own locale and builds one on its own clock", () => {
  const doc = document({
    computed: { heading: "concat(name, ' · ', format(day, 'EEE d MMM'))" },
    acts: {
      schedule: { on: "item", sets: { start: { expr: "datetime(day, '09:30')" }, title: { expr: "concat(name, ' at ', format(datetime(day, '09:30'), 'h:mm a'), ' on ', weekday(day))" } } },
    },
  });

  it("an act's values are built in the app's zone and said in its locale, and are kept as a datetime field keeps an instant", () => {
    const result = compileDocument(doc, { today: () => "2026-10-27" });
    if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings)}`);
    const app = result.app as GraviewApp<AnySchema>;
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [{ id: "i1", kind: "item", name: "Picnic", day: "2026-11-01" }] as never, edges: [] } });
    store.apply({ name: "schedule", args: { id: "i1" } });
    // November 1, 2026 is the day New York's clock falls back: 9:30 is standard time, 14:30Z.
    expect(store.graph.getNode("i1")).toMatchObject({ start: "2026-11-01T14:30:00Z", title: "Picnic at 9:30 AM on sun" });
  });

  it("a German app says the same day in German", () => {
    const result = compileDocument({ ...doc, brand: { timeZone: "Europe/Berlin", locale: "de-DE" } }, { today: () => "2026-10-27" });
    if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings)}`);
    const app = result.app as GraviewApp<AnySchema>;
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [{ id: "i1", kind: "item", name: "Picknick", day: "2026-11-01" }] as never, edges: [] } });
    store.apply({ name: "schedule", args: { id: "i1" } });
    expect(store.graph.getNode("i1")).toMatchObject({ start: "2026-11-01T08:30:00Z" });
  });
});
