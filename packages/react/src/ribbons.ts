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
export function routeOnTheGround(input: RouteInput): Map<string, Point[]> {
  const steps = routing(input);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

export interface RouteInput {
  readonly ribbons: readonly { readonly key: string; readonly from: string; readonly to: string; readonly width: number }[];
  readonly plots: ReadonlyMap<string, PlotLike>;
  readonly cell: number;
  readonly tilt?: number | undefined;
  /** The districts' name cards, on the canvas from origin zero. */
  readonly labels?: readonly Box[];
}

/**
 * `routeOnTheGround`, a ribbon at a time: it stops after the ground is
 * read and after each ribbon, so a page can route a map it has not seen in
 * slices between frames rather than hold the frame for the whole of it.
 */
export function* routing(input: RouteInput): Generator<void, Map<string, Point[]>, void> {
  const { ribbons, plots, cell } = input;
  const tilt = input.tilt ?? 0.5;
  const labels = input.labels ?? [];
  const all = [...plots.values()];
  const out = new Map<string, Point[]>();
  if (all.length === 0 || cell <= 0) return out;
  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const p of all) {
    minCol = Math.min(minCol, p.col);
    minRow = Math.min(minRow, p.row);
    maxCol = Math.max(maxCol, p.col + p.side);
    maxRow = Math.max(maxRow, p.row + p.side);
  }
  minCol -= 3;
  minRow -= 3;
  maxCol += 3;
  maxRow += 3;
  const width = Math.round((maxCol - minCol) / STEP) + 1;
  const height = Math.round((maxRow - minRow) / STEP) + 1;
  const colOf = (i: number) => minCol + i * STEP;
  const rowOf = (j: number) => minRow + j * STEP;
  const pad = 4;
  const underLabel = (col: number, row: number) => {
    if (labels.length === 0) return false;
    const p = toIso(col, row, cell, tilt);
    for (const box of labels) if (p.x > box.x - pad && p.x < box.x + box.width + pad && p.y > box.y - pad && p.y < box.y + box.height + pad) return true;
    return false;
  };
  // A street keeps a cell clear of every curb, so the ribbons in it lie in the gutter, not on its edge.
  const onPlot = (col: number, row: number) => {
    for (const p of all) if (col > p.col - CLEAR && col < p.col + p.side + CLEAR && row > p.row - CLEAR && row < p.row + p.side + CLEAR) return true;
    return false;
  };
  /*
   * THE GROUND, ASKED ONCE. Every grid point a ribbon may pass through, and
   * every step between two of them (free when its middle is: a name card can
   * sit between two grid points), is worked out here, once for the pass that
   * heeds the name cards and once for the pass that runs under them — not
   * again at every step the search takes, which asked every plot and every
   * card each time and held the overview's first frame for a second and more.
   * `across` is the step to the next point along a row of the grid, `down`
   * the step to the next point down a column, each kept by the point it leaves.
   */
  const size = width * height;
  const heeding = new Uint8Array(size);
  const plain = new Uint8Array(size);
  const acrossHeeding = new Uint8Array(size);
  const acrossPlain = new Uint8Array(size);
  const downHeeding = new Uint8Array(size);
  const downPlain = new Uint8Array(size);
  // How far each grid point is from the nearest district: past NEAR, every step costs as much again for each cell further.
  const away = new Float32Array(size);
  for (let j = 0; j < height; j++) {
    const row = rowOf(j);
    for (let i = 0; i < width; i++) {
      const col = colOf(i);
      const at = j * width + i;
      plain[at] = onPlot(col, row) ? 0 : 1;
      heeding[at] = plain[at] && !underLabel(col, row) ? 1 : 0;
      if (i + 1 < width) {
        const mid = col + STEP / 2;
        acrossPlain[at] = onPlot(mid, row) ? 0 : 1;
        acrossHeeding[at] = acrossPlain[at] && !underLabel(mid, row) ? 1 : 0;
      }
      if (j + 1 < height) {
        const mid = row + STEP / 2;
        downPlain[at] = onPlot(col, mid) ? 0 : 1;
        downHeeding[at] = downPlain[at] && !underLabel(col, mid) ? 1 : 0;
      }
      let nearest = Infinity;
      for (const p of all) nearest = Math.min(nearest, Math.max(0, p.col - col, col - (p.col + p.side), p.row - row, row - (p.row + p.side)));
      away[at] = nearest;
    }
  }
  /*
   * The doors of a district: the grid points a cell out from the middle
   * stretch of each of its four curbs, each with the point on the curb it
   * steps in to. Not its corners — a ribbon meets a curb, not a point.
   */
  const doors = (plot: PlotLike, free: Uint8Array): Door[] => {
    const found: Door[] = [];
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

  yield;
  // The stretches a ribbon already runs, kept as the steps are: a stretch already run costs less to the next ribbon.
  const usedAcross = new Uint8Array(size);
  const usedDown = new Uint8Array(size);
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  const INTO = [1, 0, 3, 2];
  // One set of the search's buffers for every ribbon and both passes: a pass fills them, never allocates them.
  const states = size * 4;
  const cost = new Float64Array(states);
  const backs = [new Int32Array(states), new Int32Array(states)] as const;
  const heap = new MinHeap();
  /*
   * A* over (point, heading): a step costs its length, a bend BEND, a stretch
   * already run less. `cap` is the cost at which the search may stop: no
   * way it could find from there would be chosen.
   */
  const search = (a: PlotLike, b: PlotLike, heed: boolean, back: Int32Array, cap: number): Pass => {
    const free = heed ? heeding : plain;
    const across = heed ? acrossHeeding : acrossPlain;
    const down = heed ? downHeeding : downPlain;
    const starts = doors(a, free);
    const ends = doors(b, free);
    const goal = new Map(ends.map((door) => [door.j * width + door.i, door]));
    if (starts.length === 0 || ends.length === 0) return { reached: -1, best: Infinity, starts, goal, back };
    const toB = (i: number, j: number) => {
      const col = colOf(i);
      const row = rowOf(j);
      return (Math.max(0, b.col - col, col - (b.col + b.side)) + Math.max(0, b.row - row, row - (b.row + b.side))) * SHARED;
    };
    cost.fill(Infinity);
    back.fill(-1);
    heap.clear();
    let reached = -1;
    let best = Infinity;
    // Leaving square on: a door's state heads out of the curb, so a turn straight after it is a bend.
    for (const door of starts) {
      const s = (door.j * width + door.i) * 4 + door.out;
      cost[s] = 0;
      heap.push(s, toB(door.i, door.j));
    }
    while (heap.size > 0) {
      const f = heap.peekKey();
      if (f >= best || f >= cap) break;
      const s = heap.pop();
      const node = s >> 2;
      const d = s & 3;
      const i = node % width;
      const j = (node - i) / width;
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
        if (i2 < 0 || j2 < 0 || i2 >= width || j2 >= height) continue;
        const node2 = j2 * width + i2;
        if (!free[node2]) continue;
        // The stretch between the two points, kept by the one it leaves rightward or downward.
        const stretch = di + dj > 0 ? node : node2;
        if (!(di !== 0 ? across : down)[stretch]) continue;
        const run = (di !== 0 ? usedAcross : usedDown)[stretch] ? SHARED : 1;
        const step = STEP * run * (1 + Math.max(0, away[node2]! - NEAR)) + (nd === d ? 0 : BEND);
        const s2 = node2 * 4 + nd;
        const next = cost[s]! + step;
        if (next < cost[s2]!) {
          cost[s2] = next;
          back[s2] = s;
          heap.push(s2, next + toB(i2, j2));
        }
      }
    }
    return { reached, best, starts, goal, back };
  };
  const routes = new Map<string, { cells: { i: number; j: number }[]; start: { col: number; row: number }; end: { col: number; row: number } }>();
  for (const ribbon of ribbons) {
    const a = plots.get(ribbon.from);
    const b = plots.get(ribbon.to);
    if (!a || !b || a === b) continue;
    /*
     * Round the name cards where that is a way at all and not a long way
     * round — on a phone the cards are as big as the streets, and a ribbon
     * sent out past the window to clear them says less than one passing
     * under a card. Else, as a street runs under a sign, under them.
     *
     * The way under is found first: every way round the cards is a way
     * under them too, so where there is none under there is none round, and
     * a way round is looked for only as far as it could be chosen — no
     * longer than 1.3 times the way under, and two. (The search may stop a
     * door's step, SHARED × OUT, past that: it guesses at most that much
     * over what is left of a way.)
     */
    const under = search(a, b, false, backs[1], Infinity);
    if (under.reached === -1) {
      yield;
      continue;
    }
    const round = search(a, b, true, backs[0], 1.3 * under.best + 2 + SHARED * OUT + 1e-9);
    const chosen = round.reached !== -1 && round.best <= 1.3 * under.best + 2 ? round : under;
    if (chosen.reached === -1) continue;
    const { reached, starts, goal, back } = chosen;
    const cells: { i: number; j: number }[] = [];
    for (let s = reached; s !== -1; s = back[s]!) {
      const node = s >> 2;
      const last = cells[cells.length - 1];
      const here = { i: node % width, j: Math.floor(node / width) };
      if (!last || last.i !== here.i || last.j !== here.j) cells.push(here);
    }
    cells.reverse();
    for (let k = 1; k < cells.length; k++) {
      const p = cells[k - 1]!;
      const q = cells[k]!;
      const from = p.i + p.j < q.i + q.j ? p : q;
      (p.i !== q.i ? usedAcross : usedDown)[from.j * width + from.i] = 1;
    }
    const first = starts.find((door) => door.i === cells[0]!.i && door.j === cells[0]!.j)!;
    const last = goal.get(cells[cells.length - 1]!.j * width + cells[cells.length - 1]!.i)!;
    routes.set(ribbon.key, { cells, start: first.curb, end: last.curb });
    yield;
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
    // Whether the k-th leg of the way is a stretch of the grid, not a stub in from a curb.
    const gridEdge = (k: number) => k >= 2 && k <= route.cells.length;
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
      if (!Array.from({ length: run.to - run.from }, (_, n) => gridEdge(run.from + 1 + n)).some(Boolean)) return 0;
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

interface Door {
  readonly i: number;
  readonly j: number;
  readonly out: number;
  readonly curb: { readonly col: number; readonly row: number };
}

/** One search of the ground: the state it reached a door in (-1 for none), what that cost, and the way back. */
interface Pass {
  readonly reached: number;
  readonly best: number;
  readonly starts: Door[];
  readonly goal: Map<number, Door>;
  readonly back: Int32Array;
}

/** The least-first queue the ground's router takes its next step from. */
class MinHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];
  get size(): number {
    return this.items.length;
  }
  clear(): void {
    this.items.length = 0;
    this.keys.length = 0;
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
    const item = this.items[a]!;
    this.items[a] = this.items[b]!;
    this.items[b] = item;
    const key = this.keys[a]!;
    this.keys[a] = this.keys[b]!;
    this.keys[b] = key;
  }
}

