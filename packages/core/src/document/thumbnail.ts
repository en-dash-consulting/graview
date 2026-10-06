import type { GraviewApp } from "../app.js";
import { heightOf, MAX_SIDE, toIso, villageCap, villageOf, type Plot } from "../city.js";
import { sceneDistricts, type SceneDistrict } from "../scene-districts.js";
import { coloursIn, hsl, type Rgba } from "../theme/contrast.js";
import { isoShade, type IsoFace } from "../theme/look.js";
import { SCHEMES } from "../theme/palettes.js";
import type { Scheme } from "../theme/types.js";
import { compileDocumentWithoutCheck } from "./compile.js";
import type { GraviewDocument } from "./schema.js";

/*
 * A PICTURE OF AN APP WITHOUT A BROWSER (FR-74).
 *
 * A host listing apps — a dashboard of a tenant's apps, a gallery, a
 * search result — wants each one to look like itself, and the only thing
 * that drew an app was the live Scene, which needs a DOM. This draws the
 * Scene from altitude as one SVG string, from the declaration alone: each
 * kind's plot where the Scene puts it (`sceneDistricts`, the same map, walk
 * and hue), in the Scene's own lighting (`isoShade`), standing a block for
 * the district, or one building per member when a host passes counts —
 * the village `sceneDistricts` stands, placed by the same `villageOf` the
 * Scene's plots use, on a plot sized by the same count (FR-103).
 *
 * It is pure: no DOM, no React, no clock, no randomness. The same document
 * and options give the same bytes, in Node, a worker or a page.
 *
 * Everything from the document is a tenant's words, so every one is
 * escaped, the picture refers to nothing outside itself (no `href`, no
 * `url()`, no font), and every colour is written as a hex the code
 * computed rather than a value it was handed.
 */

export interface SceneThumbnailOptions {
  /** Which lighting: the Scene's daylight or its night. Default `"light"`. */
  readonly scheme?: Scheme;
  /** The picture's size in CSS pixels. Default 264 × 132 — a card tile, 2:1. */
  readonly width?: number;
  readonly height?: number;
  /**
   * How many of each kind stand today, from a snapshot. Each district is
   * sized as the live Scene sizes it (FR-103): its plot's side from its
   * count, and its village, one building per member up to what the plot
   * holds, where the Scene's plots stand them. One without members draws a
   * single block. Counts move a plot's size, never its corner.
   */
  readonly counts?: Readonly<Record<string, number>>;
  /** Fill the picture with the scheme's ground. Default true; false leaves it transparent for a host's own surface. */
  readonly background?: boolean;
  /** The accessible name. Default: the app's name and what it holds. */
  readonly title?: string;
  /**
   * What the picture is fitted to (FR-107). `"map"`, the default, is the
   * Scene's map as it stands: each plot the size its count gives it, the
   * streets between at their width — faithful, and at a card's size mostly
   * ground. `"content"` is what stands, for a tile: each district fills its
   * whole block on the same corner (the most its plot grows to), the
   * picture is cropped to the plots and their buildings with a narrow
   * margin, and each district stands a few blocks it can show at this size
   * rather than one speck per record (see `minBuilding`). The corners, the
   * iso lattice, the order and the hues are the Scene's in both.
   */
  readonly fit?: "map" | "content";
  /**
   * The narrowest a building's roof may be drawn, in the picture's own
   * pixels. A district whose buildings would be narrower stands fewer,
   * larger ones. Fitted to the map (default 4) that is its village, one
   * building per member, else one block for the district. Fitted to the
   * content (default 16) it is its village when the picture is big enough,
   * else one block per member up to five, taller for more, else one block.
   */
  readonly minBuilding?: number;
}

/** What the thumbnail can be drawn from: a declaration document (an object or its JSON), or an app already compiled or declared. */
export type ThumbnailSource = GraviewDocument | GraviewApp | string;

