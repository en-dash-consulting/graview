import { describe, expect, it } from "vitest";
import { areaOf, boxOf, centroidOf, estimateWidth, fitLabel, overlaps, spanAt } from "../../src/index.js";

/**
 * A NAME THAT FITS THE THING IT NAMES.
 *
 * Found by a product whose plan drew seven model-written names at one size
 * across the middle of their shapes. Three ran off the canvas, two were
 * struck through by a neighbor's outline, and nothing failed: every test
 * passed, the accessibility tree was perfect, and the picture said "rick
 * patio with gravel joints".
 */

const band = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
const fit = (text: string, room: number, height = 120, size = 22, floor = 12) =>
  fitLabel(text, { room, height, size, floor });

describe("how much room a shape has, at a height", () => {
  it("is the width of the shape there, for a rectangle", () => {
    expect(spanAt(band(0.2, 0.1, 0.5, 0.4), 0.3)).toEqual({ x0: 0.2, x1: 0.7 });
  });

  it("is the WAIST of an hourglass, not its bounding box", () => {
    const pinched = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.55, y: 0.5 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0.45, y: 0.5 },
    ];
    expect(spanAt(pinched, 0.05).x1 - spanAt(pinched, 0.05).x0).toBeGreaterThan(0.85);
    expect(spanAt(pinched, 0.5).x1 - spanAt(pinched, 0.5).x0).toBeLessThan(0.15);
  });

  it("takes the widest run when a scanline leaves the shape and comes back", () => {
    const u = [
      { x: 0, y: 0 },
      { x: 0.2, y: 0 },
      { x: 0.2, y: 0.6 },
      { x: 0.8, y: 0.6 },
      { x: 0.8, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(spanAt(u, 0.3).x1 - spanAt(u, 0.3).x0).toBeCloseTo(0.2, 5);
    expect(spanAt(u, 0.8).x1 - spanAt(u, 0.8).x0).toBeCloseTo(1, 5);
  });

  it("says how tall a shape is, how much it covers, and where its middle is", () => {
    expect(boxOf(band(0.2, 0.1, 0.5, 0.4))).toEqual({ top: 0.1, bottom: 0.5 });
    expect(areaOf(band(0, 0, 0.5, 0.4))).toBeCloseTo(0.2, 6);
    expect(centroidOf(band(0, 0, 1, 1))).toEqual({ x: 0.5, y: 0.5 });
  });

  it("keeps a centroid inside an L rather than averaging it off the shape", () => {
    /* Four of the six corners are bunched at one end; the mean lands out. */
    const ell = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.25 },
      { x: 0.25, y: 0.25 },
      { x: 0.25, y: 1 },
      { x: 0, y: 1 },
    ];
    const middle = centroidOf(ell);
    expect(middle.x).toBeLessThan(0.45);
    expect(middle.y).toBeLessThan(0.45);
  });
});

describe("a name that fits, or none", () => {
  it("is drawn whole and large when there is room", () => {
    const fitted = fit("Back Lawn", 400)!;
    expect(fitted).toEqual({ lines: ["Back Lawn"], fontSize: 22, whole: true });
  });

  it("breaks at the space nearest the MIDDLE, not at the first one", () => {
    const fitted = fit("Perimeter raised beds along the fence", 250)!;
    expect(fitted.lines).toHaveLength(2);
    const [first, second] = fitted.lines as [string, string];
    expect(Math.abs(first.length - second.length)).toBeLessThan(8);
    expect(`${first} ${second}`).toBe("Perimeter raised beds along the fence");
  });

  it("shrinks before it cuts, and never past the floor", () => {
    const fitted = fit("Pea-gravel corner with river-rock border and log seats", 230, 80)!;
    expect(fitted.whole).toBe(true);
    /* Two lines, smaller than the base, larger than the floor. */
    expect(fitted.lines).toHaveLength(2);
    expect(fitted.fontSize).toBeGreaterThanOrEqual(12);
    expect(fitted.fontSize).toBeLessThan(22);
    for (const line of fitted.lines) expect(estimateWidth(line, fitted.fontSize)).toBeLessThanOrEqual(230);
  });

  it("cuts with an ellipsis when shrinking runs out, and says it is not whole", () => {
    const fitted = fit("Outdoor kitchen grill, covered picnic table and mini-split condenser", 90, 15)!;
    expect(fitted.whole).toBe(false);
    expect(fitted.lines[0]).toMatch(/…$/);
    expect(estimateWidth(fitted.lines[0]!, fitted.fontSize)).toBeLessThanOrEqual(90);
  });

  it("draws nothing at all rather than a two-letter stub", () => {
    /*
     * A stub over a small shape is worse than a clean one: it reads as
     * somebody else's label clipped. `whole: false` is how a caller knows
     * to say the name somewhere a person can still read it; null is how it
     * knows there is nothing on the drawing at all.
     */
    expect(fit("House elevation and side passage", 18, 40)).toBeNull();
    expect(fit("Drive", 400, 6)).toBeNull();
  });

  it("stays on one line when that is all the caller will allow", () => {
    const fitted = fitLabel("Perimeter raised beds along the fence", {
      room: 250,
      height: 120,
      size: 22,
      floor: 12,
      lines: 1,
    })!;
    expect(fitted.lines).toHaveLength(1);
  });

  it("never returns a line wider than the room it was given, for any name", () => {
    const names = [
      "Back Lawn",
      "Perimeter raised beds along the fence",
      "Pea-gravel corner with river-rock border, log seats and a fire bowl",
      "Small lawn in two panels either side of the brick path",
      "House elevation, basement stairwell and side passage",
      "A",
    ];
    for (const name of names) {
      for (const room of [40, 90, 150, 240, 380, 620]) {
        const fitted = fit(name, room);
        if (fitted === null) continue;
        for (const line of fitted.lines) {
          expect(estimateWidth(line, fitted.fontSize), `${name} @ ${room}`).toBeLessThanOrEqual(room);
        }
        expect(fitted.lines.length * fitted.fontSize * 1.15, `${name} @ ${room}`).toBeLessThanOrEqual(120);
      }
    }
  });

  it("measures with whatever the caller has, and defaults to pessimism", () => {
    /* A face twice as wide gets half the words, without this knowing why. */
    const wide = fitLabel("Back Lawn and the beds", {
      room: 200,
      height: 120,
      size: 22,
      floor: 12,
      measure: (text, size) => text.length * size * 1.2,
    })!;
    const narrow = fit("Back Lawn and the beds", 200)!;
    expect(wide.fontSize).toBeLessThan(narrow.fontSize);
  });
});

describe("whether two names would collide", () => {
  it("is the whole of collision avoidance, in one line", () => {
    const a = { x0: 0, y0: 0, x1: 10, y1: 10 };
    expect(overlaps(a, { x0: 5, y0: 5, x1: 15, y1: 15 })).toBe(true);
    /* Touching is not overlapping: two names may sit edge to edge. */
    expect(overlaps(a, { x0: 10, y0: 0, x1: 20, y1: 10 })).toBe(false);
    expect(overlaps(a, { x0: 11, y0: 11, x1: 20, y1: 20 })).toBe(false);
  });
});
