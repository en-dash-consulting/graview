import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import type { GraviewDocument } from "../../src/document/index.js";
import { importRows } from "../../src/import/index.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A WRONG DATE CAN BE TAKEN AWAY (Roadmap f-partial-dates, its clearing
 * half). `edit-<kind>` refused `null` ("expected string") and `""` for a
 * date, and an import read an empty cell as no change, so a date an agent
 * guessed could be overwritten with another guess and never removed. Now
 * `null` clears a field a record may be without, on the edit and through an
 * import that says `blanksClear`; a required field still refuses it.
 */
const doc = {
  format: "graview-document",
  formatVersion: 1,
  name: "Threats",
  kinds: {
    actor: {
      fields: { name: { type: "string", required: true }, firstSeen: { type: "date" }, origin: { type: "string" } },
    },
  },
  acts: { "add-actor": { title: "Add an actor", creates: "actor" } },
} as unknown as GraviewDocument;

function open() {
  const compiled = compileDocument(doc, { today: () => "2026-10-25" });
  if (!compiled.ok) throw new Error("the document compiles");
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    snapshot: { nodes: [{ id: "actor:apt1", kind: "actor", name: "APT1", firstSeen: "2006-01-01", origin: "Shanghai" }], edges: [] } as never,
  });
}

describe("a date an edit is told is null", () => {
  it("is cleared, and undo puts it back", () => {
    const store = open();
    const result = store.apply({ name: "edit-actor", args: { id: "actor:apt1", firstSeen: null } });
    expect(store.graph.getNode("actor:apt1")).not.toHaveProperty("firstSeen");
    expect(store.graph.getNode("actor:apt1")).toMatchObject({ origin: "Shanghai" });
    store.undo(result.batch);
    expect(store.graph.getNode("actor:apt1")).toMatchObject({ firstSeen: "2006-01-01" });
  });

  it("is refused for a field every record needs", () => {
    const store = open();
    expect(() => store.apply({ name: "edit-actor", args: { id: "actor:apt1", name: null } })).toThrow();
    expect(store.graph.getNode("actor:apt1")).toMatchObject({ name: "APT1" });
  });
});

describe("an import that says a blank cell clears", () => {
  const rows = [
    ["Name", "First seen", "Origin"],
    ["APT1", "", "Shanghai"],
  ];
  const mapping = { Name: "name", "First seen": "firstSeen", Origin: "origin" };

  it("leaves the date alone when it does not say so", () => {
    const store = open();
    const result = importRows(store, "actor", rows, mapping as never, { by: { kind: "human", id: "u:nick" }, match: "label" });
    expect(result.unchanged).toBe(1);
    expect(store.graph.getNode("actor:apt1")).toMatchObject({ firstSeen: "2006-01-01" });
  });

  it("clears the date the row leaves blank, and says so", () => {
    const store = open();
    const result = importRows(store, "actor", rows, mapping as never, { by: { kind: "human", id: "u:nick" }, match: "label", blanksClear: true });
    expect(result.changed).toBe(1);
    expect(result.rows[0]?.sentence).toMatch(/First seen: .* → nothing/);
    expect(store.graph.getNode("actor:apt1")).not.toHaveProperty("firstSeen");
    expect(store.graph.getNode("actor:apt1")).toMatchObject({ origin: "Shanghai", name: "APT1" });
  });
});
