import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  brandFromAccent,
  checkContrast,
  coloursIn,
  composite,
  contrast,
  createSchema,
  defineApp,
  defineNode,
  TEXT_PAIRS,
  type ThemeTokens,
} from "../../src/index.js";
import { checkApp } from "../../src/check.js";

/**
 * A brand is a DECLARATION, so it can be checked before it ships.
 *
 * The interesting failure is not an ugly theme, it is one that looks fine in
 * the scheme whoever made it was using. Dark and light are not inversions of
 * each other: a secondary colour that clears 4.5:1 on a dark ground can fail
 * badly on paper, and nobody notices until somebody with a bright office
 * files a bug.
 */

const schema = createSchema([defineNode("thing", { fields: z.object({ label: z.string() }) })]);

/** A minimal readable pair, so the tests are about the checking. */
const dark: ThemeTokens = {
  ground: "#0b0f14",
  groundDeep: "#06090c",
  wash: "none",
  panel: "#141c22",
  panelMuted: "#111820",
  panelWarning: "#2a1d10",
  edge: "rgba(255,255,255,0.14)",
  edgeBright: "rgba(150,220,235,0.6)",
  ink: "#eef5f7",
  inkMuted: "#a9bcc4",
  inkFaint: "#93a7b0",
  accent: "#6fdcea",
  accentDim: "rgba(111,220,234,0.35)",
  accentInk: "#06232a",
  warn: "#f0a868",
  good: "#8fdcaa",
  bad: "#ffa3a3",
  glow: "rgba(111,220,234,0.28)",
  bar: "#0e141a",
  float: "#131b22",
  liftLow: "none",
  liftHigh: "none",
  tintAlpha: 0.2,
  tintLightness: 52,
  gridAlpha: 0.35,
};

const light: ThemeTokens = {
  ...dark,
  ground: "#f6f4f0",
  groundDeep: "#efece6",
  panel: "#ffffff",
  panelMuted: "#faf8f5",
  panelWarning: "#fdf4ea",
  edge: "rgba(0,0,0,0.10)",
  edgeBright: "rgba(12,110,120,0.7)",
  ink: "#15201f",
  inkMuted: "#54605f",
  inkFaint: "#67716f",
  accent: "#0c6e78",
  accentInk: "#ffffff",
  warn: "#9a5312",
  good: "#1b6436",
  bad: "#a1232d",
  bar: "#ffffff",
  float: "#ffffff",
};

