import { compileDocumentWithoutCheck, type GraviewDocument } from "@graview/core/document";
import { compileDocument } from "@graview/core/check";
import { linkedRelations } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";

/*
 * A RELATION TO ANOTHER APP'S KIND, IN THE STUDIO. Opened on a document that
 * links another app's record, the studio read the link as a plain text field;
 * it could not make one. Now it reads it as the relation it is, makes one
 * with an act of its own, and says it as editDocument's `add-relation` with
 * the far kind as its `to`.
 */
const scenarios = (edges?: Record<string, unknown>): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Purchase scenarios",
    kinds: { scenario: { fields: { name: { type: "string", required: true } }, ...(edges ? { edges } : {}) } },
    acts: { "add-scenario": { title: "Add a scenario", creates: "scenario" } },
  }) as unknown as GraviewDocument;

const FOR_HOUSE = { to: ["@nick/house/house"], cardinality: "one" };

function studioOn(document: GraviewDocument) {
  const compiled = compileDocumentWithoutCheck(document);
  if (!compiled.ok) throw new Error(`the fixture compiles: ${JSON.stringify(compiled.findings)}`);
  return createStudio(compiled.app, { document });
}

describe("the studio makes a relation to another app's kind", () => {
  it("adds one by its act, and says it as add-relation to the far kind, giving a document that checks clean", () => {
    const studio = studioOn(scenarios());
    studio.store.apply({ name: "add-edge-to-another-app", args: { kind: "declared:scenario", label: "forHouse", to: "@nick/house/house", cardinality: "one" } } as never);
    expect(studio.edits()).toEqual([{ op: "add-relation", kind: "scenario", relation: "forHouse", to: ["@nick/house/house"], cardinality: "one" }]);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(compileDocument(outcome.document).findings.filter((f) => f.severity === "error")).toEqual([]);
    const applied = studio.apply();
    if (!applied.ok) throw new Error(JSON.stringify(applied));
    // The app it hands back keeps the link where a declaration keeps one: a field that names the far kind.
    const scenario = applied.app.schema.definition("scenario");
    expect(linkedRelations(scenario).get("forHouse")).toEqual({ address: "@nick/house", kinds: ["house"], cardinality: "one" });
    expect(Object.keys(scenario.edges)).toEqual([]);
  });

  it("refuses what does not name a kind in another app", () => {
    const studio = studioOn(scenarios());
    expect(() => studio.store.apply({ name: "add-edge-to-another-app", args: { kind: "declared:scenario", label: "forHouse", to: "house" } } as never)).toThrow(/"house" does not name a kind in another app/);
  });

  it("reads one it opened on as a relation, not a field, and keeps it through another change", () => {
    const studio = studioOn(scenarios({ forHouse: FOR_HOUSE }));
    const graph = studio.store.graph;
    expect(graph.getNode("field:scenario.forHouse")).toBeUndefined();
    expect(graph.getNode("edge:scenario.forHouse")).toMatchObject({ kind: "edge", label: "forHouse", cardinality: "one", toAnotherApp: ["@nick/house/house"] });
    expect(studio.edits()).toEqual([]);
    studio.store.apply({ name: "add-field", args: { kind: "declared:scenario", label: "notes", type: "string", required: false } } as never);
    expect(studio.edits()).toEqual([{ op: "add-field", kind: "scenario", field: "notes", type: "string" }]);
    const applied = studio.apply();
    if (!applied.ok) throw new Error(JSON.stringify(applied));
    expect(linkedRelations(applied.app.schema.definition("scenario")).get("forHouse")).toEqual({ address: "@nick/house", kinds: ["house"], cardinality: "one" });
    expect((applied.document!.kinds.scenario!.edges as Record<string, unknown>).forHouse).toEqual(FOR_HOUSE);
  });

  it("removes one as editDocument's own remove-relation", () => {
    const removing = studioOn(scenarios({ forHouse: FOR_HOUSE }));
    removing.store.apply({ name: "remove-edge", args: { id: "edge:scenario.forHouse" } } as never);
    expect(removing.edits()).toEqual([{ op: "remove-relation", kind: "scenario", relation: "forHouse" }]);
  });

  it("writes the link back to a checkout as the field a declaration keeps it in", () => {
    const studio = studioOn(scenarios());
    studio.store.apply({ name: "add-edge-to-another-app", args: { kind: "declared:scenario", label: "forHouse", to: "@nick/house/house", cardinality: "one" } } as never);
    const source = studio.files().map((file) => file.contents).join("\n");
    expect(source).toContain('forHouse: linkedRecordField(["@nick/house/house"]).optional()');
    expect(source).toMatch(/import \{[^}]*linkedRecordField[^}]*\} from "@graview\/core"/);
  });
});
