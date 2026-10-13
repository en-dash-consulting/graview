import { BLOCK, toIso } from "@graview/core/scene";
import type { Ribbon } from "./map-choice.js";
export { RIBBON_WIDTH, ribbonWidth } from "./ribbon-width.js";

/*
 * ONE RIBBON PER RELATION BETWEEN TWO DISTRICTS.
 *
 * From altitude the map used to draw a road per PAIR of districts a
 * declaration could join — the same double track whether a hundred and
 * forty-six features were filed under areas or nobody had ever voted — and,
 * once something was chosen, every relation in its own color and dash on top
 * of the roads. Nothing said which relation a line was, which way it ran or
 * how many links it carried.
 *
 * A ribbon is one relation, as the graph holds it: the edge kind, the kind it
 * leaves and the kind it reaches, and how many links run along it. Its width
 * is that count — the one thing a line at this distance can say honestly — and
 * the words are said on hover, in the kind's own words. Pure, so it is
 * testable without a browser.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}
export interface PlotLike {
  readonly col: number;
  readonly row: number;
  readonly side: number;
}
export interface Lattice {
  readonly cell: number;
}

/**
 * Where each ribbon runs in its gutter, in lattice cells off the gutter's
 * middle. Ribbons between the same two districts lie side by side — the
 * gutter is one cell wide, and they share it between them — so two
 * relations joining the same pair are two ribbons, never one drawn twice.
 */
export function ribbonLanes(ribbons: readonly Pick<Ribbon, "key" | "from" | "to">[]): Map<string, number> {
  const pairs = new Map<string, string[]>();
  for (const ribbon of ribbons) {
    const pair = ribbon.from < ribbon.to ? `${ribbon.from}|${ribbon.to}` : `${ribbon.to}|${ribbon.from}`;
    pairs.set(pair, [...(pairs.get(pair) ?? []), ribbon.key]);
  }
  const lanes = new Map<string, number>();
  for (const keys of pairs.values()) {
    const share = Math.min(0.26, 0.8 / keys.length);
    keys.forEach((key, i) => lanes.set(key, (i - (keys.length - 1) / 2) * share));
  }
  return lanes;
}

/**
 * THE STREET A RIBBON TAKES, in lattice cells: out of its district to the
 * gutter beside its block, along the gutter, up the gutter beside the other
 * block, and in. Every leg is a lattice line, so no leg crosses a third
 * district. `lane` moves the whole street sideways inside its gutters: each
 * leg holds one coordinate, and both coordinates move by the lane.
 */
export function streetPoints(from: PlotLike, to: PlotLike, lane = 0): { readonly col: number; readonly row: number }[] {
  const ca = from.col + from.side / 2 + lane;
  const ra = from.row + from.side / 2 + lane;
  const cb = to.col + to.side / 2 + lane;
  const rb = to.row + to.side / 2 + lane;
  const blockRow = (plot: PlotLike) => Math.floor(plot.row / BLOCK);
  const blockCol = (plot: PlotLike) => Math.floor(plot.col / BLOCK);
  const ja = blockRow(from);
  const jb = blockRow(to);
  const ia = blockCol(from);
  const ib = blockCol(to);
  // The gutter row beside `from`, on the side `to` lies; the gutter column beside `to`, on the side `from` lies.
  const gr = (jb > ja ? ja * BLOCK + BLOCK - 0.5 : jb < ja ? ja * BLOCK - 0.5 : ja * BLOCK + BLOCK - 0.5) + lane;
  const gc = (ib > ia ? ib * BLOCK - 0.5 : ib < ia ? ib * BLOCK + BLOCK - 0.5 : ib * BLOCK - 0.5) + lane;
  const raw = [
    { col: ca, row: ra },
    { col: ca, row: gr },
    { col: gc, row: gr },
    { col: gc, row: rb },
    { col: cb, row: rb },
  ];
  // Drop a leg of no length, and a middle point that lies on the line of its neighbors.
  const out: { col: number; row: number }[] = [];
  for (const p of raw) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.col - p.col) < 1e-9 && Math.abs(last.row - p.row) < 1e-9) continue;
    out.push(p);
  }
  for (let i = out.length - 2; i > 0; i--) {
    const a = out[i - 1]!;
    const b = out[i]!;
    const c = out[i + 1]!;
    const sameCol = Math.abs(a.col - b.col) < 1e-9 && Math.abs(b.col - c.col) < 1e-9;
    const sameRow = Math.abs(a.row - b.row) < 1e-9 && Math.abs(b.row - c.row) < 1e-9;
    if (sameCol || sameRow) out.splice(i, 1);
  }
  return out;
}

const inside = (p: { col: number; row: number }, plot: PlotLike): boolean =>
  p.col >= plot.col && p.col <= plot.col + plot.side && p.row >= plot.row && p.row <= plot.row + plot.side;
const mix = (a: { col: number; row: number }, b: { col: number; row: number }, t: number) => ({ col: a.col + (b.col - a.col) * t, row: a.row + (b.row - a.row) * t });

/**
 * FROM CURB TO CURB, in lattice cells: the street with the run inside either
 * district cut away, so a ribbon starts at one curb and ends at the other
 * rather than diving under the buildings. Bisected on each crossing leg.
 */
export function curbToCurb(street: readonly { col: number; row: number }[], from: PlotLike, to: PlotLike): { col: number; row: number }[] {
  const out: { col: number; row: number }[] = [];
  let started = false;
  for (let i = 0; i < street.length - 1; i++) {
    const a = street[i]!;
    const b = street[i + 1]!;
    if (!started) {
      if (inside(b, from)) continue;
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 14; k++) {
        const mid = (lo + hi) / 2;
        if (inside(mix(a, b, mid), from)) lo = mid;
        else hi = mid;
      }
      out.push(mix(a, b, hi));
      started = true;
    }
    if (inside(b, to)) {
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 14; k++) {
        const mid = (lo + hi) / 2;
        if (inside(mix(a, b, mid), to)) hi = mid;
        else lo = mid;
      }
      out.push(mix(a, b, lo));
      return out;
    }
    out.push(b);
  }
  return out;
}

/**
 * A RELATION OF A KIND TO ITSELF — a feature that needs another first —
 * leaves its district's right-hand curb, runs a short way up the gutter
 * beside it and comes back in: a loop on the lattice, in the gutter, on the
 * district it belongs to. Each further one stands a lane further out.
 */
export function loopPoints(plot: PlotLike, index: number): { col: number; row: number }[] {
  const out = plot.col + plot.side;
  const reach = out + 0.25 + 0.22 * Math.max(0, index);
  const a = plot.row + plot.side * Math.max(0.1, 0.3 - 0.06 * index);
  const b = plot.row + plot.side * Math.min(0.9, 0.7 + 0.06 * index);
  return [
    { col: out, row: a },
    { col: reach, row: a },
    { col: reach, row: b },
    { col: out, row: b },
  ];
}

/** Lattice points on the canvas, from origin zero. */
export function onCanvas(points: readonly { col: number; row: number }[], city: Lattice): Point[] {
  return points.map((p) => toIso(p.col, p.row, city.cell));
}

/** A polyline as an SVG path. */
export function pathOf(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

/** The middle of a polyline by length: where a ribbon's words are said. */
export function midpointOf(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  let left = total / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const leg = Math.hypot(b.x - a.x, b.y - a.y);
    if (leg >= left && leg > 0) return { x: a.x + ((b.x - a.x) * left) / leg, y: a.y + ((b.y - a.y) * left) / leg };
    left -= leg;
  }
  return points[points.length - 1]!;
}
