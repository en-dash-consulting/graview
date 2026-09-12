import { describe, expect, it } from "vitest";
import { bandRows, channelRoute } from "../../src/channels.js";

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

  it("staggers lanes so two lines along one gutter do not lie on each other", () => {
    const a = channelRoute(band[0]!, band[3]!, band, 0);
    const b = channelRoute(band[1]!, band[2]!, band, 1);
    expect(a[1]!.y).not.toBe(b[1]!.y);
  });
});
