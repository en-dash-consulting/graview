import { DARK, LIGHT } from "@graview/core";
import { describe, expect, it } from "vitest";
import { themeCss } from "../../src/index.js";

/*
 * The theme carries the kit as custom properties, so the grid, the lattice
 * and the kind tags read the brand's say without a component knowing.
 */
describe("the kit is in the theme", () => {
  it("emits the shipped kit for a brand that says nothing", () => {
    const css = themeCss("light");
    expect(css).toContain("--graview-kit-grid: 1;");
    expect(css).toContain("--graview-kit-grid-size: 64px;");
    expect(css).toContain("--graview-kit-tags: inline-flex;");
    // The ground's rules read the variables, not literals.
    expect(css).toContain("background-size: var(--graview-kit-grid-size, 64px)");
    expect(css).toContain("display: var(--graview-kit-tags, inline-flex);");
    expect(css).not.toContain("background-size: 64px 64px");
  });

  it("carries the brand's kit: a grid kept off, a tag kept off, a finer lattice", () => {
    const css = themeCss("dark", { name: "Kit", schemes: { dark: DARK, light: LIGHT }, kit: { grid: { visible: false }, tags: { visible: false }, lattice: { size: 32 } } });
    expect(css).toContain("--graview-kit-grid: 0;");
    expect(css).toContain("--graview-kit-tags: none;");
    expect(css).toContain("--graview-kit-lattice-size: 32px;");
  });
});
