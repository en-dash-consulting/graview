/**
 * A NAME THAT FITS THE THING IT NAMES.
 *
 * Every drawn surface in this framework eventually has to write a word
 * inside a shape — a district, a region on a plan, a band on a calendar —
 * and every one of them starts by centring the text at one size and hoping.
 * That works for as long as the names are short, which is for as long as a
 * person is typing them.
 *
 * A product asked a model to survey a garden and got seven areas back
 * called things like "Pea-gravel corner with river-rock border, log seats
 * and a fire bowl". The map drew each at one size across the middle of its
 * shape: three ran off the canvas, two were struck through by a
 * neighbour's outline, and nothing failed — every test passed, the
 * accessibility tree was perfect, and the picture said "rick patio with
 * gravel joints". Agent-authored labels are not an edge case; they are the
 * normal case for anything with an intelligence provider in it.
 *
 * So this is the arithmetic, apart from any drawing, where it can be
 * tested: how much room a shape actually has, and what of a name will fit
 * in it. Nothing here knows what a zone is.
 */

export interface FitPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * How wide a shape is AT A HEIGHT — not its bounding box.
 *
 * The shapes that overflow worst are the long thin ones, whose box is
 * generous exactly where the shape is not. So this is a scanline: cross the
 * polygon with a horizontal line and take the widest run that is genuinely
 * inside it. For an L, a crescent or an hourglass waist that is much less
 * than the box, which is the point.
 */
export function spanAt(outline: readonly FitPoint[], y: number): { readonly x0: number; readonly x1: number } {
  const crossings: number[] = [];
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    if (a.y === b.y) continue;
    const low = Math.min(a.y, b.y);
    const high = Math.max(a.y, b.y);
    if (y < low || y >= high) continue;
    crossings.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
  }
  crossings.sort((p, q) => p - q);
  let best = { x0: 0, x1: 0 };
  /* Pairs, not neighbours: odd gaps are inside the shape, even ones are not. */
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const run = { x0: crossings[i]!, x1: crossings[i + 1]! };
    if (run.x1 - run.x0 > best.x1 - best.x0) best = run;
  }
  return best;
}

/** The corner-to-corner extent, for the vertical room a label has. */
export function boxOf(outline: readonly FitPoint[]): { readonly top: number; readonly bottom: number } {
  let top = Infinity;
  let bottom = -Infinity;
  for (const point of outline) {
    if (point.y < top) top = point.y;
    if (point.y > bottom) bottom = point.y;
  }
  return { top, bottom };
}

/** How much a shape covers, by the shoelace. For ordering, not for display. */
export function areaOf(outline: readonly FitPoint[]): number {
  let twice = 0;
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

/**
 * The area-weighted centroid, which is NOT the mean of the corners.
 *
 * An L-shaped region with six corners has four of them bunched at one end,
 * and averaging drags the label off the shape entirely — onto the
 * neighbour, where it reads as that neighbour's name. The fallback keeps a
 * degenerate shape from producing a NaN that silently removes the label.
 */
export function centroidOf(outline: readonly FitPoint[]): FitPoint {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    const cross = a.x * b.y - b.x * a.y;
    twiceArea += cross;
    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
  }
  if (Math.abs(twiceArea) < 1e-9) {
    const mean = outline.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: mean.x / outline.length, y: mean.y / outline.length };
  }
  return { x: x / (3 * twiceArea), y: y / (3 * twiceArea) };
}

/**
 * HOW WIDE A STRING WILL BE.
 *
 * Injected, because the honest answer depends on where you are. A browser
 * has a 2D canvas context that will measure text synchronously with the same
 * engine that will draw it; a test and a server have nothing, and have to
 * estimate. The estimate is what this defaults to and it is deliberately
 * PESSIMISTIC: the failure it guards is overflow, and being a little small
 * is not a failure at all.
 *
 * The first version only estimated, at 0.52 of the size per character, and
 * that was wrong by enough to matter — a display serif runs from 0.28 for an
 * "i" to 0.86 for a "W", so a name full of wide letters measured short and
 * was drawn running off the picture. Which is the exact fault the fitting
 * exists to prevent, arrived at from the other side.
 */
export type Measure = (text: string, fontSize: number) => number;

const ADVANCE = 0.58;
export const estimateWidth: Measure = (text, fontSize) => text.length * fontSize * ADVANCE;

export interface FittedLabel {
  readonly lines: readonly string[];
  readonly fontSize: number;
  /** True when the whole name is on the drawing, so nothing has to say it again. */
  readonly whole: boolean;
}

export interface FitOptions {
  /** The widest a line may be. */
  readonly room: number;
  /** The tallest the whole label may be. */
  readonly height: number;
  /** The size to draw at when there is room. */
  readonly size: number;
  /** The size below which nothing is legible anyway. */
  readonly floor: number;
  readonly measure?: Measure;
  /** How many lines to break onto. One or two; more is a paragraph. */
  readonly lines?: 1 | 2;
}

/**
 * A name that fits, or no name at all.
 *
 * In order: the whole thing on one line; the whole thing broken at the space
 * nearest the middle, which is what a person lettering a plan does; the same
 * shrunk, down to the floor; and then cut, with an ellipsis, so the shape is
 * at least identified.
 *
 * A shape too small for four characters gets NOTHING. A two-letter stub over
 * a flower bed is worse than a clean shape, because it reads as somebody
 * else's label clipped — and `whole: false` is how the caller knows to say
 * the name somewhere a person can still read it.
 */
export function fitLabel(text: string, options: FitOptions): FittedLabel | null {
  const { room, height, size: base, floor, measure = estimateWidth, lines: most = 2 } = options;
  const fits = (lines: readonly string[], size: number) =>
    lines.every((line) => measure(line, size) <= room) && lines.length * size * 1.15 <= height;

  if (fits([text], base)) return { lines: [text], fontSize: base, whole: true };

  const words = text.split(/\s+/);
  if (most > 1 && words.length > 1) {
    /* The break nearest the middle by CHARACTER, not by word count: "The
       long south-facing bed" breaks after "long", not after "south-facing". */
    let at = 1;
    let bestGap = Infinity;
    let run = 0;
    for (let i = 0; i < words.length - 1; i += 1) {
      run += words[i]!.length + 1;
      const gap = Math.abs(run - text.length / 2);
      if (gap < bestGap) {
        bestGap = gap;
        at = i + 1;
      }
    }
    const two = [words.slice(0, at).join(" "), words.slice(at).join(" ")];
    if (fits(two, base)) return { lines: two, fontSize: base, whole: true };
    for (let size = base; size >= floor; size -= base * 0.06) {
      if (fits(two, size)) return { lines: two, fontSize: size, whole: true };
    }
  }

  for (let size = base; size >= floor; size -= base * 0.06) {
    if (fits([text], size)) return { lines: [text], fontSize: size, whole: true };
  }

  /* Cut, at the floor, on a word boundary where there is one. */
  const perCharacter = measure(text, floor) / Math.max(1, text.length);
  const fitsAt = Math.floor(room / perCharacter) - 1;
  if (fitsAt < 4 || floor * 1.15 > height) return null;
  const cut = text.slice(0, fitsAt);
  const space = cut.lastIndexOf(" ");
  const kept = space > 3 ? cut.slice(0, space) : cut;
  return { lines: [`${kept}…`], fontSize: floor, whole: false };
}

export interface LabelBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Whether two boxes touch. The whole of collision avoidance, in one line. */
export const overlaps = (a: LabelBox, b: LabelBox): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
