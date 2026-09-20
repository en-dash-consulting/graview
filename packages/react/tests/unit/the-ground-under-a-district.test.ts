import { BLOCK, toIso } from "@graview/core";
import { describe, expect, it } from "vitest";
import { padPlot, tileCorners } from "../../src/plots.js";

/**
 * A TILE IS THE PLOT THE LAYOUT COMPUTED. Its corners are the plot's four
 * lattice corners through the same isometric map the city is placed with,
 * from the same origin, moved by the same pan — so it sits under its card
 * and on the diamonds a person can see.
 */
describe("the ground under a district", () => {
  const city = { cell: 40, originX: 300, originY: 200 };

  it("puts the four corners of a plot on the lattice, clockwise from the back", () => {
    const [back, right, front, left] = tileCorners({ col: 5, row: 10, side: 2 }, city);
    const at = (col: number, row: number) => {
      const iso = toIso(col, row, city.cell);
      return { x: city.originX + iso.x, y: city.originY + iso.y };
    };
    expect(back).toEqual(at(5, 10));
    expect(right).toEqual(at(7, 10));
    expect(front).toEqual(at(7, 12));
    expect(left).toEqual(at(5, 12));
    // A 2:1 diamond: the back corner is the highest, the front the lowest, left and right level.
    expect(back.y).toBeLessThan(left.y);
    expect(front.y).toBeGreaterThan(right.y);
    expect(left.y).toBe(right.y);
  });

  it("rides the pan the cards ride", () => {
    const still = tileCorners({ col: 0, row: 0, side: 1 }, city);
    const panned = tileCorners({ col: 0, row: 0, side: 1 }, city, { x: 15, y: -7 });
    expect(panned[0]).toEqual({ x: still[0].x + 15, y: still[0].y - 7 });
  });

  it("gives the robot a pad at the origin block's street corner", () => {
    expect(padPlot()).toEqual({ col: BLOCK - 1, row: BLOCK - 1, side: 1 });
  });
});
