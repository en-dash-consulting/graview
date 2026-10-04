import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";

/**
 * NO EDITS IS NO CHANGE. A surface that says its changes as edits — the
 * studio's `edits()` — has none when nothing changed, and `editDocument`
 * refused an empty list ("give at least one edit"), so a host had to treat
 * "nothing" as a special case. Nothing is the document as it was.
 */
const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8")) as GraviewDocument;

describe("no edits is no change", () => {
  it("an empty list hands back the document as it was, saying nothing", () => {
    const outcome = editDocument(vendors, []);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.document).toEqual(vendors);
    expect(outcome.said).toEqual([]);
    expect(outcome.fills).toEqual([]);
  });
});
