import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colorsIn, composite, contrast, groundProblem, groundSchemes, SCHEMES } from "../../src/index.js";
import { rgbToHsl } from "../../src/theme/contrast.js";
import { diffDocuments, editDocument, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * AN APP STANDS ON A GROUND OF ITS OWN (Roadmap f-brand-ground). From
 * Graview Cloud: apps that each chose an accent still looked alike, every
 * one on the same off-white. A brand's `ground` is the page background —
 * one color, or one for each scheme, `null` to go back to Graview's — and
 * the panel, the muted panel, the edge and a floating sheet are drawn from
 * it, so a card still stands off it. With only a light ground the dark
 * scheme takes its hue taken down to a ground. A ground on which ink, muted
 * ink or the accent drops below 4.5:1 is refused, as an accent is, with the
 * pair, its ratio and the nearest shade that would pass.
 */
const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8")) as GraviewDocument;
const plain: GraviewDocument = { ...vendors, brand: {} };
delete (plain as { brand?: unknown }).brand;

function applied(document: GraviewDocument, edit: Record<string, unknown>) {
  const outcome = editDocument(document, [{ op: "set-brand", ...edit }]);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome;
}
const solid = (value: string, over: string) => composite(colorsIn(value)[0]!, colorsIn(over)[0]!);
const lightness = (value: string) => rgbToHsl(colorsIn(value)[0]!).l;
const hue = (value: string) => rgbToHsl(colorsIn(value)[0]!).h;

describe("set-brand gives the app a ground of its own", () => {
  const outcome = applied(plain, { ground: "#eef3f8" });
  const compiled = compileDocument(outcome.document);

  it("keeps the color as given, says it, and compiles with nothing said about it", () => {
    expect(outcome.document.brand).toEqual({ ground: "#eef3f8" });
    expect(outcome.said).toContain("The app's page background becomes #eef3f8.");
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.findings.filter((f) => f.path.startsWith("brand"))).toEqual([]);
    expect(compiled.app.brand?.schemes?.light.ground).toBe("#eef3f8");
  });

  it("draws the panel, its muted fill, the edge and a floating sheet from it, so a card still stands off the ground", () => {
    if (!compiled.ok) return;
    const light = compiled.app.brand!.schemes!.light;
    for (const token of ["panel", "panelMuted", "edge", "float"] as const) expect([token, light[token]]).not.toEqual([token, SCHEMES.light[token]]);
    expect(lightness(light.panel)).toBeGreaterThan(lightness(light.ground));
    expect(Math.abs(hue(light.panel) - hue("#eef3f8"))).toBeLessThan(10);
  });

  it("takes a dark ground of the same hue, never the light one, when only a light one is given", () => {
    if (!compiled.ok) return;
    const dark = compiled.app.brand!.schemes!.dark;
    expect(dark.ground).not.toBe("#eef3f8");
    expect(dark.ground).not.toBe(SCHEMES.dark.ground);
    expect(lightness(dark.ground)).toBeLessThan(0.12);
    expect(Math.abs(hue(dark.ground) - hue("#eef3f8"))).toBeLessThan(10);
    // The card is lit off the dark ground, as Graview's own is.
    expect(contrast(solid(dark.panel, dark.ground), colorsIn(dark.ground)[0]!)).toBeGreaterThan(1.1);
  });

  it("keeps ink, muted ink and the accent readable on the ground and on a card, in both schemes", () => {
    if (!compiled.ok) return;
    for (const scheme of ["light", "dark"] as const) {
      const tokens = compiled.app.brand!.schemes![scheme];
      for (const on of [colorsIn(tokens.ground)[0]!, solid(tokens.panel, tokens.ground)]) {
        for (const ink of [tokens.ink, tokens.inkMuted, tokens.accent]) expect([scheme, ink, contrast(colorsIn(ink)[0]!, on) >= 4.5]).toEqual([scheme, ink, true]);
      }
    }
  });

  it("takes one for each scheme as given", () => {
    const both = applied(plain, { ground: { light: "#f4efe6", dark: "#1a1612" } });
    expect(both.said).toContain("The app's page background becomes #f4efe6, and #1a1612 in the dark.");
    const schemes = groundSchemes({ light: "#f4efe6", dark: "#1a1612" });
    expect([schemes.light.ground, schemes.dark.ground]).toEqual(["#f4efe6", "#1a1612"]);
  });

  it("goes back to Graview's with null, and the diff says the colors change", () => {
    const back = editDocument(outcome.document, [{ op: "set-brand", ground: null }]);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.document.brand).toBeUndefined();
    expect(back.said).toContain("The app's page background goes back to Graview's.");
    const compiledBack = compileDocument(back.document);
    expect(compiledBack.ok && compiledBack.app.brand?.schemes).toEqual(SCHEMES);
    expect(diffDocuments(plain, outcome.document).sentences).toContain("The app's colors change.");
  });

  it("stands beside an accent, which is judged on it", () => {
    const both = applied(vendors, { ground: "#eef3f8" });
    const compiledBoth = compileDocument(both.document);
    expect(compiledBoth.ok).toBe(true);
    if (!compiledBoth.ok) return;
    expect(compiledBoth.app.brand!.schemes!.light.ground).toBe("#eef3f8");
    expect(compiledBoth.app.brand!.schemes!.light.accent).not.toBe(SCHEMES.light.accent);
  });
});

