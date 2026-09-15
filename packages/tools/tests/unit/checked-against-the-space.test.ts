import { describe, expect, it } from "vitest";
import { across, inside, within } from "../../src/index.js";

/**
 * A MODEL'S ANSWER ABOUT A SPACE, CHECKED AGAINST THE SPACE.
 *
 * A product's map prompt promised, from its first version, that an area
 * inside another must be drawn inside it and a thing must be placed inside
 * the area it stands in. Nothing looked. A survey came back as seven
 * full-width bands stacked down the page, every one lying across its
 * neighbours, and the app accepted it line for line.
 */

const band = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

describe("where a thing is", () => {
  it("is inside a shape, or outside it", () => {
    const lawn = band(0.1, 0.1, 0.4, 0.4);
    expect(inside({ x: 0.3, y: 0.3 }, lawn)).toBe(true);
    expect(inside({ x: 0.9, y: 0.9 }, lawn)).toBe(false);
  });

  it("is stable on a boundary, which is all a boundary can promise", () => {
    /*
     * Ray casting decides a point exactly on an edge by which edge the ray
     * happens to cross, so one side of a shape reads in and the other out.
     * That is the standard behaviour and it is fine for what this is for —
     * a model's coordinates are never exactly on a line — but it is not a
     * thing to build on, so it is written down rather than asserted away.
     */
    const box = band(0.1, 0.1, 0.4, 0.4);
    expect(inside({ x: 0.1, y: 0.3 }, box)).toBe(inside({ x: 0.1, y: 0.3 }, box));
    /* What does hold: a hair inside is in, a hair outside is out. */
    expect(inside({ x: 0.1001, y: 0.3 }, box)).toBe(true);
    expect(inside({ x: 0.0999, y: 0.3 }, box)).toBe(false);
  });

  it("works on a shape that is not a box", () => {
    const ell = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.25 },
      { x: 0.25, y: 0.25 },
      { x: 0.25, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(inside({ x: 0.1, y: 0.8 }, ell)).toBe(true);
    /* The notch: inside the bounding box and outside the shape. */
    expect(inside({ x: 0.8, y: 0.8 }, ell)).toBe(false);
  });
});

describe("whether one area is inside another", () => {
  it("wants every corner in, not most of them", () => {
    const lawn = band(0, 0, 0.6, 0.6);
    expect(within(band(0.1, 0.1, 0.2, 0.2), lawn)).toBe(true);
    expect(within(band(0.5, 0.5, 0.3, 0.3), lawn)).toBe(false);
  });
});

describe("whether two areas lie across each other", () => {
  it("catches bands stacked down the page, which is what guessing looks like", () => {
    expect(across(band(0.05, 0.1, 0.9, 0.3), band(0.0, 0.3, 0.8, 0.3))).toBe(true);
  });

  it("lets two areas meet at an edge, because a property is a jigsaw", () => {
    expect(across(band(0, 0, 0.5, 0.5), band(0.5, 0, 0.5, 0.5))).toBe(false);
  });

  it("does not call a nested area an overlap — it is contained, not crossing", () => {
    /*
     * The inner shape has corners in the outer one and the outer has none in
     * the inner, so the mutual test says no. Containment is a different
     * question and `within` is the one that asks it.
     */
    const outer = band(0, 0, 1, 1);
    const inner = band(0.2, 0.2, 0.2, 0.2);
    expect(across(inner, outer)).toBe(false);
    expect(within(inner, outer)).toBe(true);
  });

  it("is the same answer whichever way round it is asked", () => {
    const a = band(0.05, 0.1, 0.9, 0.3);
    const b = band(0.0, 0.3, 0.8, 0.3);
    expect(across(a, b)).toBe(across(b, a));
  });
});
