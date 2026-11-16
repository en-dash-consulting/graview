import { describe, expect, it } from "vitest";
import { carriedBetween, carriedThrough, LEVEL_LIVE, project, type Box } from "../../src/one-place-geometry.js";
import { placeSigns } from "../../src/one-place-signs.js";

/*
 * LETTING GO OF A PAN, NOTHING MOVES (Graview HQ
 * feature:f-one-face-pan-stops-still). A pan written into the view lays the
 * city out again where the hand left it, and the boards and names placed
 * over it were placed in the picture's old pixels. Read again, the city's
 * districts say how the old pixels became the new — the pan, and a zoom's
 * growth — and what was drawn is carried by the same, so a settle from it
 * starts where the last frame of the pan drew everything, never where the
 * pan began.
 */
const tasks: Box = { x: 300, y: 380, width: 270, height: 140 };
const lists: Box = { x: 580, y: 280, width: 180, height: 100 };
const plots = (...boxes: Box[]) => new Map(boxes.map((box, i) => [`kind-${i}`, box] as const));
const moved = (box: Box, live: { x: number; y: number; s: number }): Box => ({ ...project(live, box), width: box.width * live.s, height: box.height * live.s });

describe("a pan let go of carries what was drawn with the ground", () => {
  it("reads a pan off the districts as laid out before and after", () => {
    const pan = { x: 96, y: -60, s: 1 };
    const carry = carriedBetween(plots(tasks, lists), plots(moved(tasks, pan), moved(lists, pan)));
    expect(carry).not.toBeNull();
    expect(carry!.x).toBeCloseTo(96, 6);
    expect(carry!.y).toBeCloseTo(-60, 6);
    expect(carry!.s).toBeCloseTo(1, 6);
  });

  it("reads a zoom and a pan together, as a pinch whose fingers moved", () => {
    const pinch = { x: -140, y: 35, s: 1.4 };
    const carry = carriedBetween(plots(tasks, lists), plots(moved(tasks, pinch), moved(lists, pinch)));
    expect(carry!.s).toBeCloseTo(1.4, 6);
    expect(project(carry!, { x: 10, y: 20 }).x).toBeCloseTo(project(pinch, { x: 10, y: 20 }).x, 6);
    expect(project(carry!, { x: 10, y: 20 }).y).toBeCloseTo(project(pinch, { x: 10, y: 20 }).y, 6);
  });

  it("says nothing moved when the city is where it was", () => {
    expect(carriedBetween(plots(tasks, lists), plots(tasks, lists))).toEqual(LEVEL_LIVE);
  });

  it("carries nothing when the city was laid out differently, not moved", () => {
    // A record added grows one district and not the other: that is not a pan.
    const grown = { ...tasks, width: tasks.width + 40 };
    expect(carriedBetween(plots(tasks, lists), plots(grown, lists))).toBeNull();
    // A district gone, or none at all, is not a pan either.
    expect(carriedBetween(plots(tasks, lists), plots(tasks))).toBeNull();
    expect(carriedBetween(new Map(), new Map())).toBeNull();
  });

  it("carries every board's foot and every name's box where the ground took it", () => {
    const pan = { x: 96, y: 60, s: 1 };
    const slots = new Map([["board kind:task", { x: 360, y: 363 }]]);
    const names = new Map([["task", { x: 241, y: 828, width: 115, height: 24 }]]);
    expect(carriedThrough(pan, slots).get("board kind:task")).toEqual({ x: 456, y: 423 });
    expect(carriedThrough(pan, names).get("task")).toEqual({ x: 337, y: 888, width: 115, height: 24 });
    // A zoom grows a name's box with the picture, as it was drawn the frame before.
    expect(carriedThrough({ x: 0, y: 0, s: 2 }, names).get("task")).toEqual({ x: 482, y: 1656, width: 230, height: 48 });
  });

  it("places nothing again that stood when the pan let go of it, and places only what had no place, round it", () => {
    const tile = (col: number, row: number): Box => ({ x: 300 + (col - row) * 128, y: 200 + (col + row) * 64, width: 128, height: 64 });
    const asked = {
      tiles: new Map([["task", tile(0, 0)], ["list", tile(1, 0)], ["rule", tile(0, 1)]]),
      buildings: [],
      names: new Map([["task", { width: 96, height: 19 }], ["list", { width: 80, height: 19 }], ["rule", { width: 70, height: 19 }]]),
      signs: [{ key: "kind:task", kind: "task" }, { key: "kind:list", kind: "list" }, { key: "kind:rule", kind: "rule" }],
      board: { width: 90, height: 60, post: 10, gap: 8 },
    };
    const unheld = placeSigns(asked);
    // Where the last frame of a pan drew two of the boards and one name — not where a fresh placing would put them.
    const feet = new Map([["kind:task", { x: 120, y: 90 }], ["kind:list", { x: 700, y: 60 }]]);
    const names = new Map([["task", { x: 20, y: 400, width: 96, height: 19 }]]);
    const kept = placeSigns({ ...asked, held: { feet, posts: new Map([["kind:task", 14]]), scales: new Map(), names } });
    expect(kept.feet.get("kind:task")).toEqual({ x: 120, y: 90 });
    expect(kept.posts.get("kind:task")).toBe(14);
    expect(kept.feet.get("kind:list")).toEqual({ x: 700, y: 60 });
    expect(kept.names.get("task")).toEqual(names.get("task"));
    // What had no place is placed, and clear of what stands: no card or name placed afresh on a held one.
    expect(kept.feet.has("kind:rule")).toBe(true);
    expect(kept.names.has("list")).toBe(true);
    expect(kept.names.has("rule")).toBe(true);
    const card = (foot: { x: number; y: number }): Box => ({ x: foot.x - 45, y: foot.y - 60, width: 90, height: 60 });
    const across = (a: Box, b: Box) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
    const heldBoxes = [card(feet.get("kind:task")!), card(feet.get("kind:list")!), names.get("task")!];
    const fresh = [card(kept.feet.get("kind:rule")!), kept.names.get("list")!, kept.names.get("rule")!];
    for (const one of fresh) for (const held of heldBoxes) expect(across(one, held)).toBe(false);
    expect(unheld.feet.get("kind:task")).not.toEqual({ x: 120, y: 90 });
  });
});
