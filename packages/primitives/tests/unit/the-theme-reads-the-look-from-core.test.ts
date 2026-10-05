import { brandFromAccent, isoShade, SCHEMES, SHAPE, shapeOf, TYPOGRAPHY, typographyOf, type Brand } from "@graview/core";
import { describe, expect, it } from "vitest";
import { GRAVIEW_BRAND, themeCss } from "../../src/index.js";

/*
 * FR-73. The sheet's shape, type and block lighting are @graview/core's
 * `SHAPE`, `TYPOGRAPHY` and `isoShade` — so a host that dresses its pages
 * from core emits exactly what this sheet does, for every brand.
 */
const accent = brandFromAccent({ accent: "#c2577a", base: SCHEMES as never });
if (!accent.ok) throw new Error(accent.why);
const BRANDS: Record<string, Brand> = {
  "the framework's": GRAVIEW_BRAND,
  "an accent-derived": { name: "Accent", schemes: accent.schemes },
  "a square, tight, set-in-Inter": { name: "Square", schemes: SCHEMES, shape: { radius: 4, density: 0.8 }, typography: { body: "Inter, sans-serif", display: "Fraunces, serif" } },
};
const flat = (css: string) => css.replace(/\s+/g, " ");

describe("themeCss reads the look from core", () => {
  it("names the framework's faces as its own brand's", () => {
    expect(GRAVIEW_BRAND.typography).toEqual({ body: TYPOGRAPHY.body, mono: TYPOGRAPHY.mono });
  });

  for (const [name, brand] of Object.entries(BRANDS)) {
    for (const scheme of ["light", "dark"] as const) {
      it(`emits core's shape, type and lighting for ${name} brand in ${scheme}`, () => {
        const css = flat(themeCss(scheme, brand));
        const shape = shapeOf(brand);
        const type = typographyOf(brand);
        expect(css).toContain(`--graview-radius: ${shape.radius}px;`);
        expect(css).toContain(`--graview-radius-sm: ${shape.radiusSmall}px;`);
        expect(css).toContain(`--graview-pad: ${shape.pad}px;`);
        expect(css).toContain(`--graview-pad-sm: ${shape.padSmall}px;`);
        expect(css).toContain(`--graview-gap: ${shape.gap}px;`);
        expect(css).toContain(`--graview-font-body: ${type.body};`);
        expect(css).toContain(`--graview-font-display: ${type.display};`);
        expect(css).toContain(`--graview-font-mono: ${type.mono};`);
        const iso = isoShade(scheme);
        const face = (f: { saturation: number; lightness: number }) => `${f.saturation}% ${f.lightness}%`;
        expect(css).toContain(`.graview-iso-roof { fill: hsl(var(--graview-hue, 200) ${face(iso.roof)}); stroke: ${iso.roofEdge};`);
        expect(css).toContain(`.graview-iso-right { fill: hsl(var(--graview-hue, 200) ${face(iso.right)}); }`);
        expect(css).toContain(`.graview-iso-left { fill: hsl(var(--graview-hue, 200) ${face(iso.left)}); }`);
        expect(css).toContain(`.graview-plot-tile { fill: hsl(var(--graview-hue, 200) ${face(iso.plot)} / ${iso.plot.alpha}); stroke: hsl(var(--graview-hue, 200) ${face(iso.plotEdge)} / ${iso.plotEdge.alpha});`);
      });
    }
  }

  it("draws the framework's own numbers for a brand that declares no shape — the values a host mirrored by hand", () => {
    const css = themeCss("light");
    expect(css).toContain(`--graview-radius: ${SHAPE.radius}px;`);
    expect(css).toContain("--graview-radius: 12px;");
    expect(css).toContain("--graview-pad: 15px;");
    expect(flat(themeCss("dark"))).toContain(".graview-iso-left { fill: hsl(var(--graview-hue, 200) 38% 13%); }");
  });
});
