import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import type { GraviewDocument } from "../../src/document/index.js";
import { daySpanOf, Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A RULE COMPARES A DATE THAT KNOWS ONLY ITS YEAR OR ITS MONTH BY THE SPAN
 * IT COVERS (Roadmap f-partial-dates-arithmetic). `2006` is the whole of
 * 2006: before a day only when all of it is, after one only when all of it
 * is, and equal to another date only when the two cover the same days; a
 * span the other date falls inside is none of these. `days()` between two
 * such dates is measured from the first day each covers, and `today()`
 * against a month is read the same way. By their letters alone, "2006" <
 * "2006-03-04" would have been true, and a year would have stood before
 * every day inside it.
 */
const doc = {
  format: "graview-document",
  formatVersion: 1,
  name: "Threats",
  kinds: {
    actor: {
      fields: { name: { type: "string", required: true }, firstSeen: { type: "date" }, lastSeen: { type: "date" } },
      label: "{name}, {active} days",
      computed: { active: "days(firstSeen, lastSeen)" },
    },
  },
  acts: { "add-actor": { title: "Add an actor", creates: "actor" } },
  rules: {
    "seen-in-order": { title: "First seen before last seen", over: "actor", when: "present(firstSeen) && present(lastSeen)", require: "firstSeen <= lastSeen" },
    "not-yet": { title: "Not first seen in the future", over: "actor", when: "present(firstSeen)", require: "firstSeen <= today()" },
  },
} as unknown as GraviewDocument;

const TODAY = "2026-10-25";

function open() {
  const compiled = compileDocument(doc, { today: () => TODAY });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, invariants: (app.invariants ?? []) as never, snapshot: { nodes: [], edges: [] } as never });
}

const broken = (store: Store<AnySchema>, id: string) => store.violations().filter((violation) => violation.nodeIds.includes(id)).map((violation) => violation.invariant);

describe("the span a date covers", () => {
  it("is one day for a day, a month for a month alone and a year for a year alone", () => {
    expect(daySpanOf("2016-05-04")).toEqual({ from: "2016-05-04", to: "2016-05-04" });
    expect(daySpanOf("2016-05")).toEqual({ from: "2016-05-01", to: "2016-05-31" });
    expect(daySpanOf("2016-02")).toEqual({ from: "2016-02-01", to: "2016-02-29" });
    expect(daySpanOf("2006")).toEqual({ from: "2006-01-01", to: "2006-12-31" });
    expect(daySpanOf("May 2016")).toBeUndefined();
    expect(daySpanOf("2016-05-04T09:00")).toBeUndefined();
  });
});

describe("a rule over a date that knows only its year or its month", () => {
  it("holds before and after only when the whole span is, and equal when the spans are", () => {
    const store = open();
    // The whole of 2006 is before a day in 2007.
    store.apply({ name: "add-actor", args: { id: "actor:whole", name: "Whole", firstSeen: "2006", lastSeen: "2007-01-15" } });
    // A year is not before a day inside it: by its letters alone "2006" < "2006-03-04".
    store.apply({ name: "add-actor", args: { id: "actor:inside", name: "Inside", firstSeen: "2006", lastSeen: "2006-03-04" } });
    // Two months that are the same month are equal.
    store.apply({ name: "add-actor", args: { id: "actor:same", name: "Same", firstSeen: "2016-05", lastSeen: "2016-05" } });
    // A month before a day in the next month, and a month after a day in the one before.
    store.apply({ name: "add-actor", args: { id: "actor:month", name: "Month", firstSeen: "2016-05", lastSeen: "2016-06-01" } });
    store.apply({ name: "add-actor", args: { id: "actor:after", name: "After", firstSeen: "2016-05", lastSeen: "2016-04-30" } });
    expect(broken(store, "actor:whole")).toEqual([]);
    expect(broken(store, "actor:inside")).toEqual(["seen-in-order"]);
    expect(broken(store, "actor:same")).toEqual([]);
    expect(broken(store, "actor:month")).toEqual([]);
    expect(broken(store, "actor:after")).toEqual(["seen-in-order"]);
  });

  it("measures days() from the first day each covers", () => {
    const store = open();
    store.apply({ name: "add-actor", args: { id: "actor:apt1", name: "APT1", firstSeen: "2006", lastSeen: "2016-05" } });
    store.apply({ name: "add-actor", args: { id: "actor:apt28", name: "APT28", firstSeen: "2016-05", lastSeen: "2016-05-31" } });
    const said = (id: string) => (store.schema.definition("actor") as { label: (node: unknown) => string }).label(store.graph.getNode(id));
    // Jan 1, 2006 to May 1, 2016: ten years with two leap days, then January to April of a leap year.
    expect(said("actor:apt1")).toBe(`APT1, ${3652 + 121} days`);
    expect(said("actor:apt28")).toBe("APT28, 30 days");
  });

  it("reads today() against a month the same way: the month the day is in is neither before it nor after it", () => {
    const store = open();
    store.apply({ name: "add-actor", args: { id: "actor:last-month", name: "Last month", firstSeen: "2026-09" } });
    store.apply({ name: "add-actor", args: { id: "actor:this-month", name: "This month", firstSeen: "2026-10" } });
    store.apply({ name: "add-actor", args: { id: "actor:next-month", name: "Next month", firstSeen: "2026-11" } });
    store.apply({ name: "add-actor", args: { id: "actor:last-year", name: "Last year", firstSeen: "2025" } });
    store.apply({ name: "add-actor", args: { id: "actor:this-year", name: "This year", firstSeen: "2026" } });
    expect(broken(store, "actor:last-month")).toEqual([]);
    expect(broken(store, "actor:this-month")).toEqual(["not-yet"]);
    expect(broken(store, "actor:next-month")).toEqual(["not-yet"]);
    expect(broken(store, "actor:last-year")).toEqual([]);
    expect(broken(store, "actor:this-year")).toEqual(["not-yet"]);
  });
});
