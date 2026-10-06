import { readFileSync } from "node:fs";
import { checkApp } from "@graview/core/check";
import { compileDocumentWithoutCheck, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createStudio, STUDIO_MUTATIONS, studioApp } from "../../src/index.js";

/**
 * FR-61: A FIELD CHANGES IN PLACE.
 *
 * The studio added, renamed and removed kinds, fields and edges, and nothing
 * named changed what a field IS — its type, whether it must be given, its
 * options, what it is for — though `documentEdits` already says each as
 * `retype-field`, `set-required`, `set-options` and `set-label`. Graview
 * Cloud kept forms under the studio for exactly these. Now each is an act
 * of the studio's own, and each says itself as the one edit a person writing
 * the document by hand would write.
 */
const vendors = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/vendors.gdd.json", import.meta.url), "utf8")) as GraviewDocument;

function studio() {
  const compiled = compileDocumentWithoutCheck(vendors);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return createStudio(compiled.app);
}

describe("a field changes in place (FR-61)", () => {
  it("the studio offers an act for a field's type, its required flag, its options and its description", () => {
    const names = STUDIO_MUTATIONS.map((mutation) => mutation.name);
    expect(names).toEqual(expect.arrayContaining(["retype-field", "set-required", "set-options", "describe-field"]));
    // Held to the standard the checker holds every app to.
    expect(checkApp(studioApp()).errors).toBe(0);
    // And named, so no derived "Change the field" offers them, or the name, a second way.
    expect(studio().store.allMutations().map((mutation) => mutation.name)).not.toContain("edit-field");
  });

  it("vendor's notes, from text to string, is one retype-field", () => {
    const s = studio();
    s.store.apply({ name: "retype-field", args: { id: "field:vendor.notes", type: "string" } });
    expect(s.edits()).toEqual([{ op: "retype-field", kind: "vendor", field: "notes", type: "string" }]);
    const applied = s.apply();
    expect(applied.ok && applied.document?.kinds["vendor"]?.fields["notes"]?.type).toBe("string");
  });

  it("required, options and description are set-required, set-options and set-label", () => {
    const s = studio();
    s.store.apply({ name: "set-required", args: { id: "field:vendor.due", required: true } });
    s.store.apply({ name: "set-options", args: { id: "field:vendor.status", options: ["researching", "contacted", "booked", "declined", "shortlisted"] } });
    s.store.apply({ name: "describe-field", args: { id: "field:vendor.notes", description: "what we heard on the call" } });
    expect(s.edits()).toEqual([
      { op: "set-options", kind: "vendor", field: "status", add: ["shortlisted"] },
      { op: "set-required", kind: "vendor", field: "due", required: true },
      { op: "set-label", kind: "vendor", field: "notes", label: "what we heard on the call" },
    ]);
    expect(s.apply().ok).toBe(true);
  });

  it("a field made an enum is given its options, and one made something else lets them go", () => {
    const s = studio();
    s.store.apply({ name: "retype-field", args: { id: "field:vendor.notes", type: "enum", options: ["good", "bad"] } });
    expect(s.edits()).toEqual([{ op: "retype-field", kind: "vendor", field: "notes", type: "enum", options: ["good", "bad"] }]);
    expect(() => s.store.apply({ name: "retype-field", args: { id: "field:vendor.due", type: "enum" } })).toThrow(/options/);
    s.store.apply({ name: "retype-field", args: { id: "field:vendor.status", type: "string" } });
    expect(s.store.graph.getNode("field:vendor.status")).not.toHaveProperty("options");
  });

  it("options given to a field that is not an enum make it one, said as the retype it is, never refused", () => {
    const s = studio();
    s.store.apply({ name: "set-options", args: { id: "field:vendor.due", options: ["this week", "next week"] } });
    expect(s.edits()).toEqual([{ op: "retype-field", kind: "vendor", field: "due", type: "enum", options: ["this week", "next week"] }]);
  });

  it("each is undone like any other act", () => {
    const s = studio();
    s.store.apply({ name: "retype-field", args: { id: "field:vendor.notes", type: "string" } });
    s.store.undo(s.store.batches().at(-1)!.id);
    expect(s.edits()).toEqual([]);
  });

  it("a field that is money is still not retyped: the document refuses it in words", () => {
    const s = studio();
    s.store.apply({ name: "retype-field", args: { id: "field:vendor.quote", type: "integer" } });
    const said = s.document();
    expect(said?.ok).toBe(false);
    if (said?.ok !== false) return;
    expect(said.findings.map((finding) => finding.path)).toEqual(["kinds.vendor.fields.quote"]);
  });
});
