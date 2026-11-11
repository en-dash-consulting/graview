/*
 * A VIEW'S SECOND PICTURE SIZE (Roadmap f-view-pictures-load-lazily-and-small):
 * the rule a `thumb` keeps, apart from the pictures' host so the manifest's
 * check and a frame's host read it without fetching that chunk.
 */

/** The widest a picture is drawn, by default, in CSS pixels (`PICTURE_WIDTH`). */
const WIDTH = 1_200;

/** What is said of a `thumb` that is not a whole number of pixels from 16 to 4096 narrower than the width. */
export const THUMB_REFUSED = "The view's pictures thumb is a whole number of pixels from 16 to 4096, narrower than its width (1,200 by default): the size it draws a picture small at (view-pictures-thumb).";

/** Whether `thumb` is a width a view may draw a picture small at, beside `width` (1 200 where it says none). */
export function thumbIsSound(thumb: unknown, width: unknown): thumb is number {
  const across = typeof width === "number" ? width : WIDTH;
  return Number.isInteger(thumb) && (thumb as number) >= 16 && (thumb as number) <= 4_096 && (thumb as number) < across;
}
