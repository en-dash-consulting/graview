import { afterEach, describe, expect, it, vi } from "vitest";
import { compileDocument } from "../../src/check.js";
import { evaluateExpr, parseExpr } from "../../src/document/index.js";
import { sayIn, Store, tickEachDay, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A RULE'S today() AND date() READ THE DAY IN THE APP'S OWN ZONE. A
 * composed dated list says `where not (starts < today())`, and an instant
 * was compared with the day by its letters, in UTC: at half past midnight
 * in New York an event from 10 PM still read as ahead, and just after
 * midnight in Tokyo an event at 8 AM that day read as gone. With a zone
 * declared (`brand.timeZone`), today() is the day there, date() of an
 * instant is the day it is on there, and an instant compared with a day is
 * read on the app's wall; without one, all three are UTC's, as before.
 */
afterEach(() => {
  vi.useRealTimers();
  sayIn({});
});

const NY = "America/New_York";
const TOKYO = "Asia/Tokyo";
const HOUR = 60 * 60 * 1000;

const at = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};
const read = (source: string, timeZone?: string) => evaluateExpr(parseExpr(source), { graph: undefined as never, subject: null, kinds: new Map(), ...(timeZone ? { timeZone } : {}) });

describe("today() in an app that declares its zone", () => {
  it("is New York's day at 23:30 there, which is already the next day in UTC (west of UTC)", () => {
    at("2026-10-17T03:30:00Z");
    expect(read("today()", NY)).toBe("2026-10-16");
    expect(read("today()")).toBe("2026-10-17");
  });

  it("is Tokyo's day at 00:30 there, which is still the day before in UTC (east of UTC)", () => {
    at("2026-10-16T15:30:00Z");
    expect(read("today()", TOKYO)).toBe("2026-10-17");
    expect(read("today()")).toBe("2026-10-16");
  });

  it("turns at the zone's midnight on both sides of it", () => {
    at("2026-10-17T03:59:00Z");
    expect(read("today()", NY)).toBe("2026-10-16");
    vi.setSystemTime(new Date("2026-10-17T04:01:00Z"));
    expect(read("today()", NY)).toBe("2026-10-17");
  });
});

describe("date() of an instant", () => {
  it("is the day the instant is on in the declared zone", () => {
    expect(read("date('2026-10-17T03:30:00Z')", NY)).toBe("2026-10-16");
    expect(read("date('2026-10-16T15:30:00Z')", TOKYO)).toBe("2026-10-17");
    expect(read("date('2026-10-17T03:30:00Z')")).toBe("2026-10-17");
  });

  it("keeps a wall time and a day as they are written, in any zone", () => {
    expect(read("date('2026-10-16T23:30')", TOKYO)).toBe("2026-10-16");
    expect(read("date('2026-10-16')", NY)).toBe("2026-10-16");
    expect(read("date('2026-05')", NY)).toBe("2026-05-01");
  });
});

describe("an instant compared with today()", () => {
  it("is past in New York at 00:30 after a 10 PM event the evening before, though UTC still has it that day", () => {
    at("2026-10-17T04:30:00Z");
    expect(read("'2026-10-17T02:00:00Z' < today()", NY)).toBe(true);
    expect(read("'2026-10-17T02:00:00Z' < today()")).toBe(false);
  });

  it("is still ahead in Tokyo at 00:30 before an 8 AM event that day, though UTC has it the day before", () => {
    at("2026-10-16T15:30:00Z");
    expect(read("'2026-10-16T23:00:00Z' < today()", TOKYO)).toBe(false);
    expect(read("'2026-10-16T23:00:00Z' >= today()", TOKYO)).toBe(true);
  });

  it("is read on the app's wall against a month alone: 10 PM on Oct 31 in New York is within October", () => {
    expect(read("'2026-11-01T02:00:00Z' > '2026-10'", NY)).toBe(false);
    expect(read("'2026-11-01T02:00:00Z' > '2026-10'")).toBe(true);
  });
});

const documentIn = (timeZone?: string) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Evenings",
  ...(timeZone ? { brand: { timeZone } } : {}),
  kinds: {
    event: {
      fields: { title: { type: "string" }, starts: { type: "datetime" } },
      label: "{title} on {day}",
      computed: { day: "date(starts)" },
    },
  },
  rules: {
    "not-past": { title: "An event is still ahead", over: "event", when: "present(starts)", require: "not (starts < today())" },
  },
});

const appIn = (timeZone?: string) => {
  const compiled = compileDocument(documentIn(timeZone) as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return compiled.app as GraviewApp<AnySchema>;
};

// 10 PM in New York on Oct 16.
const SEED = { nodes: [{ id: "event:supper", kind: "event", title: "Supper", starts: "2026-10-17T02:00:00Z" }], edges: [] };
const storeOf = (app: GraviewApp<AnySchema>, timeZone?: string) =>
  new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, invariants: (app.invariants ?? []) as never, snapshot: structuredClone(SEED) as never, ...(timeZone ? { timeZone } : {}) });
const labelOf = (app: GraviewApp<AnySchema>, store: Store<AnySchema>) => (app.schema.definition("event") as { label: (node: unknown) => string }).label(store.graph.getNode("event:supper"));
const problems = (store: Store<AnySchema>) => store.violations().map((one) => one.invariant);

describe("a document whose brand declares its zone", () => {
  it("reads date() of a datetime field on the day it is in that zone", () => {
    const app = appIn(NY);
    expect(labelOf(app, storeOf(app, NY))).toBe("Supper on Oct 16, 2026");
  });

  it("keeps UTC's day where no zone is declared", () => {
    at("2026-10-17T03:30:00Z");
    const app = appIn();
    const store = storeOf(app);
    expect(labelOf(app, store)).toBe("Supper on Oct 17, 2026");
    expect(problems(store)).toEqual([]);
  });

  it("judges a clock rule again when the declared zone's day turns, not UTC's", () => {
    at("2026-10-16T20:00:00Z");
    const store = storeOf(appIn(NY), NY);
    const ticks: string[] = [];
    const stop = tickEachDay(store, (tick) => ticks.push(tick.day));
    expect(problems(store)).toEqual([]);
    // UTC's midnight passes, and the event's UTC day comes: nothing turns in New York.
    vi.advanceTimersByTime(4.5 * HOUR);
    expect(ticks).toEqual([]);
    expect(problems(store)).toEqual([]);
    // New York's midnight (04:00 UTC in October), and a second: the evening's event is past.
    vi.advanceTimersByTime(3.5 * HOUR + 1000);
    expect(ticks).toEqual(["2026-10-17"]);
    expect(problems(store)).toEqual(["not-past"]);
    stop();
  });
});
