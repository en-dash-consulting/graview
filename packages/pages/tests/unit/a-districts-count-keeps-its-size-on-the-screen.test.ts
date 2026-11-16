import { describe, expect, it } from "vitest";
import { project, wordOnScreen } from "../../src/one-place-geometry.js";

/*
 * A district's "+n" is words drawn at a size of their own on the screen,
 * anchored at their right end. Read at Nearby and placed round at the City,
 * Deep Time's species "+26" was taken to be 16 by 9 pixels — grown with
 * the picture by the City's 0.705 — where it was drawn 23 by 13, and the
 * page's own board stood on it (one-face on a runner, 768 wide).
 */
describe("a district's count keeps its size on the screen as the camera zooms", () => {
  const read = { x: 300, y: 500, width: 23.2, height: 13 };
  const city = { s: 0.705, x: 230, y: 117 };

  it("keeps its width and height, where a building would grow with the picture", () => {
    const placed = wordOnScreen(city, read);
    expect(placed.width).toBe(23.2);
    expect(placed.height).toBe(13);
  });

  it("puts its right end and its middle where the picture takes them", () => {
    const placed = wordOnScreen(city, read);
    const end = project(city, { x: read.x + read.width, y: read.y + read.height / 2 });
    expect(placed.x + placed.width).toBeCloseTo(end.x, 9);
    expect(placed.y + placed.height / 2).toBeCloseTo(end.y, 9);
  });

  it("is the box as read when the camera has not moved", () => {
    expect(wordOnScreen({ s: 1, x: 0, y: 0 }, read)).toEqual(read);
  });
});
