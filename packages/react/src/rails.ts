/**
 * The room the layout keeps clear on each side of the picture, by width.
 *
 * The left edge used to keep a fifth of the picture for the seat's rail;
 * the seat floats over the picture now (an ask field at its foot that
 * grows into a panel when asked), so the left keeps only a gutter and the
 * city has the rest. The right keeps the corner the altitude control and
 * the key stand in.
 */
/**
 * The strip at the picture's foot the ask field stands in: the field's 38
 * pixels, 16 under it and 10 over it. The layout keeps no card in it.
 */
export const SEAT_FOOT = 64;

export function railInset(width: number): { left: number; right: number } {
  if (width < 640) return { left: 8, right: 56 };
  return { left: 8, right: Math.round(Math.min(128, width * 0.107)) };
}
