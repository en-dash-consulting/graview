import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, isoDate, SCHEMES, type Violation } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { openStore } from "../../src/index.js";

/**
 * A STORE IS JUDGED ON ITS HOST'S DAY (W-186). A rule about a day — a loan
 * back by its due date — reads `today` from its context, and keeps no clock
 * of its own. The browser apps handed one; `graview mcp`, `graview apply`
 * and `graview serve` opened their stores with none, so an agent at the
 * library's door saw nothing overdue where the pages listed nine. Ship's
 * `openStore` judges on the host's clock unless the host pins a day.
 */
const loan = defineNode("loan", { fields: z.object({ label: z.string(), due: isoDate }), plural: "Loans" });
const schema = createSchema([loan]);
const { defineInvariant } = bindSchema(schema);
const backOnTime = defineInvariant("back-on-time", {
  scope: { kind: "loan" },
  evaluate({ subject, context }): Violation[] {
    const today = typeof context["today"] === "string" ? context["today"] : undefined;
    return today && subject.due < today ? [{ invariant: "back-on-time", subjectId: subject.id, label: subject.label, message: `${subject.label} is overdue`, nodeIds: [subject.id], repairs: [] }] : [];
  },
});
const app = defineApp({ name: "library", schema, mutations: [], invariants: [backOnTime] });
const seed = { nodes: [{ id: "l1", kind: "loan", label: "Loan 0001", due: "2020-01-01" }], edges: [] };

describe("a store opened by a host that says no day", () => {
  it("is judged on the host's own day", async () => {
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: seed as never });
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    expect(opened.store.today()).toBe(local);
    expect(opened.store.violations().map((violation) => violation.message)).toEqual(["Loan 0001 is overdue"]);
    opened.close();
  });

  it("turns at the host's midnight, and its subscribers hear it", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const midnight = new Date(2026, 9, 17); // the host's own midnight, wherever it runs
    vi.setSystemTime(new Date(midnight.getTime() - 60_000));
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: { nodes: [{ id: "l1", kind: "loan", label: "Loan 0001", due: "2026-10-16" }], edges: [] } as never });
    expect(opened.store.today()).toBe("2026-10-16");
    expect(opened.store.violations()).toEqual([]);
    const heard: unknown[] = [];
    opened.store.subscribe(() => heard.push(1));
    vi.advanceTimersByTime(2 * 60_000);
    expect(heard).toHaveLength(1);
    expect(opened.store.today()).toBe("2026-10-17");
    expect(opened.store.violations().map((violation) => violation.message)).toEqual(["Loan 0001 is overdue"]);
    opened.close();
    vi.useRealTimers();
  });

  it("keeps the day a host pins", async () => {
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: seed as never, storeOptions: { invariantOptions: { context: { today: "2019-06-01" } } } });
    expect(opened.store.today()).toBe("2019-06-01");
    expect(opened.store.violations()).toEqual([]);
    opened.close();
  });
});

/**
 * AN APP THAT SAYS ITS ZONE IS JUDGED ON ITS OWN DAY (Roadmap
 * f-app-time-zone). The host's clock is wherever the server runs: a
 * library in New York served from UTC turned its day at 8 PM. With
 * `brand.timeZone` declared, the store `openStore` opens reads the date
 * there, hands it to a rule's context, and ticks at that midnight.
 */
describe("a store opened for an app that declares its time zone", () => {
  const zoned = defineApp({ name: "library", schema, mutations: [], invariants: [backOnTime], brand: { name: "Library", schemes: SCHEMES, timeZone: "America/New_York" } });
  const dueToday = { nodes: [{ id: "l1", kind: "loan", label: "Loan 0001", due: "2026-10-16" }], edges: [] };

  afterEach(() => vi.useRealTimers());

  it("is judged on the app's day, not the host's, and turns at the app's midnight", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-10-17T01:30:00Z"));
    const opened = await openStore({ app: zoned, adapter: createMemoryAdapter(), seed: dueToday as never });
    expect(opened.store.timeZone).toBe("America/New_York");
    expect(opened.store.today()).toBe("2026-10-16");
    expect(opened.store.violations()).toEqual([]);
    const heard: unknown[] = [];
    opened.store.subscribe(() => heard.push(1));
    vi.advanceTimersByTime(2.5 * 60 * 60 * 1000 + 1000);
    expect(heard).toHaveLength(1);
    expect(opened.store.today()).toBe("2026-10-17");
    expect(opened.store.violations().map((violation) => violation.message)).toEqual(["Loan 0001 is overdue"]);
    opened.close();
  });
});
