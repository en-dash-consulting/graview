import { toIso } from "@graview/core/scene";
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
  /** The tilt the city is seen at (`toIso`): a half by default, more from above. */
  readonly tilt?: number | undefined;
}

/**
 * A DISTRICT'S GROUND ON THE CANVAS: its plot's diamond, from origin zero,
 * at the tilt the city is seen at — its center, and how far its side and its
 * back and front corners reach from it.
 */
export interface Tile {
  readonly cx: number;
  readonly cy: number;
  /** Half its width: the left and right corners are this far either side. */
  readonly hw: number;
  /** Half its height: the back and front corners are this far above and below. */
  readonly hh: number;
}

export function tileOf(plot: PlotLike, cell: number, tilt = 0.5): Tile {
  const back = toIso(plot.col, plot.row, cell, tilt);
  const right = toIso(plot.col + plot.side, plot.row, cell, tilt);
  const front = toIso(plot.col + plot.side, plot.row + plot.side, cell, tilt);
  return { cx: back.x, cy: (back.y + front.y) / 2, hw: right.x - back.x, hh: (front.y - back.y) / 2 };
}

const corner = (tile: Tile, which: "left" | "right" | "back" | "front"): Point =>
  which === "left" ? { x: tile.cx - tile.hw, y: tile.cy } : which === "right" ? { x: tile.cx + tile.hw, y: tile.cy } : which === "back" ? { x: tile.cx, y: tile.cy - tile.hh } : { x: tile.cx, y: tile.cy + tile.hh };

/** Whether a point stands on a tile's ground, a hair inside its curb. */
const onTile = (p: Point, tile: Tile): boolean => Math.abs(p.x - tile.cx) / tile.hw + Math.abs(p.y - tile.cy) / tile.hh < 0.97;

/** Whether a run crosses the ground of any tile but the two it joins. */
export function crossesAny(points: readonly Point[], tiles: readonly Tile[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const steps = Math.max(8, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
    for (let k = 0; k <= steps; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps };
      if (tiles.some((tile) => onTile(p, tile))) return true;
    }
  }
  return false;
}

/**
 * WHERE A RIBBON RUNS, decided for all of them at once: the shortest honest
 * way along the ground between its two districts.
 *
 * - Between neighbors — nothing standing between them — a straight run from
 *   the corner of one that faces the other to the corner of the other that
 *   faces it.
 * - Between two in one row with others between, along the row's street: the
 *   strip of ground just in front of its districts, which every district in
 *   the row touches at its front corner and none stands on.
 * - Between two in one column, along the column's street: the strip just
 *   beside its districts' right-hand corners.
 * - Otherwise one bend: along the street beside the first district's column
 *   to the second's row street, and along that to it — or the other way
 *   about, whichever crosses no district.
 *
 * Ribbons that share a street lie side by side in it, each its own width
 * apart, so a corridor several relations use is a bundle rather than one
 * line drawn over another. Nothing is bowed to look like a road: every run
 * is straight, and a bend is where a street meets another.
 */
