import { afterEach, describe, expect, it, vi } from "vitest";
import { compileDocument } from "../../src/check.js";
import { isoToday, sayIn, sayingIn, Store, tickEachDay, untilTheDayTurns, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A RULE'S today() IS THE APP'S DAY, NOT UTC'S (Roadmap f-app-time-zone,
 * f-rules-keep-time). The app said its datetimes in its own zone
 * (`brand.timeZone`), and still read `today()` — in a rule, a computed
 * field, a template — as the UTC date, so a practice in New York turned
 * its day at 8 PM: a chore due today was overdue over dinner. With a zone
 * declared, today() is the date there, the day turns at the app's
 * midnight, and a server and a page read the same day; without one, it is
 * the UTC date, as before.
 */
afterEach(() => {
  vi.useRealTimers();
  sayIn({});
});

const NY = "America/New_York";
const HOUR = 60 * 60 * 1000;

const documentIn = (timeZone?: string) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Chores",
  ...(timeZone ? { brand: { timeZone } } : {}),
  kinds: {
    chore: {
      fields: { title: { type: "string" }, due: { type: "date" }, done: { type: "boolean" } },
      label: "{title}, {daysLeft} days left",
      computed: { daysLeft: "days(today(), due)" },
    },
  },
  rules: {
    "not-overdue": { title: "A chore is done by its due day", over: "chore", when: "present(due) && !done", require: "due >= today()" },
  },
});

const appIn = (timeZone?: string) => {
  const compiled = compileDocument(documentIn(timeZone) as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return compiled.app as GraviewApp<AnySchema>;
};

const SEED = { nodes: [{ id: "chore:water", kind: "chore", title: "Water the plants", due: "2026-10-16", done: false }], edges: [] };
const storeOf = (app: GraviewApp<AnySchema>, timeZone?: string) =>
  new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, invariants: (app.invariants ?? []) as never, snapshot: structuredClone(SEED) as never, ...(timeZone ? { timeZone } : {}) });
const labelOf = (app: GraviewApp<AnySchema>, store: Store<AnySchema>) => (app.schema.definition("chore") as { label: (node: unknown) => string }).label(store.graph.getNode("chore:water"));
const overdue = (store: Store<AnySchema>) => store.violations().map((one) => one.invariant);

const at = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

describe("today() in an app that declares its zone", () => {
  it("is the date there: at 01:30 UTC on Oct 17 an app in New York is still on Oct 16", () => {
    at("2026-10-17T01:30:00Z");
    expect(isoToday(NY)).toBe("2026-10-16");
    expect(isoToday()).toBe("2026-10-17");
    expect(isoToday(NY, Date.parse("2026-10-17T04:00:00Z"))).toBe("2026-10-17");
  });

  it("is what a document's rules, computed fields and labels read, from the document's own brand", () => {
    at("2026-10-17T01:30:00Z");
    const app = appIn(NY);
    const store = storeOf(app);
    expect(overdue(store)).toEqual([]);
    expect(labelOf(app, store)).toBe("Water the plants, 0 days left");
    // Past the app's midnight, the chore is late.
    vi.setSystemTime(new Date("2026-10-17T04:30:00Z"));
    expect(overdue(store)).toEqual(["not-overdue"]);
    expect(labelOf(app, store)).toBe("Water the plants, -1 days left");
  });

  it("is unchanged without a declared zone: the UTC date", () => {
    at("2026-10-17T01:30:00Z");
    const app = appIn();
    const store = storeOf(app);
    expect(overdue(store)).toEqual(["not-overdue"]);
    expect(labelOf(app, store)).toBe("Water the plants, -1 days left");
    expect(store.today()).toBeUndefined();
  });

  it("is the app's on every surface, never the reader's: a page drawn for a reader in Tokyo reads New York's day", () => {
    at("2026-10-17T01:30:00Z");
    expect(sayingIn({ readerTimeZone: "Asia/Tokyo", appTimeZone: NY }, () => isoToday())).toBe("2026-10-16");
    // The page says the app it draws; what reads the day with no zone of its own reads that one.
    sayIn({ readerTimeZone: "Asia/Tokyo", appTimeZone: NY });
    expect(isoToday()).toBe("2026-10-16");
    const app = appIn(NY);
    expect(overdue(storeOf(app))).toEqual([]);
    sayIn({});
    expect(isoToday()).toBe("2026-10-17");
  });
});

