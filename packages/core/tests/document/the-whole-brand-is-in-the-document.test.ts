import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { faviconHref, hueFor, markHref, shapeOf, SYSTEM_STACKS, typographyOf, type AnySchema, type GraviewApp } from "../../src/index.js";
import { appFrom, compileDocumentWithoutCheck, serializeCompiled, type Finding, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * FR-124: THE DOCUMENT CAN HOLD THE BRAND THE TYPESCRIPT `Brand` ALREADY
 * HAS. From Graview Cloud: a chat could restructure an app's blocks and
 * not change how it looks — the document's brand was an accent, a name, a
 * currency and a locale. Now it holds a logo and a page icon (inline SVG
 * or a path on the app's own host), the faces its words are set in, its
 * shape, a hue per kind and the scheme it prefers; each reaches the
 * `Brand` the theme machinery draws from, and `graview check` refuses a
 * mark that could act or load and a face from off the list.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const enDash = read("en-dash.gdd.json") as GraviewDocument;
const LOGO = (enDash.brand!.logo as { src: string }).src;

function compiled(document: GraviewDocument) {
  const result = compileDocument(document, { today: () => "2026-10-07" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((f) => f.severity === "error")));
  return result;
}
const withBrand = (brand: Record<string, unknown>): GraviewDocument => ({ ...enDash, brand: { ...enDash.brand, ...brand } as GraviewDocument["brand"] });
const refusals = (document: GraviewDocument): Finding[] => {
  const result = compileDocument(document, { today: () => "2026-10-07" });
  return result.ok ? [] : result.findings.filter((f) => f.severity === "error");
};

describe("a document holds the whole brand, and each key reaches what the faces draw from", () => {
  const { app } = compiled(enDash);
  const brand = (app as GraviewApp<AnySchema>).brand!;

  it("compiles with no finding about its brand", () => {
    expect(compiled(enDash).findings.filter((f) => f.path.startsWith("brand"))).toEqual([]);
  });

  it("names the app, and draws the logo exactly as it was given, with its alt text", () => {
    expect(brand.name).toBe("En Dash");
    expect(brand.logo).toBe(LOGO);
    expect(brand.logoAlt).toBe("En Dash Consulting");
  });

  it("says the document's description as the line under the name", () => {
    expect(brand.subtitle).toBe(enDash.description);
  });

  it("gives the page its icon, as an address a link can take", () => {
    expect(brand.favicon).toBe(enDash.brand!.favicon);
    expect(faviconHref(brand)).toBe(enDash.brand!.favicon);
    expect(faviconHref({ favicon: LOGO })).toBe(`data:image/svg+xml,${encodeURIComponent(LOGO)}`);
  });

  it("sets headings in the display face, the body in the body's, code in the mono — each keyword its system stack", () => {
    expect(typographyOf(brand)).toEqual({ display: SYSTEM_STACKS["system-serif"], body: SYSTEM_STACKS["system-sans"], mono: SYSTEM_STACKS["system-mono"] });
    expect(typographyOf(brand).display).toMatch(/serif$/);
  });

  it("draws its shape, a hue per kind, and the scheme it prefers", () => {
    expect(shapeOf(brand).radius).toBe(6);
    expect(shapeOf(brand).pad).toBe(Math.round(15 * 0.9));
    expect(hueFor("workshop", brand.accents)).toBe(168);
    expect(hueFor("person", brand.accents)).toBe(32);
    expect(brand.scheme).toBe("dark");
  });

  it("is handed to a page compiled, and rebuilt with the same brand (graview-compiled@1)", () => {
    const wire = JSON.parse(JSON.stringify(serializeCompiled(compiled(enDash))));
    const page = appFrom(wire);
    if (!page.ok) throw new Error(JSON.stringify(page.findings));
    expect((page.app as GraviewApp<AnySchema>).brand).toEqual(brand);
  });

  it("calls every document's app what its document calls it, with or without a brand", () => {
    const { brand: _brand, ...plain } = enDash;
    expect((compiled(plain as GraviewDocument).app as GraviewApp<AnySchema>).brand?.name).toBe("En Dash Workshops");
  });

  it("takes any one key alone", () => {
    for (const brand of [{ scheme: "light" }, { shape: { radius: 0 } }, { typography: { display: "Fraunces, Georgia, serif" } }, { logo: "/graview/assets/logo.svg" }, { favicon: "favicon.svg" }]) {
      const { brand: _all, ...rest } = enDash;
      expect(refusals({ ...rest, brand } as GraviewDocument), JSON.stringify(brand)).toEqual([]);
    }
  });
});

describe("check refuses a mark that could act or load, under Graview Cloud's add_image rules", () => {
  const CASES: readonly [string, string, RegExp][] = [
    ["a script", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', /because it has a script in it/],
    ["an event handler", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>', /event handler/],
    ["HTML inside it", '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><p>hi</p></foreignObject></svg>', /foreignObject/],
    ["something it links to", '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"></image></svg>', /loads or links to something outside itself/],
    ["a style that loads", '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill: url(https://example.com/x)"></rect></svg>', /its style loads something outside itself/],
    ["another origin", "https://example.com/logo.svg", /names another origin/],
    ["a path off the app's assets", "/static/logo.svg", /under \/graview\/assets\//],
  ];
  for (const [what, mark, says] of CASES) {
    it(`refuses a logo with ${what}, and an icon with it`, () => {
      const logo = refusals(withBrand({ logo: mark }));
      expect(logo.map((f) => f.code)).toEqual(["brand-mark"]);
      expect(logo[0]!.path).toBe("brand.logo");
      expect(logo[0]!.message).toMatch(says);
      expect(refusals(withBrand({ favicon: mark })).map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-mark at brand.favicon"]);
    });
  }

  it("keeps an SVG whose links stay inside it, and an image written as data", () => {
    const own = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"></linearGradient></defs><rect fill="url(#g)"></rect><use href="#g"></use></svg>';
    expect(refusals(withBrand({ logo: own }))).toEqual([]);
  });

  it("never draws an inline mark that could act, even in a page that compiled it without the checker", () => {
    const script = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    expect(compileDocumentWithoutCheck(withBrand({ logo: script })).ok).toBe(true);
    expect(markHref(script)).toBeUndefined();
    expect(markHref(LOGO)).toBe(`data:image/svg+xml,${encodeURIComponent(LOGO)}`);
  });
});

describe("check refuses a face from anywhere but the list", () => {
  it("refuses a font loaded from an origin, naming the origin", () => {
    const found = refusals(withBrand({ typography: { display: 'Fraunces, url("https://fonts.example.net/f.woff2")' } }));
    expect(found.map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-font at brand.typography.display"]);
    expect(found[0]!.message).toMatch(/loads a font from fonts\.example\.net/);
  });

  it("refuses a face that is neither the system's nor on the list, and says what is", () => {
    const found = refusals(withBrand({ typography: { body: '"Comic Neue", sans-serif' } }));
    expect(found.map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-font at brand.typography.body"]);
    expect(found[0]!.message).toMatch(/"Comic Neue" is not a face a document may name: say system-serif, system-sans or system-mono/);
  });

  it("takes a system stack, a face every system has, and a web font from the list", () => {
    expect(refusals(withBrand({ typography: { display: "system-serif", body: "Georgia, serif", mono: '"JetBrains Mono", Menlo, monospace' } }))).toEqual([]);
  });

  it("never writes a face that would break out of the style sheet, even in a page that compiled it without the checker", () => {
    const breaking = '"x"}body{background:url(//evil.example/x)}';
    const result = compileDocumentWithoutCheck(withBrand({ typography: { display: "system-serif", body: breaking } }));
    if (!result.ok) throw new Error("does not compile");
    const typography = (result.app as GraviewApp<AnySchema>).brand!.typography!;
    expect(typography.display).toBe(SYSTEM_STACKS["system-serif"]);
    expect(typography.body).toBeUndefined();
  });

  it("takes a face the host says it serves itself", () => {
    const result = compileDocument(withBrand({ typography: { body: '"Comic Neue", sans-serif' } }), { fonts: ["Comic Neue"] });
    expect(result.ok).toBe(true);
  });
});
