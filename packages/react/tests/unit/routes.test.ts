import { describe, expect, it } from "vitest";
import { clipPolyline, orthogonalPoints, polylineD, routePoint, routedQuadratic } from "../../src/routes.js";

/*
 * A route is one case: the curve the scene always drew, its chord, and a
 * polyline with two elbows. What every route owes the scene is the same —
 * a path that keeps out of the boxes its ends are drawn in, and a point at
 * any parameter for the hit corridor.
 */
const q = { p0: { x: 0, y: 0 }, c: { x: 50, y: 80 }, p1: { x: 100, y: 0 } };

describe("routes", () => {
  it("a straight route is the quadratic with its control on the chord", () => {
    expect(routedQuadratic("straight", q).c).toEqual({ x: 50, y: 0 });
    expect(routedQuadratic("curve", q)).toBe(q);
    expect(routePoint("straight", q, 0.5)).toEqual({ x: 50, y: 0 });
    expect(routePoint("curve", q, 0.5)).toEqual({ x: 50, y: 40 });
  });

  it("an orthogonal route has two elbows at the middle, and walks them by length", () => {
    expect(orthogonalPoints({ x: 0, y: 0 }, { x: 100, y: 60 })).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 60 },
      { x: 100, y: 60 },
    ]);
    const mid = routePoint("orthogonal", { p0: { x: 0, y: 0 }, c: { x: 0, y: 0 }, p1: { x: 100, y: 60 } }, 0.5);
    // Halfway along 50 + 60 + 50 = 160 is 80: 50 across, then 30 down the riser.
    expect(mid).toEqual({ x: 50, y: 30 });
  });

  it("a polyline keeps out of the boxes its ends are drawn in", () => {
    const runs = clipPolyline(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [{ x: -10, y: -10, width: 30, height: 20 }, { x: 80, y: -10, width: 30, height: 20 }],
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]![0]!.x).toBeCloseTo(20, 0);
    expect(runs[0]![runs[0]!.length - 1]!.x).toBeCloseTo(80, 0);
    expect(polylineD(runs)).toBe("M 20 0 L 80 0");
  });

  it("a polyline under a card in the middle is drawn in two runs", () => {
    const runs = clipPolyline([{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 40, y: -5, width: 20, height: 10 }]);
    expect(runs).toHaveLength(2);
  });
});
