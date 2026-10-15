import { describe, expect, it } from "vitest";
import { SPEC_VIEW_CSS } from "../../src/spec-css.js";

/**
 * A ROW GROUP LAYS ANY BLOCK SIDE BY SIDE. `"direction": "row"` put four
 * figures in a row, but four lines of text, or two columns of meters, each
 * took the whole width and stacked: in a wrapping flex row a paragraph's
 * natural width is the whole line. Every block in a row group takes a share
 * of the line, and wraps onto the next on a phone. (Drawn and measured at a
 * desk and a phone by `pnpm verify declared`.)
 */
const rule = (selector: string): string | undefined => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\n)${escaped}\\{([^}]*)\\}`).exec(SPEC_VIEW_CSS)?.[1];
};

describe("a row group lays any block side by side", () => {
  it("wraps, and gives every block in it a share of the line it can shrink from", () => {
    expect(rule('.graview-spec-group[data-direction="row"]')).toMatch(/flex-wrap:wrap/);
    expect(rule('.graview-spec-group[data-direction="row"]>*')).toMatch(/flex:1 1 \d+(?:\.\d+)?rem;min-width:0/);
  });

  it("lets a badge keep its own width, and a headline or a divider take the whole line", () => {
    expect(SPEC_VIEW_CSS).toMatch(/\.graview-spec-group\[data-direction="row"\]>:is\([^)]*\.graview-spec-badge[,)][^{]*\{flex:0 1 auto\}/);
    expect(SPEC_VIEW_CSS).toMatch(/\.graview-spec-group\[data-direction="row"\]>:is\(\.graview-spec-headline,\.graview-spec-divider\)\{flex-basis:100%\}/);
  });
});
