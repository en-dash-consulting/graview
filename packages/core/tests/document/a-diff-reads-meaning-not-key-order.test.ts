import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocumentWithoutCheck, diffDocuments, documentHash, documentOf, type GraviewDocument } from "../../src/document/index.js";

/**
 * A DIFF READS WHAT A DOCUMENT MEANS, NOT THE ORDER ITS KEYS WERE WRITTEN IN.
 * Two documents with one hash are one document; `diffDocuments` compared
 * parts of them as JSON text, so the same act with its description written
 * last was "The act … changes." — nine such sentences between the vendors
 * document and the one `documentOf` remembers for it, which says its keys
 * in the order the schema lists them.
 */
const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8")) as GraviewDocument;

function reordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reordered);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, v]) => [key, reordered(v)]));
  return value;
}

describe("a diff reads meaning, not key order", () => {
  it("two hash-equal documents, keys written in another order, differ in nothing", async () => {
    const other = reordered(vendors) as GraviewDocument;
    expect(await documentHash(other)).toBe(await documentHash(vendors));
    const diff = diffDocuments(vendors, other);
    expect(diff.sentences).toEqual([]);
    expect(diff.unchanged).toBe(true);
  });

  it("the document an app remembers is the document it was compiled from, as far as a diff can tell", async () => {
    const compiled = compileDocumentWithoutCheck(vendors);
    if (!compiled.ok) throw new Error("the vendors fixture must compile");
    const remembered = documentOf(compiled.app)!;
    expect(await documentHash(remembered)).toBe(await documentHash(vendors));
    expect(diffDocuments(vendors, remembered).sentences).toEqual([]);
  });
});