/*
 * ROUTED ONCE FOR EACH PICTURE. A route follows from the ribbons, the plots,
 * the name cards, the cell and the tilt, and from nothing else — so a city
 * already routed is not routed again when the overview is shown again, the
 * way back from a place or out of a district. Leaving and coming back routed
 * the whole map each time, on the main thread, and held the overview's first
 * frame for a second and a half on a map of twenty-five districts.
 */
interface Routed {
  readonly ground: string;
  readonly cell: number;
  readonly tilt: number;
  readonly runs: ReadonlyMap<string, Point[]>;
}
/** How many pictures' routes are kept: a few places and districts back and forth, not every one ever seen. */
const KEPT = 16;
const routed = new Map<string, Routed>();
let routings = 0;

/** What a route follows from apart from the cell, the tilt and the cards: the ribbons, their widths and the plots. */
export function groundOf(input: Pick<RouteInput, "ribbons" | "plots">): string {
  const plots = [...input.plots].map(([kind, plot]) => `${kind}:${plot.col},${plot.row},${plot.side}`).join(";");
  return `${input.ribbons.map((ribbon) => `${ribbon.key}>${ribbon.from}>${ribbon.to}>${ribbon.width}`).join(";")}|${plots}`;
}

const boxesOf = (labels: readonly Box[]) => labels.map((box) => `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}`).join(";");

