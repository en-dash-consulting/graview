import { describe, expect, it } from "vitest";
import * as drawing from "../../src/drawing.js";
import * as main from "../../src/index.js";
import * as provider from "../../src/provider.js";

/*
 * THE PROVIDER CARRIES ONLY WHAT THE FRAME DRAWS WITH. Every face's frame
 * imports `@graview/react/provider` before anything is drawn, and a bundler
 * places a whole file in the first chunk when the first chunk can reach it
 * and any chunk uses it — so a hook only a drawn view calls, re-exported
 * there, rides in every hosted page's first chunk. What only a drawn view
 * uses is `@graview/react/drawing`'s, and this list keeps it there.
 */
const DRAWN_ONLY = [
  "anchorOf",
  "AUDIENCE_ROW",
  "kitConnector",
  "NOTHING_FOUND",
  "placeOthers",
  "useActivity",
  "useAttention",
  "useDrawnSize",
  "useEditableFields",
  "useFlagged",
  "useImplicated",
  "useKit",
  "useMarqueeRoom",
  "useReached",
  "useTextMeasure",
  "ViewBoundary",
];

describe("@graview/react/provider", () => {
  it("leaves what only a drawn view uses to @graview/react/drawing", () => {
    expect(Object.keys(drawing).sort()).toEqual([...DRAWN_ONLY].sort());
    expect(DRAWN_ONLY.filter((name) => name in provider)).toEqual([]);
  });

  it("exports nothing @graview/react does not: both narrow entries are parts of the whole", () => {
    expect(Object.keys(provider).filter((name) => !(name in main))).toEqual([]);
    expect(Object.keys(drawing).filter((name) => !(name in main))).toEqual([]);
  });

  it("still hands the frame where a caught error is told", () => {
    expect(provider.ErrorReportContext).toBe(main.ErrorReportContext);
  });
});
