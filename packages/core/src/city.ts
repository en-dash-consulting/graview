import type { AnySchema } from "./schema/schema.js";

import { defOf } from "./schema/zod.js";

/*
 * `@graview/core/city` — the map alone: where each kind stands, how its
 * records are read into rows, and the projection. What the scene lays out
 * before it draws; what stands on the ground (`village.ts`) and a picture
 * of it are `@graview/core/scene`'s, fetched when the ground is drawn.
 */

/**
 * THE CITY IS A MAP DRAWN FROM THE DECLARATION.
 *
 * A kind is a neighborhood, and where it stands is decided by the
 * declaration alone — never by today's data, never by what looks nice.
 * Same declaration, same map; a kind that grows takes a bigger block on
 * the same corner. That is what makes an address an address: the place a
 * person remembers is the place they get.
 *
 * THE MAP READS UPSTREAM TO DOWNSTREAM. A kind whose records point at
 * another's stands after it: a session names its people, a question its
 * session, a finding its question, so People, Sessions, Questions and
 * Findings stand left to right in that order — a topological order of the
 * declared relations, each kind one column past the furthest kind it
 * points at, a cycle broken where the walk meets it. Kinds in one column
 * stand one above the other, near the kinds they point at. A kind tied to
 * no other kind stands in the margin under the rest, so a note pinned to
 * nothing is not put in the middle of the work. Placed in the order the
 * declaration fills its kinds (`beginning(app).order`, or sorted ids when
 * nobody said), so ties break the same way every time; a kind declaring
 * `plot` is put exactly there.
 *
 * Units are LATTICE CELLS on the isometric ground, not pixels. `col` runs
 * down-right along one diagonal, `row` down-left along the other; a plot
 * occupies `side × side` cells from its corner. Plots sit on a block grid
 * one `BLOCK` apart, every other block, so a column of the map is a column
 * on the screen and the street between two plots is wide enough for the
 * name under each. Turned UPRIGHT (`upright`) — for a window taller than it
 * is wide — the same map stands top to bottom instead of left to right.
 */

export interface Plot {
  /** Corner cell, in lattice units. Multiples of BLOCK unless declared. */
  readonly col: number;
  readonly row: number;
  /** Cells on a side: 2, or 3 for a kind of more than four. */
  readonly side: number;
}

/**
 * The most cells a plot takes on a side. Capped low on purpose: a kind of
 * two hundred records once took sixteen times the ground of a kind of one,
 * and the map was that kind. How many is the district's count to say.
 */
export const MAX_SIDE = 3;
/** Block pitch: the largest side plus one cell of street. */
export const BLOCK = MAX_SIDE + 1;

export interface CityHints {
  /** The kind chain a blank installation fills, first to last. */
  readonly order?: readonly string[];
  /** How many of each kind stand today. Changes side, never col or row. */
  readonly counts?: Readonly<Record<string, number>>;
  /** Hand-laid plots, by kind. Used verbatim; a declared `plot` on the kind wins first. */
  readonly plots?: Readonly<Record<string, { readonly col: number; readonly row: number }>>;
  /** Stand the map top to bottom rather than left to right: the same columns, turned for a tall window. */
  readonly upright?: boolean;
}

export type CityMap = ReadonlyMap<string, Plot>;

/** A road: two kinds joined by declared edges, and which edges. */
export interface Road {
  readonly from: string;
  readonly to: string;
  readonly edges: readonly string[];
}

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Cells on a side for a population: 2, and 3 past four. */
export function sideFor(count: number | undefined): number {
  return (count ?? 0) > 4 ? MAX_SIDE : 2;
}