describe("a ground on which words would not read is refused, naming the pair, the ratio and a shade that would", () => {
  it("names muted ink on a mid-gray ground, and the shade it names is taken", () => {
    const outcome = editDocument(plain, [{ op: "set-brand", ground: "#9a9a94" }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings).toHaveLength(1);
    expect(outcome.findings[0]!.path).toBe("edits.0.ground");
    expect(outcome.findings[0]!.message).toMatch(/^Muted ink #586174 on the ground #9a9a94 is 2\.1:1; 4\.5:1 is needed — #[0-9a-f]{6} would pass\.$/);
    const shade = groundProblem("#9a9a94")!.suggestion!;
    expect(outcome.findings[0]!.fix).toBe(`{"op": "set-brand", "ground": "${shade}"}`);
    expect(Math.abs(hue(shade) - hue("#9a9a94"))).toBeLessThan(10);
    expect(editDocument(plain, [{ op: "set-brand", ground: shade }]).ok).toBe(true);
  });

  it("names the dark scheme's pair when the dark ground is the trouble", () => {
    const refused = groundProblem({ light: "#f4efe6", dark: "#5a5f70" })!;
    expect(refused.scheme).toBe("dark");
    expect(refused.sentence).toMatch(/^In the dark scheme, ink #eef0f6 on a card \(#[0-9a-f]{6}\) on the ground #5a5f70 is 4\.\d:1; 4\.5:1 is needed — #[0-9a-f]{6} would pass\.$/);
    const outcome = editDocument(plain, [{ op: "set-brand", ground: { light: "#f4efe6", dark: "#5a5f70" } }]);
    expect(!outcome.ok && outcome.findings[0]!.fix).toBe(`{"op": "set-brand", "ground": {"light": "#f4efe6", "dark": "${refused.suggestion}"}}`);
  });

  it("names the app's accent when it is the one that no longer reads", () => {
    const outcome = editDocument(vendors, [{ op: "set-brand", ground: "#d6e4d8" }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]!.message).toMatch(/^The accent #a8456a on the ground #d6e4d8 is 4\.2:1; 4\.5:1 is needed — #[0-9a-f]{6} would pass\.$/);
  });

  it("says what is not a color", () => {
    const outcome = editDocument(plain, [{ op: "set-brand", ground: "pale blue" }]);
    expect(!outcome.ok && outcome.findings[0]!.message).toMatch(/^"pale blue" is not a page background; a ground is a color like "#eef3f8"/);
  });

  it("is said by check of a document that holds one, and the app keeps Graview's ground", () => {
    const compiled = compileDocument({ ...plain, brand: { ground: "#9a9a94" } });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const said = compiled.findings.filter((f) => f.path === "brand.ground");
    expect(said.map((f) => [f.code, f.severity])).toEqual([["brand-ground", "warning"]]);
    expect(said[0]!.message).toMatch(/^Muted ink #586174 on the ground #9a9a94 is 2\.1:1; 4\.5:1 is needed — #[0-9a-f]{6} would pass\. The app keeps Graview's page background\.$/);
    expect(said[0]!.fix).toMatch(/^say \{ "ground": "#[0-9a-f]{6}" \}$/);
    expect(compiled.app.brand?.schemes?.light.ground).toBe(SCHEMES.light.ground);
  });
});
