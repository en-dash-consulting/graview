import { afterEach, describe, expect, it, vi } from "vitest";
import { compileDocument } from "../../src/check.js";
import { computedValues } from "../../src/document/computed-values.js";
import { evaluateExpr, expressionRule, parseExpr } from "../../src/document/index.js";
import { sayIn, Store, tickEachDay, type AnySchema, type GraviewApp, type Operation } from "../../src/index.js";
import { answerJob } from "../../src/jobs.js";
import { matchSubscriptions, type Subscription } from "../../src/subscriptions.js";
import { policyApplies, workflowValue } from "../../src/workflows.js";

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

describe("an instant against a wall time keeps its seconds", () => {
  it("is after a wall time of the same minute, and before one later in it", () => {
    expect(read("'2026-10-17T13:30:45Z' > '2026-10-17T09:30'", NY)).toBe(true);
    expect(read("'2026-10-17T13:30:45Z' > '2026-10-17T09:30:30'", NY)).toBe(true);
    expect(read("'2026-10-17T13:30:45Z' < '2026-10-17T09:30:50'", NY)).toBe(true);
    expect(read("'2026-10-17T09:30:45.250Z' > '2026-10-17T09:30:45'")).toBe(true);
    at("2026-10-17T09:30:45Z");
    expect(read("now() > '2026-10-17T09:30'")).toBe(true);
    expect(read("now() < '2026-10-17T09:30:50'")).toBe(true);
  });
});

describe("what a server reads with no page drawn, in a store that knows its app's zone", () => {
  const host = { kind: "system", id: "host" } as const;
  const served = () => storeOf(appIn(NY), NY);

  it("a workflow's value: date(starts) of a 10 PM event in New York is that day", () => {
    const store = served();
    const record = store.graph.getNode("event:supper") as never;
    expect(workflowValue({ expr: "date(starts)" }, record, store, { at: "2026-10-17T03:00:00.000Z", today: "2026-10-16" })).toBe("2026-10-16");
  });

  it("a workflow policy's condition reads its day there", () => {
    const store = served();
    const record = store.graph.getNode("event:supper") as never;
    const policy = { appliesTo: "date(starts) == '2026-10-16'" } as never;
    expect(policyApplies(policy, record, store.graph as never, store.schema, "2026-10-16", NY)).toBe(true);
    expect(policyApplies(policy, record, store.graph as never, store.schema, "2026-10-16")).toBe(false);
  });

  it("a job's where", () => {
    expect(answerJob(served(), { kind: "event", where: "date(starts) == '2026-10-16'" }, host).count).toBe(1);
    expect(answerJob(storeOf(appIn(NY)), { kind: "event", where: "date(starts) == '2026-10-16'" }, host).count).toBe(0);
  });

  it("a subscription's condition, matched against a commit", () => {
    const store = served();
    const heard: Operation[] = [];
    const off = store.subscribe((_diff, ops) => heard.push(...ops));
    store.apply({ name: "edit-event", args: { id: "event:supper", starts: "2026-10-17T02:30:00Z" } }, { author: { kind: "human", id: "acct-cook" } });
    off();
    const reaches = { id: "sub-1", who: host, app: "Evenings", when: { on: "reaches", kind: "event", condition: "date(starts) == '2026-10-16' && starts > '2026-10-16T22:15'" }, at: "2026-10-16T00:00:00.000Z" } as unknown as Subscription;
    expect(matchSubscriptions(store, heard, [reaches])).toHaveLength(1);
  });

  it("a computed value worked out outside the record's own label", () => {
    const store = served();
    const node = store.graph.getNode("event:supper") as never;
    expect(computedValues(store.schema, store.graph as never, node, { timeZone: NY }).values["day"]).toBe("2026-10-16");
    expect(computedValues(store.schema, store.graph as never, node).values["day"]).toBe("2026-10-17");
  });

  it("a rule written in code, judged on the store's zone", () => {
    const app = appIn();
    const onItsDay = expressionRule("on-its-day", { over: "event", require: "date(starts) == '2026-10-16'" });
    const make = (timeZone?: string) => new Store<AnySchema>({ schema: app.schema, invariants: [onItsDay] as never, snapshot: structuredClone(SEED) as never, ...(timeZone ? { timeZone } : {}) });
    expect(problems(make(NY))).toEqual([]);
    expect(problems(make())).toEqual(["on-its-day"]);
  });
});
