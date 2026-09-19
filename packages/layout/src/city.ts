import { cityExtent, cityMap, toIso, type AnySchema, type CityMap, type Plot } from "@graview/core";
import type { CityFrame } from "./types.js";

/**
 * THE CITY AT ALTITUDE: districts on the lattice, one uniform scale.
 *
 * The map is the declaration's (`cityMap`): a kind's plot never moves
 * because of what happened today or how wide the window is. What this
 * file decides is only how the lattice meets the canvas — ONE scale and
 * ONE translate, so the city keeps its shape at every width, rather than
 * the per-axis stretch a ring needed to fill a wide canvas — and how big
 * each district card is drawn: nearer rows larger, as the ring drew the
 * near side of the ellipse larger, with the reader's unit honoured and
 * given back only as far as the cards need to keep off each other.
 */

export interface CityCard {
  readonly id: string;
  readonly kind: string;
  /** Members standing today, for the plot's side. */
  readonly count: number;
  /** Extra height this card asks for, opened in place. */
  readonly opened: number;
}

export interface PlacedCard {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly plot: Plot;
}

/** Two drawn boxes sharing ground, with a little air required between them. */
export function collides(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  air = 6,
): boolean {
  return (
    a.x < b.x + b.width + air &&
    b.x < a.x + a.width + air &&
    a.y < b.y + b.height + air &&
    b.y < a.y + a.height + air
  );
}

/** The centre of a plot's diamond, in lattice pixels at `cell`. */
const centreOf = (plot: Plot, cell: number) => toIso(plot.col + plot.side / 2, plot.row + plot.side / 2, cell);

