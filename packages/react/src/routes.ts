import type { ConnectorRoute } from "@graview/core";

/*
 * HOW A CONNECTOR TRAVELS.
 *
 * The scene knows the two ends, a control point the layout chose to clear
 * what lies between, and the boxes a visible line must keep out of. A route
 * turns that into the path that is drawn and the path that takes the
 * pointer. "curve" is the quadratic the scene has always drawn; "straight"
 * is the same quadratic with its control on the chord; "orthogonal" is a
 * polyline with two elbows. Each is one case here, so the next — arcs,
 * steps, a brand's own — is one more case and nothing in the scene moves.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface Quadratic {
  readonly p0: Point;
  readonly c: Point;
  readonly p1: Point;
}

const inside = (p: Point, boxes: readonly Box[]): boolean =>
  boxes.some((box) => p.x > box.x && p.x < box.x + box.width && p.y > box.y && p.y < box.y + box.height);

/** The pieces of a polyline that lie outside every box. */
export function clipPolyline(points: readonly Point[], boxes: readonly Box[]): Point[][] {
  const runs: Point[][] = [];
  let open: Point[] = [];
  const STEPS = 48;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    let wasOut = !inside(a, boxes);
    if (wasOut && open.length === 0) open.push(a);
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const isOut = !inside(p, boxes);
      if (isOut === wasOut) continue;
      // Refine the crossing between the last sample and this one.
      let lo = (s - 1) / STEPS;
      let hi = t;
      for (let k = 0; k < 10; k++) {
        const mid = (lo + hi) / 2;
        const q = { x: a.x + (b.x - a.x) * mid, y: a.y + (b.y - a.y) * mid };
        if (!inside(q, boxes) === wasOut) lo = mid;
        else hi = mid;
      }
      const at = (lo + hi) / 2;
      const crossing = { x: a.x + (b.x - a.x) * at, y: a.y + (b.y - a.y) * at };
      if (isOut) open = [crossing];
      else {
        open.push(crossing);
        if (open.length >= 2) runs.push(open);
        open = [];
      }
      wasOut = isOut;
    }
    if (wasOut) open.push(b);
  }
  if (open.length >= 2) runs.push(open);
  return runs;
}

/**
 * Two elbows, leaving and arriving along the LONGER way.
 *
 * Out along x to the middle, across, and in along x drew the last leg of a
 * line from the focus down to a card in a band as a horizontal run at the
 * card's own height — through the gap between it and its neighbour, so two
 * chips in a row read as joined by a dashed line. Where the ends are further
 * apart vertically than across, the route leaves and arrives vertically and
 * crosses in the gutter halfway between: a line comes down INTO a card, and
 * never lies along the row it sits in.
 */
export function orthogonalPoints(from: Point, to: Point): Point[] {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dy > dx) {
    if (dx < 2) return [from, to];
    const midY = (from.y + to.y) / 2;
    return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
  }
  const midX = (from.x + to.x) / 2;
  if (Math.abs(to.x - from.x) < 2) return [from, to];
  return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
}

// Two decimals: a path is read by a person in the inspector, and sub-pixel noise is not information.
const at = (n: number): number => Math.round(n * 100) / 100;

export const polylineD = (runs: readonly (readonly Point[])[]): string =>
  runs.map((run) => run.map((p, i) => `${i === 0 ? "M" : "L"} ${at(p.x)} ${at(p.y)}`).join(" ")).join(" ");

/**
 * A polyline with its corners rounded: each elbow becomes a short quadratic,
 * so a road through the gutters reads as a road and not as a box drawn
 * around whatever it went round.
 */
export function roundedPolylineD(points: readonly Point[], radius: number): string {
  if (points.length < 3) return polylineD([points]);
  const parts: string[] = [`M ${at(points[0]!.x)} ${at(points[0]!.y)}`];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const corner = points[i]!;
    const next = points[i + 1]!;
    const inLen = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const outLen = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const a = { x: corner.x + ((prev.x - corner.x) / (inLen || 1)) * r, y: corner.y + ((prev.y - corner.y) / (inLen || 1)) * r };
    const b = { x: corner.x + ((next.x - corner.x) / (outLen || 1)) * r, y: corner.y + ((next.y - corner.y) / (outLen || 1)) * r };
    parts.push(`L ${at(a.x)} ${at(a.y)} Q ${at(corner.x)} ${at(corner.y)} ${at(b.x)} ${at(b.y)}`);
  }
  const last = points[points.length - 1]!;
  parts.push(`L ${at(last.x)} ${at(last.y)}`);
  return parts.join(" ");
}

/** Where a route is at parameter t, for sampling a hit corridor. */
export function routePoint(route: ConnectorRoute, q: Quadratic, t: number): Point {
  if (route === "orthogonal") {
    const points = orthogonalPoints(q.p0, q.p1);
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    let along = t * total;
    for (let i = 0; i < lengths.length; i++) {
      const length = lengths[i]!;
      if (along <= length || i === lengths.length - 1) {
        const u = length === 0 ? 0 : Math.min(1, along / length);
        const a = points[i]!;
        const b = points[i + 1]!;
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      }
      along -= length;
    }
    return q.p1;
  }
  const c = route === "straight" ? { x: (q.p0.x + q.p1.x) / 2, y: (q.p0.y + q.p1.y) / 2 } : q.c;
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const d = t * t;
  return { x: a * q.p0.x + b * c.x + d * q.p1.x, y: a * q.p0.y + b * c.y + d * q.p1.y };
}

/** The quadratic a route wants drawn: the scene's own for a curve, its chord for a straight line. */
export function routedQuadratic(route: ConnectorRoute, q: Quadratic): Quadratic {
  if (route !== "straight") return q;
  return { ...q, c: { x: (q.p0.x + q.p1.x) / 2, y: (q.p0.y + q.p1.y) / 2 } };
}

/**
 * A ROAD ALONG THE LATTICE. From altitude the ground is a 2:1 lattice and
 * a road between two districts runs along its diagonals — one leg on each,
 * with the elbow where they meet — so the roads lie on the same grid the
 * districts stand on. Solving from + a·(2,1) + b·(−2,1) = to gives the two
 * legs; a pair on one diagonal needs no elbow at all.
 */
export function latticePoints(from: Point, to: Point): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Along (2,1): a; along (-2,1): b. dx = 2a − 2b, dy = a + b.
  const a = (dx / 2 + dy) / 2;
  const b = (dy - dx / 2) / 2;
  if (Math.abs(a) < 1 || Math.abs(b) < 1) return [from, to];
  const elbow = { x: from.x + 2 * a, y: from.y + a };
  return [from, elbow, to];
}
