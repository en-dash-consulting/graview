import type { Box } from "./step-back-geometry.js";

/*
 * WHERE THE CITY STANDS AROUND THE STEPPED-BACK PAGE, and where a line
 * leaves a part of it (Graview HQ feature:f-page-zooms-out-to-the-city).
 * Pure arithmetic, fetched with the city (`city-behind.tsx`).
 *
 * Two ways the city can stand, one switch (`CITY_PLACEMENT`): BEHIND the
 * page, the ground it stands on — the whole region under the bar, its
 * districts drawn a little down and to the right of the page's corner so
 * most of them are not under it — or BESIDE it, in the band to its right or
 * under it, never covered. Behind is what the owner chose.
 */

/** Where the city stands around the page stepped back. */
export type CityPlacement = "behind" | "beside";
export const CITY_PLACEMENT: CityPlacement = "behind";

/**
 * How far into the page's box the city's own box begins, behind it: a third
 * of the way across and down, so the page covers the city's back corner and
 * leaves the rest of it to read.
 */
const BEHIND_FROM = 0.35;
/** In a window taller than it is wide (a phone), the page is a column and the city runs under it: its box begins most of the way down the page. */
const BEHIND_FROM_TALL = 0.8;

/** The air between the page, the city and the region's edges, in pixels. */
const AIR = 16;

/**
 * The room the stepped-back page leaves: the band to its right and the band
 * under it, each the region's full other side. The city is fitted to the one
 * it is drawn larger in (`fitIn`).
 */
export function roomBeside(region: { readonly width: number; readonly height: number }, page: Box): { readonly right: Box; readonly below: Box } {
  const rightX = page.x + page.width + AIR;
  const belowY = page.y + page.height + AIR;
  return {
    right: { x: rightX, y: AIR, width: Math.max(0, region.width - rightX - AIR), height: Math.max(0, region.height - 2 * AIR) },
    below: { x: AIR, y: belowY, width: Math.max(0, region.width - 2 * AIR), height: Math.max(0, region.height - belowY - AIR) },
  };
}

/** Behind the page: the whole region but for the corner the page stands in — its top left, or its top right in a page that reads right to left. */
export function roomBehind(region: { readonly width: number; readonly height: number }, page: Box, rtl = false): Box {
  const y = page.y + page.height * (region.height > region.width ? BEHIND_FROM_TALL : BEHIND_FROM);
  const height = Math.max(0, region.height - y - AIR);
  if (rtl) return { x: AIR, y, width: Math.max(0, page.x + page.width * (1 - BEHIND_FROM) - AIR), height };
  const x = page.x + page.width * BEHIND_FROM;
  return { x, y, width: Math.max(0, region.width - x - AIR), height };
}

/** The rooms the city may be fitted to, for a placement: the one it is drawn larger in is chosen (`bestFit`). */
export function cityRooms(region: { readonly width: number; readonly height: number }, page: Box, placement: CityPlacement = CITY_PLACEMENT, rtl = false): readonly Box[] {
  if (placement === "behind") return [roomBehind(region, page, rtl)];
  const { right, below } = roomBeside(region, page);
  // Beside a page that reads right to left: the band to its left.
  return rtl ? [{ x: AIR, y: AIR, width: Math.max(0, page.x - 2 * AIR), height: Math.max(0, region.height - 2 * AIR) }, below] : [right, below];
}

/** The scale a drawing of this size is drawn at to fit a box whole, never stretched. */
export function fitIn(box: Box, drawing: { readonly width: number; readonly height: number }): number {
  if (drawing.width <= 0 || drawing.height <= 0 || box.width <= 0 || box.height <= 0) return 0;
  return Math.min(box.width / drawing.width, box.height / drawing.height);
}

/**
 * Of several drawings (the map run wide, and run upright) and the rooms it
 * may stand in, the pairing that draws the city largest. Ties go to the
 * first drawing and the first room.
 */
export function bestFit<D extends { readonly width: number; readonly height: number }>(rooms: readonly Box[], drawings: readonly D[]): { readonly drawing: D; readonly box: Box; readonly scale: number } | null {
  let best: { drawing: D; box: Box; scale: number } | null = null;
  for (const drawing of drawings) {
    for (const box of rooms) {
      const scale = fitIn(box, drawing);
      if (scale > 0 && (best === null || scale > best.scale + 1e-9)) best = { drawing, box, scale };
    }
  }
  return best;
}

/** Whether two boxes share any area: a part of the page outside what the stepped-back page shows is not drawn from. */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * WHERE A LINE LEAVES A PART OF THE PAGE STANDING TURNED: the part's box on
 * the page as laid out, each of its corners and the middles of its sides
 * carried through the page's own transform (`project`), and of those the one
 * nearest the record the line runs to. Every one is a point of the part
 * where the page's plane puts it, so the line starts on the part, not on the
 * box it would have had flat.
 */
export function leavesFrom(box: Box, project: (point: { readonly x: number; readonly y: number }) => { readonly x: number; readonly y: number }, to: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } {
  const { x, y, width: w, height: h } = box;
  const on = [
    { x, y },
    { x: x + w / 2, y },
    { x: x + w, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w, y: y + h },
    { x: x + w / 2, y: y + h },
    { x, y: y + h },
    { x, y: y + h / 2 },
  ].map(project);
  let best = on[0]!;
  for (const point of on) if (Math.hypot(point.x - to.x, point.y - to.y) < Math.hypot(best.x - to.x, best.y - to.y)) best = point;
  return best;
}
