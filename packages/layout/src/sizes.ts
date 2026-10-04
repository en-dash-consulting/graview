/*
 * WHAT A CARD'S MARQUEE AND AN OPENED DISTRICT'S ROSTER TAKE, in arithmetic
 * the layout and the views that draw them share. Apart from `layout.ts` so
 * a view that sizes itself does not carry the city that is laid out with it
 * (`@graview/layout/view`, FR-57).
 */

/*
 * THE ROOM A DRIVE-IN'S MARQUEE TAKES under the nameplate: its showings as
 * buttons, wrapped to the card's width. It was one fixed row, and Rota's
 * three long titles wrapped to three and stood on the landmark below. The
 * estimate is the pill's own metrics — eleven-pixel type, eight of padding
 * a side, a four-pixel gap, a twenty-eight-pixel row — so the band is the
 * height the buttons will actually take, and nothing else moves.
 */
/*
 * The showings are PICTURES now: one thumbnail per lens with its name
 * under it — a single showing at 120×72, two or more in two columns of
 * 58×36 — so the band is the rows of thumbnails they make. `cardWidth` is
 * kept for the call sites; the columns are fixed by the thumbnail size.
 */
export const THUMB_ONE = { width: 120, height: 72 };
export const THUMB_TWO = { width: 58, height: 36 };
export const THUMB_TITLE = 16;
export const MARQUEE_GAP = 4;
export function marqueeHeightFor(titles: readonly string[], cardWidth: number): number {
  void cardWidth;
  if (titles.length === 0) return 0;
  if (titles.length === 1) return 10 + THUMB_ONE.height + THUMB_TITLE;
  const rows = Math.ceil(titles.length / 2);
  return 10 + rows * (THUMB_TWO.height + THUMB_TITLE) + (rows - 1) * MARQUEE_GAP;
}

/**
 * AN OPENED DISTRICT'S ROSTER, in arithmetic both sides share.
 *
 * The layout reserved 96 pixels under an opened district's nameplate and
 * the view listed sixteen members in 250 — so a dealership's Vehicles,
 * opened at the bottom of the city, ran its list off the scene and over the
 * district beside it. The layout now reserves the rows it will be asked to
 * hold, the view lists the rows it was given (`openedRows`), and the rest
 * are counted.
 */
export const ROSTER_ROW = 27;
/** The most rows a roster is given: past it the district is gone into. */
export const ROSTER_MOST = 8;
/** The rows it keeps however crowded the city: the city grows before the roster goes under four. */
export const ROSTER_KEPT = 4;
/** The count line under the rows, the hairline and padding above them, and the header's second line (the count wraps under the name). */
export const ROSTER_CHROME = 64;
export const rosterRows = (count: number): number => Math.max(1, Math.min(ROSTER_MOST, count));
export const rosterHeight = (rows: number): number => rows * ROSTER_ROW + ROSTER_CHROME;