export function routeRibbons(
  ribbons: readonly { readonly key: string; readonly from: string; readonly to: string; readonly width: number }[],
  tiles: ReadonlyMap<string, Tile>,
): Map<string, Point[]> {
  const all = [...tiles.values()];
  const others = (a: Tile, b: Tile) => all.filter((tile) => tile !== a && tile !== b);
  const sameRow = (a: Tile, b: Tile) => Math.abs(a.cy - b.cy) < 0.25 * Math.min(a.hh, b.hh);
  const sameCol = (a: Tile, b: Tile) => Math.abs(a.cx - b.cx) < 0.25 * Math.min(a.hw, b.hw);
  // How far apart neighbors stand: a straight run longer than a neighbor's reach crosses empty ground nobody lives on.
  const nearest = all.map((a) => Math.min(...all.filter((b) => b !== a).map((b) => Math.hypot(a.cx - b.cx, a.cy - b.cy))));
  const reach = 1.6 * (nearest.filter(Number.isFinite).sort((x, y) => x - y)[Math.floor(nearest.length / 2)] ?? Infinity);
  const gap = 10;

  type Street = { readonly axis: "h" | "v"; readonly at: number; readonly sign: 1 | -1 };
  type Plan = { readonly key: string; readonly width: number; readonly build: (offset: (street: Street) => number) => Point[]; readonly streets: readonly Street[] };
  const plans: Plan[] = [];
  for (const ribbon of ribbons) {
    const a = tiles.get(ribbon.from);
    const b = tiles.get(ribbon.to);
    if (!a || !b || a === b) continue;
    const between = others(a, b);
    // 1. Neighbors: straight, corner to facing corner.
    const facing: [Point, Point] = sameRow(a, b)
      ? [corner(a, b.cx > a.cx ? "right" : "left"), corner(b, b.cx > a.cx ? "left" : "right")]
      : sameCol(a, b)
        ? [corner(a, b.cy > a.cy ? "front" : "back"), corner(b, b.cy > a.cy ? "back" : "front")]
        : nearestCorners(a, b);
    const straight = [...facing];
    const long = Math.hypot(facing[1].x - facing[0].x, facing[1].y - facing[0].y) > reach && !sameRow(a, b) && !sameCol(a, b);
    if (!crossesAny(straight, between) && !long) {
      plans.push({ key: ribbon.key, width: ribbon.width, streets: [], build: () => straight });
      continue;
    }
    const frontStreet = (tile: Tile): Street => ({ axis: "h", at: tile.cy + tile.hh + gap, sign: 1 });
    const sideStreet = (tile: Tile, right: boolean): Street => ({ axis: "v", at: right ? tile.cx + tile.hw + gap : tile.cx - tile.hw - gap, sign: right ? 1 : -1 });
    // 2. One row: along the street in front of it.
    if (sameRow(a, b)) {
      const street = frontStreet(a.cy + a.hh > b.cy + b.hh ? a : b);
      plans.push({ key: ribbon.key, width: ribbon.width, streets: [street], build: (offset) => {
        const y = street.at + offset(street);
        return [corner(a, "front"), { x: a.cx, y }, { x: b.cx, y }, corner(b, "front")];
      } });
      continue;
    }
    // 3. One column: along the street beside it.
    if (sameCol(a, b)) {
      const street = sideStreet(a.hw > b.hw ? a : b, true);
      plans.push({ key: ribbon.key, width: ribbon.width, streets: [street], build: (offset) => {
        const x = street.at + offset(street);
        return [corner(a, "right"), { x, y: a.cy }, { x, y: b.cy }, corner(b, "right")];
      } });
      continue;
    }
    // 4. One bend: beside one district's column, then along the other's row street.
    const toward = b.cx > a.cx;
    const viaA = { col: sideStreet(a, toward), row: frontStreet(b) };
    const viaB = { col: sideStreet(b, !toward), row: frontStreet(a) };
    const firstWay = (offset: (street: Street) => number): Point[] => {
      const x = viaA.col.at + offset(viaA.col);
      const y = viaA.row.at + offset(viaA.row);
      return [corner(a, toward ? "right" : "left"), { x, y: a.cy }, { x, y }, { x: b.cx, y }, corner(b, "front")];
    };
    const otherWay = (offset: (street: Street) => number): Point[] => {
      const x = viaB.col.at + offset(viaB.col);
      const y = viaB.row.at + offset(viaB.row);
      return [corner(a, "front"), { x: a.cx, y }, { x, y }, { x, y: b.cy }, corner(b, toward ? "left" : "right")];
    };
    const none = () => 0;
    const firstClear = !crossesAny(firstWay(none), between);
    const otherClear = !crossesAny(otherWay(none), between);
    const length = (points: readonly Point[]) => points.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y)), 0);
    const useFirst = firstClear && (!otherClear || length(firstWay(none)) <= length(otherWay(none)));
    plans.push(useFirst || !otherClear ? { key: ribbon.key, width: ribbon.width, streets: [viaA.col, viaA.row], build: firstWay } : { key: ribbon.key, width: ribbon.width, streets: [viaB.col, viaB.row], build: otherWay });
  }

  // The bundles: each street's ribbons side by side, away from the districts it runs beside.
  const id = (street: Street) => `${street.axis}:${Math.round(street.at)}:${street.sign}`;
  const used = new Map<string, number>();
  const offsets = new Map<string, Map<string, number>>();
  for (const plan of plans) {
    for (const street of plan.streets) {
      const taken = used.get(id(street)) ?? 0;
      const mine = offsets.get(plan.key) ?? new Map<string, number>();
      mine.set(id(street), street.sign * (taken + plan.width / 2));
      offsets.set(plan.key, mine);
      used.set(id(street), taken + plan.width + 2);
    }
  }
  const out = new Map<string, Point[]>();
  for (const plan of plans) out.set(plan.key, plan.build((street) => offsets.get(plan.key)?.get(id(street)) ?? 0));
  return out;
}

/** The pair of corners, one on each tile, nearest each other. */
function nearestCorners(a: Tile, b: Tile): [Point, Point] {
  const sides = ["left", "right", "back", "front"] as const;
  let best: [Point, Point] = [corner(a, "right"), corner(b, "left")];
  let gap = Infinity;
  for (const one of sides) {
    for (const other of sides) {
      const p = corner(a, one);
      const q = corner(b, other);
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < gap) {
        gap = d;
        best = [p, q];
      }
    }
  }
  return best;
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
  return points.map((p) => toIso(p.col, p.row, city.cell, city.tilt));
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
