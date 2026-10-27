import { describe, expect, it } from "vitest";
import { groundSchemes, logoFor, logoScheme, SCHEMES, type Brand, type Ground } from "../../src/index.js";

/**
 * A LIGHT SCHEME DRAWN AS A DARK PAGE DRAWS THE DARK LOGO (Roadmap
 * f-logo-on-dark-light-ground). Since 0.1.56 a light scheme whose ground
 * is dark is drawn as the dark page it is, in the dark scheme's inks
 * (f-dark-brand-accent) — but the light logo was still the one drawn
 * there, so a dark mark made for paper vanished on it. `logoScheme` says
 * which scheme's logo a scheme draws, and the sheets hide the other by it.
 */
const LIGHT = "/logo.svg";
const DARK = "/logo-dark.svg";
const brandOn = (ground: Ground | undefined, logo: Brand["logo"]): Brand => ({ name: "Steelers", logo, schemes: ground ? groundSchemes(ground) : SCHEMES });

describe("which scheme's logo a scheme draws", () => {
  it("is the dark one in the dark scheme, and the light one in a light scheme on paper", () => {
    expect(logoScheme(brandOn(undefined, { light: LIGHT, dark: DARK }), "dark")).toBe("dark");
    expect(logoScheme(brandOn(undefined, { light: LIGHT, dark: DARK }), "light")).toBe("light");
    expect(logoScheme(brandOn("#f4efe6", { light: LIGHT, dark: DARK }), "light")).toBe("light");
  });

  it("is the dark one in a light scheme whose ground is dark", () => {
    expect(logoScheme(brandOn("#000000", { light: LIGHT, dark: DARK }), "light")).toBe("dark");
    expect(logoScheme(brandOn({ light: "#0a0f1f", dark: "#0a0f1f" }, { light: LIGHT, dark: DARK }), "light")).toBe("dark");
    expect(logoScheme(undefined, "light")).toBe("light");
  });
});

describe("the logo a scheme draws", () => {
  it("is the dark logo on a dark light-ground, and the light one inverted there when that is what the brand gave", () => {
    expect(logoFor(brandOn("#000000", { light: LIGHT, dark: DARK }), "light")).toEqual({ src: DARK, invert: false });
    expect(logoFor(brandOn("#000000", { light: LIGHT, darkFallback: "invert" }), "light")).toEqual({ src: LIGHT, invert: true });
    expect(logoFor(brandOn("#000000", { light: LIGHT }), "light")).toEqual({ src: LIGHT, invert: false });
  });

  it("is the light logo on paper, as before", () => {
    expect(logoFor(brandOn("#f4efe6", { light: LIGHT, dark: DARK }), "light")).toEqual({ src: LIGHT, invert: false });
    expect(logoFor(brandOn(undefined, { light: LIGHT, dark: DARK }), "dark")).toEqual({ src: DARK, invert: false });
  });
});