describe("a store that knows its app's zone", () => {
  it("is judged on the day there, and says it, so a server and a page agree", () => {
    at("2026-10-17T01:30:00Z");
    // A document that says no zone of its own, opened by a host that knows the app's: the store's day is the app's.
    const store = storeOf(appIn(), NY);
    expect(store.timeZone).toBe(NY);
    expect(store.today()).toBe("2026-10-16");
    expect(overdue(store)).toEqual([]);
  });

  it("ticks to the day of an instant there", () => {
    at("2026-10-16T20:00:00Z");
    const store = storeOf(appIn(NY), NY);
    expect(store.tick(new Date("2026-10-17T01:30:00Z")).day).toBe("2026-10-16");
    const turned = store.tick(new Date("2026-10-17T04:00:01Z"));
    expect(turned.day).toBe("2026-10-17");
    expect(turned.appeared.map((one) => one.invariant)).toEqual(["not-overdue"]);
  });

  it("flips a rule over a due date at the app's midnight, not UTC's, as tickEachDay turns it", () => {
    at("2026-10-16T20:00:00Z");
    const store = storeOf(appIn(NY), NY);
    const heard: number[] = [];
    store.subscribe(() => heard.push(Date.now()));
    const ticks: string[] = [];
    const stop = tickEachDay(store, (tick) => ticks.push(tick.day));
    // UTC's midnight passes: nothing turns.
    vi.advanceTimersByTime(4.5 * HOUR);
    expect(ticks).toEqual([]);
    expect(overdue(store)).toEqual([]);
    // New York's midnight (04:00 UTC in October), and a second: the day turns, and every subscriber hears it.
    vi.advanceTimersByTime(3.5 * HOUR + 1000);
    expect(ticks).toEqual(["2026-10-17"]);
    expect(heard).toHaveLength(1);
    expect(overdue(store)).toEqual(["not-overdue"]);
    stop();
  });
});

describe("the next turn of the day in a zone", () => {
  it("is the app's next midnight", () => {
    expect(untilTheDayTurns(Date.parse("2026-10-17T01:30:00Z"), NY)).toBe(2.5 * HOUR);
    expect(untilTheDayTurns(Date.parse("2026-10-17T01:30:00Z"))).toBe(22.5 * HOUR);
  });

  it("keeps to midnight across spring forward: Mar 8, 2026 is 23 hours long in New York", () => {
    expect(untilTheDayTurns(Date.parse("2026-03-07T12:00:00Z"), NY)).toBe(17 * HOUR);
    expect(untilTheDayTurns(Date.parse("2026-03-08T05:00:00Z"), NY)).toBe(23 * HOUR);
    expect(untilTheDayTurns(Date.parse("2026-03-08T12:00:00Z"), NY)).toBe(16 * HOUR);
  });

  it("keeps to midnight across fall back: Nov 1, 2026 is 25 hours long in New York", () => {
    expect(untilTheDayTurns(Date.parse("2026-10-31T12:00:00Z"), NY)).toBe(16 * HOUR);
    expect(untilTheDayTurns(Date.parse("2026-11-01T04:00:00Z"), NY)).toBe(25 * HOUR);
  });

  it("ticks a store across both changes of the clock at each midnight there", () => {
    at("2026-10-31T12:00:00Z");
    const store = storeOf(appIn(NY), NY);
    const ticks: string[] = [];
    const stop = tickEachDay(store, (tick) => ticks.push(`${tick.day} @ ${new Date().toISOString()}`));
    vi.advanceTimersByTime(16 * HOUR + 1000);
    vi.advanceTimersByTime(25 * HOUR);
    expect(ticks).toEqual(["2026-11-01 @ 2026-11-01T04:00:01.000Z", "2026-11-02 @ 2026-11-02T05:00:01.000Z"]);
    stop();
  });

  it("finds the day's first moment where midnight never happens: Santiago skips from 23:59 to 01:00", () => {
    const zone = "America/Santiago";
    for (let stamp = Date.parse("2026-09-04T12:00:00Z"); stamp < Date.parse("2026-09-08T12:00:00Z"); stamp += 3 * HOUR) {
      const wait = untilTheDayTurns(stamp, zone);
      expect(wait).toBeGreaterThan(0);
      expect(isoToday(zone, stamp + wait - 1)).toBe(isoToday(zone, stamp));
      expect(isoToday(zone, stamp + wait)).not.toBe(isoToday(zone, stamp));
    }
  });
});
