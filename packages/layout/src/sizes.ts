/*
 * WHAT A CARD'S MARQUEE AND AN OPENED DISTRICT'S ROSTER TAKE, in arithmetic
 * the layout and the views that draw them share. Apart from `layout.ts` so
 * a view that sizes itself does not carry the city that is laid out with it
 * (`@graview/layout/view`, FR-57).
 */

/*
 * The showings are NAMES now (FR-118): one per line, each whole, wrapped
 * onto a second line rather than cut — a thumbnail of the lens at a
 * seventeenth of its size said nothing anybody could read, and cut the
 * name under it to fit. A line is 13-pixel type in a column `MARQUEE_WIDTH`
 * wide less its padding; a name is a fingertip tall however short.
 */
export const MARQUEE_WIDTH = 156;
export const MARQUEE_GAP = 2;
/** The width a showing's name has to wrap in: the column less its rule and padding. */
const NAME_ROOM = MARQUEE_WIDTH - 18;
/** About an average letter's width at 13 pixels. */
const LETTER = 7.1;
const LINE = 16;
/** A name's height: its lines, and never under a fingertip. */
const nameHeight = (title: string) => Math.max(24, Math.ceil((title.length * LETTER) / NAME_ROOM) * LINE + 6);
export function marqueeHeightFor(titles: readonly string[], cardWidth: number): number {
  void cardWidth;
  if (titles.length === 0) return 0;
  return 10 + titles.reduce((sum, title) => sum + nameHeight(title), 0) + (titles.length - 1) * MARQUEE_GAP;
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
