import { describe, expect, it } from "vitest";
import { bandRows, cardRoute, channelRoute } from "../../src/channels.js";

/*
 * A line between two chips of one band never crosses a third chip: it
 * takes the gutters. Whatever the pair — same row, the next row, two rows
 * apart — every segment lies clear of every chip's box but its own ends'.
 */
const chip = (col: number, row: number, width = 150) => ({ x: 20 + col * 275, y: 600 + row * 60, width, height: 26 });
const band = [0, 1, 2].flatMap((row) => [0, 1, 2, 3].map((col) => chip(col, row, 120 + ((col + row) % 3) * 30)));

const crosses = (a: { x: number; y: number }, b: { x: number; y: number }, box: { x: number; y: number; width: number; height: number }): boolean => {
  // Axis-aligned segments only: the router draws no others.
  const inset = 0.5;
  const left = box.x + inset, right = box.x + box.width - inset, top = box.y + inset, bottom = box.y + box.height - inset;
  if (a.x === b.x) {
    const x = a.x, y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    return x > left && x < right && y1 > top && y0 < bottom;
  }
  const y = a.y, x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
  return y > top && y < bottom && x1 > left && x0 < right;
};
const clear = (points: { x: number; y: number }[], from: (typeof band)[number], to: (typeof band)[number]) => {
  for (let i = 0; i < points.length - 1; i++) {
    for (const box of band) {
      if (box === from || box === to) continue;
      expect(crosses(points[i]!, points[i + 1]!, box), `segment ${i} crosses ${box.x},${box.y}`).toBe(false);
    }
  }
};

describe("a line through the gutters", () => {
  it("reads the band as rows", () => {
    const rows = bandRows(band);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.boxes.length)).toEqual([4, 4, 4]);
  });

  it("stays clear of every other chip: same row, next row, two rows apart, upward", () => {
    const pairs: [number, number][] = [[0, 3], [0, 5], [0, 11], [11, 1], [5, 6], [8, 2]];
    for (const [f, t] of pairs) {
      const points = channelRoute(band[f]!, band[t]!, band);
      expect(points.length).toBeGreaterThanOrEqual(4);
      clear(points, band[f]!, band[t]!);
      // It leaves and arrives on the chips' own edges, never inside them.
      const first = points[0]!, last = points[points.length - 1]!;
      expect([band[f]!.y, band[f]!.y + band[f]!.height]).toContain(first.y);
      expect([band[t]!.y, band[t]!.y + band[t]!.height]).toContain(last.y);
    }
  });

  it("crosses a row through a gap that is clear of every box in it, however they overlap", () => {
    // A caption wider than the card under it: the gap is past the caption's end, not the card's.
    const card = { x: 51, y: 532, width: 228, height: 45 };
    const words = { x: 33, y: 513, width: 264, height: 17 };
    const above = { x: 51, y: 462, width: 228, height: 45 };
    const below = { x: 51, y: 602, width: 228, height: 45 };
    const points = channelRoute(below, above, [above, words, card, below]);
    for (let i = 0; i < points.length - 1; i++) for (const box of [words, card]) expect(crosses(points[i]!, points[i + 1]!, box)).toBe(false);
  });

  it("staggers lanes so two lines along one gutter do not lie on each other", () => {
    const a = channelRoute(band[0]!, band[3]!, band, 0);
    const b = channelRoute(band[1]!, band[2]!, band, 1);
    expect(a[1]!.y).not.toBe(b[1]!.y);
  });
});

/*
 * A TIE FROM A RECORD'S CARD TO A CHIP OF ITS BAND is one line: it leaves
 * the card's edge facing the band, crosses no chip and no caption's words
 * on the way, and arrives on the chip's own edge.
 */
describe("a tie from the card", () => {
  const card = { x: 300, y: 300, width: 700, height: 220 };
  // Each run's caption hangs just over its first chip, as the scene places it.
  const captions = [
    { x: 520, y: 581, width: 110, height: 17 },
    { x: 380, y: 641, width: 240, height: 17 },
  ];
  const all = [...band, ...captions];
  const onEdge = (p: { x: number; y: number }, box: { x: number; y: number; width: number; height: number }) =>
    (Math.abs(p.y - box.y) < 0.01 || Math.abs(p.y - box.y - box.height) < 0.01) ? p.x >= box.x - 0.01 && p.x <= box.x + box.width + 0.01 : (Math.abs(p.x - box.x) < 0.01 || Math.abs(p.x - box.x - box.width) < 0.01) && p.y >= box.y && p.y <= box.y + box.height;

  it("reaches every chip whole, past every other chip and every caption", () => {
    for (const chip of band) {
      const points = cardRoute(card, chip, all)!;
      expect(points).not.toBeNull();
      expect(points[0]!.y).toBe(card.y + card.height);
      expect(points[0]!.x).toBeGreaterThanOrEqual(card.x);
      expect(points[0]!.x).toBeLessThanOrEqual(card.x + card.width);
      expect(onEdge(points[points.length - 1]!, chip), `ends on ${chip.x},${chip.y}`).toBe(true);
      for (let i = 0; i < points.length - 1; i++) {
        for (const box of all) {
          if (box === chip) continue;
          expect(crosses(points[i]!, points[i + 1]!, box), `to ${chip.x},${chip.y}: segment ${i} crosses ${box.x},${box.y}`).toBe(false);
        }
        // Every leg runs along an axis: a road, not a diagonal.
        expect(points[i]!.x === points[i + 1]!.x || points[i]!.y === points[i + 1]!.y).toBe(true);
      }
    }
  });

  it("drops straight onto a chip right under the card", () => {
    const chip = band[1]!;
    const points = cardRoute(card, chip, all)!;
    expect(points).toHaveLength(2);
  });

  it("comes in from the side where a caption's words cover the chip's whole top", () => {
    const chip = { x: 40, y: 700, width: 100, height: 26 };
    const words = { x: 20, y: 681, width: 140, height: 17 };
    const points = cardRoute(card, chip, [chip, words])!;
    const last = points[points.length - 1]!;
    expect(last.y).toBeCloseTo(chip.y + chip.height / 2);
    for (let i = 0; i < points.length - 1; i++) expect(crosses(points[i]!, points[i + 1]!, words)).toBe(false);
  });

  it("works upside down, to a band above the card", () => {
    const low = { x: 300, y: 900, width: 700, height: 120 };
    const points = cardRoute(low, band[5]!, band)!;
    expect(points[0]!.y).toBe(low.y);
    expect(onEdge(points[points.length - 1]!, band[5]!)).toBe(true);
  });
});
