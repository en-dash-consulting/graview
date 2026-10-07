import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accentProblem, brandFromAccent, colorsIn, contrast, defineApp, defineNode, LIGHT, SCHEMES, z } from "../../src/index.js";
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
});
