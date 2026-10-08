import { describe, expect, it } from "vitest";
import {
  brandFromAccent,
  checkBrandContrast,
  contrast,
  colorsIn,
  DARK,
  GRAVIEW_COLORS,
  GRAVIEW_FACE,
  graviewSymbol,
  LIGHT,
  LOGO_RULES,
  SCHEMES,
  symbolCut,
  SYSTEM_STACKS,
  TYPOGRAPHY,
  typographyOf,
  WEIGHTS,
} from "../../src/index.js";

/*
 * THE DESIGN KIT, REVISION 03. Graview's identity is data in core — navy,
 * turquoise, paper, ink, Montserrat and its weights, the symbol — and it
 * reaches an app only through the framework's own defaults: the shipped
 * schemes, the default faces and weights. A brand that declares its own
 * gets its own; a document saying `system-sans` still gets the system's.
 */
const ratio = (ink: string, on: string) => contrast(colorsIn(ink)[0]!, colorsIn(on)[0]!);

describe("Graview's identity, as the kit gives it", () => {
  it("is the corrected En Dash navy and turquoise, on paper, in reading ink", () => {
    expect(GRAVIEW_COLORS).toEqual({ navy: "#001769", turquoise: "#00e5b9", paper: "#f7f7f2", ink: "#18213a", muted: "#586174" });
    expect(Object.isFrozen(GRAVIEW_COLORS)).toBe(true);
  });

  it("never makes the turquoise a word: it fails as text on paper, and navy reads on it", () => {
    expect(ratio(GRAVIEW_COLORS.turquoise, GRAVIEW_COLORS.paper)).toBeLessThan(3);
    expect(ratio(GRAVIEW_COLORS.navy, GRAVIEW_COLORS.turquoise)).toBeGreaterThan(7);
    for (const scheme of [LIGHT, DARK]) expect(JSON.stringify(scheme).toLowerCase()).not.toContain(GRAVIEW_COLORS.turquoise);
  });

  it("builds the shipped light scheme on paper, ink and navy, and both schemes pass every pair", () => {
    expect(LIGHT.ground).toBe(GRAVIEW_COLORS.paper);
    expect(LIGHT.ink).toBe(GRAVIEW_COLORS.ink);
    expect(LIGHT.inkMuted).toBe(GRAVIEW_COLORS.muted);
    expect(LIGHT.accent).toBe(GRAVIEW_COLORS.navy);
    expect(DARK.accentInk).toBe(GRAVIEW_COLORS.navy);
    expect(checkBrandContrast(SCHEMES)).toEqual([]);
  });

  it("paints no wash or glow behind the scene, and an accent derived on it adds none", () => {
    expect(LIGHT.wash).toBe("none");
    expect(DARK.wash).toBe("none");
    const derived = brandFromAccent({ accent: "#2f7d8c", base: SCHEMES });
    expect(derived.ok).toBe(true);
    if (derived.ok) expect([derived.schemes.light.wash, derived.schemes.dark.wash]).toEqual(["none", "none"]);
  });

  it("names Montserrat first in the default stack, and keeps system-sans the system's own", () => {
    expect(TYPOGRAPHY.body.startsWith(`"${GRAVIEW_FACE}",`)).toBe(true);
    expect(SYSTEM_STACKS["system-sans"]).not.toContain(GRAVIEW_FACE);
  });

  it("sets the identity's weights on its own face, and plain ones on a face a brand chose", () => {
    expect(typographyOf().weights).toEqual(WEIGHTS);
    expect(WEIGHTS).toEqual({ display: 550, body: 450, label: 600 });
    expect(typographyOf({ typography: { body: "Georgia, serif" } }).weights).toEqual({ display: 600, body: 400, label: 600 });
    expect(typographyOf({ typography: { body: "Georgia, serif", weights: { body: 350 } } }).weights.body).toBe(350);
  });
});

describe("the shared-plane symbol", () => {
  it("is the optical micro cut at 16–27 px and the regular one from 28", () => {
    for (const size of [16, 20, 24, 27]) expect(symbolCut(size)).toBe("micro");
    for (const size of [28, 32, 48, 128]) expect(symbolCut(size)).toBe("regular");
    expect(LOGO_RULES).toMatchObject({ minWidth: 140, clearSpace: 0.5, microMax: 24, regularMin: 32 });
  });

  it("draws in currentColor with the point left to --graview-mark-point, so one color is the whole mark", () => {
    for (const size of [16, 32]) {
      const svg = graviewSymbol({ size });
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('fill="var(--graview-mark-point, currentColor)"');
      expect(svg).not.toMatch(/#[0-9a-f]{6}/i);
    }
    expect(graviewSymbol({ size: 16 })).toContain('viewBox="0 0 32 32"');
    expect(graviewSymbol({ size: 32 })).toContain('viewBox="0 0 196 166"');
  });

  it("is decorative unless named, and is named without an id, so it can be drawn many times on one page", () => {
    expect(graviewSymbol()).toContain('aria-hidden="true"');
    const named = graviewSymbol({ title: "Graview" });
    expect(named).toContain('role="img" aria-label="Graview"');
    expect(named).not.toMatch(/\sid="/);
  });
});
