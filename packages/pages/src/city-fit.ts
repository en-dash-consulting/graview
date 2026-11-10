import type { Box } from "./step-back-geometry.js";

/*
 * WHERE THE CITY HAS ROOM BESIDE THE STEPPED-BACK PAGE, and where a line
 * leaves a part of it (Graview HQ feature:f-page-zooms-out-to-the-city).
 * Pure arithmetic, fetched with the city (`city-behind.tsx`).
 */

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

/** The scale a drawing of this size is drawn at to fit a box whole, never stretched. */
export function fitIn(box: Box, drawing: { readonly width: number; readonly height: number }): number {
  if (drawing.width <= 0 || drawing.height <= 0 || box.width <= 0 || box.height <= 0) return 0;
  return Math.min(box.width / drawing.width, box.height / drawing.height);
}

/**
 * Of several drawings (the map run wide, and run upright) and the two rooms,
 * the pairing that draws the city largest. Ties go to the first drawing and
 * the room to the right.
 */
export function bestFit<D extends { readonly width: number; readonly height: number }>(rooms: { readonly right: Box; readonly below: Box }, drawings: readonly D[]): { readonly drawing: D; readonly box: Box; readonly scale: number } | null {
  let best: { drawing: D; box: Box; scale: number } | null = null;
  for (const drawing of drawings) {
    for (const box of [rooms.right, rooms.below]) {
      const scale = fitIn(box, drawing);
      if (scale > 0 && (best === null || scale > best.scale + 1e-9)) best = { drawing, box, scale };
    }
  }
  return best;
}

/** The point of a box nearest another point: where a line from the box toward that point leaves it. */
export function nearestOnBox(box: Box, to: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } {
  const x = Math.max(box.x, Math.min(box.x + box.width, to.x));
  const y = Math.max(box.y, Math.min(box.y + box.height, to.y));
  // A point inside the box leaves by the nearest side, so a line never starts in the middle of the words.
  if (x > box.x && x < box.x + box.width && y > box.y && y < box.y + box.height) {
    const sides = [
      { d: x - box.x, p: { x: box.x, y } },
      { d: box.x + box.width - x, p: { x: box.x + box.width, y } },
      { d: y - box.y, p: { x, y: box.y } },
      { d: box.y + box.height - y, p: { x, y: box.y + box.height } },
    ];
    sides.sort((a, b) => a.d - b.d);
    return sides[0]!.p;
  }
  return { x, y };
}

/** Whether two boxes share any area: a part of the page outside what the stepped-back page shows is not drawn from. */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
