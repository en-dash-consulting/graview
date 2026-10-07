import type { AnySchema } from "./schema/schema.js";

/**
 * THE CITY IS A MAP DRAWN FROM THE DECLARATION.
 *
 * A kind is a neighborhood, and where it stands is decided by the
 * declaration alone — never by today's data, never by what looks nice.
 * Same declaration, same map; add a kind and every existing plot stays
 * where it was; a kind that grows takes a bigger block on the same corner.
 * That is what makes an address an address: the place a person remembers
 * is the place they get.
 *
 * Units are LATTICE CELLS on the isometric ground, not pixels. `col` runs
 * down-right along one diagonal, `row` down-left along the other; a plot
 * occupies `side × side` cells from its corner. Plots sit on a block grid
 * one `BLOCK` apart, so a plot growing to its largest side never reaches
 * its neighbor: the street between is the cell left over.
 *
 * Placement walks the kinds in the order the declaration says a blank
 * installation fills them (`beginning(app).order`, or sorted ids when
 * nobody said), puts the first at the origin, and puts each next kind in
 * the free block adjacent to the placed kind it shares the most declared
 * edges with — ties by id — spiraling outward when the near blocks are
 * taken. A kind declaring `plot` is put exactly there.
 */

export interface Plot {
  /** Corner cell, in lattice units. Multiples of BLOCK unless declared. */
  readonly col: number;
  readonly row: number;
  /** Cells on a side: ceil(sqrt(count)), at least 1, at most MAX_SIDE. */
  readonly side: number;
}

/** The most cells a plot takes on a side. */
export const MAX_SIDE = 4;
/** Block pitch: the largest side plus one cell of street. */
export const BLOCK = MAX_SIDE + 1;

export interface CityHints {
  /** The kind chain a blank installation fills, first to last. */
  readonly order?: readonly string[];
  /** How many of each kind stand today. Changes side, never col or row. */
  readonly counts?: Readonly<Record<string, number>>;
  /** Hand-laid plots, by kind. Used verbatim; a declared `plot` on the kind wins first. */
  readonly plots?: Readonly<Record<string, { readonly col: number; readonly row: number }>>;
}

export type CityMap = ReadonlyMap<string, Plot>;

/** A road: two kinds joined by declared edges, and which edges. */
export interface Road {
  readonly from: string;
  readonly to: string;
  readonly edges: readonly string[];
}

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Cells on a side for a population. */
export function sideFor(count: number | undefined): number {
  if (!count || count <= 1) return 1;
  return Math.min(MAX_SIDE, Math.ceil(Math.sqrt(count)));
}

/**
 * How many declared edges join two kinds, either direction. A wildcard
 * edge touches every kind and counts once toward each.
 */
export function sharedEdges(schema: AnySchema, a: string, b: string): number {
  if (a === b) return 0;
  const kinds = schema.kinds as readonly string[];
  let shared = 0;
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    const definition = schema.tryDefinition(from);
    for (const declaration of Object.values(definition?.edges ?? {})) {
      const targets = declaration.to === "*" ? kinds : (declaration.to as readonly string[]);
      if (targets.includes(to)) shared += 1;
    }
  }
  return shared;
}

/** The block cells a plot at (col,row) reserves: every cell of the block. */
const blockKey = (col: number, row: number): string => `${Math.floor(col / BLOCK)},${Math.floor(row / BLOCK)}`;

/**
 * Blocks around `(col,row)` at Manhattan distance `d`, in a stable order:
 * the four cardinal neighbors first (down-right, down-left, up-left,
 * up-right), then the rest clockwise. Deterministic, so the walk is.
 */