/** The other kinds a kind's declared edges point at. A wildcard edge points at no kind in particular. */
function pointsAt(schema: AnySchema, kind: string, kinds: readonly string[]): string[] {
  const out: string[] = [];
  for (const declaration of Object.values(schema.tryDefinition(kind)?.edges ?? {})) {
    if (declaration.to === "*") continue;
    for (const to of declaration.to as readonly string[]) if (to !== kind && kinds.includes(to) && !out.includes(to)) out.push(to);
  }
  return out;
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

export function cityMap(schema: AnySchema, hints: CityHints = {}): CityMap {
  const kinds = [...(schema.kinds as readonly string[])];
  const order = [
    ...(hints.order ?? []).filter((kind) => kinds.includes(kind)),
    ...kinds.filter((kind) => !(hints.order ?? []).includes(kind)).sort(byId),
  ].filter((kind, index, all) => all.indexOf(kind) === index);
  const rank = (kind: string) => order.indexOf(kind);

  const plots = new Map<string, Plot>();
  const taken: { col: number; row: number }[] = [];
  const put = (kind: string, col: number, row: number) => {
    plots.set(kind, { col, row, side: sideFor(hints.counts?.[kind]) });
    taken.push({ col, row });
  };

  /* HAND-LAID FIRST, verbatim: a declared address is an address. */
  for (const kind of order) {
    const declared = (schema.tryDefinition(kind) as { plot?: { col: number; row: number } } | undefined)?.plot ?? hints.plots?.[kind];
    if (declared) put(kind, declared.col, declared.row);
  }

  /*
   * EACH KIND ONE COLUMN PAST THE FURTHEST KIND IT POINTS AT. A cycle —
   * two kinds pointing at each other — is broken where the walk, in the
   * declaration's order, meets it again.
   */
  const upstream = new Map(order.map((kind) => [kind, pointsAt(schema, kind, kinds)]));
  const linked = new Set(order.filter((kind) => upstream.get(kind)!.length > 0 || order.some((other) => upstream.get(other)!.includes(kind))));
  const column = new Map<string, number>();
  const walking = new Set<string>();
  const columnOf = (kind: string): number => {
    const known = column.get(kind);
    if (known !== undefined) return known;
    if (walking.has(kind)) return -1;
    walking.add(kind);
    let at = 0;
    for (const target of upstream.get(kind)!) at = Math.max(at, columnOf(target) + 1);
    walking.delete(kind);
    column.set(kind, at);
    return at;
  };
  for (const kind of order) if (linked.has(kind)) columnOf(kind);

  /*
   * WITHIN A COLUMN, near what it points at: ordered by where its upstream
   * kinds stand, so the streets between two columns cross as little as
   * they can; then by the declaration's order.
   */
  const columns: string[][] = [];
  for (const kind of order) if (linked.has(kind)) (columns[column.get(kind)!] ??= []).push(kind);
  const slot = new Map<string, number>();
  /*
   * A column of the map is a column on the screen — two blocks across from
   * the next — and the kinds of one column stand one block apart down it,
   * on every other block of the lattice, so a street runs round each.
   * Turned upright, the same with the axes swapped.
   */
  const at = (i: number, j: number) => (hints.upright ? { col: (i + j) * BLOCK, row: (i - j) * BLOCK } : { col: (i + j) * BLOCK, row: (j - i) * BLOCK });
  const free = (cell: { col: number; row: number }) => !taken.some((other) => plotsOverlap(other, cell));
  const place = (kind: string, i: number, from: number): number => {
    let j = from;
    while (!free(at(i, j)) && j < from + 64) j++;
    if (!plots.has(kind)) put(kind, at(i, j).col, at(i, j).row);
    return j;
  };
  let deepest = 0;
  columns.forEach((list = [], i) => {
    const mean = (kind: string) => {
      const near = upstream.get(kind)!.map((target) => slot.get(target)).filter((j): j is number => j !== undefined);
      return near.length > 0 ? near.reduce((a, b) => a + b, 0) / near.length : Infinity;
    };
    const sorted = [...list].sort((a, b) => mean(a) - mean(b) || rank(a) - rank(b));
    let j = 0;
    for (const kind of sorted) {
      if (plots.has(kind)) continue;
      j = place(kind, i, j);
      slot.set(kind, j);
      deepest = Math.max(deepest, j + 1);
      j++;
    }
  });
  /*
   * THE MARGIN: kinds tied to nothing, under the map and a row apart from
   * it — rows under its columns when it reads left to right, rows after its
   * last when it reads top to bottom — as wide as the map is.
   */
  const loose = order.filter((kind) => !linked.has(kind) && !plots.has(kind));
  const across = Math.max(hints.upright ? deepest : columns.length, Math.ceil(Math.sqrt(loose.length * 2)), 1);
  const apart = linked.size > 0 ? 1 : 0;
  loose.forEach((kind, n) => {
    if (hints.upright) place(kind, columns.length + apart + Math.floor(n / across), n % across);
    else place(kind, n % across, deepest + apart + Math.floor(n / across));
  });
  return plots;
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
 * sits on the grid a person can see. `tilt` is h/w: a half is the city
 * seen at an angle, one is the same ground seen from straight above.
 */
export function toIso(col: number, row: number, cell: number, tilt = 0.5): { readonly x: number; readonly y: number } {
  return { x: ((col - row) * cell) / 2, y: ((col + row) * cell * tilt) / 2 };
}

/** The tilt the city is seen at by default; from straight above (`TOP_DOWN`) on a person's asking. */
export const TILTED = 0.5;
export const TOP_DOWN = 1;

/*
 * THE STATE A DISTRICT SHOWS. Every block in a district was the same cube,
 * so thirty-one cubes said only "31". A kind's main choice field — its
 * lifecycle's field, else a choice called status, stage, state or phase —
 * stands its records in rows, one per value in the declared order, and
 * each value is read as waiting, active or done: done lies flat and quiet,
 * active stands tallest. Read from the declaration alone, so the map, the
 * district's bar and a test agree.
 */

/** How a value of a kind's main choice reads on the map. */
export type StateTier = "waiting" | "active" | "done";

export interface DistrictState {
  /** The choice field the rows are read from. */
  readonly field: string;
  /** Its values, in declared order: one row each. */
  readonly values: readonly string[];
  /** How each value reads, in the same order. */
  readonly tiers: readonly StateTier[];
}

const DONE = /^(done|completed?|closed|finished|shipped|sent|won|lost|passed|declined|dropped|answered|resolved|fixed|archived|cancell?ed|retired|released|published|delivered|paid|merged|rejected|written[-_ ]?up|out)$/i;
const ACTIVE = /^(doing|in[-_ ]?progress|active|building|started|working|in[-_ ]?review|review(ing)?|fixing|ongoing|underway|testing|drafting|writing|running)$/i;

/** The values of an enum field, through optional, default and nullable; undefined when it is not one. */
function enumValues(schema: AnySchema, kind: string, field: string): readonly string[] | undefined {
  let def = defOf((schema.tryDefinition(kind)?.fields.shape as Record<string, unknown> | undefined)?.[field]);
  while (def && def.innerType !== undefined && def.type !== "enum") def = defOf(def.innerType);
  if (def?.type !== "enum") return undefined;
  const values = (def.entries ? Object.values(def.entries) : (def.values ?? [])).filter((value): value is string => typeof value === "string");
  return values.length > 0 ? values : undefined;
}

/** A kind's main choice field and how each of its values reads; undefined when the kind has none. */
export function districtState(schema: AnySchema, kind: string): DistrictState | undefined {
  const definition = schema.tryDefinition(kind);
  if (!definition) return undefined;
  const lifecycle = definition.lifecycle;
  const fields = Object.keys((definition.fields.shape ?? {}) as Record<string, unknown>);
  const field = [lifecycle?.field, ...fields.filter((name) => /^(status|stage|state|phase)$/i.test(name))].find(
    (name): name is string => name !== undefined && enumValues(schema, kind, name) !== undefined,
  );
  if (!field) return undefined;
  const values = enumValues(schema, kind, field)!;
  const retired = lifecycle?.field === field && Array.isArray(lifecycle.retired) ? lifecycle.retired : [];
  return { field, values, tiers: values.map((value) => (retired.includes(value) || DONE.test(value) ? "done" : ACTIVE.test(value) ? "active" : "waiting")) };
}
