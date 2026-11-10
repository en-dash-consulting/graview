/*
 * WHERE THE PAGE STANDS WHEN A PERSON STEPS BACK FROM IT, AND WHERE THE CITY
 * BEHIND IT HAS ROOM (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * Pure arithmetic, no DOM: the region under the bar is what the page filled;
 * stepped back, the page is the same picture at a smaller scale, moved up
 * and to the left, and the city stands in the room the page leaves — to its
 * right or under it, whichever lets the city be drawn larger. Nothing here is
 * a compensation: the page is scaled as one plane, the city is fitted as one.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SetBack {
  /** The page's scale, stepped back: one plane, every part of it at the same scale. */
  readonly scale: number;
  /** Where the page's top-left corner stands in the region, stepped back. */
  readonly x: number;
  readonly y: number;
}

/** How far the page recedes: to a little over half its size, where its words still read. */
export const SET_BACK_SCALE = 0.55;

/** The air between the page, the city and the region's edges, in pixels. */
const AIR = 16;

/** Where the page stands stepped back in a region of this size: smaller, up and to the left. */
export function setBack(region: { readonly width: number; readonly height: number }): SetBack {
  const scale = SET_BACK_SCALE;
  const gutter = Math.max(AIR, Math.round(Math.min(region.width, region.height) * 0.03));
  return { scale, x: gutter, y: gutter };
}

/** The page's own box in the region, stepped back. */
export function pageBox(region: { readonly width: number; readonly height: number }, back: SetBack = setBack(region)): Box {
  return { x: back.x, y: back.y, width: region.width * back.scale, height: region.height * back.scale };
}
