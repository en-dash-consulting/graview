import type { GraviewApp } from "../app.js";
import { toIso, villageCap, villageOf } from "../city.js";
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
 * placed by the same `villageOf` the Scene's village uses.
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
   * How many of each kind stand today, from a snapshot. A district with
   * members draws its village, one building each up to what the plot holds;
   * one without draws a single block. Counts move a plot's size, never its
   * corner, exactly as in the Scene.
   */
  readonly counts?: Readonly<Record<string, number>>;
  /** Fill the picture with the scheme's ground. Default true; false leaves it transparent for a host's own surface. */
  readonly background?: boolean;
  /** The accessible name. Default: the app's name and what it holds. */
  readonly title?: string;
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
  const at = (c: number, r: number, lift = 0): Point => {
    const p = toIso(c, r, CELL);
    return { x: p.x, y: p.y - lift };
  };
  const back = at(col - half, row - half, rise);
  const right = at(col + half, row - half, rise);
  const front = at(col + half, row + half, rise);
  const left = at(col - half, row + half, rise);
  const frontFoot = at(col + half, row + half);
  const leftFoot = at(col - half, row + half);
  const rightFoot = at(col + half, row - half);
  const edge = coloursIn(shade.roofEdge)[0]!;
  return {
    svg:
      `<polygon fill="${face(hue, shade.left)}" points="${points([left, front, frontFoot, leftFoot])}"/>` +
      `<polygon fill="${face(hue, shade.right)}" points="${points([front, right, rightFoot, frontFoot])}"/>` +
      `<polygon fill="${face(hue, shade.roof)}" stroke="${hex(edge)}" points="${points([back, right, front, left])}"/>`,
    reach: [back, right, left, frontFoot, leftFoot, rightFoot],
  };
}

interface Standing {
  readonly depth: number;
  readonly svg: string;
  readonly reach: readonly Point[];
}

/*
 * HOW MUCH VILLAGE A THUMBNAIL CAN SHOW. The Scene stands one building per
 * member; at a card's size a big app's buildings are a pixel across and
 * hundreds of them are only bytes. So a village is drawn while a building
 * is still a few pixels wide and the picture holds at most this many; past
 * either, each populated district stands as one block, taller for more —
 * the same district on the same plot, seen from further away.
 */
const VILLAGE_MIN_PX = 4;
const MOST_BUILDINGS = 160;

/** What stands on one district: its village when it has members and room to show them, else one block for the district itself. */
function standing(district: SceneDistrict, scheme: Scheme, village: boolean): Standing[] {
  const { plot, hue, kind, count } = district;
  if (count > 0 && village) {
    const shown = Math.min(count, villageCap(plot.side));
    // Ids for the members are the kind and an ordinal: a snapshot's counts carry no ids, and the same count must draw the same village.
    const { buildings } = villageOf(plot, Array.from({ length: shown }, (_, i) => `${kind}#${i}`));
    return buildings.map((b) => ({ depth: b.col + b.row, ...block(b.col, b.row, b.footprint, b.height, hue, scheme) }));
  }
  const centre = { col: plot.col + plot.side / 2, row: plot.row + plot.side / 2 };
  const height = 1.25 + Math.min(1.25, Math.log2(1 + count) * 0.2);
  return [{ depth: centre.col + centre.row, ...block(centre.col, centre.row, plot.side * 0.56, height, hue, scheme) }];
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

  /* The plots first, then everything standing on them back to front, so a near block is drawn over a far one. */
  const tiles: string[] = [];
  const all: Point[] = [];
  for (const district of districts) {
    const { plot, hue } = district;
    const corners = [toIso(plot.col, plot.row, CELL), toIso(plot.col + plot.side, plot.row, CELL), toIso(plot.col + plot.side, plot.row + plot.side, CELL), toIso(plot.col, plot.row + plot.side, CELL)];
    all.push(...corners);
    const fill = hsl(hue, shade.plot.saturation / 100, shade.plot.lightness / 100);
    const kerb = hsl(hue, shade.plotEdge.saturation / 100, shade.plotEdge.lightness / 100);
    tiles.push(
      `<g data-kind="${escapeSvg(district.kind)}"><title>${escapeSvg(district.count > 0 ? `${district.label}: ${district.count}` : district.label)}</title>` +
        `<polygon fill="${hex(fill)}" stroke="${hex(kerb)}" points="${points(corners)}"/></g>`,
    );
  }
  /* Whether the villages are drawn: a building a few pixels wide at the scale the plots alone are fitted at, and not too many of them. */
  const ground0 = bounds(all);
  const scale = Math.min(width / (ground0.maxX - ground0.minX + CELL * 1.2), height / (ground0.maxY - ground0.minY + CELL * 1.8));
  const buildings = districts.reduce((sum, d) => sum + Math.min(d.count, villageCap(d.plot.side)), 0);
  const smallest = Math.min(Infinity, ...districts.filter((d) => d.count > 0).map((d) => (d.plot.side / (d.plot.side + 1)) * 0.62 * CELL * scale));
  const village = buildings <= MOST_BUILDINGS && smallest >= VILLAGE_MIN_PX;
  const stands: Standing[] = districts.flatMap((district) => standing(district, scheme, village));
  for (const one of stands) all.push(...one.reach);
  stands.sort((a, b) => a.depth - b.depth);

  /* The view box is the drawing's own bounds with air around it; an empty app is one cell of ground. */
  const box = bounds(all);
  const pad = CELL * 0.6;
  let minX = box.minX - pad;
  let maxX = box.maxX + pad;
  let minY = box.minY - pad;
  let maxY = box.maxY + pad;
  // Widen the shorter side so the box has the picture's own proportion: the city is centred, never stretched.
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
