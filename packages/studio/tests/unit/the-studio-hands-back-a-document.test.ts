import { readFileSync } from "node:fs";
import { compileDocument, compileDocumentWithoutCheck, diffDocuments, documentHash, editDocument, toDocument, type DocumentEdit, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";

/*
 * FR-54. THE STUDIO HANDS A HOST BACK A DOCUMENT.
 *
 * Opened on an app compiled from a document, the studio edited it well and
 * gave back a TypeScript app: every act a function body, every label code,
 * `text` read as `string`, the brand and the description gone. A host that
 * keeps documents — graview.cloud's builder — could not take that back, so
 * it spoke `editDocument` instead. Now the studio says its changes in
 * `editDocument`'s own ops, and the document is those ops applied to the one
 * it opened on: one source of truth, and everything the graph did not touch
 * kept as it was written.
 *
 * Cloud held this open with a test that failed the day it closed
 * (graview-cloud packages/document/tests/studio-roundtrip.test.ts); this is
 * its shape, asserting the gap is closed.
 */

const vendors = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/vendors.gdd.json", import.meta.url), "utf8")) as GraviewDocument;
const ADD = { op: "add-field", kind: "vendor", field: "soil", type: "string" } as const;

type Call = { readonly name: string; readonly args: Record<string, unknown> };

function studioOn(document: GraviewDocument) {
  const compiled = compileDocumentWithoutCheck(document);
  if (!compiled.ok) throw new Error(`the fixture must compile: ${JSON.stringify(compiled.findings)}`);
  return createStudio(compiled.app);
}

function throughTheStudio(document: GraviewDocument, calls: readonly Call[]) {
  const studio = studioOn(document);
  for (const call of calls) studio.store.apply(call as never);
  return studio;
}

function throughEditDocument(document: GraviewDocument, edits: readonly DocumentEdit[]): GraviewDocument {
  const outcome = editDocument(document, edits);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome.document;
}

describe("the studio's apply, written as a document (FR-54)", () => {
  it("adding soil to a vendor gives back the document editDocument makes, with no error", async () => {
    const studio = throughTheStudio(vendors, [{ name: "add-field", args: { kind: "declared:vendor", label: "soil", type: "string", required: false } }]);
    expect(studio.edits()).toEqual([ADD]);
    const applied = studio.apply();
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const edited = throughEditDocument(vendors, [ADD]);
    expect(applied.document).toBeDefined();
    expect(await documentHash(applied.document!)).toBe(await documentHash(edited));
    // The host compiles the document it was handed, and toDocument reads that app back without a finding.
    const compiled = compileDocument(applied.document!);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const back = toDocument(compiled.app);
    expect(back.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(await documentHash(back.document)).toBe(await documentHash(edited));
    // Nothing the graph did not touch moved: every act, the brand, the description, notes as text.
    // Said against the document as the host wrote it, keys in its own order: exactly the one change.
    expect(diffDocuments(vendors, applied.document!).sentences).toEqual(["vendor gains a field, soil (string)."]);
    expect(diffDocuments(vendors, back.document).sentences).toEqual(["vendor gains a field, soil (string)."]);
    expect(back.document.kinds["vendor"]!.fields["notes"]!.type).toBe("text");
    expect(back.document.brand).toEqual(vendors.brand);
    expect(back.document.description).toBe(vendors.description);
    expect(Object.keys(back.document.acts ?? {})).toEqual(Object.keys(vendors.acts ?? {}));
  });

  it("nothing changed: the document it opened on, and no edits", async () => {
    const studio = studioOn(vendors);
    expect(studio.edits()).toEqual([]);
    const outcome = studio.document();
    expect(outcome?.ok).toBe(true);
    if (!outcome?.ok) return;
    expect(await documentHash(outcome.document)).toBe(await documentHash(vendors));
  });

  it("a studio opened on a TypeScript app has no document to hand back", () => {
    const compiled = compileDocumentWithoutCheck(vendors);
    if (!compiled.ok) throw new Error("the fixture must compile");
    const studio = createStudio({ ...compiled.app }); // a copy: no document remembered for it
    expect(studio.document()).toBeUndefined();
    const applied = studio.apply();
    expect(applied.ok && applied.document).toBeFalsy();
  });
});

/*
 * EVERY STUDIO EDIT WITH AN editDocument EQUIVALENT gives the same document,
 * byte for byte (documentHash), as the editDocument path — the studio's ops
 * ARE editDocument's ops.
 */
describe("the studio and editDocument make the same document", () => {
  const cases: readonly { readonly name: string; readonly calls: readonly Call[]; readonly edits: readonly DocumentEdit[] }[] = [
    { name: "add-kind", calls: [{ name: "add-kind", args: { label: "venue", plural: "venues" } }], edits: [{ op: "add-kind", kind: "venue", plural: "venues", fields: { label: { type: "string", required: true } } }] },
    { name: "rename-kind", calls: [{ name: "rename-kind", args: { id: "declared:category", label: "need" } }], edits: [{ op: "rename-kind", kind: "category", to: "need" }] },
    { name: "remove-kind", calls: [{ name: "remove-kind", args: { id: "declared:category" } }], edits: [{ op: "remove-kind", kind: "category" }] },
    { name: "add-field", calls: [{ name: "add-field", args: { kind: "declared:vendor", label: "phone", type: "string", required: true, description: "Phone number" } }], edits: [{ op: "add-field", kind: "vendor", field: "phone", type: "string", required: true, label: "Phone number" }] },
    { name: "add-field (a choice)", calls: [{ name: "add-field", args: { kind: "declared:vendor", label: "tier", type: "enum", required: false, options: ["gold", "silver"] } }], edits: [{ op: "add-field", kind: "vendor", field: "tier", type: "enum", options: ["gold", "silver"] }] },
    { name: "add-field (an integer)", calls: [{ name: "add-field", args: { kind: "declared:vendor", label: "guests", type: "integer", required: false } }], edits: [{ op: "add-field", kind: "vendor", field: "guests", type: "integer" }] },
    { name: "rename-field", calls: [{ name: "rename-field", args: { id: "field:vendor.quote", to: "price" } }], edits: [{ op: "rename-field", kind: "vendor", field: "quote", to: "price" }] },
    { name: "remove-field", calls: [{ name: "remove-field", args: { id: "field:vendor.notes" } }], edits: [{ op: "remove-field", kind: "vendor", field: "notes" }] },
    { name: "retype-field", calls: [{ name: "retype-field", args: { id: "field:vendor.notes", type: "string" } }], edits: [{ op: "retype-field", kind: "vendor", field: "notes", type: "string" }] },
    { name: "set-required", calls: [{ name: "set-required", args: { id: "field:vendor.due", required: true } }], edits: [{ op: "set-required", kind: "vendor", field: "due", required: true }] },
    { name: "set-options", calls: [{ name: "set-options", args: { id: "field:vendor.status", options: ["researching", "contacted", "booked", "declined", "waitlisted"] } }], edits: [{ op: "set-options", kind: "vendor", field: "status", add: ["waitlisted"] }] },
    { name: "set-label", calls: [{ name: "describe-field", args: { id: "field:vendor.due", description: "Answer by" } }], edits: [{ op: "set-label", kind: "vendor", field: "due", label: "Answer by" }] },
    { name: "add-relation", calls: [{ name: "add-edge", args: { kind: "declared:vendor", label: "backup", to: "declared:vendor", cardinality: "one", description: "who stands in" } }], edits: [{ op: "add-relation", kind: "vendor", relation: "backup", to: ["vendor"], cardinality: "one", description: "who stands in" }] },
    { name: "rename-relation", calls: [{ name: "edit-edge", args: { id: "edge:vendor.fills", label: "fillsNeed" } }], edits: [{ op: "rename-relation", kind: "vendor", relation: "fills", to: "fillsNeed" }] },
    { name: "remove-relation", calls: [{ name: "remove-edge", args: { id: "edge:vendor.fills" } }], edits: [{ op: "remove-relation", kind: "vendor", relation: "fills" }] },
    { name: "remove-act", calls: [{ name: "remove-act", args: { id: "act:decline" } }], edits: [{ op: "remove-act", act: "decline" }] },
    { name: "remove-rule", calls: [{ name: "remove-rule", args: { id: "rule:within-budget" } }], edits: [{ op: "remove-rule", rule: "within-budget" }] },
    {
      name: "add-rule",
      calls: [{ name: "add-rule", args: { kind: "declared:vendor", label: "due-when-contacted", description: "A contacted vendor has a date to answer by.", require: "due != null", when: "status == 'contacted'", says: "{name} has no date" } }],
      edits: [{ op: "add-rule", rule: "due-when-contacted", over: "vendor", description: "A contacted vendor has a date to answer by.", require: "due != null", when: "status == 'contacted'", says: "{name} has no date" }],
    },
  ];

  it.each(cases.map((c) => [c.name, c] as const))("%s", async (_name, c) => {
    const studio = throughTheStudio(vendors, c.calls);
    expect(studio.edits()).toEqual(c.edits);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(await documentHash(outcome.document)).toBe(await documentHash(throughEditDocument(vendors, c.edits)));
  });
});

/*
 * A FIELD TYPE THE STUDIO CANNOT EDIT IS NAMED, NOT COERCED. The studio's
 * types are the document's eleven, so an integer, a date and time, a link
 * or an address is read as what it is and survives a change elsewhere
 * untouched. What a field carries besides its type — how a number is shown
 * (money, percent, duration), its unit, what a list holds — the studio does
 * not edit; a change that would decide it is refused in words.
 */
describe("what the studio does not edit, it names", () => {
  const typed: GraviewDocument = {
    ...vendors,
    kinds: {
      ...vendors.kinds,
      vendor: {
        ...vendors.kinds["vendor"]!,
        fields: {
          ...vendors.kinds["vendor"]!.fields,
          guests: { type: "integer", unit: "people" },
          answered: { type: "datetime" },
          site: { type: "url" },
          email: { type: "email" },
          tags: { type: "list", of: "number" },
        },
      },
    },
  } as GraviewDocument;

  it("reads every document type as itself", () => {
    const studio = studioOn(typed);
    const types = Object.fromEntries(
      studio.store
        .snapshot()
        .nodes.filter((node) => node.kind === "field" && node.id.startsWith("field:vendor."))
        .map((node) => [String((node as { label?: unknown }).label), String((node as { type?: unknown }).type)]),
    );
    expect(types).toMatchObject({ notes: "text", quote: "number", due: "date", guests: "integer", answered: "datetime", site: "url", email: "email", tags: "list" });
  });

  it("an integer, a datetime, a url, an email, a unit, a format and a list's element survive an unrelated edit untouched", async () => {
    const studio = throughTheStudio(typed, [{ name: "add-field", args: { kind: "declared:category", label: "deadline", type: "date", required: false } }]);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(outcome.document.kinds["vendor"]).toEqual(typed.kinds["vendor"]);
    expect(await documentHash(outcome.document)).toBe(await documentHash(throughEditDocument(typed, [{ op: "add-field", kind: "category", field: "deadline", type: "date" }])));
  });

  it("retyping a field that carries a format, a unit or a list's element is refused in words, not carried half", () => {
    const studio = throughTheStudio(typed, [{ name: "retype-field", args: { id: "field:vendor.quote", type: "string" } }]);
    const outcome = studio.document();
    expect(outcome?.ok).toBe(false);
    if (outcome?.ok !== false) return;
    expect(outcome.findings.map((finding) => finding.message).join(" ")).toMatch(/quote.*money.*studio/);
    const applied = studio.apply();
    expect(applied.ok && applied.document).toBeFalsy();
    if (applied.ok) expect(applied.documentFindings?.length).toBeGreaterThan(0);
  });

  it("a change no edit can say yet is named, not dropped", () => {
    const studio = throughTheStudio(vendors, [{ name: "edit-edge", args: { id: "edge:vendor.fills", cardinality: "many" } }]);
    const outcome = studio.document();
    expect(outcome?.ok).toBe(false);
    if (outcome?.ok !== false) return;
    expect(outcome.findings[0]!.message).toMatch(/fills/);
  });
});
