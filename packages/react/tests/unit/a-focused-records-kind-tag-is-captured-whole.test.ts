import { describe, expect, it } from "vitest";
import { kindTagOutset } from "../../src/captured-outset.js";

/*
 * On the GPU path a view is captured as its host's box and nothing past it,
 * and a focused record's kind tag stands astride its panel's top edge. The
 * host grows its box by the tag's overhang, known from where it placed the
 * tag rather than measured.
 */
describe("a focused record's kind tag is captured whole", () => {
  it("grows the box above by the tag's overhang, with room for its edge", () => {
    expect(kindTagOutset({ top: -9, right: 14 })).toEqual({ top: 13, right: 0, bottom: 0, left: 0 });
  });

  it("takes a fractional overhang up to the next whole pixel", () => {
    expect(kindTagOutset({ top: -8.2, right: 14 })?.top).toBe(13);
  });

  it("asks for nothing when the panel stands lower in its box than the tag reaches", () => {
    expect(kindTagOutset({ top: 31, right: 14 })).toBeNull();
    expect(kindTagOutset({ top: 0, right: 14 })).toBeNull();
  });

  it("asks for nothing before the tag is placed", () => {
    expect(kindTagOutset(null)).toBeNull();
    expect(kindTagOutset({ top: Number.NaN, right: 14 })).toBeNull();
  });
});
