/**
 * The rail the layout keeps clear on each side of the picture, by width.
 * A full-size scene reserves 264 and 128; a narrow one, where the panes
 * are sheets rather than rails, keeps only the corner the altitude control
 * stands in.
 *
 * `left`, where the seat has said how much of the left edge it takes (FR-78):
 * put away to a tab, laid over the picture, or hidden, it takes nothing of
 * the picture's own box, and the city has the room.
 */
export function railInset(width: number, left: number | null = null): { left: number; right: number } {
  if (width < 640) return { left: left ?? 8, right: 56 };
  if (left !== null) return { left, right: Math.round(Math.min(128, width * 0.107)) };
  return {
    left: Math.round(Math.min(264, width * 0.22)),
    right: Math.round(Math.min(128, width * 0.107)),
  };
}
