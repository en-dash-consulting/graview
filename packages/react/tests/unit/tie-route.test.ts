import { describe, expect, it } from "vitest";
import { tieRoute } from "../../src/scene.js";

/**
 * How a tie runs, pinned as geometry. The browser harnesses prove the
 * lines land on real drawings; this pins the routing DECISIONS — stitch in
 * the gutter for stacked rows, over the top for row-mates, direct arc only
 * across clear air, and no line at all where none is honest.
 */

const box = (x: number, y: number, width = 100, height = 30) => ({ x, y, width, height });

describe("tieRoute", () => {
  it("stitches stacked rows along their right edge, in the gutter", () => {
    // Two rows in one list column: same x-range, one above the other. The
    // old center-to-center vertical ran THROUGH every row between them.
    const stitched = tieRoute(box(0, 0), box(0, 200))!;
    expect(stitched.mode).toBe("stacked");
    // Both anchors sit on the right edges, and the control bows further
    // right — the line lives in the gutter, not the content.
    expect(stitched.from.x).toBe(100);
    expect(stitched.to.x).toBe(100);
    expect(stitched.control.x).toBeGreaterThan(100);
  });

  it("keeps the stitch for ADJACENT rows instead of dropping the line", () => {
    // A row and the row directly beneath it — 5px apart. The waits-for tie
    // between neighboring tasks used to vanish entirely here.
    const stitched = tieRoute(box(0, 0), box(0, 35))!;
    expect(stitched).not.toBeNull();
    expect(stitched.mode).toBe("stacked");
  });

  it("stitches row-mates over the top", () => {
    const route = tieRoute(box(0, 0, 60, 30), box(200, 5, 60, 30))!;
    expect(route.mode).toBe("abreast");
    expect(route.from.y).toBe(0);
    expect(route.to.y).toBe(5);
    expect(route.control.y).toBeLessThan(0);
  });

  it("takes the direct arc only across clear air", () => {
    const route = tieRoute(box(0, 0, 60, 30), box(300, 300, 60, 30))!;
    expect(route.mode).toBe("direct");
  });

  it("draws nothing for one drawing inside another", () => {
    expect(tieRoute(box(0, 0, 200, 100), box(50, 30, 40, 20))).toBeNull();
  });

  it("draws nothing between anchors a few pixels apart", () => {
    // Two tiny drawings diagonally adjacent, borders almost touching —
    // a line here restates one drawing rather than showing a relation.
    expect(tieRoute(box(0, 0, 10, 10), box(14, 14, 10, 10))).toBeNull();
  });
});
