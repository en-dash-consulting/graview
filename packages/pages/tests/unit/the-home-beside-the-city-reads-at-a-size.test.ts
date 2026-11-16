import { describe, expect, it } from "vitest";
import { framedTogether, homeReadableZoom, levelZooms, PANEL, type Box } from "../../src/one-place-geometry.js";
import { groundGap } from "../../src/one-place-signs.js";

/*
 * THE HOME AT NEARBY READS AT A SIZE (Graview HQ
 * feature:f-one-face-home-nearby-reads-at-size). Framed whole beside the
 * page at whatever zoom the camera reached, a rich app's plots were drawn at
 * three fifths of a record page's and its boards could not be read; and a
 * district's name allowed to stand anywhere within reach of the box round
 * its diamond stood at the box's corner, half a plot off the ground it named.
 */
const desk = { width: 1280, height: 800, top: 48 };
const phone = { width: 390, height: 844, top: 56 };

describe("the home beside the city reads at a size", () => {
  it("never stands further out than a kind's list beside the city, nor closer than the home's own Nearby", () => {
    for (const view of [desk, phone, { width: 1920, height: 1080, top: 48 }]) {
      const least = homeReadableZoom(view);
      expect(least).toBeLessThanOrEqual(levelZooms({ type: "home" }, view)[PANEL]!);
      expect(least).toBeLessThanOrEqual(levelZooms({ type: "list", kind: "task" }, view)[PANEL]!);
    }
    // On a phone the home's own Nearby, closer than a list's there; on a desk a list's, never under a quarter past the Map's size.
    expect(homeReadableZoom(phone)).toBe(1.4);
    expect(homeReadableZoom(desk)).toBeGreaterThanOrEqual(1.25);
  });

  it("frames the views' districts in the order the page shows them, each that still fits with those before it", () => {
    const area: Box = { x: 0, y: 0, width: 400, height: 300 };
    const first: Box = { x: 0, y: 0, width: 100, height: 50 };
    const near: Box = { x: 150, y: 60, width: 100, height: 50 };
    const far: Box = { x: 900, y: 0, width: 100, height: 50 };
    // At 1.2 the first two together are 300 wide, inside 400 less two margins of 16; the third would make them 1200.
    expect(framedTogether([first, far, near], area, 1.2)).toEqual({ x: 0, y: 0, width: 250, height: 110 });
    // Closer, the second no longer fits with the first: the first alone.
    expect(framedTogether([first, near], area, 1.6)).toEqual(first);
    expect(framedTogether([], area, 1)).toBeNull();
  });

  it("measures a name's distance from its district's ground, not from the box round it", () => {
    const tile: Box = { x: 100, y: 100, width: 200, height: 100 };
    // In the box's top-left corner, clear of the diamond: the box says it touches, the ground does not.
    const atCorner: Box = { x: 100, y: 100, width: 40, height: 16 };
    expect(groundGap(atCorner, tile)).toBeGreaterThan(10);
    // On the ground, and across one of its edges: none.
    expect(groundGap({ x: 190, y: 140, width: 20, height: 20 }, tile)).toBe(0);
    expect(groundGap({ x: 120, y: 120, width: 120, height: 8 }, tile)).toBe(0);
    // Straight under its bottom corner, 10 below it.
    expect(groundGap({ x: 180, y: 210, width: 40, height: 16 }, tile)).toBeCloseTo(10, 5);
  });
});