const keyOf = (input: RouteInput, ground: string) => `${ground}|${input.cell}|${input.tilt ?? 0.5}|${boxesOf(input.labels ?? [])}`;

function remember(input: RouteInput, ground: string, runs: ReadonlyMap<string, Point[]>): void {
  routed.set(keyOf(input, ground), { ground, cell: input.cell, tilt: input.tilt ?? 0.5, runs });
  while (routed.size > KEPT) routed.delete(routed.keys().next().value!);
}

/** The routes this very picture was given, if it has been routed: the most recently asked is the last to be let go. */
export function routesRemembered(input: RouteInput): ReadonlyMap<string, Point[]> | undefined {
  const key = keyOf(input, groundOf(input));
  const kept = routed.get(key);
  if (!kept) return undefined;
  routed.delete(key);
  routed.set(key, kept);
  return kept.runs;
}

/** `routeOnTheGround`, remembered: the same picture asked again is answered with the routes it was given. */
export function routesFor(input: RouteInput): ReadonlyMap<string, Point[]> {
  const kept = routesRemembered(input);
  if (kept) return kept;
  routings += 1;
  const runs = routeOnTheGround(input);
  remember(input, groundOf(input), runs);
  return runs;
}

/**
 * A PICTURE NOT SEEN BEFORE, ROUTED BETWEEN FRAMES: a ribbon at a time,
 * `budget` milliseconds of them before the page is let go to draw, until
 * the whole map is routed — then remembered, and `done` is told. A map of
 * twenty-five districts routed in one piece held the frame a few hundred
 * milliseconds on a slow machine; in slices, no frame waits on more than a
 * slice. Returns how to stop it, for a picture that changed meanwhile.
 */
