import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument, planMigration, type GraviewDocument } from "../../src/document/index.js";
import { UNSET } from "../../src/index.js";

/**
 * A RELATION TO ANOTHER APP'S KIND, MADE BY AN EDIT. What a whole document
 * may declare since FR-171 — `"forHouse": { "to": ["@nick/house/house"] }` —
 * an `add-relation` edit makes too, so a builder that changes an app by
 * edits (Cloud's `propose_change`, the studio) can link it to another app;
 * and what the checker refuses of such a relation, the edit refuses in the
 * checker's own words.
 */
const scenarios = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Purchase scenarios",
    kinds: {
      scenario: { fields: { name: { type: "string", required: true }, budget: { type: "number", format: "money" } } },
      offer: { fields: { amount: { type: "number", format: "money" } } },
    },
    acts: { "add-scenario": { title: "Add a scenario", creates: "scenario" } },
  }) as unknown as GraviewDocument;

const errors = (doc: unknown) => compileDocument(doc, { today: () => "2026-10-18" }).findings.filter((f) => f.severity === "error");

const edited = (edits: readonly unknown[], doc: GraviewDocument = scenarios()) => {
  const outcome = editDocument(doc, edits);
  if (!outcome.ok) throw new Error(`the edit applies: ${JSON.stringify(outcome.findings)}`);
  return outcome;
};

const refused = (edits: readonly unknown[]) => {
  const outcome = editDocument(scenarios(), edits);
  if (outcome.ok) throw new Error("the edit is refused");
  return outcome.findings.map((f) => `${f.code} at ${f.path}: ${f.message}`);
};

const FOR_HOUSE = { op: "add-relation", kind: "scenario", relation: "forHouse", to: ["@nick/house/house"], cardinality: "one" };

describe("an add-relation edit can name another app's kind", () => {
  it("gives a document that checks clean, its relation going to that app's kind", () => {
    const { document } = edited([FOR_HOUSE]);
    expect((document.kinds as Record<string, { edges?: Record<string, unknown> }>).scenario!.edges!.forHouse).toEqual({ to: ["@nick/house/house"], cardinality: "one" });
    expect(errors(document)).toEqual([]);
  });

  it("takes one far kind written as a word rather than a list", () => {
    const { document } = edited([{ ...FOR_HOUSE, to: "@nick/house/house" }]);
    expect(errors(document)).toEqual([]);
  });

  it("says the far kind as people say it: the kind, in the app at its address", () => {
    expect(edited([FOR_HOUSE]).said).toEqual(['scenario gains a relation, "forHouse", to one house in the app @nick/house, another app, read there as whoever is looking.']);
    expect(edited([{ ...FOR_HOUSE, relation: "comparables", to: ["@nick/house/house", "@nick/house/flat"], cardinality: "many" }]).said).toEqual([
      'scenario gains a relation, "comparables", to houses or flats in the app @nick/house, another app, read there as whoever is looking.',
    ]);
  });

  it("refuses a relation to a kind here and a kind in another app beside it, with the checker's linked-mixed", () => {
    expect(refused([{ ...FOR_HOUSE, to: ["@nick/house/house", "offer"] }])).toEqual([expect.stringMatching(/^linked-mixed at edits\.0\.to: scenario's forHouse goes to "offer" here and to another app beside it/)]);
  });

  it("refuses a relation to kinds in two apps, with the checker's linked-apps", () => {
    expect(refused([{ ...FOR_HOUSE, to: ["@nick/house/house", "@ana/flats/flat"] }])).toEqual([expect.stringMatching(/^linked-apps at edits\.0\.to: scenario's forHouse goes to kinds in 2 apps \(@nick\/house, @ana\/flats\)/)]);
  });

  it("refuses what does not name a kind in another app, a name from the far end, and an append-only far relation, as the checker does", () => {
    // The document's own shape already refuses what is no kind's name anywhere, as it does in a whole document.
    expect(refused([{ ...FOR_HOUSE, to: ["@nick"] }])).toEqual(['edit at edits.0.to.0: a relation goes to a kind of this document, like "house", or of another app, like "@nick/house/house"']);
    expect(refused([{ ...FOR_HOUSE, inverse: "scenarios" }])).toEqual([expect.stringMatching(/^linked-inverse at edits\.0\.inverse: /)]);
    expect(refused([{ ...FOR_HOUSE, cardinality: "many", appendOnly: true }])).toEqual([expect.stringMatching(/^linked-append-only at edits\.0\.appendOnly: /)]);
  });

  it("still refuses a kind this app does not have, when no target names another app", () => {
    expect(refused([{ ...FOR_HOUSE, to: ["house"] }])).toEqual(['edit at edits.0.to: "house" is not a kind this app has']);
  });

  it("renames and removes a far relation, which keeps checking clean", () => {
    const made = edited([FOR_HOUSE]).document;
    const renamed = edited([{ op: "rename-relation", kind: "scenario", relation: "forHouse", to: "home" }], made);
    expect((renamed.document.kinds as Record<string, { edges?: Record<string, unknown> }>).scenario!.edges).toEqual({ home: { to: ["@nick/house/house"], cardinality: "one", renamedFrom: "forHouse" } });
    expect(errors(renamed.document)).toEqual([]);
    const removed = edited([{ op: "remove-relation", kind: "scenario", relation: "home" }], renamed.document);
    expect((removed.document.kinds as Record<string, { edges?: unknown }>).scenario!.edges).toBeUndefined();
    expect(errors(removed.document)).toEqual([]);
  });

  it("keeps the far records a scenario links through another change, and moves them with a rename", () => {
    const made = edited([FOR_HOUSE]).document;
    const graph = { nodes: [{ id: "s1", kind: "scenario", name: "First", forHouse: "house:h1" }], edges: [] };
    const widened = edited([{ op: "add-field", kind: "scenario", field: "notes", spec: { type: "text" } }], made).document;
    expect(planMigration(made, widened, graph).primitives).toEqual([]);
    const renamed = edited([{ op: "rename-relation", kind: "scenario", relation: "forHouse", to: "home" }], made);
    const plan = planMigration(made, renamed.document, graph);
    expect(plan.primitives).toEqual([{ op: "patch-node", id: "s1", before: { forHouse: "house:h1", home: UNSET }, after: { forHouse: UNSET, home: "house:h1" } }]);
    expect(plan.words).toEqual(['"forHouse" renamed to "home", links kept (1 record).']);
    const removed = edited([{ op: "remove-relation", kind: "scenario", relation: "forHouse" }], made).document;
    expect(planMigration(made, removed, graph).primitives).toEqual([{ op: "patch-node", id: "s1", before: { forHouse: "house:h1" }, after: { forHouse: UNSET } }]);
  });

  it("leaves a far relation alone when a kind of this app is renamed or removed, and a computed field may walk it", () => {
    const made = edited([FOR_HOUSE, { op: "set-computed", kind: "scenario", name: "room", expr: "budget - forHouse.listPrice" }]).document;
    expect(errors(made)).toEqual([]);
    const renamed = edited([{ op: "rename-kind", kind: "offer", to: "bid" }, { op: "remove-kind", kind: "bid" }], made);
    expect((renamed.document.kinds as Record<string, { edges?: Record<string, unknown> }>).scenario!.edges!.forHouse).toEqual({ to: ["@nick/house/house"], cardinality: "one" });
    expect(errors(renamed.document)).toEqual([]);
  });
});
