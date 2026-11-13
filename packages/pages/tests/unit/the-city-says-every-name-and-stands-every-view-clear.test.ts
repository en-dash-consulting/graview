import { describe, expect, it } from "vitest";
import type { Box } from "../../src/one-place-geometry.js";
import { diamondReach, placeSigns } from "../../src/one-place-signs.js";

/*
 * A city packed the way the Scene packs a rich app's: districts a lattice
 * street apart on the diagonal, as the Scene lays them out, three views on one of
 * them and the page being read on a building in the middle.
 */
const tile = (col: number, row: number): Box => ({ x: 300 + (col - row) * 128, y: 200 + (col + row) * 64, width: 128, height: 64 });
const tiles = new Map<string, Box>([
  ["species", tile(0, 0)],
  ["site", tile(1, 0)],
  ["period", tile(0, 1)],
  ["event", tile(1, 1)],
  ["era", tile(2, 1)],
  ["eon", tile(1, 2)],
]);
const building: Box = { x: tile(1, 1).x + 56, y: tile(1, 1).y + 14, width: 14, height: 18 };
const name = { width: 96, height: 19 };
const asked = {
  tiles,
  buildings: [building],
  names: new Map([...tiles.keys()].map((kind) => [kind, name])),
  signs: [
    { key: "home", kind: null },
    { key: "kind:species", kind: "species" },
    { key: "place:species:tree", kind: "species" },
    { key: "place:species:dig", kind: "species" },
    { key: "kind:event", kind: "event" },
    { key: "record:e1", kind: "event", building },
  ],
  board: { width: 90, height: 60, post: 10, gap: 8 },
};
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const card = (foot: { x: number; y: number }): Box => ({ x: foot.x - 45, y: foot.y - 60, width: 90, height: 60 });

describe("the City says every district's name and stands every view clear of everything else", () => {
  const placed = placeSigns(asked);

  it("names every district, each on no other district's ground and no other name", () => {
    expect([...placed.names.keys()].sort()).toEqual([...tiles.keys()].sort());
    const boxes = [...placed.names];
    for (const [kind, box] of boxes) {
      for (const [other, ground] of tiles) if (other !== kind) expect(diamondReach(box, ground), `${kind} on ${other}`).toBeGreaterThanOrEqual(1);
      for (const [other, theirs] of boxes) if (other !== kind) expect(overlap(box, theirs), `${kind} × ${other}`).toBe(0);
      // Never a card over the records: no name on a building or the name written over it.
      expect(overlap(box, { ...building, y: building.y - 14, height: building.height + 14 }), `${kind} on a building`).toBe(0);
    }
  });

  it("stands no board on another, on a name, or on a district's ground; the page's own on its building", () => {
    const cards = [...placed.feet].map(([key, foot]) => ({ key, box: card(foot) }));
    expect(cards.map((one) => one.key).sort()).toEqual(asked.signs.map((one) => one.key).sort());
    for (const one of cards) {
      for (const other of cards) if (other !== one) expect(overlap(one.box, other.box), `${one.key} × ${other.key}`).toBe(0);
      for (const [kind, box] of placed.names) expect(overlap(one.box, box), `${one.key} on the ${kind} name`).toBe(0);
      if (one.key !== "record:e1") for (const [kind, ground] of tiles) expect(overlap(one.box, ground), `${one.key} on ${kind}`).toBe(0);
    }
    // The page being read stands on its building's roof, on a post tall enough to clear what is round it.
    const foot = placed.feet.get("record:e1")!;
    expect(foot.y + placed.posts.get("record:e1")!).toBeCloseTo(building.y, 6);
    expect(Math.abs(foot.x - (building.x + building.width / 2))).toBeLessThanOrEqual(90);
  });

  it("stands a kind's views nearer its own district than any other", () => {
    const gap = (p: { x: number; y: number }, b: Box) => Math.hypot(Math.max(b.x - p.x, 0, p.x - (b.x + b.width)), Math.max(b.y - p.y, 0, p.y - (b.y + b.height)));
    for (const key of ["kind:species", "place:species:tree", "place:species:dig"]) {
      const foot = placed.feet.get(key)!;
      for (const [kind, ground] of tiles) if (kind !== "species") expect(gap(foot, tiles.get("species")!), `${key} by ${kind}`).toBeLessThan(gap(foot, ground));
    }
  });

  it("keeps a name inside what the camera shows, slid along its own district, and says none for a district out of sight", () => {
    const shown: Box = { x: 0, y: 0, width: tile(1, 0).x + 40, height: tile(2, 1).y - 10 };
    const inside = placeSigns({ ...asked, bounds: shown });
    const site = inside.names.get("site");
    expect(site).toBeDefined();
    expect(site!.x + site!.width).toBeLessThanOrEqual(shown.x + shown.width);
    expect(inside.names.has("era")).toBe(false);
  });

  it("fits around all of it", () => {
    for (const box of [...tiles.values(), ...placed.names.values(), ...[...placed.feet.values()].map(card)]) {
      expect(box.x).toBeGreaterThanOrEqual(placed.whole!.x - 1e-6);
      expect(box.y).toBeGreaterThanOrEqual(placed.whole!.y - 1e-6);
      expect(box.x + box.width).toBeLessThanOrEqual(placed.whole!.x + placed.whole!.width + 1e-6);
      expect(box.y + box.height).toBeLessThanOrEqual(placed.whole!.y + placed.whole!.height + 1e-6);
    }
  });
});
