/*
 * HOW WIDE A RIBBON IS: the one figure the map and its Key both draw a
 * relation with, so the Key's swatch is the ribbon's own width. Its own
 * module, because the Key is drawn on the pages too and carries nothing of
 * the map's.
 */

/** The thinnest and widest a ribbon is drawn, in pixels. */
export const RIBBON_WIDTH = { min: 2, max: 9 } as const;

/** A ribbon's width: its share of the busiest relation's links, between the thinnest and the widest. */
export function ribbonWidth(links: number, most: number): number {
  if (most <= 0) return RIBBON_WIDTH.min;
  return RIBBON_WIDTH.min + (RIBBON_WIDTH.max - RIBBON_WIDTH.min) * Math.min(1, links / most);
}
