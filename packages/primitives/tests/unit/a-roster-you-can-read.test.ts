import { describe, expect, it } from "vitest";
import { rosterOf, themeCss } from "../../src/index.js";

/**
 * AN OPENED DISTRICT IS A ROSTER YOU CAN READ. Two columns of ninety-five
 * pixels turned every vehicle into "2026 Ma…"; its header's grid gave the
 * name a column of minmax(0, 1fr) and the count drew over "VEHICLES".
 */
describe("an opened district's roster", () => {
  it("keeps one column for names too long for two, and lists the rows it was given", () => {
    const vehicles = Array.from({ length: 291 }, (_, i) => `2026 Mazda CX-5 Carbon Edition ${i}`);
    expect(rosterOf(vehicles, 3)).toEqual({ columns: 1, shown: 3 });
  });

  it("uses two columns where two short names fit side by side", () => {
    expect(rosterOf(["Ana", "Bo", "Cy", "Di", "Ed"], 2)).toEqual({ columns: 2, shown: 4 });
    expect(rosterOf(["Ana"], 8)).toEqual({ columns: 2, shown: 1 });
  });

  it("wraps its header rather than squeezing the name under the count", () => {
    const css = themeCss("light");
    const opened = css.slice(css.indexOf(".graview-kind-face[data-graview-opened] {"));
    expect(opened.slice(0, 600)).toContain("flex-wrap: wrap");
    expect(opened.slice(0, 600)).not.toContain("minmax(0, 1fr) auto");
  });
});
