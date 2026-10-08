import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accentProblem, brandFromAccent, colorsIn, contrast, passingShade, defineApp, defineNode, LIGHT, SCHEMES, z } from "../../src/index.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { checkApp, compileDocument } from "../../src/check.js";
import { createSchema } from "../../src/schema/schema.js";

/**
 * FR-126: A CONTRAST REFUSAL NAMES THE PAIR AND THE RATIO, WITH A FIX.
 * From Graview Cloud: an accent refused for contrast did not say which
 * pair failed, so a chat could not fix it. Now `set-brand` refuses an
 * accent that does not read as given with the pair, its ratio, the ratio
 * needed and the nearest shade of the same hue that would pass — and that
 * shade is taken. A document holding such an accent, and a TypeScript
 * palette that fails a pair, are said the same way by `graview check`.
 */
const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8")) as GraviewDocument;

describe("set-brand refuses an accent that does not read, naming the pair, the ratio and a shade that would", () => {
  const outcome = editDocument(vendors, [{ op: "set-brand", accent: "#e6c200" }]);

  it("is refused, at the accent, in one sentence", () => {
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings).toHaveLength(1);
    expect(outcome.findings[0]!.path).toBe("edits.0.accent");
    expect(outcome.findings[0]!.message).toMatch(/^#e6c200 text on #f6f4f0 is 1\.5:1; 4\.5:1 is needed — #[0-9a-f]{6} would pass\.$/);
  });

  const suggestion = accentProblem("#e6c200")!.suggestion!;
  it("suggests the nearest shade of the same hue, by lightness alone, which reads where the accent did not", () => {
    const hueOf = (hex: string) => {
      const { r, g, b } = colorsIn(hex)[0]!;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      return ((g - b) / (max - min)) * 60;
    };
    expect(Math.abs(hueOf(suggestion) - hueOf("#e6c200"))).toBeLessThan(2);
    expect(contrast(colorsIn(suggestion)[0]!, colorsIn(SCHEMES.light.ground)[0]!)).toBeGreaterThanOrEqual(4.5);
    expect(outcome.ok ? "" : outcome.findings[0]!.fix).toBe(`{"op": "set-brand", "accent": "${suggestion}"}`);
  });

  it("takes the suggestion, and the app compiles wearing it with nothing said about its colors", () => {
    const taken = editDocument(vendors, [{ op: "set-brand", accent: suggestion }]);
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    const compiled = compileDocument(taken.document);
    expect(compiled.ok).toBe(true);
    expect(compiled.findings.filter((f) => f.path.startsWith("brand"))).toEqual([]);
  });

  it("says a hue the warning color is drawn in as that, not as a contrast, and never asks a document for a dark accent it cannot give", () => {
    const clash = accentProblem("#993300")!;
    expect(clash.sentence).toBe('#993300 reads as given, but the warning color is drawn in its hue, so "something is broken" would look like "this is selected", at any shade — pick another hue.');
    expect(clash.pair.on).toMatch(/^#[0-9a-f]{6}$/);
    expect(clash.ratio).toBeGreaterThan(0);
    expect(accentProblem("#ff6600")!.sentence).toMatch(/; no shade of this hue does, since the warning color is drawn in it — pick another hue\.$/);
    const dark = accentProblem("#3a0ca3")!;
    expect(dark.sentence).toMatch(/^#3a0ca3 reads in the light scheme, but not in the dark: /);
    expect(dark.sentence).not.toMatch(/supply one|needs an accent of its own/);
    expect(dark.pair.on).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("check says the same of a document that holds such an accent", () => {
  it("warns with the sentence and the shade, where the compile used to say only that it could not", () => {
    const compiled = compileDocument({ ...vendors, brand: { accent: "#e6c200" } });
    const said = compiled.findings.filter((f) => f.path === "brand.accent");
    expect(said).toHaveLength(1);
    expect(said[0]!.message).toMatch(/#e6c200 text on #f6f4f0 is 1\.5:1; 4\.5:1 is needed — #[0-9a-f]{6} would pass\./);
    expect(said[0]!.fix).toMatch(/^say \{ "accent": "#[0-9a-f]{6}" \}$/);
  });

  it("an accent the derivation moved to read is said too, with the shade it would have needed", () => {
    expect(brandFromAccent({ accent: "#c2577a", base: SCHEMES }).ok).toBe(true);
    const compiled = compileDocument({ ...vendors, brand: { accent: "#c2577a" } });
    expect(compiled.ok).toBe(true);
    const said = compiled.findings.filter((f) => f.code === "brand-accent");
    expect(said.map((f) => f.severity)).toEqual(["warning"]);
    expect(said[0]!.message).toMatch(/^#c2577a text on #f6f4f0 is 3\.8:1; 4\.5:1 is needed — #[0-9a-f]{6} would pass\. The app draws a shade it moved to read, not the color given\.$/);
  });
});

describe("check says a TypeScript palette's failing pair as colors, with a shade that would pass", () => {
  it("names the ink and the ground as colors, the ratio, and the fix", () => {
    const schema = createSchema([defineNode("thing", { fields: z.object({ name: z.string() }) })]);
    const app = defineApp({ name: "pale", schema, brand: { name: "Pale", schemes: { ...SCHEMES, light: { ...LIGHT, inkMuted: "#b0b0b0" } } } });
    const found = checkApp(app).findings.filter((f) => f.code === "theme-contrast-below-aa" && f.where === "brand.schemes.light: inkMuted on panel");
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toMatch(/^#b0b0b0 text \(inkMuted\) on #ffffff \(panel\) is 2\.\d:1; 4\.5:1 is needed — a subtitle\.$/);
    expect(found[0]!.fix).toMatch(/^#[0-9a-f]{6} would pass as "inkMuted"\.$/);
  });

  it("offers a shade that passes on every stop of a gradient ground, as the check judges it, so following the fix clears it", () => {
    for (const ground of ["linear-gradient(#ffffff, #c8c8c8)", "linear-gradient(#f6f4f0, #d0d0d0, #ffffff)"]) {
      const shade = passingShade("#a0a0a0", ground, 4.5);
      expect(shade).toBeDefined();
      const worst = Math.min(...colorsIn(ground).map((stop) => contrast(colorsIn(shade!)[0]!, stop)));
      expect([ground, shade, worst >= 4.5]).toEqual([ground, shade, true]);
    }
    const schema = createSchema([defineNode("thing", { fields: z.object({ name: z.string() }) })]);
    const pale = defineApp({ name: "pale", schema, brand: { name: "Pale", schemes: { ...SCHEMES, light: { ...LIGHT, inkMuted: "#a0a0a0" } } } });
    for (const finding of checkApp(pale).findings.filter((f) => f.code === "theme-contrast-below-aa" && f.where?.startsWith("brand.schemes.light: inkMuted"))) {
      const fixed = /^(#[0-9a-f]{6}) would pass/.exec(finding.fix ?? "")?.[1];
      expect(fixed, finding.where).toBeDefined();
      const again = defineApp({ name: "pale", schema, brand: { name: "Pale", schemes: { ...SCHEMES, light: { ...LIGHT, inkMuted: fixed! } } } });
      expect(checkApp(again).findings.filter((f) => f.code === "theme-contrast-below-aa" && f.where === finding.where)).toEqual([]);
    }
  });
});