const CELL = 40;
const fmt = (n: number): string => {
  const fixed = n.toFixed(1);
  // One decimal, and none when it is a whole number: a big app's picture is mostly coordinates.
  const short = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
  return short === "-0" ? "0" : short;
};
const points = (list: readonly { x: number; y: number }[]): string => list.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(" ");

/** Text for an SVG text node or attribute: every character that could end one or open markup, escaped. */
function escapeSvg(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const hex = (c: Rgba): string => `#${[c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const face = (hue: number, f: IsoFace): string => hex(hsl(hue, f.saturation / 100, f.lightness / 100));
const alpha = (a: number): string => String(Math.round(a * 1000) / 1000);

/** The first few labels, and how many more: an accessible name is a sentence, not an inventory. */
const named = (labels: readonly string[], most = 6): string =>
  labels.length <= most ? labels.join(", ") : `${labels.slice(0, most).join(", ")} and ${labels.length - most} more`;

function appOf(source: ThumbnailSource): GraviewApp | null {
  if (typeof source === "object" && source !== null && "schema" in source && typeof (source as GraviewApp).schema?.tryDefinition === "function") return source as GraviewApp;
  const compiled = compileDocumentWithoutCheck(source);
  return compiled.ok ? compiled.app : null;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** One block on the ground: three faces from its foot's centre in lattice cells, and every point it reaches (for the view box). */
function block(col: number, row: number, footprint: number, height: number, hue: number, scheme: Scheme): { readonly svg: string; readonly reach: readonly Point[] } {
  const shade = isoShade(scheme);
  const half = footprint / 2;
  const rise = footprint * CELL * 0.5 * height;
  /*
   * Whole units, a fortieth of a cell: under a third of a pixel at the
   * smallest scale a village is drawn at, and half the bytes of a tenth.
   * Rounded before the faces are written, so each face closes exactly.
   */
  const at = (c: number, r: number, lift = 0): Point => {
    const p = toIso(c, r, CELL);
    return { x: Math.round(p.x), y: Math.round(p.y - lift) };
  };
  const back = at(col - half, row - half, rise);
  const right = at(col + half, row - half, rise);
  const front = at(col + half, row + half, rise);
  const left = at(col - half, row + half, rise);
  const edge = coloursIn(shade.roofEdge)[0]!;
  /*
   * Each face a path from one corner, the rest relative: a wall is two
   * corners of the roof and the drop to the ground, a roof the diamond.
   * A village is hundreds of these, so a corner is written once.
   */
  const to = (a: Point, b: Point) => `${fmt(b.x - a.x)} ${fmt(b.y - a.y)}`;
  const from = (p: Point) => `M${fmt(p.x)} ${fmt(p.y)}`;
  const fall = Math.round(rise);
  const drop = `v${fall}`;
  return {
    svg:
      `<path fill="${face(hue, shade.left)}" d="${from(left)}l${to(left, front)}${drop}l${to(front, left)}z"/>` +
      `<path fill="${face(hue, shade.right)}" d="${from(front)}l${to(front, right)}${drop}l${to(right, front)}z"/>` +
      `<path fill="${face(hue, shade.roof)}" stroke="${hex(edge)}" d="${from(back)}l${to(back, right)}l${to(right, front)}l${to(front, left)}z"/>`,
    reach: [back, right, left, { x: front.x, y: front.y + fall }, { x: left.x, y: left.y + fall }, { x: right.x, y: right.y + fall }],
  };
}

interface Standing {
  readonly depth: number;
  readonly svg: string;
  readonly reach: readonly Point[];
}

/*
 * HOW MUCH VILLAGE A THUMBNAIL CAN SHOW. The Scene stands one building per
 * member, and so does the picture, while a building is still a few pixels
 * wide and the picture holds at most this many: twelve districts each as
 * full as a plot holds (12 × 24), in about 50 KB. Past either, each
 * populated district stands as one block, taller for more — the same
 * district on the same plot, seen from further away.
 */
const VILLAGE_MIN_PX = 4;
const MOST_BUILDINGS = 300;

/** One block for the district itself, at its plot's centre, taller for more members: the district seen from furthest away. */
function landmark(plot: Plot, district: SceneDistrict, scheme: Scheme): Standing {
  const centre = { col: plot.col + plot.side / 2, row: plot.row + plot.side / 2 };
  const height = 1.25 + Math.min(1.25, Math.log2(1 + district.count) * 0.2);
  return { depth: centre.col + centre.row, ...block(centre.col, centre.row, plot.side * 0.56, height, district.hue, scheme) };
}

/** What stands on one district: its village when it has members and room to show them, else one block for the district itself. */
function standing(district: SceneDistrict, scheme: Scheme, village: boolean): Standing[] {
  const { hue, count } = district;
  if (count > 0 && village) {
    return district.village.map((b) => ({ depth: b.col + b.row, ...block(b.col, b.row, b.footprint, b.height, hue, scheme) }));
  }
  return [landmark(district.plot, district, scheme)];
}

/*
 * FITTED TO WHAT STANDS (FR-107). At a card's size a plot one or two cells
 * on a side, five cells from the next, is a speck, and a building per
 * record on it is a speck on a speck. So a fitted picture stands each
 * district on its whole block — the most its plot grows to, from the same
 * corner — and stands on it what can be seen at this size, the first rung
 * whose every roof is at least `minBuilding` pixels wide:
 *
 *   village  the Scene's own, one building per member on the whole block,
 *            when the picture is big enough (members past five only);
 *   few      one block per member up to five, on the block's three-by-three
 *            sub-lattice, spread across it, taller for more past five;
 *   one      one block for the district, as the faithful picture's fallback.
 */
const FEW = 5;
/** A building on a card-sized tile reads as a building from about here: Cloud's own tile art stands blocks 20–30 px wide. */
const FITTED_MIN_PX = 16;
/*
 * Where one to five blocks stand on a three-by-three sub-lattice of the
 * block. The back corner (0,0), the middle and the front corner (2,2) are
 * one above another on the screen, so two blocks stand side by side at the
 * left and right corners rather than in a column, and more fill the corners
 * before the middle.
 */
const FEW_CELLS: readonly (readonly (readonly [number, number])[])[] = [
  [[1, 1]],
  [
    [2, 0],
    [0, 2],
  ],
  [
    [0, 0],
    [2, 0],
    [0, 2],
  ],
  [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
];
type Rung = "village" | "few" | "one";

/** The district on its whole block: the same corner, the largest side. */
const wholeBlock = (plot: Plot): Plot => ({ col: plot.col, row: plot.row, side: MAX_SIDE });

function standingFitted(district: SceneDistrict, scheme: Scheme, rung: Rung): { readonly stands: Standing[]; readonly narrowest: number } {
  const plot = wholeBlock(district.plot);
  const { hue, count, kind } = district;
  if (rung === "village" && count > FEW) {
    const { buildings } = villageOf(plot, Array.from({ length: Math.min(count, villageCap(plot.side)) }, (_, i) => `${kind}#${i}`));
    return { stands: buildings.map((b) => ({ depth: b.col + b.row, ...block(b.col, b.row, b.footprint, b.height, hue, scheme) })), narrowest: buildings[0]?.footprint ?? Infinity };
  }
  if (rung === "one") {
    const one = landmark(plot, district, scheme);
    return { stands: [one], narrowest: plot.side * 0.56 };
  }
  const pitch = plot.side / 3;
  const footprint = pitch * 0.8;
  // Past five, the five grow taller with the count, as the one block does.
  const taller = count > FEW ? Math.min(0.8, Math.log2(count / FEW) * 0.25) : 0;
  const stands = FEW_CELLS[Math.max(1, Math.min(FEW, count)) - 1]!.map(([c, r], i) => {
    const col = plot.col + (c + 0.5) * pitch;
    const row = plot.row + (r + 0.5) * pitch;
    const height = count === 0 ? 0.6 : 0.7 + heightOf(`${kind}#${i}`) * 0.6 + taller;
    return { depth: col + row, ...block(col, row, footprint, height, hue, scheme) };
  });
  return { stands, narrowest: footprint };
}

