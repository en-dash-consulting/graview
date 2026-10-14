import type { Box, Point } from "./routes.js";

/*
 * A LINE BETWEEN TWO CHIPS OF ONE BAND runs in the gutters.
 *
 * A band of many neighbors is a grid: rows of chips with gaps between the
 * rows and between the chips. An arc between two of them crossed whatever
 * lay between, and clipped under every chip it crossed it was left as
 * confetti — dashes in the gaps that belonged to no visible line. In a
 * grid the honest road is the gutter: leave a chip by its bottom edge,
 * travel along the channel between rows, cross rows through a gap between
 * chips, and arrive at the other chip's top. Nothing is crossed, so
 * nothing needs clipping, and the whole line is one visible thing.
 */

const CLEAR = 12;

export interface Row {
  readonly top: number;
  readonly bottom: number;
  readonly boxes: readonly Box[];
}

/** How near two boxes stand, one over the other, and are still one row: a caption hung just over its run is of the run's row. */
const TOUCHING = 3;

/** Boxes grouped into rows by vertical overlap (or touching), top to bottom, each row's boxes left to right. */
export function bandRows(band: readonly Box[]): Row[] {
  const sorted = [...band].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: { top: number; bottom: number; boxes: Box[] }[] = [];
  for (const box of sorted) {
    const row = rows.find((r) => box.y < r.bottom + TOUCHING && box.y + box.height > r.top - TOUCHING);
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
      cursor = Math.max(cursor, box.x + box.width + CLEAR);
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
    // A gap between chips over the band's margin, unless the margin is much nearer:
    // a road down the outside edge, hugging the row's first chip, framed it.
    const margin = gap.from === -Infinity || gap.to === Infinity;
    const d = Math.abs(x - wanted) + (margin ? 60 : 0);
    if (d < distance) {
      distance = d;
      best = x;
    }
  }
  return best;
}

/** A box turned upside down, so a road upward is worked out as a road downward. */
const flipped = (box: Box): Box => ({ x: box.x, y: -(box.y + box.height), width: box.width, height: box.height });
const unflip = (points: readonly Point[]): Point[] => points.map((p) => ({ x: p.x, y: -p.y }));

/** Legs of no length are not corners, and neither is a point along a straight leg. */
function corners(points: readonly Point[]): Point[] {
  const near = (m: number, n: number) => Math.abs(m - n) < 0.5;
  const kept = points.filter((p, i) => i === 0 || !(near(p.x, points[i - 1]!.x) && near(p.y, points[i - 1]!.y)));
  return kept.filter((p, i) => {
    const a = kept[i - 1];
    const b = kept[i + 1];
    return !a || !b || !((near(a.x, p.x) && near(p.x, b.x)) || (near(a.y, p.y) && near(p.y, b.y)));
  });
}

/**
 * WHERE A ROAD COMING DOWN MEETS A BOX: on its top, over the box and clear
 * of anything standing over it in its row (its run's caption is of its
 * row); and where the caption's words cover the whole top, on its side,
 * down a gap beside it. `x` is the vertical the road comes down at, and
 * `tail` the points from there onto the box's edge.
 */
function topPort(row: Row, box: Box, want: number): { x: number; tail: Point[] } {
  const over = row.boxes.filter((b) => !same(b, box) && b.y + b.height <= box.y + 1 && b.x < box.x + box.width && b.x + b.width > box.x);
  let free: { from: number; to: number }[] = [{ from: box.x + 6, to: box.x + box.width - 6 }];
  for (const b of over) {
    free = free.flatMap((gap) => [
      { from: gap.from, to: Math.min(gap.to, b.x - CLEAR / 2) },
      { from: Math.max(gap.from, b.x + b.width + CLEAR / 2), to: gap.to },
    ]).filter((gap) => gap.to >= gap.from);
  }
  let best: number | null = null;
  for (const gap of free) {
    const x = Math.min(Math.max(want, gap.from), gap.to);
    if (best === null || Math.abs(x - want) < Math.abs(best - want)) best = x;
  }
  if (best !== null) return { x: best, tail: [{ x: best, y: box.y }] };
  // Its side, nearer the way the road comes from, down the gap beside it.
  const left = want < box.x + box.width / 2;
  const x = clearX([row], left ? box.x - CLEAR : box.x + box.width + CLEAR);
  const y = box.y + box.height / 2;
  return { x, tail: [{ x, y }, { x: x < box.x ? box.x : box.x + box.width, y }] };
}

/** Where a road going down leaves a box: its bottom, which nothing in its row stands under. */
function bottomPort(row: Row, box: Box, want: number): { x: number; head: Point[] } {
  const turned = topPort({ top: -row.bottom, bottom: -row.top, boxes: row.boxes.map(flipped) }, flipped(box), want);
  return { x: turned.x, head: unflip(turned.tail).reverse() };
}

