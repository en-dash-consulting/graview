import { afterEach, describe, expect, it, vi } from "vitest";
import { checkApp, clockReaders, compileDocument } from "../../src/check.js";
import { defineInvariant, defineNode, createSchema, Store, tickEachDay, untilTheDayTurns, z, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A RULE THAT READS THE CLOCK IS JUDGED AGAIN WHEN THE DAY TURNS (FR-176).
 *
 * Rules are judged on every change and once on load. "A task past its due
 * day is overdue" is broken by midnight with nothing changed, and a room
 * that stays open for weeks went on saying the day it last heard a change.
 * The declaration says which of its rules and computed fields read the
 * clock (`clockReaders`, which `graview check` reads); a host ticks the
 * store when the day turns, and the answer is the problems that appeared
 * and cleared, which every subscriber hears.
 */
const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Chores",
  kinds: {
    chore: {
      fields: { title: { type: "string" }, due: { type: "date" }, done: { type: "boolean" } },
      label: "{title}",
      computed: { daysLeft: "days(today(), due)", late: "daysLeft < 0", size: "len(title)" },
    },
    note: { fields: { text: { type: "string" } } },
  },
  computed: { overdue: "count(all('chore') where due < today() && !done)" },
  rules: {
    "not-overdue": { title: "A chore is done by its due day", over: "chore", when: "present(due) && !done", require: "due >= today()" },
    "not-late": { title: "A chore is not late", over: "chore", when: "present(due)", require: "!late" },
    "none-overdue": { title: "Nothing is overdue", over: "graph", require: "fact('overdue') == 0" },
    "a-note-says-something": { title: "A note says something", over: "note", require: "len(text) > 0" },
  },
};

const app = (() => {
  const compiled = compileDocument(DOCUMENT as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return compiled.app as GraviewApp<AnySchema>;
})();

const SEED = { nodes: [{ id: "chore:water", kind: "chore", title: "Water the plants", due: "2026-10-12", done: false }], edges: [] };
const storeOf = () => new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, invariants: (app.invariants ?? []) as never, snapshot: structuredClone(SEED) as never });

afterEach(() => {
  vi.useRealTimers();
});

describe("a rule that reads the clock is judged again when the day turns", () => {
  it("knows which rules and computed fields read the clock, through the names they read, from the declaration alone", () => {
    const reads = clockReaders(app.schema, app.invariants ?? []);
    expect([...reads.rules].sort()).toEqual(["none-overdue", "not-late", "not-overdue"]);
    expect(reads.computed).toEqual([
      { kind: "chore", field: "daysLeft" },
      { kind: "chore", field: "late" },
      { kind: null, field: "overdue" },
    ]);
  });

  it("re-judges them on tick(now) and answers what appeared, then what cleared", () => {
    const store = storeOf();
    store.tick("2026-10-12");
    expect(store.violations()).toEqual([]);
    const turned = store.tick(new Date("2026-10-13T00:00:01Z"));
    expect(turned.day).toBe("2026-10-13");
    expect(turned.was).toBe("2026-10-12");
    expect(turned.appeared.map((one) => one.invariant).sort()).toEqual(["none-overdue", "not-late", "not-overdue"]);
    expect(turned.cleared).toEqual([]);
    // The store judges on the day it was ticked to, wherever it is asked.
    expect(store.today()).toBe("2026-10-13");
    expect(store.violations().map((one) => one.invariant).sort()).toEqual(["none-overdue", "not-late", "not-overdue"]);
    expect(store.seenBy({ kind: "human", id: "someone" } as never).violations().length).toBe(3);

    const back = store.tick("2026-10-11");
    expect(back.appeared).toEqual([]);
    expect(back.cleared.map((one) => one.invariant).sort()).toEqual(["none-overdue", "not-late", "not-overdue"]);
  });

  it("tells every subscriber, with no record changed and nothing logged, so the bar, the problems page and a count read again", () => {
    const store = storeOf();
    store.tick("2026-10-12");
    const heard: unknown[] = [];
    store.subscribe((diff, ops) => heard.push({ diff, ops }));
    const logged = store.log.all().length;
    store.tick("2026-10-13");
    expect(heard).toHaveLength(1);
    expect((heard[0] as { ops: unknown[] }).ops).toEqual([]);
    expect(store.log.all().length).toBe(logged);
    // The same day again moves nothing and says nothing.
    store.tick("2026-10-13");
    expect(heard).toHaveLength(1);
  });

  it("finds nothing that reads the clock in a declaration that does not, and a tick there moves nothing", () => {
    const schema = createSchema([defineNode("note", { fields: z.object({ text: z.string() }) })] as const);
    const never = defineInvariant("never", { scope: "graph", evaluate: () => [] });
    expect(clockReaders(schema as never, [never as never])).toEqual({ rules: [], computed: [] });
    const store = new Store({ schema, invariants: [never as never] });
    expect(store.tick("2026-10-13")).toEqual({ day: "2026-10-13", appeared: [], cleared: [] });
  });

  it("judges a rule that is a function on the day handed to it, when it says it reads the clock", () => {
    const schema = createSchema([defineNode("note", { fields: z.object({ text: z.string() }) })] as const);
    const weekend = defineInvariant("not-on-a-weekend", {
      scope: "graph",
      readsTheClock: true,
      evaluate: ({ today }: { today?: string }) => ([0, 6].includes(new Date(`${today}T12:00:00Z`).getUTCDay()) ? [{ invariant: "not-on-a-weekend", label: "Not on a weekend", message: "It is the weekend", nodeIds: [], repairs: [] }] : []),
    } as never);
    const store = new Store({ schema, invariants: [weekend as never] });
    expect(clockReaders(schema as never, [weekend as never]).rules).toEqual(["not-on-a-weekend"]);
    store.tick("2026-10-09");
    expect(store.tick("2026-10-10").appeared.map((one) => one.invariant)).toEqual(["not-on-a-weekend"]);
    expect(store.tick("2026-10-12").cleared.map((one) => one.invariant)).toEqual(["not-on-a-weekend"]);
  });

  it("leaves a store pinned to a day on that day", () => {
    const store = new Store<AnySchema>({ schema: app.schema, invariants: (app.invariants ?? []) as never, snapshot: structuredClone(SEED) as never, invariantOptions: { today: "2026-10-01" } });
    expect(store.tick("2026-10-20")).toEqual({ day: "2026-10-01", was: "2026-10-01", appeared: [], cleared: [] });
    expect(store.violations()).toEqual([]);
  });

  it("ticks a store at each midnight by the clock today() reads, until it is stopped", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T22:00:00Z"));
    expect(untilTheDayTurns()).toBe(2 * 60 * 60 * 1000);
    const store = storeOf();
    const ticks: string[] = [];
    const stop = tickEachDay(store, (tick) => ticks.push(tick.day));
    expect(ticks).toEqual([]);
    vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 1000);
    expect(ticks).toEqual(["2026-10-13"]);
    expect(store.violations().map((one) => one.invariant)).toContain("not-overdue");
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(ticks).toEqual(["2026-10-13", "2026-10-14"]);
    stop();
    vi.advanceTimersByTime(48 * 60 * 60 * 1000);
    expect(ticks).toHaveLength(2);
  });

  it("is said by graview check: which rules read the clock, and what their host owes them", () => {
    const found = checkApp(app as never).findings.filter((one) => one.code === "rules-read-the-clock");
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe("note");
    expect(found[0]!.where).toBe("not-overdue, not-late, none-overdue");
    expect(found[0]!.fix).toContain("store.tick(now)");
    expect(clockReaders(app.schema, []).rules).toEqual([]);
  });
});
