import { readFileSync } from "node:fs";
import { compileDocumentWithoutCheck, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createStudio, uneditable } from "../../src/index.js";

/**
 * FR-62: WHAT THE STUDIO WILL NOT CHANGE IS SAID UP FRONT.
 *
 * The studio keeps how a number is shown (a `format`), what it is counted
 * in (a `unit`) and what a list holds (its `of`), and refuses to retype a
 * field that carries one — but a host could only learn that by trying.
 * Graview Cloud copied the rule into its own builder (`studioLeaves`) to
 * warn first. `uneditable(document)` is the studio's own rule, asked ahead.
 */
const vendors = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/vendors.gdd.json", import.meta.url), "utf8")) as GraviewDocument;

describe("uneditable(document) (FR-62)", () => {
  it("on the vendors names the quote and the budget, which are money", () => {
    const said = uneditable(vendors);
    expect(said.map((finding) => finding.path).sort()).toEqual(["kinds.category.fields.budget", "kinds.vendor.fields.quote"]);
    for (const finding of said) {
      expect(finding.severity).toBe("note");
      expect(finding.code).toBe("studio-keeps-format");
      expect(finding.message).toMatch(/shown as money/);
    }
  });

  it("is one finding per property kept: a format, a unit, a list's item type", () => {
    const document = structuredClone(vendors) as GraviewDocument;
    const fields = document.kinds["vendor"]!.fields as Record<string, unknown>;
    fields["hours"] = { type: "number", unit: "h", format: "duration" };
    fields["tags"] = { type: "list", of: "string" };
    const said = uneditable(document).filter((finding) => finding.path.startsWith("kinds.vendor.fields.") && finding.path !== "kinds.vendor.fields.quote");
    expect(said.map((finding) => [finding.path, finding.code])).toEqual([
      ["kinds.vendor.fields.hours", "studio-keeps-format"],
      ["kinds.vendor.fields.hours", "studio-keeps-unit"],
      ["kinds.vendor.fields.tags", "studio-keeps-item-type"],
    ]);
    expect(said[2]!.message).toMatch(/a list of strings/);
  });

  it("is the very rule the studio refuses by: retyping the quote is refused in the words it said ahead", () => {
    const compiled = compileDocumentWithoutCheck(vendors);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const studio = createStudio(compiled.app);
    studio.store.apply({ name: "retype-field", args: { id: "field:vendor.quote", type: "integer" } });
    const outcome = studio.document();
    if (outcome?.ok !== false) throw new Error("retyping money was not refused");
    const ahead = uneditable(vendors).find((finding) => finding.path === "kinds.vendor.fields.quote")!;
    expect(outcome.findings[0]!.path).toBe(ahead.path);
    expect(outcome.findings[0]!.message).toContain("shown as money");
  });

  it("a number's range (FR-114) is kept, said, and stops a retype, which would let it go", () => {
    const document = structuredClone(vendors) as GraviewDocument;
    (document.kinds["vendor"]!.fields as Record<string, unknown>)["rating"] = { type: "integer", min: 1, max: 5 };
    const said = uneditable(document).find((finding) => finding.path === "kinds.vendor.fields.rating")!;
    expect([said.code, said.message]).toEqual(["studio-keeps-range", "vendor's rating is taken from 1 to 5; the studio keeps that as it is and will not change it, nor retype the field"]);
    const compiled = compileDocumentWithoutCheck(document);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const studio = createStudio(compiled.app, { document });
    studio.store.apply({ name: "set-required", args: { id: "field:vendor.rating", required: true } });
    const kept = studio.document();
    if (!kept?.ok) throw new Error(JSON.stringify(kept?.findings));
    expect(kept.document.kinds["vendor"]!.fields["rating"]).toEqual({ type: "integer", min: 1, max: 5, required: true });
  });

  it("a document that keeps nothing of the kind says nothing", () => {
    const document = structuredClone(vendors) as GraviewDocument;
    delete (document.kinds["vendor"]!.fields["quote"] as { format?: string }).format;
    delete (document.kinds["category"]!.fields["budget"] as { format?: string }).format;
    expect(uneditable(document)).toEqual([]);
  });
});
