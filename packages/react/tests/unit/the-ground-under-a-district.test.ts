import { BLOCK, toIso } from "@graview/core";
import { describe, expect, it } from "vitest";
import { buildingFaces, heightOf, padPlot, roadBetween, streetPoints, tileCorners, toLattice, villageCap, villageOf } from "../../src/plots.js";

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

describe("a district is a village", () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `m-${i}`);

  it("holds a sub-lattice of side+1 to a side, minus the village square", () => {
    // A side-1 plot holds one member; its 2×2 sub-lattice has no room for a square.
    expect(villageCap(1)).toBe(4);
    expect(villageCap(2)).toBe(8);
    expect(villageCap(3)).toBe(12);
    expect(villageCap(4)).toBe(24);
  });

  it("stands one building per member up to the cap, and counts the rest", () => {
    const few = villageOf({ col: 0, row: 0, side: 2 }, ids(5));
    expect(few.buildings).toHaveLength(5);
    expect(few.rest).toBe(0);
    const many = villageOf({ col: 0, row: 0, side: 2 }, ids(30));
    expect(many.buildings).toHaveLength(8);
    expect(many.rest).toBe(22);
  });

  it("keeps the square in the middle free and draws back to front", () => {
    const { buildings } = villageOf({ col: 10, row: 20, side: 2 }, ids(8));
    // The middle cell of a 3×3 sub-lattice is (1,1): its centre is the plot's centre, and nobody stands there.
    expect(buildings.some((b) => Math.abs(b.col - 11) < 1e-9 && Math.abs(b.row - 21) < 1e-9)).toBe(false);
    for (let i = 1; i < buildings.length; i++) {
      expect(buildings[i]!.col + buildings[i]!.row).toBeGreaterThanOrEqual(buildings[i - 1]!.col + buildings[i - 1]!.row - 1e-9);
    }
  });

  it("gives every member a height of its own that does not change between renders", () => {
    expect(heightOf("m-1")).toBe(heightOf("m-1"));
    expect(heightOf("m-1")).not.toBe(heightOf("m-2"));
    const { buildings } = villageOf({ col: 0, row: 0, side: 1 }, ids(3));
    expect(new Set(buildings.map((b) => b.height)).size).toBeGreaterThan(1);
  });

  it("raises a building's roof above its foot by its height", () => {
    const city = { cell: 40, originX: 0, originY: 0 };
    const { buildings } = villageOf({ col: 0, row: 0, side: 1 }, ids(1));
    const faces = buildingFaces(buildings[0]!, city, { x: 0, y: 0 });
    const iso = toIso(buildings[0]!.col - buildings[0]!.footprint / 2, buildings[0]!.row - buildings[0]!.footprint / 2, city.cell);
    expect(faces.top.y).toBeLessThan(iso.y);
    expect(faces.roof.split(" ")).toHaveLength(4);
  });
});

describe("a road runs kerb to kerb", () => {
  const city = { cell: 40, originX: 500, originY: 300 };
  const pan = { x: 0, y: 0 };

  it("runs the isometric map backwards", () => {
    const iso = toIso(7, 3, city.cell);
    const back = toLattice({ x: city.originX + iso.x, y: city.originY + iso.y }, city, pan);
    expect(back.col).toBeCloseTo(7, 6);
    expect(back.row).toBeCloseTo(3, 6);
  });

  it("starts at one plot's kerb and ends at the other's, not at their centres", () => {
    const a = { col: 0, row: 0, side: 2 };
    const b = { col: 10, row: 0, side: 2 };
    const road = roadBetween(a, b, city, pan);
    expect(road.length).toBeGreaterThanOrEqual(2);
    const first = toLattice(road[0]!, city, pan);
    const last = toLattice(road[road.length - 1]!, city, pan);
    // The road leaves a across its front kerb (row 2) and enters b across its near kerb (col 10).
    expect(first.row).toBeCloseTo(2, 1);
    expect(last.col).toBeCloseTo(10, 1);
  });

  it("runs along the gutters between blocks, never through a third plot", () => {
    const a = { col: 0, row: 0, side: 4 };
    const between = { col: 5, row: 0, side: 4 };
    const b = { col: 10, row: 0, side: 4 };
    const street = streetPoints(a, b);
    // Every leg holds one coordinate: a lattice line.
    for (let i = 1; i < street.length; i++) {
      const p = street[i - 1]!;
      const q = street[i]!;
      expect(Math.abs(p.col - q.col) < 1e-9 || Math.abs(p.row - q.row) < 1e-9).toBe(true);
    }
    // And no point of the street, sampled finely, is inside the plot in between.
    for (let i = 1; i < street.length; i++) {
      const p = street[i - 1]!;
      const q = street[i]!;
      for (let t = 0; t <= 1; t += 0.05) {
        const col = p.col + (q.col - p.col) * t;
        const row = p.row + (q.row - p.row) * t;
        const inside = col > between.col && col < between.col + between.side && row > between.row && row < between.row + between.side;
        expect(inside).toBe(false);
      }
    }
  });

  it("is two legs when the plots share a gutter and no more than four otherwise", () => {
    expect(streetPoints({ col: 0, row: 0, side: 1 }, { col: 5, row: 0, side: 1 }).length).toBeLessThanOrEqual(5);
    expect(streetPoints({ col: 0, row: 0, side: 1 }, { col: 10, row: 10, side: 1 }).length).toBeLessThanOrEqual(5);
  });
});