/** The view box: the drawing's own bounds with `pad` of air, widened on its shorter side to the picture's proportion so the city is centred, never stretched. */
function frame(all: readonly Point[], pad: number, width: number, height: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const box = bounds(all);
  let minX = box.minX - pad;
  let maxX = box.maxX + pad;
  let minY = box.minY - pad;
  let maxY = box.maxY + pad;
  const want = width / height;
  if ((maxX - minX) / (maxY - minY) < want) {
    const grow = ((maxY - minY) * want - (maxX - minX)) / 2;
    minX -= grow;
    maxX += grow;
  } else {
    const grow = ((maxX - minX) / want - (maxY - minY)) / 2;
    minY -= grow;
    maxY += grow;
  }
  return { minX, maxX, minY, maxY };
}

/** The box that holds every point, or one cell of ground when there are none. */
function bounds(all: readonly Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
  if (all.length === 0) return { minX: -CELL, maxX: CELL, minY: -CELL / 2, maxY: CELL / 2 };
  return {
    minX: Math.min(...all.map((p) => p.x)),
    maxX: Math.max(...all.map((p) => p.x)),
    minY: Math.min(...all.map((p) => p.y)),
    maxY: Math.max(...all.map((p) => p.y)),
  };
}

/**
 * The Scene of an app from altitude, as a standalone SVG string: each
 * kind's plot on the declaration's own map in its hue, with a block or its
 * village standing on it, lit as the Scene lights it.
 *
 * `source` is a `graview-document@1` document (or its JSON), or a
 * `GraviewApp`. A document that does not compile draws the empty ground,
 * with a title that says so, rather than throwing on a host's listing page.
 */
