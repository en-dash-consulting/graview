import { humanizeField } from "@graview/core";
import type { Layout, Via } from "./types.js";

/**
 * WHERE A RELATION'S CAPTION GOES — pure, so it can be held to.
 *
 * The neighborhood is grouped by relation, and each group is captioned
 * once, above the first row it occupies. Three things this used to get
 * wrong, all found by a discography whose artist is featured on some songs
 * and produced others:
 *
 * - A group was a CONSECUTIVE run of the frame's nodes, and the frame is
 *   sorted by id. "Featured on" After Midnight, "produced" Blue Hour,
 *   "featured on" Rent Is Due made three runs and two captions saying the
 *   same thing — and, keyed by the edge kind alone, React could not tell
 *   the two apart, kept the old elements through the next navigation, and
 *   an album's picture went on saying "their songs" from the artist you had
 *   left, one caption over every card.
 * - A caption borrowed three hundred pixels whatever stood beside it, so
 *   two narrow groups' captions lay across each other.
 * - The borrowing was clamped to the stage and not to the room the rails
 *   leave, so the leftmost caption ran under the inspector.
 */
export interface CaptionEntry {
  /** Which relation, read from which end: one caption per key. */
  readonly key: string;
  readonly text: string;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

export interface CaptionRun {
  readonly key: string;
  readonly text: string;
  readonly left: number;
  readonly width: number;
  /** The top of the row the caption sits over. */
  readonly top: number;
}

/** Wide enough for a full edge description before anything is cut. */
export const MIN_CAPTION = 300;
/** Cards in one row are within this many pixels of each other's top. */
const SAME_ROW = 12;
const GAP = 8;
/**
 * HOW A CAPTION STANDS OVER ITS ROW, at a 16px rem: its top this far above
 * the row's, this tall. The band keeps the gutter between its rows at least
 * this deep (`CAPTION_GUTTER` in the layout), so the words stand on ground
 * of their own and never on the row above.
 */
export const CAPTION_RISE = 19;
export const CAPTION_HEIGHT = 17;
/** About how wide a caption's words are drawn: 0.75rem capitals, letter-spaced, on a padded ground — at a 16px rem, times `scale` for the reader's own. */
export const captionWidth = (text: string, scale = 1): number => (text.length * 8.4 + 16) * scale;

/** What a relation's caption says: the declaration's words for this end, or the edge's name with an arrow for its direction (FR-142). */
export function captionText(via: Via): string {
  return via.description ?? `${via.direction === "in" ? "←" : "→"} ${humanizeField(via.edgeKind).toLowerCase()}`;
}

export function captionRuns(
  entries: readonly CaptionEntry[],
  room: { readonly left: number; readonly right: number },
  /** The reader's rem over 16: a caption is set in rem, so its words grow with it. */
  scale = 1,
): CaptionRun[] {
  const wordsWidth = (text: string) => captionWidth(text, scale);
  const groups = new Map<string, CaptionEntry[]>();
  for (const entry of entries) {
    const held = groups.get(entry.key);
    if (held) held.push(entry);
    else groups.set(entry.key, [entry]);
  }
  // Each group over the FIRST row it stands in: the rows after it continue it.
  const runs = [...groups.values()].map((members) => {
    const top = Math.min(...members.map((member) => member.top));
    const row = members.filter((member) => member.top - top <= SAME_ROW);
    return {
      key: members[0]!.key,
      text: members[0]!.text,
      left: Math.min(...row.map((member) => member.left)),
      right: Math.max(...row.map((member) => member.right)),
      top,
    };
  });
  runs.sort((a, b) => a.top - b.top || a.left - b.left);
  /*
   * What each caption WANTS: its own run, or its words, whichever is wider,
   * centered on the run. A neighbor's ground is borrowed only as far as the
   * neighbor does not want it; where both want the gutter between them,
   * they split it.
   */
  const want = runs.map((run) => {
    const width = Math.max(run.right - run.left, Math.min(MIN_CAPTION, wordsWidth(run.text)));
    const mid = (run.left + run.right) / 2;
    return { left: mid - width / 2, right: mid + width / 2 };
  });
  return runs.map((run, index) => {
    const beside = runs
      .map((other, at) => ({ other, at }))
      .filter(({ other }) => other !== run && Math.abs(other.top - run.top) <= SAME_ROW);
    const floors = beside
      .filter(({ other }) => other.right <= run.left)
      .map(({ other, at }) => (want[at]!.right + GAP <= (other.right + run.left) / 2 ? want[at]!.right + GAP : (other.right + run.left + GAP) / 2));
    const ceilings = beside
      .filter(({ other }) => other.left >= run.right)
      .map(({ other, at }) => (want[at]!.left - GAP >= (run.right + other.left) / 2 ? want[at]!.left - GAP : (run.right + other.left - GAP) / 2));
    const floor = Math.max(room.left, ...floors);
    const ceiling = Math.min(room.right, ...ceilings);
    const own = run.right - run.left;
    const desired = want[index]!.right - want[index]!.left;
    const width = Math.max(own, Math.min(desired, ceiling - floor));
    const mid = (run.left + run.right) / 2;
    const left = own >= width ? run.left : Math.max(floor, Math.min(mid - width / 2, ceiling - width));
    return { key: run.key, text: run.text, left, width, top: run.top };
  });
}

/** A caption's box, in the layout's own coordinates. */
export interface CaptionBox {
  readonly key: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * THE CAPTIONS A LAID-OUT BAND WILL DRAW, from the layout alone: the
 * placement the renderer makes from what it measures (`captionRuns`), on
 * the boxes the layout gave the cards. It is how the layout is held to
 * giving the captions ground of their own — none on a card, none on
 * another caption — without a browser.
 */
export function bandCaptions(
  result: Pick<Layout, "nodes" | "width">,
  room: { readonly left: number; readonly right: number } = { left: 0, right: result.width },
  unit = 16,
): CaptionBox[] {
  const scale = unit / 16;
  const entries: CaptionEntry[] = result.nodes
    .filter((node) => node.plane === 1 && node.via)
    .map((node) => ({ key: `${node.via!.edgeKind}|${node.via!.direction}`, text: captionText(node.via!), left: node.x, right: node.x + node.width, top: node.y }));
  return captionRuns(entries, room, scale).map((run) => ({
    key: run.key,
    text: run.text,
    x: run.left,
    y: Math.max(0, run.top - CAPTION_RISE * scale),
    width: run.width,
    height: CAPTION_HEIGHT * scale,
  }));
}
