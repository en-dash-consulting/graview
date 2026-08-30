import { describe, expect, it } from "vitest";
import {
  hitTest,
  invertPlaneTransform,
  toLocal,
  type Placement,
} from "../../src/interaction/pointer-router.js";
import { isAffine, planeTransform, perspectiveProbeMatrix, IDENTITY } from "../../src/index.js";
import { mixStyles, PLANE_STYLES, styleFor, transformFor } from "../../src/scene/plane.js";

/**
 * The routing maths, tested headlessly. The browser half is verified by
 * `apps/spike/scripts/run-spike.mjs`, which clicks three real panels at three
 * plane depths in Chrome Canary; this covers the arithmetic that has to be
 * right for that to work.
 */

const placement = (depth: number, scale: number, tx: number, ty: number): Placement => ({
  element: null as unknown as Element,
  transform: planeTransform(scale, tx, ty),
  width: 400,
  height: 200,
  depth,
});

describe("plane transforms", () => {
  it("emits nothing but affine transforms", () => {
    for (const plane of [0, 1, 2]) {
      const style = styleFor(plane);
      const transform = transformFor(style, 100, 50, 1000, 600);
      expect(isAffine(transform)).toBe(true);
    }
    // The probe matrix exists only to ask the browser a question; it must not
    // pass the assertion layout relies on.
    expect(isAffine(perspectiveProbeMatrix())).toBe(false);
    expect(isAffine(IDENTITY)).toBe(true);
  });

  it("leaves position to layout and contributes only treatment", () => {
    const near = transformFor(PLANE_STYLES[0], 100, 100, 1000, 600);
    const far = transformFor(PLANE_STYLES[2], 100, 100, 1000, 600);
    // Both land exactly where layout put them...
    expect([near[12], near[13]]).toEqual([100, 100]);
    expect([far[12], far[13]]).toEqual([100, 100]);
    // ...and recession is carried by scale, not by moving things about. If
    // the plane moved them too, layout would no longer know where anything
    // ended up and connectors would miss the views they connect.
    expect(near[0]).toBe(1);
    expect(far[0]).toBe(PLANE_STYLES[2].scale);
  });

  it("interpolates any two plane styles, so transitions animate", () => {
    // Read both ends from the source of truth, so tuning a plane's look does
    // not break a test about interpolation.
    const mid = mixStyles(PLANE_STYLES[0], PLANE_STYLES[2], 0.5);
    expect(mid.scale).toBeCloseTo((PLANE_STYLES[0].scale + PLANE_STYLES[2].scale) / 2);
    expect(mid.blur).toBeCloseTo((PLANE_STYLES[0].blur + PLANE_STYLES[2].blur) / 2);
    expect(mixStyles(PLANE_STYLES[0], PLANE_STYLES[2], 0)).toEqual(PLANE_STYLES[0]);
    expect(mixStyles(PLANE_STYLES[0], PLANE_STYLES[2], 1)).toEqual(PLANE_STYLES[2]);
    // Fidelity is a choice, not a blend: a half-captured view is not a thing.
    expect(mixStyles(PLANE_STYLES[0], PLANE_STYLES[2], 0.4).fidelity).toBe("full");
    expect(mixStyles(PLANE_STYLES[0], PLANE_STYLES[2], 0.6).fidelity).toBe("glyph");
  });

  it("clamps an out-of-range plane rather than inventing a style", () => {
    expect(styleFor(-3)).toEqual(PLANE_STYLES[0]);
    expect(styleFor(99)).toEqual(PLANE_STYLES[2]);
  });
});

describe("hit testing against drawn geometry", () => {
  it("inverts a plane transform exactly", () => {
    const inverse = invertPlaneTransform(planeTransform(0.5, 100, 40));
    expect(inverse).toEqual({ scaleX: 2, scaleY: 2, translateX: 100, translateY: 40 });
    expect(invertPlaneTransform(planeTransform(0, 0, 0))).toBeNull();
  });

  it("maps a canvas point into the element's own coordinates", () => {
    const view = placement(0, 0.5, 100, 40);
    // The quad covers 100..300 x 40..140 on the canvas; its own box is 400x200.
    expect(toLocal(view, 100, 40)).toMatchObject({ x: 0, y: 0 });
    expect(toLocal(view, 300, 140)).toMatchObject({ x: 400, y: 200 });
    expect(toLocal(view, 200, 90)).toMatchObject({ x: 200, y: 100 });
    expect(toLocal(view, 99, 90)).toBeNull();
    expect(toLocal(view, 301, 90)).toBeNull();
  });

  it("gives the click to the nearest plane when quads overlap", () => {
    const near = placement(0, 1, 0, 0); // covers 0..400 x 0..200
    const overlapping = placement(2, 0.5, 100, 40); // covers 100..300 x 40..140
    // Inside both: plane 0 wins, because it is the one you can see. This is
    // exactly the case that made two of three spike clicks look wrong before
    // the panels were spaced apart — occlusion, working correctly.
    expect(hitTest([overlapping, near], 150, 60)?.placement).toBe(near);

    const clear = placement(2, 0.5, 450, 250); // covers 450..650 x 250..350
    expect(hitTest([clear, near], 500, 300)?.placement).toBe(clear);
  });

  it("returns nothing when the point is over bare canvas", () => {
    expect(hitTest([placement(0, 1, 0, 0)], 900, 900)).toBeNull();
    expect(hitTest([], 10, 10)).toBeNull();
  });
});
