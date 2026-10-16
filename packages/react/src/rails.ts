/**
 * The room the layout keeps clear on each side of the picture, by width.
 *
 * The left edge used to keep a fifth of the picture for the seat's rail;
 * the quick ask floats over the picture beside what it is about, so the
 * left keeps only a gutter and the city has the rest. The right keeps the
 * corner the altitude control and the key stand in.
 */

/**
 * The strip at the picture's foot the layout keeps no card in: 64 pixels,
 * where the zoom, the way back, a notice and the AI's proposal stand. It was
 * the ask field's, and the city kept its fit when the field went.
 */
export const FOOT = 64;

export function railInset(width: number): { left: number; right: number } {
  if (width < 640) return { left: 8, right: 56 };
  return { left: 8, right: Math.round(Math.min(128, width * 0.107)) };
}
