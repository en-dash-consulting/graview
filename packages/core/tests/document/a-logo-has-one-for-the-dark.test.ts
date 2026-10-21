import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkApp } from "../../src/cli/check.js";
import { createSchema, defineApp, defineNode, emojiMark, logoFor, logoOf, SCHEMES, z, type AnySchema, type Brand, type GraviewApp } from "../../src/index.js";
import { diffDocuments, editDocument, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * A LOGO HAS ONE FOR THE DARK. A client's real logo is a JPG on white:
 * the brand took an emoji or one mark, and on a dark theme the mark sat as
 * a white slab, so the TrueNorth recon app inverted it with a filter of its
 * own. `brand.logo` is still a string, or `{ light, dark? }` — the dark one
 * drawn in the dark scheme — and where there is only a light one, whether
 * it is opaque on white cannot be known, so inverting it in the dark is
 * asked for (`darkFallback: "invert"`), never guessed. `graview check` and
 * `set-brand` judge each mark as they judged the one.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const vendors = read("vendors.gdd.json") as GraviewDocument;
const withLogo = (logo: unknown): GraviewDocument => ({ ...vendors, brand: { ...vendors.brand, logo } as GraviewDocument["brand"] });
const compiled = (document: GraviewDocument) => compileDocument(document, { today: () => "2026-10-20" });
const drawn = (document: GraviewDocument): Brand => {
  const result = compiled(document);
  if (!result.ok) throw new Error(JSON.stringify(result.findings));
  return result.app.brand!;
};
const errors = (document: GraviewDocument) => compiled(document).findings.filter((f) => f.severity === "error");
const LIGHT = "/graview/assets/0f3a.jpg";
const DARK = "/graview/assets/9b2c.png";

describe("a document's logo", () => {
  it("keeps the string form, and the src form, as the one logo in both schemes", () => {
    expect(drawn(withLogo(LIGHT)).logo).toBe(LIGHT);
    expect(drawn(withLogo({ src: LIGHT, alt: "TrueNorth" })).logo).toBe(LIGHT);
  });

  it("takes a light and a dark one, said by one alt, and draws each in its scheme", () => {
    const result = compiled(withLogo({ light: LIGHT, dark: DARK, alt: "TrueNorth Recon" }));
    expect(result.findings.filter((f) => f.severity === "error")).toEqual([]);
    const brand = drawn(withLogo({ light: LIGHT, dark: DARK, alt: "TrueNorth Recon" }));
    expect(brand.logo).toEqual({ light: LIGHT, dark: DARK });
    expect(brand.logoAlt).toBe("TrueNorth Recon");
    expect(logoFor(brand, "light")).toEqual({ src: LIGHT, invert: false });
    expect(logoFor(brand, "dark")).toEqual({ src: DARK, invert: false });
  });

  it("inverts a light one in the dark only when asked to", () => {
    const asked = drawn(withLogo({ light: LIGHT, darkFallback: "invert" }));
    expect(logoFor(asked, "dark")).toEqual({ src: LIGHT, invert: true });
    expect(logoFor(asked, "light")).toEqual({ src: LIGHT, invert: false });
    const unasked = drawn(withLogo({ light: LIGHT }));
    expect(logoFor(unasked, "dark")).toEqual({ src: LIGHT, invert: false });
  });

  it("refuses a dark mark that could act, at brand.logo.dark, as it refuses a light one", () => {
    const acting = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    expect(errors(withLogo({ light: LIGHT, dark: acting })).map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-mark at brand.logo.dark"]);
    expect(errors(withLogo({ light: acting })).map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-mark at brand.logo.light"]);
  });

  it("refuses a fallback it does not know, and says a fallback beside a dark logo is never drawn", () => {
    expect(errors(withLogo({ light: LIGHT, darkFallback: "blend" })).length).toBeGreaterThan(0);
    expect(errors(withLogo({ dark: DARK })).length).toBeGreaterThan(0);
    const said = compiled(withLogo({ light: LIGHT, dark: DARK, darkFallback: "invert" })).findings.filter((f) => f.code === "brand-logo");
    expect(said.map((f) => [f.severity, f.path])).toEqual([["warning", "brand.logo.darkFallback"]]);
    expect(said[0]!.message).toMatch(/dark logo is drawn in the dark scheme/);
  });

  it("is a logo, so an emoji does not stand in for it", () => {
    expect(emojiMark({ logo: { light: LIGHT }, favicon: { emoji: "🧭" } })).toBeUndefined();
    expect(logoOf({ logo: LIGHT })).toEqual({ light: LIGHT });
    expect(logoOf({})).toBeUndefined();
  });
});

describe("set-brand takes a logo for each scheme", () => {
  it("sets { light, dark }, and says the dark one", () => {
    const outcome = editDocument(vendors, [{ op: "set-brand", logo: { light: LIGHT, dark: DARK } }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.document.brand?.logo).toEqual({ light: LIGHT, dark: DARK });
    expect(outcome.said.join(" ")).toMatch(/dark scheme/);
    expect(diffDocuments(vendors, outcome.document).sentences.join(" ")).toMatch(/logo/i);
  });

  it("says a light logo inverted in the dark, and a dark one added to a logo that stays", () => {
    const inverted = editDocument(vendors, [{ op: "set-brand", logo: { light: LIGHT, darkFallback: "invert" } }]);
    if (!inverted.ok) throw new Error(JSON.stringify(inverted.findings));
    expect(inverted.said.join(" ")).toMatch(/inverted in the dark scheme/);
    const first = editDocument(vendors, [{ op: "set-brand", logo: LIGHT }]);
    if (!first.ok) throw new Error(JSON.stringify(first.findings));
    const then = editDocument(first.document, [{ op: "set-brand", logo: { light: LIGHT, dark: DARK } }]);
    if (!then.ok) throw new Error(JSON.stringify(then.findings));
    expect(then.said).toContain("The logo gets one of its own for the dark scheme.");
    expect(diffDocuments(first.document, then.document).sentences).toContain("The logo gets one of its own for the dark scheme.");
  });

  it("refuses a dark mark that could act, at the edit's own path", () => {
    const edited = editDocument(vendors, [{ op: "set-brand", logo: { light: LIGHT, dark: '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>' } }]);
    expect(edited.ok).toBe(false);
    if (!edited.ok) expect(edited.findings.map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-mark at edits.0.logo.dark"]);
  });
});

describe("graview check on a declared app's logo", () => {
  const thing = defineNode("thing", { fields: z.object({ name: z.string() }) });
  const app = (logo: unknown) =>
    defineApp({ name: "Recon", schema: createSchema([thing]), brand: { name: "Recon", schemes: SCHEMES as Brand["schemes"], logo: logo as Brand["logo"] } }) as GraviewApp<AnySchema>;
  const found = (logo: unknown) => checkApp(app(logo)).findings.filter((f) => f.code === "brand-logo" || f.code === "brand-mark");

  it("passes a string and a light and dark pair", () => {
    expect(found(LIGHT)).toEqual([]);
    expect(found({ light: LIGHT, dark: DARK })).toEqual([]);
    expect(found({ light: LIGHT, darkFallback: "invert" })).toEqual([]);
  });

  it("refuses a pair with no light one, and a fallback it does not know", () => {
    expect(found({ dark: DARK }).map((f) => [f.severity, f.where])).toEqual([["error", "brand.logo.light"]]);
    expect(found({ light: LIGHT, darkFallback: "blend" }).map((f) => [f.severity, f.where])).toEqual([["error", "brand.logo.darkFallback"]]);
  });

  it("refuses a mark that could act, in either scheme", () => {
    expect(found({ light: LIGHT, dark: '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>' }).map((f) => [f.code, f.where])).toEqual([["brand-mark", "brand.logo.dark"]]);
  });
});
