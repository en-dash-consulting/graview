import { describe, expect, it } from "vitest";
import { ROWS_CSS } from "../../src/page-typography.js";

/**
 * A ROW'S GLANCE IS TWO LINES AT MOST, as its name is. A brief's long text
 * said as its excerpt ran four lines in the glance column, so one row stood
 * twice the height of the others; a row is one line or two, never more
 * (`pnpm verify long-text` measures it on every engine and width).
 */
describe("a row's glance", () => {
  it("is clamped to two lines, like the row's name", () => {
    const rule = /\.graview-row-glance\{([^}]*)\}/g;
    const said = [...ROWS_CSS.matchAll(rule)].map((match) => match[1]).join(";");
    expect(said).toContain("-webkit-line-clamp:2");
    expect(said).toContain("overflow:hidden");
  });
});
