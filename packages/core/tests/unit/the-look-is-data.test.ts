import { describe, expect, it } from "vitest";
import { isoShade, SCHEMES, SHAPE, shapeOf, TYPOGRAPHY, typographyOf } from "../../src/index.js";

/*
 * FR-73. A host reads Graview's shape, type and block lighting from core,
 * beside the palettes, as plain frozen data — `themeCss` reads the same
 * values, and `the-theme-reads-the-look-from-core.test.ts` in primitives
 * holds the sheet to them.
 */
describe("the look is data a host can read", () => {
  it("is the framework's own shape and type", () => {
    expect(SHAPE).toMatchObject({ radius: 8, density: 1, pad: 15, padSmall: 10, gap: 7 });
    expect(TYPOGRAPHY.body).toBe('"Montserrat", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif');
    expect(TYPOGRAPHY.mono).toBe('ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace');
  });

  it("is frozen all the way down, so nobody restyles the framework by assigning to it", () => {
    expect(Object.isFrozen(SHAPE)).toBe(true);
    expect(Object.isFrozen(TYPOGRAPHY)).toBe(true);
    for (const scheme of ["light", "dark"] as const) {
      const shade = isoShade(scheme);
      expect(Object.isFrozen(shade)).toBe(true);
      for (const face of [shade.roof, shade.right, shade.left, shade.plot, shade.plotEdge]) expect(Object.isFrozen(face)).toBe(true);
    }
  });

  it("is plain data: it survives JSON unchanged, so a worker can be handed it", () => {
    for (const value of [SHAPE, TYPOGRAPHY, isoShade("light"), isoShade("dark")]) expect(JSON.parse(JSON.stringify(value))).toEqual(value);
  });

  it("lights a block brighter toward the sky in both schemes, and not as one lighting inverted", () => {
    for (const scheme of ["light", "dark"] as const) {
      const { roof, right, left } = isoShade(scheme);
      expect(roof.lightness).toBeGreaterThan(right.lightness);
      expect(right.lightness).toBeGreaterThan(left.lightness);
    }
    expect(isoShade("light").roof).toEqual({ saturation: 48, lightness: 82 });
    expect(isoShade("dark").roof).toEqual({ saturation: 42, lightness: 32 });
    expect(isoShade("light").roofEdge).not.toBe(isoShade("dark").roofEdge);
  });

  it("resolves a brand that says nothing to the framework's own pixels", () => {
    expect(shapeOf({})).toEqual({ radius: 8, radiusSmall: 6, pad: 15, padSmall: 10, gap: 7 });
    expect(shapeOf()).toEqual(shapeOf({}));
    expect(typographyOf({})).toEqual({ body: TYPOGRAPHY.body, display: TYPOGRAPHY.body, mono: TYPOGRAPHY.mono, weights: { display: 550, body: 450, label: 600 } });
  });

  it("lets a brand move its radius and density, and every pixel of spacing moves with the one number", () => {
    const square = shapeOf({ shape: { radius: 2, density: 0.8 } });
    expect(square).toEqual({ radius: 2, radiusSmall: 2, pad: 12, padSmall: 8, gap: 6 });
    expect(shapeOf({ shape: { density: 1.4 } })).toMatchObject({ radius: 8, pad: 21 });
  });

  it("gives a brand's display face to the body when it names only one, and its own when it names two", () => {
    expect(typographyOf({ typography: { body: "Inter, sans-serif" } })).toEqual({ body: "Inter, sans-serif", display: "Inter, sans-serif", mono: TYPOGRAPHY.mono, weights: { display: 600, body: 400, label: 600 } });
    expect(typographyOf({ typography: { body: "Inter, sans-serif", display: "Fraunces, serif" } }).display).toBe("Fraunces, serif");
  });

  it("sits beside the palettes it is drawn with: one lighting per scheme the framework ships", () => {
    expect(Object.keys(SCHEMES).sort()).toEqual(["dark", "light"]);
    for (const scheme of Object.keys(SCHEMES) as ("light" | "dark")[]) expect(isoShade(scheme)).toBeDefined();
  });
});