export function placeCity(
  cards: readonly CityCard[],
  schema: AnySchema,
  base: { readonly width: number; readonly height: number },
  canvas: { readonly width: number; readonly height: number },
  inset: { readonly left?: number; readonly right?: number } = {},
  options: {
    readonly order?: readonly string[];
    readonly plots?: Readonly<Record<string, { col: number; row: number }>>;
    readonly scale?: number;
    /** The height a card is never drawn under, whatever the canvas — the layout's own floor. */
    readonly minHeight?: number;
    /**
     * Ground already taken — the picture standing in the middle from
     * altitude. No district is laid under it: the city slides aside, and
     * grows, until every district has ground of its own.
     */
    readonly avoid?: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[];
  } = {},
): { readonly placed: readonly PlacedCard[]; readonly frame: CityFrame; readonly map: CityMap } {
  const counts: Record<string, number> = {};
  for (const card of cards) counts[card.kind] = card.count;
  const map = cityMap(schema, {
    ...(options.order ? { order: options.order } : {}),
    counts,
    ...(options.plots ? { plots: options.plots } : {}),
  });
  const left = inset.left ?? 0;
  const span = canvas.width - left - (inset.right ?? 0);
  const cx = left + span / 2;
  const cy = canvas.height * 0.53;

  /*
   * ONE SCALE. The map's bounding diamond, at one pixel per cell, is
   * fitted into the room the canvas has once a card's own size is taken
   * off each edge — a card is centred on its plot and must not leave the
   * canvas. The cell is then the same on both axes, which is the whole
   * point: a city that was squashed to fit a wide window and stretched to
   * fit a tall one had no shape of its own.
   */
  const extent = cityExtent(map);
  const corners = [
    toIso(extent.minCol, extent.minRow, 1),
    toIso(extent.maxCol, extent.minRow, 1),
    toIso(extent.minCol, extent.maxRow, 1),
    toIso(extent.maxCol, extent.maxRow, 1),
  ];
  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x));
  const minY = Math.min(...corners.map((c) => c.y));
  const maxY = Math.max(...corners.map((c) => c.y));
  const spread = { x: Math.max(1, maxX - minX), y: Math.max(0.5, maxY - minY) };
  const roomX = Math.max(40, span - base.width * 1.1);
  const roomY = Math.max(24, canvas.height * 0.62 - base.height * 1.1);
  const fitted = Math.max(18, Math.min(160, roomX / spread.x, roomY / spread.y));

  const scale = options.scale ?? 1;
  const minHeight = options.minHeight ?? 0;
  const avoid = options.avoid ?? [];
  const at = (cell: number, asked: number, openedShare = 1, shift = { x: 0, y: 0 }): PlacedCard[] => {
    const originX = cx - ((minX + maxX) / 2) * cell + shift.x;
    const originY = cy - ((minY + maxY) / 2) * cell + shift.y;
    const size = { width: base.width * asked, height: base.height * asked };
    const rows = cards.map((card) => centreOf(map.get(card.kind)!, cell).y);
    const lowest = Math.max(...rows);
    const highest = Math.min(...rows);
    return cards.map((card) => {
      const plot = map.get(card.kind)!;
      const centre = centreOf(plot, cell);
      /*
       * NEARNESS FROM THE ROW. Lower on the ground is nearer the viewer,
       * exactly as the bottom of the ring was: 1 there, 0 at the top, and
       * the depth number everything else reads (`1 − near·0.65`) is
       * unchanged so the plane styles and the altitude opacity are too.
       */
      const near = lowest === highest ? 0.5 : (centre.y - highest) / (lowest - highest);
      const grow = 0.85 + near * 0.45;
      const width = size.width * grow;
      const height = Math.max(minHeight, size.height * grow) + card.opened * openedShare;
      /*
       * NOT HELD INSIDE THE CANVAS. The ring pushed its near card back in
       * from the edge; a city has a shape, and a district pushed off its
       * corner to fit a phone is a district on the wrong corner. A city
       * wider than the window is reached by panning, which the camera
       * bounds to the map's extent for exactly this reason.
       */
      return {
        id: card.id,
        x: originX + centre.x - width / 2,
        y: originY + centre.y - height / 2,
        width,
        height,
        depth: 1 - near * 0.65,
        plot,
      };
    });
  };
  const crowded = (placed: readonly PlacedCard[]) =>
    placed.some((one, index) => placed.some((other, index2) => index2 !== index && collides(one, other))) ||
    placed.some((one) => avoid.some((box) => collides(one, box)));

  /*
   * The reader's unit is given back first, down to the size a card has
   * always been; and when the cards still stand in each other at that
   * size, the CITY grows — the cell widens until every district has its
   * own ground — rather than the cards shrinking below what their names
   * need. A district's legibility is not the window's to take.
   */
  /*
   * THE CITY SLIDES ASIDE for the picture in the middle, when there is one.
   * A district on the map's own centre stands exactly where the live view
   * stands, and no amount of growing moves it — scaling about the centre
   * keeps the centre where it is. So the map is tried in place first, and
   * then shifted: by the width of what it must clear, right, left, down,
   * up, and the diagonals — the first shift with every district on ground
   * of its own is the one kept. No picture in the middle means no shift.
   */
  const shifts = (cell: number): readonly { x: number; y: number }[] => {
    if (avoid.length === 0) return [{ x: 0, y: 0 }];
    const dx = Math.max(...avoid.map((box) => box.width)) / 2 + cell;
    const dy = Math.max(...avoid.map((box) => box.height)) / 2 + cell / 2;
    const out: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (const share of [0.5, 0.75, 1, 1.25]) {
      const sx = dx * share;
      const sy = dy * share;
      out.push({ x: sx, y: 0 }, { x: -sx, y: 0 }, { x: 0, y: sy }, { x: 0, y: -sy }, { x: sx, y: sy }, { x: -sx, y: sy }, { x: sx, y: -sy }, { x: -sx, y: -sy });
    }
    return out;
  };
  /** How much of the city is off the canvas: the shift that shows the most is the one kept. */
  const outside = (placed: readonly PlacedCard[]): number =>
    placed.reduce((sum, card) => {
      const visibleW = Math.max(0, Math.min(card.x + card.width, canvas.width) - Math.max(card.x, 0));
      const visibleH = Math.max(0, Math.min(card.y + card.height, canvas.height) - Math.max(card.y, 0));
      return sum + card.width * card.height - visibleW * visibleH;
    }, 0);
  const settle = (cell: number, asked: number, openedShare: number): { placed: PlacedCard[]; shift: { x: number; y: number } } => {
    let best: { placed: PlacedCard[]; shift: { x: number; y: number }; off: number } | undefined;
    let fallback: { placed: PlacedCard[]; shift: { x: number; y: number } } | undefined;
    for (const shift of shifts(cell)) {
      const placed = at(cell, asked, openedShare, shift);
      if (crowded(placed)) {
        fallback ??= { placed, shift };
        continue;
      }
      const off = outside(placed);
      if (!best || off < best.off - 0.5) best = { placed, shift, off };
    }
    return best ?? fallback!;
  };

  let cell = fitted;
  let asked = scale;
  let openedShare = 1;
  let settled = settle(cell, asked, openedShare);
  while (crowded(settled.placed) && asked > 1.001) {
    asked = Math.max(1, asked - 0.05);
    settled = settle(cell, asked, openedShare);
  }
  /*
   * An opened district's listing is the luxury and the city is the picture:
   * in a short canvas the listing gives up its room before the city has to
   * grow past the window, exactly as the ring's listing gave up its room
   * before the ring gave up being a ring.
   */
  while (crowded(settled.placed) && openedShare > 0.3) {
    openedShare = Math.max(0.3, openedShare - 0.1);
    settled = settle(cell, asked, openedShare);
  }
  /*
   * A SMALLER CITY BEFORE A CITY OFF THE EDGE. With a picture standing in
   * the middle, the map fitted to the room may not stand beside it and
   * stay on the canvas; a tighter lattice usually can, and the districts
   * keep their size — only the streets between them shorten. So the cell
   * is tried smaller, down to where the districts would touch, and the
   * largest cell whose every district is on the canvas is the one kept.
   * Only when no cell will do does the city grow past the window.
   */
  if (crowded(settled.placed) || outside(settled.placed) > 0) {
    let best: { cell: number; settled: typeof settled; off: number } | undefined =
      crowded(settled.placed) ? undefined : { cell, settled, off: outside(settled.placed) };
    for (let share = 0.9; share >= 0.3; share -= 0.1) {
      const tighter = fitted * share;
      const trial = settle(tighter, asked, openedShare);
      if (crowded(trial.placed)) continue;
      const off = outside(trial.placed);
      if (!best || off < best.off - 0.5) best = { cell: tighter, settled: trial, off };
      if (off === 0) break;
    }
    if (best) {
      cell = best.cell;
      settled = best.settled;
    }
  }
  for (let grown = 0; crowded(settled.placed) && grown < 80; grown++) {
    cell *= 1.06;
    settled = settle(cell, asked, openedShare);
  }
  const placed = settled.placed;
  const originX = cx - ((minX + maxX) / 2) * cell + settled.shift.x;
  const originY = cy - ((minY + maxY) / 2) * cell + settled.shift.y;

  const frame: CityFrame = {
    cell,
    originX,
    originY,
    extent: {
      x: originX + minX * cell,
      y: originY + minY * cell,
      width: spread.x * cell,
      height: spread.y * cell,
    },
  };
  return { placed, frame, map };
}

/**
 * HOW FAR THE CAMERA MAY GO. A little way over a picture that fits — losing
 * the scene off the edge of its own window is not panning, it is dropping
 * it — and as far as the city reaches when the city is bigger than the
 * window: every district is reachable, none is lost. Symmetric about the
 * centre so the same limit serves both directions, and read by the scene
 * and by the tests alike, so "reachable" means one thing.
 */
export function cameraLimit(result: { readonly width: number; readonly height: number; readonly city?: CityFrame }): { readonly x: number; readonly y: number } {
  const slack = { x: result.width * 0.45, y: result.height * 0.45 };
  if (!result.city) return slack;
  const { extent } = result.city;
  const margin = 24;
  return {
    x: Math.max(slack.x, extent.x + extent.width - result.width + margin, -extent.x + margin),
    y: Math.max(slack.y, extent.y + extent.height - result.height + margin, -extent.y + margin),
  };
}
