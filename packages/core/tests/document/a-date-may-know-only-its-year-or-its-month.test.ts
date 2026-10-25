import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import type { GraviewDocument } from "../../src/document/index.js";
import { fieldSpecOf } from "../../src/document/field-spec.js";
import { importRows } from "../../src/import/index.js";
import { dayAsRead, whenAsRead } from "../../src/days.js";
import { readableFields } from "../../src/words.js";
import { arrange } from "../../src/arrange.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A DATE MAY KNOW ONLY ITS YEAR OR ITS MONTH (Roadmap f-partial-dates).
 * History often knows a year alone — APT1 was first seen in 2006 — and an
 * agent that could keep only a day stored `2006-01-01`, a false exact date.
 * A document's date now holds a year (`2006`) or a month (`2016-05`) as
 * well as a day, said "2006" and "May 2016", sorted before the days within
 * them, and read so from a sheet.
 */
const doc = {
  format: "graview-document",
  formatVersion: 1,
  name: "Threats",
  kinds: {
    actor: { fields: { name: { type: "string", required: true }, firstSeen: { type: "date" } } },
  },
  acts: { "add-actor": { title: "Add an actor", creates: "actor" } },
} as unknown as GraviewDocument;

function open() {
  const compiled = compileDocument(doc, { today: () => "2026-10-25" });
  if (!compiled.ok) throw new Error("the document compiles");
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: { nodes: [], edges: [] } as never });
}

describe("a date that knows only its year or its month", () => {
  it("is kept as it is given, and a month or a day that is no such thing is refused", () => {
    const store = open();
    store.apply({ name: "add-actor", args: { id: "actor:apt1", name: "APT1", firstSeen: "2006" } });
    store.apply({ name: "add-actor", args: { id: "actor:apt28", name: "APT28", firstSeen: "2016-05" } });
    expect(store.graph.getNode("actor:apt1")).toMatchObject({ firstSeen: "2006" });
    expect(store.graph.getNode("actor:apt28")).toMatchObject({ firstSeen: "2016-05" });
    for (const wrong of ["2016-13", "16", "May 2016", "2016-5"]) expect(() => store.apply({ name: "add-actor", args: { name: "X", firstSeen: wrong } })).toThrow();
    store.apply({ name: "edit-actor", args: { id: "actor:apt1", firstSeen: "2006-02" } });
    expect(store.graph.getNode("actor:apt1")).toMatchObject({ firstSeen: "2006-02" });
  });

  it("is still a date field to everything that asks", () => {
    const store = open();
    const shape = (store.schema.tryDefinition("actor")!.fields as unknown as { shape: Record<string, unknown> }).shape;
    expect(fieldSpecOf(shape["firstSeen"])?.type).toBe("date");
  });

  it("is said as a year, or a month and its year", () => {
    expect(dayAsRead("2006")).toBe("2006");
    expect(dayAsRead("2016-05")).toBe("May 2016");
    expect(whenAsRead("2016-05")).toBe("May 2016");
    expect(dayAsRead("2016-05-04")).toBe("May 4, 2016");
    const store = open();
    store.apply({ name: "add-actor", args: { id: "actor:apt28", name: "APT28", firstSeen: "2016-05" } });
    const definition = store.schema.tryDefinition("actor");
    const facts = readableFields(store.graph.getNode("actor:apt28") as never, definition);
    expect(facts.find((fact) => fact.key === "firstSeen")?.value).toBe("May 2016");
  });

  it("sorts before the days within it, and in its year's place", () => {
    const store = open();
    for (const [id, firstSeen] of [["a", "2016-05-20"], ["b", "2006"], ["c", "2016-05"], ["d", "2016"], ["e", "2015-12-31"]] as const) {
      store.apply({ name: "add-actor", args: { id: `actor:${id}`, name: id.toUpperCase(), firstSeen } });
    }
    const ctx = { schema: store.schema, graph: store.graph } as never;
    const sorted = arrange(store.graph.nodesOfKind("actor" as never) as never, { sort: { by: "firstSeen" } } as never, ctx);
    expect((sorted.nodes as readonly { firstSeen: string }[]).map((node) => node.firstSeen)).toEqual(["2006", "2015-12-31", "2016", "2016-05", "2016-05-20"]);
    // Grouped by year, a year alone is in its year; by month, a month alone is in its month and a year alone stands by itself before them.
    const byYear = arrange(store.graph.nodesOfKind("actor" as never) as never, { group: { by: "firstSeen", bucket: "year" } } as never, ctx);
    expect(byYear.groups.map((group) => [group.label, group.nodes.length])).toEqual([["2006", 1], ["2015", 1], ["2016", 3]]);
    const byMonth = arrange(store.graph.nodesOfKind("actor" as never) as never, { group: { by: "firstSeen", bucket: "month" } } as never, ctx);
    expect(byMonth.groups.map((group) => [group.label, group.nodes.length])).toEqual([["2006", 1], ["December 2015", 1], ["2016", 1], ["May 2016", 2]]);
  });

  it("is read from a sheet that says a year or a month", () => {
    const store = open();
    const rows = [["Name", "First seen"], ["APT1", "2006"], ["APT28", "May 2016"], ["APT29", "2008-07"]];
    const result = importRows(store, "actor", rows, { Name: "name", "First seen": "firstSeen" } as never, { by: { kind: "human", id: "u:nick" } });
    expect(result.refused).toBe(0);
    expect(store.graph.nodesOfKind("actor" as never).map((node) => (node as unknown as { firstSeen: string }).firstSeen).sort()).toEqual(["2006", "2008-07", "2016-05"]);
  });
});