function ringAround(col: number, row: number, d: number): { col: number; row: number }[] {
  if (d === 0) return [{ col, row }];
  const out: { col: number; row: number }[] = [];
  for (let i = 0; i < d; i++) {
    out.push({ col: col + (d - i) * BLOCK, row: row + i * BLOCK });
    out.push({ col: col - i * BLOCK, row: row + (d - i) * BLOCK });
    out.push({ col: col - (d - i) * BLOCK, row: row - i * BLOCK });
    out.push({ col: col + i * BLOCK, row: row - (d - i) * BLOCK });
  }
  return out;
}

export function cityMap(schema: AnySchema, hints: CityHints = {}): CityMap {
  const kinds = [...(schema.kinds as readonly string[])];
  const order = [
    ...(hints.order ?? []).filter((kind) => kinds.includes(kind)),
    ...kinds.filter((kind) => !(hints.order ?? []).includes(kind)).sort(byId),
  ].filter((kind, index, all) => all.indexOf(kind) === index);

  const plots = new Map<string, Plot>();
  const taken = new Set<string>();
  const put = (kind: string, col: number, row: number) => {
    plots.set(kind, { col, row, side: sideFor(hints.counts?.[kind]) });
    taken.add(blockKey(col, row));
  };

  /* HAND-LAID FIRST, verbatim: a declared address is an address. */
  for (const kind of order) {
    const declared = (schema.tryDefinition(kind) as { plot?: { col: number; row: number } } | undefined)?.plot ?? hints.plots?.[kind];
    if (declared) put(kind, declared.col, declared.row);
  }

  for (const kind of order) {
    if (plots.has(kind)) continue;
    if (plots.size === 0) {
      put(kind, 0, 0);
      continue;
    }
    /*
     * THE PLACED KIND IT SHARES THE MOST EDGES WITH. None shared means
     * nothing to be near, and the city's first block is the anchor — so an
     * unrelated kind still lands near the middle rather than off on its own.
     */
    let anchor: string | undefined;
    let most = 0;
    for (const placed of [...plots.keys()].sort(byId)) {
      const shared = sharedEdges(schema, kind, placed);
      if (shared > most || (shared === most && shared > 0 && anchor !== undefined && byId(placed, anchor) < 0)) {
        most = shared;
        anchor = placed;
      }
    }
    const from = anchor ? plots.get(anchor)! : plots.get(order.find((k) => plots.has(k))!)!;
    let found: { col: number; row: number } | undefined;
    for (let d = 1; !found && d < 64; d++) {
      found = ringAround(from.col, from.row, d).find((cell) => !taken.has(blockKey(cell.col, cell.row)));
    }
    put(kind, found?.col ?? from.col + BLOCK * plots.size, found?.row ?? from.row);
  }
  return plots;
}

/** The roads between placed kinds: one per pair joined by any declared edge. */
export function roadsOf(schema: AnySchema, map: CityMap): readonly Road[] {
  const kinds = [...map.keys()].sort(byId);
  const roads: Road[] = [];
  for (let i = 0; i < kinds.length; i++) {
    for (let j = i + 1; j < kinds.length; j++) {
      const a = kinds[i]!;
      const b = kinds[j]!;
      const edges: string[] = [];
      for (const [from, to] of [
        [a, b],
        [b, a],
      ] as const) {
        const definition = schema.tryDefinition(from);
        for (const [name, declaration] of Object.entries(definition?.edges ?? {})) {
          const targets = declaration.to === "*" ? (schema.kinds as readonly string[]) : (declaration.to as readonly string[]);
          if (targets.includes(to)) edges.push(name);
        }
      }
      if (edges.length > 0) roads.push({ from: a, to: b, edges });
    }
  }
  return roads;
}

/**
 * Two plots overlap when their blocks do — the checker's question about
 * hand-laid plots, asked at the block size so a plot growing to its
 * largest side can never reach a neighbor.
 */
export function plotsOverlap(a: { readonly col: number; readonly row: number }, b: { readonly col: number; readonly row: number }): boolean {
  return Math.abs(a.col - b.col) < BLOCK && Math.abs(a.row - b.row) < BLOCK;
}

