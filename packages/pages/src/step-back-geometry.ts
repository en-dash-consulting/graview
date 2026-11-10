/*
 * WHERE THE PAGE STANDS WHEN A PERSON STEPS BACK FROM IT
 * (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * Pure arithmetic, no DOM. The region under the bar is what the page filled.
 * Stepped back, the page is the same picture as one plane: smaller, up and
 * to the left, and turned on its left edge so it stands in the city like a
 * panel rather than lying on it — a real tilt in perspective, its right side
 * further away than its left. Nothing here is a compensation: every part of
 * the page is where that one plane puts it, and a line drawn from a part
 * starts where the same transform puts that part (`city-behind.tsx`).
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** How the page stands, stepped back: one plane, scaled, turned and moved. */
export interface SetBack {
  /** The page's scale: every part of it at the same scale. */
  readonly scale: number;
  /** Where the page's leading edge stands in the region (its left, or its right in a page that reads right to left), and its top. */
  readonly x: number;
  readonly y: number;
  /** How far it is turned on its left edge, and tipped back, in degrees. */
  readonly turn: number;
  readonly tip: number;
  /** How far the viewer stands from the region, in pixels: what the turn is seen in perspective from. */
  readonly perspective: number;
  /** The page reads right to left: everything mirrored — up and to the right, turned on its right edge, the city down and to the left. */
  readonly rtl: boolean;
}

/** How far the page recedes at a desk: to a half of its size, where its words still read. */
export const SET_BACK_SCALE = 0.5;
/** On a phone it recedes less, and turns less: its words are smaller to begin with. */
export const SET_BACK_SCALE_NARROW = 0.58;
/** How far it turns on its left edge at a desk, and on a phone. */
export const SET_BACK_TURN = 20;
export const SET_BACK_TURN_NARROW = 9;
/** A region narrower than this is a phone's. */
const NARROW = 600;

/** The air between the page and the region's edges, in pixels. */
const AIR = 16;

/** How the page stands stepped back in a region of this size: smaller, up and to the left, turned. */
export function setBack(region: { readonly width: number; readonly height: number }, rtl = false): SetBack {
  const narrow = region.width < NARROW;
  const scale = narrow ? SET_BACK_SCALE_NARROW : SET_BACK_SCALE;
  const gutter = Math.max(AIR, Math.round(Math.min(region.width, region.height) * 0.03));
  return {
    scale,
    x: gutter,
    y: gutter,
    turn: narrow ? SET_BACK_TURN_NARROW : SET_BACK_TURN,
    tip: narrow ? 2 : 3,
    perspective: Math.round(Math.max(region.width, region.height) * (narrow ? 1.6 : 1.2)),
    rtl,
  };
}

/**
 * The page's transform, as CSS, about its leading edge's middle
 * (`setBackOrigin`): moved so its top leading corner stands `x` in from
 * that side and `y` down, seen in perspective, turned and tipped, and
 * scaled. Mirrored for a page that reads right to left.
 */
export function setBackTransform(region: { readonly height: number }, back: SetBack): string {
  const ty = back.y - (region.height / 2) * (1 - back.scale);
  const tx = back.rtl ? -back.x : back.x;
  const turn = back.rtl ? -back.turn : back.turn;
  return `translate(${tx}px, ${ty.toFixed(1)}px) perspective(${back.perspective}px) rotateY(${turn}deg) rotateX(${back.tip}deg) scale(${back.scale})`;
}

/** Where the transform turns the page about: its leading edge's middle. */
export const setBackOrigin = (back: SetBack): string => (back.rtl ? "100% 50%" : "0 50%");

/** The page's box in the region, stepped back, before its turn: what it covers at most. */
export function pageBox(region: { readonly width: number; readonly height: number }, back: SetBack = setBack(region)): Box {
  const width = region.width * back.scale;
  return { x: back.rtl ? region.width - back.x - width : back.x, y: back.y, width, height: region.height * back.scale };
}
