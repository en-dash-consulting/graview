import { groundSchemes, SCHEMES, type Brand } from "@graview/core";
import { describe, expect, it } from "vitest";
import { staticCss } from "../../src/static.js";

/**
 * A STATIC PAGE ON A DARK LIGHT-GROUND DRAWS THE DARK LOGO (Roadmap
 * f-logo-on-dark-light-ground). `renderPlace` writes both logos into the
 * masthead and its sheet hides the other scheme's; a light scheme whose
 * ground is dark is drawn as a dark page (f-dark-brand-accent), so the
 * sheet hides the light logo there and shows the dark one, as the theme's
 * sheet does on the live faces.
 */
const brand = (ground?: string): Brand => ({ name: "Steelers", logo: { light: "/logo.svg", dark: "/logo-dark.svg" }, schemes: ground ? groundSchemes(ground) : SCHEMES });

describe("the static sheet's logo for the light scheme", () => {
  it("hides the light logo on a dark ground, and inverts a light one that asked to be", () => {
    const black = staticCss(brand("#000000"), "light");
    expect(black).toContain('[data-graview-scheme-only="light"] { display: none; }');
    expect(black).not.toContain('[data-graview-scheme-only="dark"] { display: none; }');
    expect(black).toContain("invert(1)");
  });

  it("hides the dark logo on paper, as before", () => {
    for (const css of [staticCss(brand(), "light"), staticCss(brand("#f4efe6"), "light")]) {
      expect(css).toContain('[data-graview-scheme-only="dark"] { display: none; }');
      expect(css).not.toContain("invert(1)");
    }
    expect(staticCss(brand("#000000"), "dark")).toContain('[data-graview-scheme-only="light"] { display: none; }');
  });
});
