import type { AnySchema } from "./schema/schema.js";
import type { CityMap, Road, StateTier } from "./city.js";

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/*
 * WHAT STANDS ON THE GROUND: the roads between the plots, and the blocks on
 * each — a module of its own beside the map (`city.ts`), because the scene
 * fetches the ground only when it first rises, and the map is laid out
 * before it does.
 */

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

/** One record's block on its district: where it stands, in lattice cells, and which row. */
export interface Block extends Building {
  /** The row it stands in: the index of its value, or the last row for none. */
  readonly lane: number;
}

/** Records a row had no room for, said as `+n` where the row begins — off the plot's left edge, never under its name. */
export interface LaneRest {
  readonly lane: number;
  readonly count: number;
  readonly col: number;
  readonly row: number;
}

/** How tall a block of each tier stands, as a share of its footprint: done lies flat. */
export const TIER_HEIGHT: Readonly<Record<StateTier, number>> = { done: 0.12, waiting: 0.55, active: 1.05 };

/**
 * THE BLOCKS ON A PLOT, A ROW PER VALUE. `lanes` holds each row's record
 * ids, back row first; the plot is cut into that many rows across its
 * depth, every block the same size so a row's length is its count, at the
 * largest size the fullest row fits — and never smaller than an eighth of
 * the plot, past which a row is cut and the rest counted where it begins.
 */
export function districtBlocks(
  plot: { readonly col: number; readonly row: number; readonly side: number },
  lanes: readonly (readonly string[])[],
  heights: readonly number[] = [],
): { readonly blocks: readonly Block[]; readonly rests: readonly LaneRest[] } {
  const side = plot.side;
  const depth = side / Math.max(1, lanes.length);
  const most = Math.max(1, ...lanes.map((lane) => lane.length));
  let pitch = depth;
  for (let k = 1; depth / k >= side / 8 - 1e-9; k++) {
    pitch = depth / k;
    if (k * Math.floor(side / pitch + 1e-9) >= most) break;
  }
  const deep = Math.max(1, Math.floor(depth / pitch + 1e-9));
  const across = Math.max(1, Math.floor(side / pitch + 1e-9));
  const spread = side / across;
  const blocks: Block[] = [];
  const rests: LaneRest[] = [];
  lanes.forEach((ids, lane) => {
    const shown = ids.slice(0, deep * across);
    shown.forEach((id, n) => {
      blocks.push({
        id,
        lane,
        col: plot.col + ((n % across) + 0.5) * spread,
        row: plot.row + lane * depth + (Math.floor(n / across) + 0.5) * pitch,
        footprint: Math.min(spread, pitch) * 0.66,
        height: heights[lane] ?? TIER_HEIGHT.waiting,
      });
    });
    if (ids.length > shown.length) rests.push({ lane, count: ids.length - shown.length, col: plot.col - 0.15, row: plot.row + (lane + 0.5) * depth });
  });
  // Back to front: a smaller col+row is further from the viewer.
  blocks.sort((a, b) => a.col + a.row - (b.col + b.row) || a.col - b.col);
  return { blocks, rests };
}
