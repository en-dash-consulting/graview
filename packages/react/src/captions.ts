/**
 * WHERE A RELATION'S CAPTION GOES — pure, so it can be held to.
 *
 * The neighbourhood is grouped by relation, and each group is captioned
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

export function captionRuns(
  entries: readonly CaptionEntry[],
  room: { readonly left: number; readonly right: number },
): CaptionRun[] {
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
  return runs.map((run) => {
    // What it may borrow: half the gutter to each neighbour in the same row, and the rails.
    const beside = runs.filter((other) => other !== run && Math.abs(other.top - run.top) <= SAME_ROW);
    const floor = Math.max(room.left, ...beside.filter((other) => other.right <= run.left).map((other) => (other.right + run.left + GAP) / 2));
    const ceiling = Math.min(room.right, ...beside.filter((other) => other.left >= run.right).map((other) => (run.right + other.left - GAP) / 2));
    const own = run.right - run.left;
    const width = Math.max(own, Math.min(MIN_CAPTION, ceiling - floor));
    const mid = (run.left + run.right) / 2;
    const left = own >= width ? run.left : Math.max(floor, Math.min(mid - width / 2, ceiling - width));
    return { key: run.key, text: run.text, left, width, top: run.top };
  });
}
