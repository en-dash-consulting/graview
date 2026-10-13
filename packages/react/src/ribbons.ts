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

/** A box on the canvas, from origin zero: a district's name card the ribbons go round. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The grid a ribbon is routed on: half a lattice cell, so a street can run down the middle of a one-cell gutter. */
const STEP = 0.5;
/** How far out from a curb the streets run, in cells, and how near to one no street may come. */
const OUT = 1;
const CLEAR = 0.76;
/** What a bend costs, in cells: enough that a ribbon bends only where it must. */
const BEND = 3;
/** How far from every district, in cells, the ground starts to cost more to cross: a ribbon keeps to the streets between districts, not the open ground beyond them. */
const NEAR = 3;
/** How much less a stretch another ribbon already runs along costs: ribbons that can share a street do. */
const SHARED = 0.6;

/**
 * WHERE EACH RIBBON RUNS, ON THE GROUND.
 *
 * The ground is a lattice, and a line drawn on it runs along one of its two
 * axes — the diagonals a person sees the grid in. A ribbon leaves its
 * district from the middle of a curb, runs along the gutters between the
 * districts on the lattice's own lines, and comes into the other district
 * at the middle of a curb: never across a district, never behind a
 * district's name card, and with as few bends as the ground allows — none
 * or one between neighbors. A stretch another ribbon already runs costs
 * less, so relations that can share a street do, and those sharing one lie
 * side by side in it, each its own width apart. Routed on the lattice and
 * drawn through `toIso`, so it lies on the ground at whatever tilt the city
 * is seen at.
 */
