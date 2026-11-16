import { readFileSync } from "node:fs";
import { compileDocumentWithoutCheck, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";

/*
 * THE STUDIO WRITES BACK NAMES THAT SWAP. Renaming kind a to tmp, b to a and
 * tmp to b leaves the two kinds with each other's names, and the studio
 * said that as "rename a to b, rename b to a": the first is refused, since
 * there is already a kind b, so no document came back. The renames are
 * ordered so none lands on a name still taken, and a cycle of them goes
 * through a name of its own, so a swap and a three-way turn write back.
 */
const vendors = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/vendors.gdd.json", import.meta.url), "utf8")) as GraviewDocument;

const three: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Orchard",
  kinds: {
    apple: { fields: { name: { type: "string", required: true }, crisp: { type: "boolean" } }, edges: { growsNear: { to: ["berry"] }, shadedBy: { to: ["cherry"] } } },
    berry: { fields: { name: { type: "string", required: true }, tart: { type: "boolean" } } },
    cherry: { fields: { name: { type: "string", required: true }, dark: { type: "boolean" } } },
  },
} as never;

type Call = { readonly name: string; readonly args: Record<string, unknown> };

function throughTheStudio(document: GraviewDocument, calls: readonly Call[]) {
  const compiled = compileDocumentWithoutCheck(document);
  if (!compiled.ok) throw new Error(`the fixture must compile: ${JSON.stringify(compiled.findings)}`);
  const studio = createStudio(compiled.app);
  for (const call of calls) studio.store.apply(call as never);
  return studio;
}

const renameKind = (id: string, label: string): Call => ({ name: "rename-kind", args: { id: `declared:${id}`, label } });
const fieldsOf = (document: GraviewDocument) => Object.fromEntries(Object.entries(document.kinds).map(([kind, spec]) => [kind, Object.keys(spec.fields)]));

describe("the studio writes back names that swap", () => {
  it("swaps two kinds' names through a third, and the document comes back", () => {
    const studio = throughTheStudio(vendors, [renameKind("category", "tmp"), renameKind("vendor", "category"), renameKind("category", "vendor")]);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(fieldsOf(outcome.document)).toEqual({ vendor: ["name", "budget"], category: ["name", "status", "quote", "due", "notes"] });
  });

  it("turns three kinds' names one place round, and the document comes back", () => {
    const studio = throughTheStudio(three, [renameKind("apple", "spare"), renameKind("cherry", "apple"), renameKind("berry", "cherry"), renameKind("apple", "berry")]);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(fieldsOf(outcome.document)).toEqual({ berry: ["name", "crisp"], cherry: ["name", "tart"], apple: ["name", "dark"] });
  });

  it("orders a chain of renames so none lands on a name still taken, with no name of its own", () => {
    // apple → berry while berry → cherry: berry must move first.
    const studio = throughTheStudio(three, [renameKind("cherry", "date"), renameKind("berry", "cherry"), renameKind("apple", "berry")]);
    expect(studio.edits().filter((edit) => edit.op === "rename-kind")).toEqual([
      { op: "rename-kind", kind: "cherry", to: "date" },
      { op: "rename-kind", kind: "berry", to: "cherry" },
      { op: "rename-kind", kind: "apple", to: "berry" },
    ]);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(fieldsOf(outcome.document)).toEqual({ berry: ["name", "crisp"], cherry: ["name", "tart"], date: ["name", "dark"] });
  });

  it("swaps two fields' names on one kind, and their values go with them", () => {
    const studio = throughTheStudio(vendors, [
      { name: "rename-field", args: { id: "field:vendor.due", to: "spare" } },
      { name: "rename-field", args: { id: "field:vendor.notes", to: "due" } },
      { name: "rename-field", args: { id: "field:vendor.due", to: "notes" } },
    ]);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    // Each continues the values of the field it was, through the name it stepped aside to.
    expect(outcome.document.kinds["vendor"]!.fields["notes"]).toEqual({ ...vendors.kinds["vendor"]!.fields["due"], renamedFrom: "due" });
    expect(outcome.document.kinds["vendor"]!.fields["due"]).toEqual({ ...vendors.kinds["vendor"]!.fields["notes"], renamedFrom: "notes" });
  });

  it("names a field a rule judged by its new name, and says no change to the rule", () => {
    const studio = throughTheStudio(vendors, [
      { name: "rename-field", args: { id: "field:vendor.quote", to: "spare" } },
      { name: "rename-field", args: { id: "field:vendor.notes", to: "quote" } },
      { name: "rename-field", args: { id: "field:vendor.quote", to: "notes" } },
    ]);
    expect(studio.edits().every((edit) => edit.op === "rename-field")).toBe(true);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(outcome.document.rules?.["booked-needs-quote"]?.require).toBe("notes != null");
  });

  it("swaps two relations' camelCase names, and the document comes back", () => {
    const studio = throughTheStudio(three, [
      { name: "edit-edge", args: { id: "edge:apple.growsNear", label: "spare" } },
      { name: "edit-edge", args: { id: "edge:apple.shadedBy", label: "growsNear" } },
      { name: "edit-edge", args: { id: "edge:apple.growsNear", label: "shadedBy" } },
    ]);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    const edges = outcome.document.kinds["apple"]!.edges as Record<string, { to: string[] }>;
    expect(edges["shadedBy"]!.to).toEqual(["berry"]);
    expect(edges["growsNear"]!.to).toEqual(["cherry"]);
  });
});