describe("reading a colour", () => {
  it("reads hex, rgb and hsl alike", () => {
    expect(coloursIn("#ffffff")[0]).toMatchObject({ r: 255, g: 255, b: 255, a: 1 });
    expect(coloursIn("rgba(0, 0, 0, 0.5)")[0]).toMatchObject({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(coloursIn("hsl(0 100% 50%)")[0]).toMatchObject({ r: 255, g: 0, b: 0 });
  });

  it("reads EVERY stop of a gradient, because text lands on all of them", () => {
    const stops = coloursIn("linear-gradient(rgba(14,22,29,0.96), rgba(8,13,18,0.97))");
    expect(stops).toHaveLength(2);
  });

  it("composites a translucent panel over its ground", () => {
    const over = composite({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
    expect(Math.round(over.r)).toBe(128);
  });

  it("computes the ratios WCAG says it should", () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(Math.round(contrast(black, white))).toBe(21);
    expect(contrast(white, white)).toBe(1);
  });
});

describe("checking a palette", () => {
  it("passes a readable one", () => {
    expect(checkContrast(dark)).toEqual([]);
    expect(checkContrast(light)).toEqual([]);
  });

  it("names the exact pair that fails, and where it is drawn", () => {
    const faded = { ...light, inkFaint: "#c8cfcd" };
    const failure = checkContrast(faded).find((finding) => finding.ink === "inkFaint")!;
    expect(failure.on).toBe("panel");
    expect(failure.ratio).toBeLessThan(4.5);
    // "Your theme has a contrast problem" is not something anyone can act on.
    expect(failure.where).toBe("a field name");
  });

  it("reports a value it could not read rather than passing it", () => {
    const opaque = { ...light, panel: "var(--somebody-elses-token)" };
    const finding = checkContrast(opaque).find((f) => f.unreadable !== undefined)!;
    expect(finding.unreadable).toBe("var(--somebody-elses-token)");
  });

  it("covers every pair a component actually draws text on", () => {
    // The list is the contract; a component that invents a new pairing has to
    // come here, which is the point of enumerating rather than discovering.
    expect(TEXT_PAIRS.length).toBeGreaterThan(10);
    for (const pair of TEXT_PAIRS) {
      expect(Object.keys(dark)).toContain(pair.ink);
      expect(Object.keys(dark)).toContain(pair.on);
    }
  });

  it("is a graview check finding, naming the scheme", () => {
    const app = defineApp({
      name: "branded",
      schema,
      brand: { name: "Acme", schemes: { dark, light: { ...light, inkMuted: "#d8dedd" } } },
    });
    const finding = checkApp(app).findings.find((f) => f.code === "theme-contrast-below-aa")!;
    expect(finding.where).toContain("light");
    expect(finding.where).toContain("inkMuted");
    expect(finding.severity).toBe("error");
  });
});

describe("one accent is not a theme", () => {
  const base = { dark, light };

  it("keeps the brand's hue and moves only its lightness, per scheme", () => {
    /*
     * No single colour can be accent TEXT in both schemes: 4.5:1 on white
     * needs a lightness under about 0.18 and 4.5:1 on a dark panel needs one
     * over about 0.24, and those do not overlap. "The brand's accent" is one
     * hue with two lightnesses, and a framework that simply took the hex
     * would have shipped an unreadable label in one scheme or the other.
     */
    const built = brandFromAccent({ accent: "#0c6e78", base });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    // Readable in BOTH, which is the only claim that matters.
    expect(checkContrast(built.schemes.dark)).toEqual([]);
    expect(checkContrast(built.schemes.light)).toEqual([]);
    // And still the same colour: the dark one is lighter, not different.
    expect(built.schemes.dark.accent).not.toBe(built.schemes.light.accent);
  });

  it("leaves a colour that already works exactly alone", () => {
    const built = brandFromAccent({ accent: light.accent, base });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(coloursIn(built.schemes.light.accent)[0]).toMatchObject(
      coloursIn(light.accent)[0]!,
    );
  });

  it("chooses the text on a filled accent, and checks its own choice", () => {
    const built = brandFromAccent({ accent: "#0c6e78", base });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.schemes.light.accentInk).toBe("#ffffff");
  });

  it("REFUSES when reaching legibility would stop it being the brand's colour", () => {
    /*
     * A pale brand yellow is a perfectly good logo colour and an unreadable
     * label on white. It can be made readable — by darkening it until it is
     * brown, which is not their colour any more. Shipping that under their
     * name is worse than saying so.
     */
    const built = brandFromAccent({ accent: "#ffe066", base });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.missing).toContain("accent (light)");
    expect(built.why).toContain("supply one for light");
  });

  it("refuses a warning colour that shares the accent's hue", () => {
    // Two roles that look alike is worse than an ugly pair, because one of
    // them means "something is broken".
    const built = brandFromAccent({
      accent: "#c86a1e",
      base,
      warn: { dark: "#f0a868", light: "#9a5312" },
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.missing.some((name) => name.startsWith("warn"))).toBe(true);
  });

  it("refuses a value that is not a colour at all", () => {
    const built = brandFromAccent({ accent: "brand-blue", base });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.missing).toEqual(["accent"]);
  });
});

describe("kind accents are declared, not hashed", () => {
  it("check refuses an accent for an unknown kind, and a non-numeric hue", () => {
    const thing = defineNode("thing", { fields: z.object({ label: z.string() }) });
    const app = defineApp({
      name: "test",
      schema: createSchema([thing]),
      mutations: [],
      invariants: [],
      brand: {
        name: "T",
        schemes: { dark, light },
        accents: { thing: 120, ghost: 40, bad: "green" as never },
      },
    });
    const codes = checkApp(app).findings.map((f) => f.code);
    expect(codes).toContain("brand-accent-unknown-kind");
    expect(codes).toContain("brand-accent-not-a-hue");
    // "bad" earns two findings — an unknown kind AND a non-hue value.
    expect(codes.filter((c) => c.startsWith("brand-accent"))).toHaveLength(3);
  });
});