/**
 * THE LAST DESCENT: going down to a box in row `rt` at `x`, the highest row
 * from which a straight drop at `x` meets nothing on the way.
 */
function dropFrom(rows: readonly Row[], rt: number, x: number, floor: number): number {
  let k = rt;
  while (k > floor && !rows[k - 1]!.boxes.some((b) => x > b.x - CLEAR / 2 && x < b.x + b.width + CLEAR / 2)) k--;
  return k;
}

/** How far a lane may stand off the middle of a channel this tall without touching its sides. */
const lanes = (lane: number, height: number) => ((lane % 3) - 1) * Math.max(0, Math.min(4, height / 2 - 3));

/**
 * A road downward: from `head` (leaving row `rf`, or from above every row
 * when `rf` is -1, at `startY`) at `x`, to the box `to` in row `rt`.
 */
function downward(rows: readonly Row[], rf: number, startY: number, depart: { x: number; head: Point[] }, to: Box, rt: number, want: number, lane: number): Point[] {
  const gap = (above: number) => (above < 0 ? rows[0]!.top - startY : rows[above + 1]!.top - rows[above]!.bottom);
  const channel = (above: number) => (above < 0 ? (startY + rows[0]!.top) / 2 : channelBetween(rows, above, above + 1)) + lanes(lane, gap(above));
  const arrive = topPort(rows[rt]!, to, want);
  const k = dropFrom(rows, rt, arrive.x, rf + 1);
  const first = channel(rf);
  if (k === rf + 1) return corners([...depart.head, { x: depart.x, y: first }, { x: arrive.x, y: first }, ...arrive.tail]);
  // Rows in between: cross them through a gap between chips, as near the far chip as one is.
  const vx = clearX(rows.slice(rf + 1, k), arrive.x);
  const last = channel(k - 1);
  return corners([...depart.head, { x: depart.x, y: first }, { x: vx, y: first }, { x: vx, y: last }, { x: arrive.x, y: last }, ...arrive.tail]);
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
  if (rf === rt) {
    // A U under the row (or over it, for the last row of several): out, along, and back in.
    const under = rf < rows.length - 1 || rows.length === 1;
    if (!under) return unflip(channelRoute(flipped(from), flipped(to), band.map(flipped), lane));
    const y = channelBetween(rows, rf, rf + 1) + lanes(lane, rf < rows.length - 1 ? rows[rf + 1]!.top - rows[rf]!.bottom : 2 * CLEAR);
    const out = bottomPort(rows[rf]!, from, tx);
    const back = bottomPort(rows[rf]!, to, fx);
    return corners([...out.head, { x: out.x, y }, { x: back.x, y }, ...[...back.head].reverse()]);
  }
  // A road upward is the same road downward, upside down.
  if (rt < rf) return unflip(channelRoute(flipped(from), flipped(to), band.map(flipped), lane));
  const depart = bottomPort(rows[rf]!, from, tx);
  return downward(rows, rf, rows[rf]!.bottom, depart, to, rt, fx, lane);
}

/*
 * A TIE FROM THE RECORD'S CARD TO ONE OF ITS CHIPS, whole. It leaves the
 * card's edge facing the band, drops through the open ground between them,
 * crosses any rows on the way through a gap between their chips (and their
 * captions' words, which are of the band too), runs along a gutter and
 * arrives on the chip's own edge. Nothing is crossed, so nothing is
 * clipped, and the line is one line. Null when the chip is not clear of
 * the card above or below it: the band's own route stands then.
 */
export function cardRoute(card: Box, chip: Box, band: readonly Box[], lane = 0): Point[] | null {
  if (chip.y + chip.height <= card.y) {
    const up = cardRoute(flipped(card), flipped(chip), band.map(flipped), lane);
    return up ? unflip(up) : null;
  }
  const edge = card.y + card.height;
  if (chip.y < edge) return null;
  const rows = bandRows([...band.filter((box) => box.y >= edge && !same(box, chip)), chip]);
  const rt = rowOf(rows, chip);
  const tx = chip.x + chip.width / 2;
  // Leave the card where the road will go down: over the chip, or over the gap it crosses the rows by.
  const arrive = topPort(rows[rt]!, chip, tx);
  const k = dropFrom(rows, rt, arrive.x, 0);
  const vx = k === 0 ? arrive.x : clearX(rows.slice(0, k), arrive.x);
  const room = Math.min(CLEAR, card.width / 2);
  const x0 = Math.min(Math.max(vx, card.x + room), card.x + card.width - room);
  return downward(rows, -1, edge, { x: x0, head: [{ x: x0, y: edge }] }, chip, rt, tx, lane);
}
