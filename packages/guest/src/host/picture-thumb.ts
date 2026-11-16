/*
 * A VIEW'S SECOND PICTURE SIZE (Roadmap f-view-pictures-load-lazily-and-small):
 * the rule a `thumb` keeps, apart from the pictures' host so the manifest's
 * check and a frame's host read it without fetching that chunk.
 */

/** The widest a picture is drawn, by default, in CSS pixels (`PICTURE_WIDTH`). */
const WIDTH = 1_200;

/**
 * A THUMB OF A SHAPE (Graview HQ f-picture-thumb-around-focus): its width,
 * and the width over the height it is cropped to, around the picture's
 * `focus` (its middle where the record says none). A cutout is never
 * cropped: its thumb is the whole picture at that width.
 */
export interface ThumbShape {
  readonly width: number;
  readonly aspect?: number;
}

/** The narrowest and widest shape a thumb is cropped to, width over height. */
export const THUMB_ASPECT = { least: 0.1, most: 10 } as const;

/** What is said of a `thumb` that is not a whole number of pixels from 16 to 4096 narrower than the width. */
export const THUMB_REFUSED = "The view's pictures thumb is a whole number of pixels from 16 to 4096, narrower than its width (1,200 by default): the size it draws a picture small at (view-pictures-thumb).";

/** What is said of a `thumb` written as a shape that is not one. */
export const THUMB_SHAPE_REFUSED = `The view's pictures thumb, as a shape, is { "width": <a whole number of pixels from 16 to 4096, narrower than its width>, "aspect": <its width over its height, from ${THUMB_ASPECT.least} to ${THUMB_ASPECT.most}> }, cropped to that shape around each picture's focus; "aspect" may be left out (view-pictures-thumb).`;

const widthIsSound = (thumb: unknown, width: unknown): thumb is number => {
  const across = typeof width === "number" ? width : WIDTH;
  return Number.isInteger(thumb) && (thumb as number) >= 16 && (thumb as number) <= 4_096 && (thumb as number) < across;
};

/** Whether `thumb` is written as a shape (`{ width, aspect }`) rather than a width or a kind's fields. */
export const isThumbShape = (thumb: unknown): thumb is Record<string, unknown> => typeof thumb === "object" && thumb !== null && !Array.isArray(thumb);

/** Whether `thumb` is a width a view may draw a picture small at, or a shape of one, beside `width` (1 200 where it says none). */
export function thumbIsSound(thumb: unknown, width: unknown): thumb is number | ThumbShape {
  if (!isThumbShape(thumb)) return widthIsSound(thumb, width);
  const { width: across, aspect, ...rest } = thumb;
  if (Object.keys(rest).length > 0 || !widthIsSound(across, width)) return false;
  return aspect === undefined || (typeof aspect === "number" && Number.isFinite(aspect) && aspect >= THUMB_ASPECT.least && aspect <= THUMB_ASPECT.most);
}

/** What is said of a `thumb` that is no sound one, in its own form; nothing where it is sound. */
export function thumbRefusal(thumb: unknown, width: unknown): string | undefined {
  if (thumbIsSound(thumb, width)) return undefined;
  return isThumbShape(thumb) ? THUMB_SHAPE_REFUSED : THUMB_REFUSED;
}

/** A sound thumb as a shape: its width, and its aspect where it has one. */
export const thumbShapeOf = (thumb: number | ThumbShape): ThumbShape => (typeof thumb === "number" ? { width: thumb } : thumb);

/**
 * THE PART OF A PICTURE A THUMB OF `aspect` SHOWS, in its pixels: as much of
 * it as that shape holds, its middle as near `focus` as the picture's edges
 * allow — a portrait cropped square around a face high in it keeps the
 * face, not the chest.
 */
export function cropAround(width: number, height: number, aspect: number, focus: { readonly x: number; readonly y: number } = { x: 0.5, y: 0.5 }): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const wide = width / height > aspect;
  const w = wide ? Math.max(1, Math.round(height * aspect)) : width;
  const h = wide ? height : Math.max(1, Math.round(width / aspect));
  const clamp = (at: number, span: number, whole: number) => Math.min(whole - span, Math.max(0, Math.round(at - span / 2)));
  return { x: clamp(focus.x * width, w, width), y: clamp(focus.y * height, h, height), width: w, height: h };
}