/** The map's extent in lattice cells: the smallest box holding every plot at its side. */
export function cityExtent(map: CityMap): { readonly minCol: number; readonly minRow: number; readonly maxCol: number; readonly maxRow: number } {
  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const plot of map.values()) {
    minCol = Math.min(minCol, plot.col);
    minRow = Math.min(minRow, plot.row);
    maxCol = Math.max(maxCol, plot.col + plot.side);
    maxRow = Math.max(maxRow, plot.row + plot.side);
  }
  if (map.size === 0) return { minCol: 0, minRow: 0, maxCol: 1, maxRow: 1 };
  return { minCol, minRow, maxCol, maxRow };
}

/**
 * THE 2:1 LATTICE, as a projection. A cell (col,row) meets the screen at
 * x = (col − row) · w/2, y = (col + row) · h/2 with h = w/2 — the same
 * pitch the ground's CSS draws (lines at ±atan 2), so a plot placed here
 * sits on the grid a person can see.
 */
export function toIso(col: number, row: number, cell: number): { readonly x: number; readonly y: number } {
  return { x: ((col - row) * cell) / 2, y: ((col + row) * cell) / 4 };
}

/*
 * THE VILLAGE ON A PLOT. From altitude a district stands one building per
 * member on its plot's own sub-lattice. Pure arithmetic on the map, so it
 * lives with the map: the scene draws it, and so does a picture of an app
 * drawn without a browser.
 */

/** The most buildings a plot of this side holds: a sub-lattice of side+1 to a side, minus the square in the middle. */
export function villageCap(side: number): number {
  const n = side + 1;
  return n * n - squareCells(n).length;
}

/** The sub-cells of an n×n sub-lattice that make the village square: the middle one, or the middle four; a 2×2 has no room for one. */
function squareCells(n: number): readonly (readonly [number, number])[] {
  if (n < 3) return [];
  if (n % 2 === 1) {
    const mid = (n - 1) / 2;
    return [[mid, mid]];
  }
  const a = n / 2 - 1;
  const b = n / 2;
  return [
    [a, a],
    [b, a],
    [a, b],
    [b, b],
  ];
}

/** A stable number in [0, 1) from an id, so a village is not a barracks and does not reshuffle on every render. */
export function heightOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export interface Building {
  readonly id: string;
  /** The foot, in lattice units from the plot's own corner. */
  readonly col: number;
  readonly row: number;
  /** How wide a building is on the ground, in lattice units. */
  readonly footprint: number;
  /** How tall, as a fraction of its footprint. */
  readonly height: number;
}

/**
 * WHERE THE MEMBERS STAND. One building per member on the plot's own
 * sub-lattice, back to front so the near ones are drawn last; the middle
 * of the plot is the village square, where the nameplate and the kind's
 * landmark stand, so no building is under them. Past the cap the rest are
 * a number on the curb.
 */
export function villageOf(plot: { readonly col: number; readonly row: number; readonly side: number }, memberIds: readonly string[]): { readonly buildings: readonly Building[]; readonly rest: number } {
  const n = plot.side + 1;
  const square = new Set(squareCells(n).map(([c, r]) => `${c},${r}`));
  const pitch = plot.side / n;
  const cells: (readonly [number, number])[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!square.has(`${c},${r}`)) cells.push([c, r]);
  // Back to front: a smaller col+row is further from the viewer on a 2:1 lattice.
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);
  const shown = memberIds.slice(0, cells.length);
  const buildings = shown.map((id, i) => {
    const [c, r] = cells[i]!;
    return {
      id,
      col: plot.col + (c + 0.5) * pitch,
      row: plot.row + (r + 0.5) * pitch,
      footprint: pitch * 0.62,
      height: 0.55 + heightOf(id) * 0.7,
    };
  });
  return { buildings, rest: Math.max(0, memberIds.length - shown.length) };
}
