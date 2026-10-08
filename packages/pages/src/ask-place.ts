/**
 * THE ASK STAYS IN ITS OWN BOX.
 *
 * On graview.dev the routed face of a chapter stood its "Ask" at the foot
 * of the WINDOW, fixed there like a page's own control: over the hero's
 * caption, over the copy beside it and over every section scrolled past,
 * while the embed it belonged to was somewhere else. On somebody else's page
 * the face's box is the whole of its world, so the Ask and its drawer are
 * placed in that box as it shows on the screen, and put away when too
 * little of the box shows to hold them.
 */

/** A box on the screen, as `getBoundingClientRect` says it. */
export interface ScreenBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Where the Ask and its drawer go, in the fixed coordinates of the window. */
export interface AskPlace {
  /** False when too little of the box shows to hold the Ask: it is put away until more does. */
  readonly shown: boolean;
  readonly button: { readonly left: number; readonly bottom: number };
  readonly drawer: { readonly left: number; readonly top: number; readonly height: number; readonly width: number };
}

/** The gap between the Ask and the edges of its box. */
const GAP = 16;
/** The drawer's width on a desk; on anything narrower it is the box's. */
const DRAWER = 320;

/**
 * The Ask at the foot's left of `box` as it shows in a window `view` wide
 * and high, and the drawer down the box's left side. `size` is the Ask's own.
 */
export function askPlace(box: ScreenBox, view: { readonly width: number; readonly height: number }, size: { readonly width: number; readonly height: number }): AskPlace {
  const left = Math.max(0, box.left);
  const right = Math.min(view.width, box.right);
  const top = Math.max(0, box.top);
  const foot = Math.min(view.height, box.bottom);
  const shown = foot - top >= size.height + 2 * GAP && right - left >= size.width + 2 * GAP;
  return {
    shown,
    button: { left: Math.round(left + GAP), bottom: Math.round(view.height - foot + GAP) },
    drawer: { left: Math.round(left), top: Math.round(top), height: Math.round(Math.max(0, foot - top)), width: Math.round(Math.max(0, Math.min(DRAWER, right - left))) },
  };
}
