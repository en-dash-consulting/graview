/**
 * WHERE A CHOSEN RECORD'S TIES SAY THEIR WORDS, AND WHEN.
 *
 * Every tie on the ground said its relation at its far end, all the time:
 * "the findings in it: 7 findings" hung at the end of each line, and with a
 * few of them drawn a row of floating labels stood over the cards — over a
 * finding's title, over a district's name — saying what the lines already
 * showed. Now a tie's words wait to be asked for: they show while the tie,
 * or a card at either end of it, is under the pointer or holds the keyboard
 * (`tiesReached`). Shown, they stand in open ground beside the far end
 * rather than on it, clear of every card's title where there is room
 * (`placeTieLabels`), and words two ties would both say are said once.
 *
 * Pure: boxes in, places out, in the stage's pixels.
 */

export interface TieBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A tie as its words need it: what it says, where it ends, and the box it ends on. */
export interface TieToLabel {
  readonly key: string;
  readonly said: string;
  readonly end: { readonly x: number; readonly y: number };
  readonly far: TieBox;
}

/** One label, standing for every tie that says the same words. */
export interface TieLabel {
  readonly said: string;
  /** The ties it speaks for: shown when any of them is reached. */
  readonly keys: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A label's height, and the gap it keeps from the box it stands beside. */
const HEIGHT = 22;
const GAP = 6;

/** About how wide the words are drawn at the label's size, capped where the label cuts them. */
export function labelWidth(said: string): number {
  return Math.min(260, 16 + said.length * 6.6);
}

const overlap = (a: TieBox, b: TieBox): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/**
 * Each set of words once, beside its far end: above the box the tie ends
 * on, else below it, else to its right or left — the first place that
 * stands on no card's title and no label already placed, inside the stage.
 * Where every place stands on something, the one standing on least, a
 * title costing far more than the rest of a card.
 */
export function placeTieLabels(
  ties: readonly TieToLabel[],
  /** The cards on the stage, and the strip at the top of each that says its title. */
  cards: readonly { readonly box: TieBox; readonly title: TieBox }[],
  stage: { readonly width: number; readonly height: number },
): TieLabel[] {
  const bySaid = new Map<string, TieToLabel[]>();
  for (const tie of ties) {
    const same = bySaid.get(tie.said);
    if (same) same.push(tie);
    else bySaid.set(tie.said, [tie]);
  }
  const placed: TieBox[] = [];
  const out: TieLabel[] = [];
  for (const [said, same] of bySaid) {
    const first = same[0]!;
    const width = labelWidth(said);
    const { end, far } = first;
    const clampX = (x: number) => Math.max(0, Math.min(stage.width - width, x));
    const candidates: TieBox[] = [
      { x: clampX(end.x - width / 2), y: far.y - HEIGHT - GAP, width, height: HEIGHT },
      { x: clampX(end.x - width / 2), y: far.y + far.height + GAP, width, height: HEIGHT },
      { x: far.x + far.width + GAP, y: end.y - HEIGHT / 2, width, height: HEIGHT },
      { x: far.x - width - GAP, y: end.y - HEIGHT / 2, width, height: HEIGHT },
    ];
    let best = candidates[0]!;
    let cost = Infinity;
    for (const box of candidates) {
      const outside = box.x < 0 || box.y < 0 || box.x + box.width > stage.width || box.y + box.height > stage.height;
      let here = outside ? 1e9 : 0;
      for (const card of cards) here += overlap(box, card.title) * 100 + overlap(box, card.box);
      for (const other of placed) here += overlap(box, other) * 100;
      if (here < cost) {
        cost = here;
        best = box;
      }
      if (here === 0) break;
    }
    placed.push(best);
    out.push({ said, keys: same.map((tie) => tie.key), ...best });
  }
  return out;
}

/** A tie as the pointer and the keyboard reach it: its two ends' boxes and the records at them. */
export interface TieReach {
  readonly key: string;
  readonly fromBox: TieBox;
  readonly toBox: TieBox;
  readonly ids: readonly string[];
  readonly edgeId: string | null;
}

const inside = (box: TieBox, point: { readonly x: number; readonly y: number }, slop = 2) =>
  point.x >= box.x - slop && point.x <= box.x + box.width + slop && point.y >= box.y - slop && point.y <= box.y + box.height + slop;

/**
 * The ties a person is reaching for: the one whose line is under the
 * pointer (`edgeId`), every tie with an end where the pointer is, and every
 * tie with an end on the record that holds the keyboard (`ids`) or whose
 * box the focused element stands in (`box`).
 */
export function tiesReached(
  ties: readonly TieReach[],
  at: { readonly point?: { readonly x: number; readonly y: number }; readonly edgeId?: string | null; readonly ids?: readonly string[]; readonly box?: TieBox },
): Set<string> {
  const reached = new Set<string>();
  for (const tie of ties) {
    if (at.edgeId && tie.edgeId === at.edgeId) reached.add(tie.key);
    else if (at.point && (inside(tie.fromBox, at.point) || inside(tie.toBox, at.point))) reached.add(tie.key);
    else if (at.ids?.some((id) => tie.ids.includes(id))) reached.add(tie.key);
    else if (at.box && (overlap(at.box, tie.fromBox) > 0 || overlap(at.box, tie.toBox) > 0)) reached.add(tie.key);
  }
  return reached;
}
