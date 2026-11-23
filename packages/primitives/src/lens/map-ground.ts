import { labelOf, type AnySchema, type Geo, type MapCoordinates } from "@graview/core";
import { mapPointOf } from "@graview/core/describe";

/*
 * THE MAP'S GROUND, AS GEOMETRY (Graview HQ feature:f-map-lens).
 *
 * The projection is Web Mercator, the one every street map's tiles are cut
 * in, so a host's tiles lie under the pins exactly; nothing is bent to fit.
 * The frame is the pins' own bounds, widened — never stretched — to the
 * shape the picture has room for, so a degree east is as long on the map as
 * the projection says it is. Lines of latitude and longitude are drawn at a
 * round step in degrees, said at their edge. Nothing here reads a page.
 */

/** One record on the map: where it is, and where that falls in the frame (0 to 1 across, 0 to 1 down). */
export interface MapPin {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
  readonly x: number;
  readonly y: number;
}

/** A part of the world in Web Mercator's units: 0 to 1 across from 180° W, 0 to 1 down from about 85° N. */
export interface MapFrame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The latitude Web Mercator reaches: past it a square world has no room. */
const MOST_LATITUDE = 85.05112878;

/** Where a point falls on the world, 0 to 1 each way. */
export function mercator(lat: number, lng: number): { readonly x: number; readonly y: number } {
  const φ = (Math.max(-MOST_LATITUDE, Math.min(MOST_LATITUDE, lat)) * Math.PI) / 180;
  return { x: (lng + 180) / 360, y: (1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2 };
}

/** The latitude at a height of the world, 0 to 1 down. */
export const latitudeAt = (y: number): number => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

/** The longitude at a width of the world, 0 to 1 across. */
export const longitudeAt = (x: number): number => x * 360 - 180;

/** The least the frame spans, about two kilometers at the equator: one pin, or several at one door, still stands on some ground. */
const LEAST_SPAN = 0.02 / 360;
/** The ground left around the outermost pins, a share of what they span on each side. */
const MARGIN = 0.12;

/**
 * THE FRAME THAT HOLDS EVERY PIN, at `aspect` (width over height): their
 * bounds, a margin around them, then widened on the narrower side until it
 * has the picture's shape. Undefined with no pins to hold.
 */
export function frameOf(points: readonly { readonly lat: number; readonly lng: number }[], aspect: number): MapFrame | undefined {
  if (points.length === 0) return undefined;
  const at = points.map((one) => mercator(one.lat, one.lng));
  const xs = at.map((one) => one.x);
  const ys = at.map((one) => one.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  let width = Math.max(Math.max(...xs) - minX, LEAST_SPAN);
  let height = Math.max(Math.max(...ys) - minY, LEAST_SPAN);
  const middle = { x: minX + (Math.max(...xs) - minX) / 2, y: minY + (Math.max(...ys) - minY) / 2 };
  width *= 1 + 2 * MARGIN;
  height *= 1 + 2 * MARGIN;
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;
  return { left: middle.x - width / 2, top: middle.y - height / 2, width, height };
}

/** Where a point falls in a frame: 0 to 1 across, 0 to 1 down. */
export function inFrame(frame: MapFrame, lat: number, lng: number): { readonly x: number; readonly y: number } {
  const at = mercator(lat, lng);
  return { x: (at.x - frame.left) / frame.width, y: (at.y - frame.top) / frame.height };
}

/** The steps a line of latitude or longitude is drawn at, in degrees. */
const STEPS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 45, 90];

/** One line of the graticule: its degrees, where it falls in the frame (0 to 1), and how it is said ("51.5° N"). */
export interface GraticuleLine {
  readonly degrees: number;
  readonly at: number;
  readonly said: string;
}

/** A line's degrees in words, to as many places as its step has: "0.25° W", "51° N", "0°". */
function degreesSaid(value: number, step: number, positive: string, negative: string): string {
  const places = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  const rounded = Number(Math.abs(value).toFixed(places));
  return rounded === 0 ? "0°" : `${rounded.toFixed(places)}° ${value > 0 ? positive : negative}`;
}

/**
 * THE GRATICULE OVER A FRAME: meridians and parallels at the roundest step
 * that draws between two and six of each, each said in degrees. In Web
 * Mercator a meridian is upright and a parallel level, so each is a line
 * straight across the frame.
 */
export function graticuleOf(frame: MapFrame): { readonly step: number; readonly meridians: readonly GraticuleLine[]; readonly parallels: readonly GraticuleLine[] } {
  const west = longitudeAt(frame.left);
  const east = longitudeAt(frame.left + frame.width);
  const north = latitudeAt(frame.top);
  const south = latitudeAt(frame.top + frame.height);
  // The roundest step that still draws two lines across the frame's shorter side.
  const span = Math.min(east - west, north - south);
  const step = STEPS.find((one) => span / one <= 3) ?? 90;
  const lines = (from: number, to: number, place: (degrees: number) => number, said: (degrees: number) => string): GraticuleLine[] => {
    const out: GraticuleLine[] = [];
    for (let n = Math.ceil(from / step); n * step <= to + 1e-12; n++) {
      const degrees = Number((n * step).toFixed(6));
      const at = place(degrees);
      if (at > 0.02 && at < 0.98) out.push({ degrees, at, said: said(degrees) });
    }
    return out;
  };
  return {
    step,
    meridians: lines(west, east, (lng) => (mercator(0, lng).x - frame.left) / frame.width, (lng) => degreesSaid(((((lng + 180) % 360) + 360) % 360) - 180, step, "E", "W")),
    parallels: lines(south, north, (lat) => (mercator(lat, 0).y - frame.top) / frame.height, (lat) => degreesSaid(lat, step, "N", "S")),
  };
}

/** Where a host's tiles come from: an address with `{z}`, `{x}` and `{y}` in it, cut in Web Mercator, and the words owed to whoever drew them. */
export interface MapTiles {
  readonly url: string;
  readonly attribution?: string;
  /** Each tile's side in pixels: 256 unless said. */
  readonly size?: number;
  /** The closest zoom the source has: 19 unless said. */
  readonly most?: number;
}

/** One tile laid in a frame: its address, and its box in the frame's shares (0 to 1). */
export interface LaidTile {
  readonly href: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The most tiles one map lays, whatever its size: past it the picture asks for more than any screen shows. */
const MOST_TILES = 64;

/**
 * THE TILES THAT COVER A FRAME drawn `pixels` wide: the zoom at which a
 * tile is about its own size on the screen, and each tile from the frame's
 * west edge to its east and its north to its south.
 */
export function tilesFor(frame: MapFrame, pixels: number, tiles: MapTiles): readonly LaidTile[] {
  const size = tiles.size ?? 256;
  const span = (z: number) => {
    const n = 2 ** z;
    const first = { x: Math.floor(frame.left * n), y: Math.max(0, Math.floor(frame.top * n)) };
    const last = { x: Math.floor((frame.left + frame.width) * n), y: Math.min(n - 1, Math.floor((frame.top + frame.height) * n)) };
    return { n, first, last, count: (last.x - first.x + 1) * (last.y - first.y + 1) };
  };
  // The zoom at which a tile is about its own size, coarsened until the frame takes no more tiles than a screen shows.
  let z = Math.max(0, Math.min(tiles.most ?? 19, Math.round(Math.log2(pixels / (frame.width * size)))));
  while (z > 0 && span(z).count > MOST_TILES) z--;
  const { n, first, last } = span(z);
  const out: LaidTile[] = [];
  for (let ty = first.y; ty <= last.y; ty++) {
    for (let tx = first.x; tx <= last.x; tx++) {
      if (out.length >= MOST_TILES) return out;
      const wrapped = ((tx % n) + n) % n;
      out.push({
        href: tiles.url.replaceAll("{z}", String(z)).replaceAll("{x}", String(wrapped)).replaceAll("{y}", String(ty)),
        x: (tx / n - frame.left) / frame.width,
        y: (ty / n - frame.top) / frame.height,
        width: 1 / n / frame.width,
        height: 1 / n / frame.height,
      });
    }
  }
  return out;
}

/** A record's point by the bindings its kind is pinned by: its place's, kept beside it by the host, or its two numbers. */
export function pointOf(node: Record<string, unknown>, coordinates: MapCoordinates | undefined): Geo | undefined {
  return mapPointOf(node, coordinates);
}

/** The records a map pins, and how many of each kind it has no point for. */
export interface Pinned {
  readonly pins: readonly Omit<MapPin, "x" | "y">[];
  /** By kind, in the order the kinds came: how many records it could not pin. */
  readonly unplaced: readonly { readonly kind: string; readonly count: number }[];
}

/** Which of these records a map pins, by the coordinates each kind is bound to, and how many it does not. */
export function pinsOf(schema: AnySchema, nodes: readonly { readonly id: string; readonly kind: string }[], bindings: Readonly<Record<string, MapCoordinates>>): Pinned {
  const pins: Omit<MapPin, "x" | "y">[] = [];
  const missing = new Map<string, number>();
  for (const node of nodes) {
    const coordinates = bindings[node.kind];
    if (!coordinates) continue;
    const point = pointOf(node as unknown as Record<string, unknown>, coordinates);
    if (point) pins.push({ id: node.id, kind: node.kind, label: labelOf(schema.tryDefinition(node.kind), node as never), lat: point.lat, lng: point.lng });
    else missing.set(node.kind, (missing.get(node.kind) ?? 0) + 1);
  }
  return { pins, unplaced: [...missing].map(([kind, count]) => ({ kind, count })) };
}

/** A pin where it is drawn: at its point, or set out beside it on a ring when others share the spot, with the point it stands for. */
export interface LaidPin extends MapPin {
  /** Where its press is drawn, 0 to 1 across and down; its point when nothing shares the spot. */
  readonly drawnX: number;
  readonly drawnY: number;
}

/**
 * PINS THAT SHARE A SPOT ARE SET OUT AROUND IT. Two records at one door, or
 * two museums a street apart, were one press on top of another: the one
 * underneath was reached only by the keyboard. Pins closer than a press is
 * wide, in a picture `width` by `height` pixels, are set on a ring around
 * where they are — no two presses touching — and each keeps its true
 * point, which the map draws with a line to it. A pin alone is drawn at its
 * point exactly.
 */
export function fanOut(pins: readonly MapPin[], width: number, height: number, press = 24): readonly LaidPin[] {
  const groups: MapPin[][] = [];
  for (const pin of pins) {
    const near = groups.find((group) => Math.hypot((group[0]!.x - pin.x) * width, (group[0]!.y - pin.y) * height) < press);
    if (near) near.push(pin);
    else groups.push([pin]);
  }
  const half = press / 2 + 1;
  return groups.flatMap((group) => {
    if (group.length === 1) return [{ ...group[0]!, drawnX: group[0]!.x, drawnY: group[0]!.y }];
    const cx = group.reduce((sum, one) => sum + one.x, 0) / group.length;
    const cy = group.reduce((sum, one) => sum + one.y, 0) / group.length;
    // Far enough out that neighbors on the ring are a press and a pixel apart.
    const r = (press / 2 + 1) / Math.sin(Math.PI / group.length);
    return group.map((pin, at) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * at) / group.length;
      const px = Math.max(half, Math.min(width - half, cx * width + r * Math.cos(angle)));
      const py = Math.max(half, Math.min(height - half, cy * height + r * Math.sin(angle)));
      return { ...pin, drawnX: px / width, drawnY: py / height };
    });
  });
}
