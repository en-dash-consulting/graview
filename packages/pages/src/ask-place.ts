/**
 * THE SEAT STAYS IN ITS OWN BOX.
 *
 * On graview.dev the routed face of a chapter stood its "Ask" at the foot
 * of the WINDOW, fixed there like a page's own control: over the hero's
 * caption, over the copy beside it and over every section scrolled past,
 * while the embed it belonged to was somewhere else. On somebody else's page
 * the face's box is the whole of its world, so the seat stands in the part
 * of that box that shows on the screen, and is put away when too little of
 * the box shows to hold it.
 */

/** A box on the screen, as `getBoundingClientRect` says it. */
export interface ScreenBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Where the seat's box goes, in the fixed coordinates of the window. */
export interface AskPlace {
  /** False when too little of the box shows to hold the seat: it is put away until more does. */
  readonly shown: boolean;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The gap between the seat and the edges of its box. */
const GAP = 16;

/**
 * The part of `box` that shows in a window `view` wide and high: the seat
 * stands at its foot. `need` is the least the closed field needs.
 */
export function askPlace(box: ScreenBox, view: { readonly width: number; readonly height: number }, need: { readonly width: number; readonly height: number }): AskPlace {
  const left = Math.max(0, box.left);
  const right = Math.min(view.width, box.right);
  const top = Math.max(0, box.top);
  const foot = Math.min(view.height, box.bottom);
  const shown = foot - top >= need.height + 2 * GAP && right - left >= need.width + 2 * GAP;
  return { shown, left: Math.round(left), top: Math.round(top), width: Math.round(Math.max(0, right - left)), height: Math.round(Math.max(0, foot - top)) };
}

/**
 * Puts a fixed `element` at `at` on the screen, or away. FIXED TO WHAT HOLDS
 * IT, which is not always the window: a host that animates its stage with a
 * transform (graview.dev's hero) makes that stage the box `fixed` is measured
 * from, and the seat stood on the caption under it. Where it landed is read
 * back and the difference taken off.
 */
export function pin(element: HTMLElement, at: { readonly left: number; readonly top: number }, shown: boolean): void {
  const style = element.style;
  style.left = `${at.left}px`;
  style.top = `${at.top}px`;
  style.right = "auto";
  style.bottom = "auto";
  style.visibility = shown ? "" : "hidden";
  const landed = element.getBoundingClientRect();
  if (landed.width === 0) return;
  style.left = `${Math.round(2 * at.left - landed.left)}px`;
  style.top = `${Math.round(2 * at.top - landed.top)}px`;
}
