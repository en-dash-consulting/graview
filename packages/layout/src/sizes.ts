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
/**
 * HOW WIDE A NAME IS DRAWN, in pixels, in the face and size the marquee
 * draws it in — measured by whoever can see the font (`measureText` on a
 * canvas, in the page). Without one the width is estimated from the letter
 * count, which a wider brand face outruns: names sized for an average
 * letter ran the column past its district into the one below.
 */
export type NameWidth = (text: string) => number;
/** The lines a name wraps onto in the column, word by word as the browser breaks it; a word wider than the column breaks anywhere. */
function linesFor(title: string, width: NameWidth): number {
  // The first word always starts a line; a word wider than the column breaks anywhere, onto whole lines and the rest.
  let lines = 0;
  let used = NAME_ROOM;
  for (const word of title.split(" ")) {
    const wide = width(word);
    const after = used + width(" ") + wide;
    if (after <= NAME_ROOM) used = after;
    else {
      const spans = Math.ceil(wide / NAME_ROOM) || 1;
      lines += spans;
      used = wide - (spans - 1) * NAME_ROOM;
    }
  }
  return lines;
}
/** A measured line: 13-pixel type at the marquee's 1.25 line height, not rounded down. */
const MEASURED_LINE = 16.25;
/*
 * A FINGERTIP AS DRAWN. A name is pressed, so it is never shorter than the
 * 24 pixels WCAG 2.2 asks of a target (2.5.8) — on the screen, not in the
 * layout: the marquee hangs off a district drawn at its plane's 0.9, so a
 * name 24 tall in the layout reached the screen at 21.6, and axe found
 * every one-line name on a hosted app's scene too small to press. 27 is 24
 * over the deepest plane's scale, rounded up.
 */
export const MARQUEE_NAME_FLOOR = 27;
/** A name's height: its lines, and never under a fingertip. Measured, it is never less than the estimate. */
const nameHeight = (title: string, width?: NameWidth) => {
  const estimated = Math.ceil((title.length * LETTER) / NAME_ROOM);
  if (!width) return Math.max(MARQUEE_NAME_FLOOR, estimated * LINE + 6);
  return Math.max(MARQUEE_NAME_FLOOR, Math.ceil(Math.max(estimated, linesFor(title, width)) * MEASURED_LINE) + 6);
};
export function marqueeHeightFor(titles: readonly string[], cardWidth: number, width?: NameWidth): number {
  void cardWidth;
  if (titles.length === 0) return 0;
  return 10 + titles.reduce((sum, title) => sum + nameHeight(title, width), 0) + (titles.length - 1) * MARQUEE_GAP;
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