export function routeOnTheGround(input: {
  readonly ribbons: readonly { readonly key: string; readonly from: string; readonly to: string; readonly width: number }[];
  readonly plots: ReadonlyMap<string, PlotLike>;
  readonly cell: number;
  readonly tilt?: number | undefined;
  /** The districts' name cards, on the canvas from origin zero. */
  readonly labels?: readonly Box[];
}): Map<string, Point[]> {
  const { ribbons, plots, cell } = input;
  const tilt = input.tilt ?? 0.5;
  const labels = input.labels ?? [];
  const all = [...plots.values()];
  const out = new Map<string, Point[]>();
  if (all.length === 0 || cell <= 0) return out;
  const minCol = Math.min(...all.map((p) => p.col)) - 3;
  const minRow = Math.min(...all.map((p) => p.row)) - 3;
  const maxCol = Math.max(...all.map((p) => p.col + p.side)) + 3;
  const maxRow = Math.max(...all.map((p) => p.row + p.side)) + 3;
  const width = Math.round((maxCol - minCol) / STEP) + 1;
  const height = Math.round((maxRow - minRow) / STEP) + 1;
  const colOf = (i: number) => minCol + i * STEP;
  const rowOf = (j: number) => minRow + j * STEP;
  const pad = 4;
  // Whether the name cards are heeded: where they leave no way at all, a ribbon passes under them rather than not at all.
  let heed = true;
  const underLabel = (col: number, row: number) => {
    if (!heed) return false;
    const p = toIso(col, row, cell, tilt);
    return labels.some((box) => p.x > box.x - pad && p.x < box.x + box.width + pad && p.y > box.y - pad && p.y < box.y + box.height + pad);
  };
  // A street keeps a cell clear of every curb, so the ribbons in it lie in the gutter, not on its edge.
  const onPlot = (col: number, row: number) => all.some((p) => col > p.col - CLEAR && col < p.col + p.side + CLEAR && row > p.row - CLEAR && row < p.row + p.side + CLEAR);
  // Every grid point a ribbon may pass through: off every district, and out from under every name card — or, where they leave no way, off every district.
  const heeding = new Uint8Array(width * height);
  const plain = new Uint8Array(width * height);
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const col = colOf(i);
      const row = rowOf(j);
      plain[j * width + i] = onPlot(col, row) ? 0 : 1;
      heeding[j * width + i] = plain[j * width + i] && !underLabel(col, row) ? 1 : 0;
    }
  }
  let free = heeding;
  // How far each grid point is from the nearest district: past NEAR, every step costs as much again for each cell further.
  const away = new Float32Array(width * height);
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const col = colOf(i);
      const row = rowOf(j);
      away[j * width + i] = Math.min(...all.map((p) => Math.max(0, p.col - col, col - (p.col + p.side), p.row - row, row - (p.row + p.side))));
    }
  }
  // An edge is free when its middle is too: a name card can sit between two grid points.
  const edgeFree = (i: number, j: number, di: number, dj: number) => {
    const col = colOf(i) + (di * STEP) / 2;
    const row = rowOf(j) + (dj * STEP) / 2;
    return !onPlot(col, row) && !underLabel(col, row);
  };
  /*
   * The doors of a district: the grid points a cell out from the middle
   * stretch of each of its four curbs, each with the point on the curb it
   * steps in to. Not its corners — a ribbon meets a curb, not a point.
   */
  const doors = (plot: PlotLike): { i: number; j: number; out: number; curb: { col: number; row: number } }[] => {
    const found: { i: number; j: number; out: number; curb: { col: number; row: number } }[] = [];
    const along = (from: number, side: number) => {
      const steps: number[] = [];
      // On the router's grid, so two doors facing each other across a street line up.
      const margin = Math.min(1, side / 3);
      for (let t = Math.ceil((from + margin) / STEP - 1e-9) * STEP; t <= from + side - margin + 1e-9; t += STEP) steps.push(t);
      return steps;
    };
    // `out` is the heading that leaves the curb straight: a ribbon meets a curb square on.
    const add = (col: number, row: number, out: number, curb: { col: number; row: number }) => {
      const i = Math.round((col - minCol) / STEP);
      const j = Math.round((row - minRow) / STEP);
      if (i >= 0 && j >= 0 && i < width && j < height && free[j * width + i]) found.push({ i, j, out, curb });
    };
    for (const row of along(plot.row, plot.side)) {
      add(plot.col - OUT, row, 1, { col: plot.col, row });
      add(plot.col + plot.side + OUT, row, 0, { col: plot.col + plot.side, row });
    }
    for (const col of along(plot.col, plot.side)) {
      add(col, plot.row - OUT, 3, { col, row: plot.row });
      add(col, plot.row + plot.side + OUT, 2, { col, row: plot.row + plot.side });
    }
    return found;
  };

  const used = new Map<string, string[]>();
  const edgeKey = (i: number, j: number, i2: number, j2: number) => (i < i2 || (i === i2 && j < j2) ? `${i},${j}-${i2},${j2}` : `${i2},${j2}-${i},${j}`);
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  const routes = new Map<string, { cells: { i: number; j: number }[]; start: { col: number; row: number }; end: { col: number; row: number } }>();
  for (const ribbon of ribbons) {
    const a = plots.get(ribbon.from);
    const b = plots.get(ribbon.to);
    if (!a || !b || a === b) continue;
    let reached = -1;
    let starts: ReturnType<typeof doors> = [];
    let goal = new Map<number, ReturnType<typeof doors>[number]>();
    let back: Int32Array = new Int32Array(0);
    let best = Infinity;
    /*
     * Round the name cards where that is a way at all and not a long way
     * round — on a phone the cards are as big as the streets, and a ribbon
     * sent out past the window to clear them says less than one passing
     * under a card. Else, as a street runs under a sign, under them.
     */
    const found: { reached: number; starts: typeof starts; goal: typeof goal; back: Int32Array; best: number }[] = [];
    for (const pass of [true, false]) {
    reached = -1;
    best = Infinity;
    heed = pass;
    free = pass ? heeding : plain;
    starts = doors(a);
    const ends = doors(b);
    if (starts.length === 0 || ends.length === 0) {
      found.push({ reached: -1, starts, goal, back, best });
      continue;
    }
    goal = new Map(ends.map((door) => [door.j * width + door.i, door]));
    const toB = (i: number, j: number) => {
      const col = colOf(i);
      const row = rowOf(j);
      return (Math.max(0, b.col - col, col - (b.col + b.side)) + Math.max(0, b.row - row, row - (b.row + b.side))) * SHARED;
    };
    // A* over (point, heading): a step costs its length, a bend BEND, a stretch already run less.
    const states = width * height * 4;
    const cost = new Float64Array(states).fill(Infinity);
    back = new Int32Array(states).fill(-1);
    const heap = new MinHeap();
    // Leaving square on: a door's state heads out of the curb, so a turn straight after it is a bend.
    for (const door of starts) {
      const s = (door.j * width + door.i) * 4 + door.out;
      cost[s] = 0;
      heap.push(s, toB(door.i, door.j));
    }
    const INTO = [1, 0, 3, 2];
    while (heap.size > 0) {
      const f = heap.peekKey();
      if (f >= best) break;
      const s = heap.pop();
      const node = Math.floor(s / 4);
      const d = s % 4;
      const i = node % width;
      const j = Math.floor(node / width);
      const door = goal.get(node);
      if (door) {
        // Arriving square on costs nothing more; arriving along the curb is one more bend.
        const total = cost[s]! + (d === INTO[door.out] ? 0 : BEND);
        if (total < best) {
          best = total;
          reached = s;
        }
        continue;
      }
      for (let nd = 0; nd < 4; nd++) {
        const [di, dj] = DIRS[nd]!;
        const i2 = i + di;
        const j2 = j + dj;
        if (i2 < 0 || j2 < 0 || i2 >= width || j2 >= height || !free[j2 * width + i2] || !edgeFree(i, j, di, dj)) continue;
        const step = STEP * (used.has(edgeKey(i, j, i2, j2)) ? SHARED : 1) * (1 + Math.max(0, away[j2 * width + i2]! - NEAR)) + (nd === d ? 0 : BEND);
        const s2 = (j2 * width + i2) * 4 + nd;
        const next = cost[s]! + step;
        if (next < cost[s2]!) {
          cost[s2] = next;
          back[s2] = s;
          heap.push(s2, next + toB(i2, j2));
        }
      }
    }
    found.push({ reached, starts, goal, back, best });
    }
    heed = true;
    free = heeding;
    const [round, under] = found as [(typeof found)[number] | undefined, (typeof found)[number] | undefined];
    const chosen = round && round.reached !== -1 && (!under || under.reached === -1 || round.best <= 1.3 * under.best + 2) ? round : under;
    if (!chosen || chosen.reached === -1) continue;
    ({ reached, starts, goal, back } = chosen);
    const cells: { i: number; j: number }[] = [];
    for (let s = reached; s !== -1; s = back[s]!) {
      const node = Math.floor(s / 4);
      const last = cells[cells.length - 1];
      const here = { i: node % width, j: Math.floor(node / width) };
      if (!last || last.i !== here.i || last.j !== here.j) cells.push(here);
    }
    cells.reverse();
    for (let k = 1; k < cells.length; k++) {
      const key = edgeKey(cells[k - 1]!.i, cells[k - 1]!.j, cells[k]!.i, cells[k]!.j);
      used.set(key, [...(used.get(key) ?? []), ribbon.key]);
    }
    const first = starts.find((door) => door.i === cells[0]!.i && door.j === cells[0]!.j)!;
    const last = goal.get(cells[cells.length - 1]!.j * width + cells[cells.length - 1]!.i)!;
    routes.set(ribbon.key, { cells, start: first.curb, end: last.curb });
  }

  /*
   * THE BUNDLES. A run's lane is its place among the ribbons sharing the
   * stretch it runs, in one order for every stretch, so a bundle keeps its
   * order round a bend; each lane is its ribbon's width apart from the last,
   * across the run, on the ground.
   */
  const widthOf = new Map(ribbons.map((ribbon) => [ribbon.key, ribbon.width]));
  const order = new Map(ribbons.map((ribbon, index) => [ribbon.key, index]));
  // How far apart, on the canvas, two runs a cell apart across the ground lie.
  const pxPerCell = (cell * tilt) / Math.sqrt(1 + tilt * tilt);
  /*
   * A STREET IS A LINE OF THE LATTICE, and a ribbon keeps its lane along
   * the whole of it: every ribbon that runs on a line anywhere is given its
   * place across it, so one joining or leaving the bundle part way along
   * moves no other ribbon sideways.
   */
  const lineOf = (axis: "col" | "row", at: { col: number; row: number }) => (axis === "col" ? `r${at.row.toFixed(2)}` : `c${at.col.toFixed(2)}`);
  const lines = new Map<string, Set<string>>();
  for (const [key, route] of routes) {
    for (let k = 1; k < route.cells.length; k++) {
      const a = route.cells[k - 1]!;
      const b = route.cells[k]!;
      const line = lineOf(a.i !== b.i ? "col" : "row", { col: colOf(a.i), row: rowOf(a.j) });
      lines.set(line, (lines.get(line) ?? new Set<string>()).add(key));
    }
  }
  for (const [key, route] of routes) {
    // The whole way, on the lattice: in from the curb, along the grid, and out to the other curb.
    const way = [route.start, ...route.cells.map((at) => ({ col: colOf(at.i), row: rowOf(at.j) })), route.end];
    const gridEdge = (k: number) => (k >= 2 && k <= route.cells.length ? edgeKey(route.cells[k - 2]!.i, route.cells[k - 2]!.j, route.cells[k - 1]!.i, route.cells[k - 1]!.j) : null);
    // The straight runs: where the heading stays the same.
    const runs: { from: number; to: number; axis: "col" | "row" }[] = [];
    for (let k = 1; k < way.length; k++) {
      const axis = Math.abs(way[k]!.col - way[k - 1]!.col) > 1e-9 ? "col" : "row";
      const open = runs[runs.length - 1];
      if (open && open.axis === axis) open.to = k;
      else runs.push({ from: k - 1, to: k, axis });
    }
    if (runs.length === 0) continue;
    const shift = runs.map((run) => {
      // A stub in from a curb is no street: it stays where it meets the curb.
      if (!Array.from({ length: run.to - run.from }, (_, n) => gridEdge(run.from + 1 + n)).some((edge) => edge !== null)) return 0;
      const sharing = lines.get(lineOf(run.axis, way[run.from]!)) ?? new Set<string>();
      if (!sharing.has(key)) return 0;
      const bundle = [...sharing].sort((x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0));
      const total = bundle.reduce((sum, other) => sum + (widthOf.get(other) ?? 2) + 2, 0) - 2;
      let at = -total / 2;
      for (const other of bundle) {
        if (other === key) return (at + (widthOf.get(other) ?? 2) / 2) / pxPerCell;
        at += (widthOf.get(other) ?? 2) + 2;
      }
      return 0;
    });
    // A run along the col axis holds its row and is moved across by changing it, and the other way about; a corner takes one from each.
    const held = (index: number) => {
      const run = runs[index]!;
      const at = way[run.from]!;
      return run.axis === "col" ? { row: at.row + shift[index]! } : { col: at.col + shift[index]! };
    };
    const merge = (one: { col?: number; row?: number }, other: { col?: number; row?: number }, fallback: { col: number; row: number }) => ({ col: one.col ?? other.col ?? fallback.col, row: one.row ?? other.row ?? fallback.row });
    const points = [merge(held(0), {}, way[0]!)];
    for (let index = 0; index + 1 < runs.length; index++) points.push(merge(held(index), held(index + 1), way[runs[index]!.to]!));
    points.push(merge(held(runs.length - 1), {}, way[way.length - 1]!));
    out.set(key, points.map((p) => toIso(p.col, p.row, cell, tilt)));
  }
  return out;
}

/** The least-first queue the ground's router takes its next step from. */
class MinHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];
  get size(): number {
    return this.items.length;
  }
  peekKey(): number {
    return this.keys[0] ?? Infinity;
  }
  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    let at = this.items.length - 1;
    while (at > 0) {
      const up = (at - 1) >> 1;
      if (this.keys[up]! <= this.keys[at]!) break;
      this.swap(at, up);
      at = up;
    }
  }
  pop(): number {
    const top = this.items[0]!;
    const lastItem = this.items.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let at = 0;
      for (;;) {
        const left = 2 * at + 1;
        const right = left + 1;
        let least = at;
        if (left < this.items.length && this.keys[left]! < this.keys[least]!) least = left;
        if (right < this.items.length && this.keys[right]! < this.keys[least]!) least = right;
        if (least === at) break;
        this.swap(at, least);
        at = least;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.keys[a], this.keys[b]] = [this.keys[b]!, this.keys[a]!];
  }
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
