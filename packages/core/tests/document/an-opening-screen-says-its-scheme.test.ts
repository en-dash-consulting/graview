import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";

/**
 * AN OPENING SCREEN SAYS ITS SCHEME (Roadmap f-splash-follows-declared-scheme).
 * Where the brand pins no scheme, `brand.splash.scheme` says the one the
 * screen opens in — "light", "dark", or "device" for the reader's system.
 * `set-brand` takes it and says it; one the brand's own scheme overrides
 * is said rather than kept quiet (`brand-splash-scheme`); a word off the
 * list is refused by path.
 */
const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8")) as GraviewDocument;
const withBrand = (more: Record<string, unknown>): GraviewDocument => ({ ...vendors, brand: { ...(vendors.brand ?? {}), ...more } as GraviewDocument["brand"] });
const codes = (document: GraviewDocument) => {
  const result = compileDocument(document, { today: () => "2026-10-29" });
  return result.findings.filter((f) => f.path.startsWith("brand.splash")).map((f) => `${f.severity} ${f.code} at ${f.path}`);
};

describe("an opening screen's own scheme", () => {
  it("compiles with no finding for each scheme it may say, where the brand pins none", () => {
    for (const scheme of ["light", "dark", "device"]) expect(codes(withBrand({ scheme: "auto", splash: { style: "plain", scheme } }))).toEqual([]);
  });

  it("says one the brand's own scheme overrides, and refuses a word off the list", () => {
    expect(codes(withBrand({ scheme: "dark", splash: { style: "plain", scheme: "light" } }))).toEqual(["warning brand-splash-scheme at brand.splash.scheme"]);
    expect(codes(withBrand({ scheme: "dark", splash: { style: "plain", scheme: "dark" } }))).toEqual([]);
    expect(compileDocument(withBrand({ splash: { style: "plain", scheme: "sepia" } })).ok).toBe(false);
  });

  it("is set by set-brand and said", () => {
    const set = editDocument(vendors, [{ op: "set-brand", splash: { style: "editorial", scheme: "dark" } }]);
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect((set.document.brand as { splash?: unknown }).splash).toEqual({ style: "editorial", scheme: "dark" });
    expect(set.said).toEqual(["The app opens on a dark editorial screen while it loads."]);
    expect(editDocument(vendors, [{ op: "set-brand", splash: { style: "editorial", scheme: "sepia" } }]).ok).toBe(false);
  });
});
