/*
 * WHAT A VIEW HEARS A CLICK ON, KEPT ON ITS REGION (0.1.48). A worker view
 * says where its `graview.on("click", selector, …)` listens; the host keeps
 * the selectors on the region it draws the view in, under a key every copy of
 * the package shares, and an audit of the page (`auditView`) reads them there
 * when it is not handed `clicked`.
 */

/** The region's key for the selectors its view hears a click on. */
export const CLICKED_ON: unique symbol = Symbol.for("graview.view.clicked") as never;

/** Keep, on the region, where its view hears a click. */
export function keepClicked(region: object, selectors: readonly string[]): void {
  (region as Record<symbol, unknown>)[CLICKED_ON] = Object.freeze([...selectors]);
}

/** Where the view drawn in or under `root` hears a click, as its host kept it: on the root, the shadow root's host, or a region above. */
export function clickedOf(root: unknown): readonly string[] | undefined {
  for (let at = root as { host?: unknown; parentNode?: unknown } | null | undefined, steps = 0; at && steps < 64; steps += 1) {
    const kept = (at as Record<symbol, unknown>)[CLICKED_ON];
    if (Array.isArray(kept)) return kept as readonly string[];
    at = (at.host ?? at.parentNode) as typeof at;
  }
  return undefined;
}
