import type { Box, Point } from "./routes.js";

/*
 * A LINE BETWEEN TWO CHIPS OF ONE BAND runs in the gutters.
 *
 * A band of many neighbours is a grid: rows of chips with gaps between the
 * rows and between the chips. An arc between two of them crossed whatever
 * lay between, and clipped under every chip it crossed it was left as
 * confetti — dashes in the gaps that belonged to no visible line. In a
 * grid the honest road is the gutter: leave a chip by its bottom edge,
 * travel along the channel between rows, cross rows through a gap between
 * chips, and arrive at the other chip's top. Nothing is crossed, so
 * nothing needs clipping, and the whole line is one visible thing.
 */

const CLEAR = 8;

export interface Row {
  readonly top: number;
  readonly bottom: number;
  readonly boxes: readonly Box[];
}

/** Boxes grouped into rows by vertical overlap, top to bottom, each row's boxes left to right. */
export function bandRows(band: readonly Box[]): Row[] {
  const sorted = [...band].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: { top: number; bottom: number; boxes: Box[] }[] = [];
  for (const box of sorted) {
    const row = rows.find((r) => box.y < r.bottom && box.y + box.height > r.top);
    if (row) {
      row.boxes.push(box);
      row.top = Math.min(row.top, box.y);
      row.bottom = Math.max(row.bottom, box.y + box.height);
    } else rows.push({ top: box.y, bottom: box.y + box.height, boxes: [box] });
  }
  for (const row of rows) row.boxes.sort((a, b) => a.x - b.x);
  return rows.sort((a, b) => a.top - b.top);
}

const same = (a: Box, b: Box) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const rowOf = (rows: readonly Row[], box: Box): number => rows.findIndex((row) => row.boxes.some((b) => same(b, box)));

/** The channel between two consecutive rows, or the space just above the first / below the last. */
function channelBetween(rows: readonly Row[], above: number, below: number): number {
  if (above < 0) return rows[0]!.top - CLEAR * 2;
  if (below >= rows.length) return rows[rows.length - 1]!.bottom + CLEAR * 2;
  return (rows[above]!.bottom + rows[below]!.top) / 2;
}

/** An x that is clear of every chip in these rows, as near `wanted` as one exists. */
function clearX(rows: readonly Row[], wanted: number): number {
  // Every row's free intervals, intersected: the gaps between chips plus both margins.
  let free: { from: number; to: number }[] = [{ from: -Infinity, to: Infinity }];
  for (const row of rows) {
    const gaps: { from: number; to: number }[] = [];
    let cursor = -Infinity;
    for (const box of row.boxes) {
      gaps.push({ from: cursor, to: box.x - CLEAR });
      cursor = box.x + box.width + CLEAR;
    }
    gaps.push({ from: cursor, to: Infinity });
    const next: { from: number; to: number }[] = [];
    for (const a of free) for (const b of gaps) {
      const from = Math.max(a.from, b.from);
      const to = Math.min(a.to, b.to);
      if (to - from >= 0) next.push({ from, to });
    }
    free = next;
  }
  let best = wanted;
  let distance = Infinity;
  for (const gap of free) {
    const x = Math.min(Math.max(wanted, gap.from), gap.to);
    const d = Math.abs(x - wanted);
    if (d < distance) {
      distance = d;
      best = x;
    }
  }
  return best;
}

/**
 * The polyline from one chip to another through the band's gutters. `lane`
 * staggers lines that share a channel by a few pixels so two relations
 * along the same gutter do not lie on one another.
 */
export function channelRoute(from: Box, to: Box, band: readonly Box[], lane = 0): Point[] {
  const rows = bandRows(band.some((b) => same(b, from)) && band.some((b) => same(b, to)) ? band : [...band, from, to]);
  const rf = rowOf(rows, from);
  const rt = rowOf(rows, to);
  const fx = from.x + from.width / 2;
  const tx = to.x + to.width / 2;
  const stagger = ((lane % 3) - 1) * 4;
  if (rf === rt) {
    // A U under the row (or over it, for the last row of several): out, along, and back in.
    const under = rf < rows.length - 1 || rows.length === 1;
    const y = (under ? channelBetween(rows, rf, rf + 1) : channelBetween(rows, rf - 1, rf)) + stagger;
    const a = under ? from.y + from.height : from.y;
    const b = under ? to.y + to.height : to.y;
    return [{ x: fx, y: a }, { x: fx, y }, { x: tx, y }, { x: tx, y: b }];
  }
  const down = rt > rf;
  const step = down ? 1 : -1;
  const start = { x: fx, y: down ? from.y + from.height : from.y };
  const end = { x: tx, y: down ? to.y : to.y + to.height };
  const first = (down ? channelBetween(rows, rf, rf + 1) : channelBetween(rows, rf - 1, rf)) + stagger;
  const last = (down ? channelBetween(rows, rt - 1, rt) : channelBetween(rows, rt, rt + 1)) + stagger;
  if (Math.abs(rt - rf) === 1) return [start, { x: fx, y: first }, { x: tx, y: first }, end];
  // Rows in between: cross them through a gap between chips, as near the far chip as one is.
  const between: Row[] = [];
  for (let r = rf + step; r !== rt; r += step) between.push(rows[r]!);
  const vx = clearX(between, tx);
  return [start, { x: fx, y: first }, { x: vx, y: first }, { x: vx, y: last }, { x: tx, y: last }, end];
}