export function sceneThumbnail(source: ThumbnailSource, options: SceneThumbnailOptions = {}): string {
  const scheme: Scheme = options.scheme === "dark" ? "dark" : "light";
  const width = Math.max(16, Math.round(options.width ?? 264));
  const height = Math.max(8, Math.round(options.height ?? 132));
  const app = appOf(source);
  const districts = app ? sceneDistricts(app, options.counts ? { counts: options.counts } : {}) : [];
  const shade = isoShade(scheme);
  const tokens = (app?.brand?.schemes ?? SCHEMES)[scheme] ?? SCHEMES[scheme];
  const ground = coloursIn(tokens.ground)[0] ?? coloursIn(SCHEMES[scheme].ground)[0]!;
  const roofEdge = coloursIn(shade.roofEdge)[0]!;

  const fitted = options.fit === "content";
  const given = options.minBuilding;
  const minBuilding = typeof given === "number" && Number.isFinite(given) && given >= 0 ? given : fitted ? FITTED_MIN_PX : VILLAGE_MIN_PX;

  /* The plots first, then everything standing on them back to front, so a near block is drawn over a far one. */
  const tiles: string[] = [];
  const all: Point[] = [];
  for (const district of districts) {
    const { hue } = district;
    const plot = fitted ? wholeBlock(district.plot) : district.plot;
    const corners = [toIso(plot.col, plot.row, CELL), toIso(plot.col + plot.side, plot.row, CELL), toIso(plot.col + plot.side, plot.row + plot.side, CELL), toIso(plot.col, plot.row + plot.side, CELL)];
    all.push(...corners);
    const fill = hsl(hue, shade.plot.saturation / 100, shade.plot.lightness / 100);
    const kerb = hsl(hue, shade.plotEdge.saturation / 100, shade.plotEdge.lightness / 100);
    tiles.push(
      `<g data-kind="${escapeSvg(district.kind)}"><title>${escapeSvg(district.count > 0 ? `${district.label}: ${district.count}` : district.label)}</title>` +
        `<polygon fill="${hex(fill)}" stroke="${hex(kerb)}" points="${points(corners)}"/></g>`,
    );
  }
  let stands: Standing[] = [];
  let view: ReturnType<typeof frame> | undefined;
  if (fitted) {
    /*
     * The first rung whose narrowest roof is minBuilding wide at the scale
     * the finished picture is drawn at — plots, buildings and a narrow
     * margin — and not more buildings than a picture holds.
     */
    const pad = CELL * 0.4;
    const rungs: readonly Rung[] = ["village", "few", "one"];
    for (const rung of rungs) {
      const drawn = districts.map((district) => standingFitted(district, scheme, rung));
      stands = drawn.flatMap((d) => d.stands);
      view = frame([...all, ...stands.flatMap((s) => s.reach)], pad, width, height);
      const scale = width / (view.maxX - view.minX);
      // Less the unit a corner can lose to rounding: a block's corners are written in whole units.
      const narrowest = (Math.min(Infinity, ...drawn.map((d) => d.narrowest)) * CELL - 1) * scale;
      if (rung === "one" || (narrowest >= minBuilding && stands.length <= MOST_BUILDINGS)) break;
    }
  } else {
    /* Whether the villages are drawn: a building a few pixels wide at the scale the plots alone are fitted at, and not too many of them. */
    const ground0 = bounds(all);
    const scale = Math.min(width / (ground0.maxX - ground0.minX + CELL * 1.2), height / (ground0.maxY - ground0.minY + CELL * 1.8));
    const buildings = districts.reduce((sum, d) => sum + d.village.length, 0);
    const smallest = Math.min(Infinity, ...districts.filter((d) => d.count > 0).map((d) => (d.plot.side / (d.plot.side + 1)) * 0.62 * CELL * scale));
    const village = buildings <= MOST_BUILDINGS && smallest >= minBuilding;
    stands = districts.flatMap((district) => standing(district, scheme, village));
    /* The view box is the drawing's own bounds with air around it; an empty app is one cell of ground. */
    view = frame([...all, ...stands.flatMap((s) => s.reach)], CELL * 0.6, width, height);
  }
  stands.sort((a, b) => a.depth - b.depth);
  const { minX, maxX, minY, maxY } = view ?? frame(all, CELL * 0.6, width, height);
  const viewBox = `${fmt(minX)} ${fmt(minY)} ${fmt(maxX - minX)} ${fmt(maxY - minY)}`;

  const name = app?.name ?? (typeof source === "object" && source !== null && typeof (source as { name?: unknown }).name === "string" ? (source as { name: string }).name : "An app");
  const title =
    options.title ??
    (app
      ? districts.length === 0
        ? `${name}: no kinds yet`
        : `${name}: ${districts.length === 1 ? "one kind" : `${districts.length} kinds`}, ${named(districts.map((d) => d.label))}`
      : `${name}: this declaration does not compile, so there is nothing to draw`);
  const background = options.background === false ? "" : `<rect x="${fmt(minX)}" y="${fmt(minY)}" width="${fmt(maxX - minX)}" height="${fmt(maxY - minY)}" fill="${hex(ground)}"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img" data-scheme="${scheme}">` +
    `<title>${escapeSvg(title)}</title>` +
    background +
    // What every plot and every roof share is said once, on the group: only a roof is stroked among the blocks.
    `<g fill-opacity="${alpha(shade.plot.alpha)}" stroke-opacity="${alpha(shade.plotEdge.alpha)}" stroke-linejoin="round">${tiles.join("")}</g>` +
    `<g stroke-opacity="${alpha(roofEdge.a)}" stroke-linejoin="round">${stands.map((s) => s.svg).join("")}</g>` +
    `</svg>`
  );
}