export function routeBetweenFrames(input: RouteInput, done: (runs: ReadonlyMap<string, Point[]>) => void, budget = 8): () => void {
  const kept = routesRemembered(input);
  if (kept) {
    done(kept);
    return () => {};
  }
  const ground = groundOf(input);
  const steps = routing(input);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  routings += 1;
  const slice = () => {
    timer = undefined;
    if (stopped) return;
    const began = performance.now();
    for (;;) {
      const step = steps.next();
      if (step.done) {
        remember(input, ground, step.value);
        done(step.value);
        return;
      }
      if (performance.now() - began >= budget) break;
    }
    timer = setTimeout(slice, 0);
  };
  timer = setTimeout(slice, 0);
  return () => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
  };
}

/**
 * The routes last given for this ground at this tilt, at the cell asked —
 * the city on its way in or out, the camera moving over the same streets.
 * Nothing when the ground has not been routed: a ribbon is drawn where it
 * was routed, never where it might be.
 */
export function routesSeen(ground: string, cell: number, tilt: number): ReadonlyMap<string, Point[]> | undefined {
  let found: Routed | undefined;
  for (const kept of routed.values()) if (kept.ground === ground && kept.tilt === tilt) found = kept;
  if (!found || cell <= 0) return undefined;
  if (found.cell === cell) return found.runs;
  const by = cell / found.cell;
  return new Map([...found.runs].map(([key, points]) => [key, points.map((p) => ({ x: p.x * by, y: p.y * by }))]));
}

/** How many times the ground has been routed rather than remembered: for a test to hold a return to the overview to none. */
export function routingsSoFar(): number {
  return routings;
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
