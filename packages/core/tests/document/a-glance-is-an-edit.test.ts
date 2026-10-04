import { describe, expect, it } from "vitest";
import { diffDocuments, editDocument, EDIT_OPS, type GraviewDocument } from "../../src/document/index.js";

/**
 * A GLANCE IS AN EDIT. A document says what a glance at a kind says
 * (`kinds.<kind>.glance`, FR-39), and a host that changes a document by
 * `editDocument` had no op for it: the choice could be read, compiled and
 * diffed, but not made. `set-glance` makes it — the names checked like any
 * other name an edit gives, and an empty list taking the choice away.
 */
const vendors: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Vendors",
  kinds: {
    vendor: {
      fields: { name: { type: "string", required: true }, quote: { type: "number", format: "money" }, due: { type: "date" }, notes: { type: "text" } },
    },
  },
} as GraviewDocument;

describe("set-glance", () => {
  it("is one of the edits Graview knows", () => {
    expect(EDIT_OPS).toContain("set-glance");
  });

  it("says which fields a glance at a kind shows, in that order, and says so in words", () => {
    const outcome = editDocument(vendors, [{ op: "set-glance", kind: "vendor", fields: ["quote", "due"] }]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.document.kinds["vendor"]!.glance).toEqual(["quote", "due"]);
    expect(outcome.said.join(" ")).toMatch(/glance at a vendor/);
  });

  it("an empty list takes the choice away", () => {
    const chosen = editDocument(vendors, [{ op: "set-glance", kind: "vendor", fields: ["quote"] }]);
    if (!chosen.ok) throw new Error("set-glance refused");
    const cleared = editDocument(chosen.document, [{ op: "set-glance", kind: "vendor", fields: [] }]);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect("glance" in cleared.document.kinds["vendor"]!).toBe(false);
  });

  it("a field the kind does not have is refused by name, with the ones it has", () => {
    const outcome = editDocument(vendors, [{ op: "set-glance", kind: "vendor", fields: ["quote", "price"] }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]!.path).toBe("edits.0.fields.1");
    expect(outcome.findings[0]!.message).toMatch(/"price"/);
    expect(outcome.findings[0]!.fix).toMatch(/quote/);
  });

  it("a kind the app does not have, a name twice, and a name that is no field name are refused", () => {
    expect(editDocument(vendors, [{ op: "set-glance", kind: "venue", fields: ["name"] }]).ok).toBe(false);
    expect(editDocument(vendors, [{ op: "set-glance", kind: "vendor", fields: ["quote", "quote"] }]).ok).toBe(false);
    expect(editDocument(vendors, [{ op: "set-glance", kind: "vendor", fields: ["Due Date"] }]).ok).toBe(false);
    expect(editDocument(vendors, [{ op: "set-glance", kind: "vendor", fields: ["quote"], extra: true }]).ok).toBe(false);
  });

  it("diffDocuments says it: what a glance at a vendor says changes", () => {
    const outcome = editDocument(vendors, [{ op: "set-glance", kind: "vendor", fields: ["quote", "due"] }]);
    if (!outcome.ok) throw new Error("set-glance refused");
    expect(diffDocuments(vendors, outcome.document).sentences).toContain("What a glance at a vendor says changes.");
  });
});
