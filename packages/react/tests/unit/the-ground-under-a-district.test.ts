import { toIso } from "@graview/core/scene";
import { describe, expect, it } from "vitest";
import { buildingFaces, heightOf, namesWithRoom, tileCorners, toLattice, villageCap, villageOf } from "../../src/plots.js";

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
    // The middle cell of a 3×3 sub-lattice is (1,1): its center is the plot's center, and nobody stands there.
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

describe("the lattice, run backwards", () => {
  const city = { cell: 40, originX: 500, originY: 300 };
  const pan = { x: 0, y: 0 };

  it("runs the isometric map backwards", () => {
    const iso = toIso(7, 3, city.cell);
    const back = toLattice({ x: city.originX + iso.x, y: city.originY + iso.y }, city, pan);
    expect(back.col).toBeCloseTo(7, 6);
    expect(back.row).toBeCloseTo(3, 6);
  });
});

/**
 * NO TWO NAMES ON A PLOT LIE OVER EACH OTHER. Coming down on a district, its
 * blocks stand a step apart on the diagonal and each wrote its name over
 * itself whatever stood beside it, so the names were one smudge. A name is
 * written only where it has room: the chosen block's first and whole, then
 * each in turn whose name clears the ones already written.
 */
describe("a district's blocks say their names only where there is room", () => {
  const block = (id: string, x: number, y: number, name = `The ${id}`, width = 40) => ({ id, name, width, top: { x, y } });
  const row = [block("hall", 0, 0), block("workshop", 20, 4), block("kitchen", 200, 0), block("store", 220, 40)];

  it("writes a name that would lie over one already written nowhere", () => {
    const said = namesWithRoom(row, new Set());
    // The workshop's name would cross the hall's, a step to its right: it waits.
    expect([...said.keys()]).toEqual(["hall", "kitchen", "store"]);
  });

  it("writes the chosen block's name first and whole, and the one it would cover waits instead", () => {
    const said = namesWithRoom([...row, block("yard", 0, 300, "The yard where the vans unload", 20)], new Set(["workshop", "yard"]));
    expect(said.has("workshop")).toBe(true);
    expect(said.has("hall")).toBe(false);
    // Too narrow to be named by itself, but chosen: whole.
    expect(said.get("yard")).toBe("The yard where the vans unload");
  });

  it("names every block once they stand far enough apart", () => {
    const apart = row.map((one, i) => ({ ...one, top: { x: i * 200, y: 0 } }));
    expect(namesWithRoom(apart, new Set()).size).toBe(4);
  });
});
