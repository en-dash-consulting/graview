import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AnySchema, GraviewApp } from "../../src/index.js";
import { compileDocument } from "../../src/check.js";
import { viewFontProblem, viewFontSource } from "../../src/css.js";
import { diffDocuments, editDocument, type GraviewDocument } from "../../src/document/index.js";

/**
 * A BRAND LENDS ITS VIEWS FACES IT DECLARES (Roadmap
 * f-view-authoring-friction-2026-11). A children's rocks-and-minerals app
 * could draw its views only in the system's faces and the web fonts on
 * the brand's list, since a view's stylesheet loads nothing — no
 * `@font-face`. Now `brand.views.fonts` names a face and the one file it is
 * drawn from: a file the app holds, by its content address, or an `https:`
 * address — loaded by the view's host only where it lets a view's images
 * come from. `graview check` holds each to the rule the host loads it by,
 * `set-brand` takes them whole and says so, and they reach the Brand a page
 * draws from.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const enDash = read("en-dash.gdd.json") as GraviewDocument;
const SHA = "a".repeat(64);
const BALOO = { family: "Baloo 2", src: `/graview/assets/${SHA}.woff2`, weight: "400 800" };
const FREDOKA = { family: "Fredoka", src: "https://fonts.gstatic.com/s/fredoka/v14/fredoka.woff2", style: "normal" as const };

const withFonts = (fonts: unknown): GraviewDocument => ({ ...enDash, brand: { ...enDash.brand, views: { fonts } } as GraviewDocument["brand"] });
const compiled = (document: GraviewDocument) => compileDocument(document, { today: () => "2026-11-06" });

describe("a face a brand lends its views", () => {
  it("compiles with no finding from a file the app holds or an https: address, and reaches the Brand a page draws from", () => {
    const result = compiled(withFonts([BALOO, FREDOKA]));
    expect(result.findings.filter((f) => f.path.startsWith("brand.views"))).toEqual([]);
    expect(result.ok && (result.app as GraviewApp<AnySchema>).brand?.views).toEqual({ fonts: [BALOO, FREDOKA] });
    expect(viewFontSource(BALOO.src)).toEqual({ asset: BALOO.src });
    expect(viewFontSource(FREDOKA.src)).toEqual({ https: FREDOKA.src, origin: "https://fonts.gstatic.com" });
  });

  it("is refused, by name, where it names no file it may be loaded from, a stylesheet in its family, or a name CSS keeps", () => {
    const findings = compiled(withFonts([
      { family: "Rock Sans", src: "/fonts/rock.woff2" },
      { family: "Rock Sans", src: "http://fonts.example/rock.woff2" },
      { family: "Rock Sans", src: "https://fonts.example/rock.css" },
      { family: 'Rock"; } body { color: red', src: BALOO.src },
      { family: "serif", src: BALOO.src },
      { family: "Rock Sans", src: BALOO.src, weight: 1200 },
    ])).findings.filter((f) => f.code === "brand-views-font");
    expect(findings.map((f) => f.path)).toEqual([0, 1, 2, 3, 4, 5].map((at) => `brand.views.fonts.${at}`));
    expect(findings.every((f) => f.severity === "error")).toBe(true);
    expect(findings[0]!.message).toContain("its src is a file the app holds (/graview/assets/<sha256>.woff2) or an https: address");
    expect(findings[3]!.message).toContain("letters, digits, spaces and hyphens");
    expect(findings[4]!.message).toContain('"serif" is a name CSS keeps for itself');
    expect(findings[0]!.fix).toContain('font-family: "Baloo 2"');
    expect(viewFontProblem(BALOO)).toBeNull();
  });

  it("is at most eight", () => {
    const many = Array.from({ length: 9 }, (_, at) => ({ ...BALOO, weight: 100 * (at + 1) }));
    expect(compiled(withFonts(many)).findings.some((f) => f.path === "brand.views.fonts" && f.code === "brand-views-font")).toBe(true);
  });
});

describe("set-brand", () => {
  it("takes the faces whole and says them, the diff says the same, and null takes them away", () => {
    const outcome = editDocument(enDash, [{ op: "set-brand", views: { fonts: [BALOO, FREDOKA] } }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.document.brand?.views).toEqual({ fonts: [BALOO, FREDOKA] });
    expect(outcome.said).toEqual(["Views may draw in Baloo 2 and Fredoka."]);
    expect(diffDocuments(enDash, outcome.document).sentences).toEqual(["Views may draw in Baloo 2 and Fredoka."]);
    const bare = editDocument(outcome.document, [{ op: "set-brand", views: { fonts: null } }]);
    if (!bare.ok) throw new Error(JSON.stringify(bare.findings));
    expect(bare.document.brand?.views).toBeUndefined();
    expect(bare.said).toEqual(["Views are drawn in the app's faces alone, and lend them none of their own."]);
  });
});
