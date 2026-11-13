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
const card = (foot: { x: number; y: number }, scale = 1): Box => ({ x: foot.x - 45 * scale, y: foot.y - 60 * scale, width: 90 * scale, height: 60 * scale });

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
    const cards = [...placed.feet].map(([key, foot]) => ({ key, box: card(foot, placed.scales.get(key) ?? 1) }));
    expect(cards.map((one) => one.key).sort()).toEqual(asked.signs.map((one) => one.key).sort());
    for (const one of cards) {
      for (const other of cards) if (other !== one) expect(overlap(one.box, other.box), `${one.key} × ${other.key}`).toBe(0);
      for (const [kind, box] of placed.names) expect(overlap(one.box, box), `${one.key} on the ${kind} name`).toBe(0);
      // A district's ground is its diamond; the bare corners of its box are street.
      if (one.key !== "record:e1") for (const [kind, ground] of tiles) expect(diamondReach(one.box, ground), `${one.key} on ${kind}`).toBeGreaterThanOrEqual(1);
    }
    // The page being read stands on its building's roof, on a post tall enough to clear what is round it.
    const foot = placed.feet.get("record:e1")!;
    expect(foot.y + placed.posts.get("record:e1")!).toBeCloseTo(building.y, 6);
    expect(Math.abs(foot.x - (building.x + building.width / 2))).toBeLessThanOrEqual(90);
  });

  it("stands a kind's views on their own district, each post coming down onto its plate", () => {
    for (const key of ["kind:species", "place:species:tree", "place:species:dig", "kind:event"]) {
      const foot = placed.feet.get(key)!;
      const ground = { x: foot.x, y: foot.y + placed.posts.get(key)!, width: 0, height: 0 };
      const kind = key.includes("species") ? "species" : "event";
      expect(diamondReach(ground, tiles.get(kind)!), `${key} on its own plate`).toBeLessThanOrEqual(1);
    }
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
    for (const box of [...tiles.values(), ...placed.names.values(), ...[...placed.feet].map(([key, foot]) => card(foot, placed.scales.get(key) ?? 1))]) {
      expect(box.x).toBeGreaterThanOrEqual(placed.whole!.x - 1e-6);
      expect(box.y).toBeGreaterThanOrEqual(placed.whole!.y - 1e-6);
      expect(box.x + box.width).toBeLessThanOrEqual(placed.whole!.x + placed.whole!.width + 1e-6);
      expect(box.y + box.height).toBeLessThanOrEqual(placed.whole!.y + placed.whole!.height + 1e-6);
    }
  });
});

describe("placing the City's words stays cheap", () => {
  it("places sixty views of one kind among forty districts and a thousand buildings in under 8 ms", () => {
    const many = new Map<string, Box>();
    for (let i = 0; i < 40; i++) many.set(`k${i}`, { x: 300 + ((i % 8) - Math.floor(i / 8)) * 128, y: 200 + ((i % 8) + Math.floor(i / 8)) * 64, width: 128, height: 64 });
    const blocks: Box[] = [];
    for (let i = 0; i < 1000; i++) {
      const at = many.get(`k${i % 40}`)!;
      blocks.push({ x: at.x + 30 + (i % 7) * 9, y: at.y + 10 + (i % 5) * 7, width: 10, height: 14 });
    }
    const signs = Array.from({ length: 60 }, (_, i) => ({ key: `place:k0:v${i}`, kind: "k0" }));
    const input = { tiles: many, buildings: blocks, names: new Map([...many.keys()].map((kind) => [kind, { width: 80, height: 19 }])), signs, board: { width: 90, height: 60, post: 10, gap: 8 } };
    placeSigns(input);
    const started = performance.now();
    placeSigns(input);
    expect(performance.now() - started).toBeLessThan(8);
  });
});
