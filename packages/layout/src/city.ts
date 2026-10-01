import { cityExtent, cityMap, toIso, type AnySchema, type CityMap, type Plot } from "@graview/core";
import type { CityFrame, Layout } from "./types.js";

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
  /**
   * The least of that the listing gives up to: a few rows it keeps however
   * crowded the city is. Shrunk to nothing, an opened district of four kinds
   * listed one and counted three — opening it answered nothing.
   */
  readonly openedMin?: number;
  /**
   * Extra height for a drive-in's marquee — the showings drawn as buttons
   * under the nameplate. Not given back like the listing: a marquee
   * clipped is a button nobody can press.
   */
  readonly marquee?: number;
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
    /** A factor on the fitted cell: the camera brought closer, the city allowed past the window. */
    readonly zoom?: number;
    /** The pan baked into the cards, recorded on the frame so the ground can tween with them. */
    readonly pan?: { readonly x: number; readonly y: number };
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
  /** Where the whole city is slid to stand beside the rails rather than under them (see below). */
  let nudge = 0;
  const at = (cell: number, asked: number, openedShare = 1, shift = { x: 0, y: 0 }): PlacedCard[] => {
    const originX = cx - ((minX + maxX) / 2) * cell + shift.x + nudge;
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
      const base = Math.max(minHeight, size.height * grow);
      const height = base + (card.marquee ?? 0) + (card.opened > 0 ? Math.max(card.openedMin ?? 0, card.opened * openedShare) : 0);
      /*
       * NOT HELD INSIDE THE CANVAS. The ring pushed its near card back in
       * from the edge; a city has a shape, and a district pushed off its
       * corner to fit a phone is a district on the wrong corner. A city
       * wider than the window is reached by panning, which the camera
       * bounds to the map's extent for exactly this reason.
       */
      /*
       * The NAMEPLATE is centred on the plot; what hangs under it — a
       * marquee, an opened listing — grows DOWNWARD, so the top of the card
       * stays where the plot's far half is, and a screen standing at the
       * far edge is never covered by its own district's growth.
       */
      return {
        id: card.id,
        x: originX + centre.x - width / 2,
        y: originY + centre.y - base / 2,
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
  const right = canvas.width - (inset.right ?? 0);
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
  /*
   * BESIDE THE RAILS, NOT UNDER THEM. The map is centred on its lattice's
   * bounding diamond, and the districts are not: a card is centred on its
   * plot and the plots do not fill the diamond, so a city grown just wide
   * enough for its names stood twenty-five pixels left of the room it
   * fitted — and the leftmost district under the inspector. When the
   * districts fit between the rails, the city slides the least distance
   * that puts every one of them there; when they do not, the camera pans
   * to them, as before.
   */
  // With a picture standing in the middle the city has already stepped aside for it, and that placement stands.
  if (avoid.length === 0) {
    const lowX = Math.min(...settled.placed.map((card) => card.x));
    const highX = Math.max(...settled.placed.map((card) => card.x + card.width));
    const slide = highX - lowX > right - left ? 0 : lowX < left ? left - lowX : highX > right ? right - highX : 0;
    if (slide !== 0) {
      nudge = slide;
      const slid = at(cell, asked, openedShare, settled.shift);
      if (crowded(slid)) nudge = 0;
      else settled = { placed: slid, shift: settled.shift };
    }
  }
  /*
   * FLYING CLOSER. The fit above is the whole map in the window; a zoom is
   * the camera brought in afterwards, so the map keeps its shape and only
   * the cell grows — the city may run past the window, and the camera
   * pans to reach it.
   */
  if (options.zoom && options.zoom !== 1) {
    cell *= options.zoom;
    nudge *= options.zoom;
    settled = settle(cell, asked, openedShare);
  }
  const placed = settled.placed;
  const originX = cx - ((minX + maxX) / 2) * cell + settled.shift.x + nudge;
  const originY = cy - ((minY + maxY) / 2) * cell + settled.shift.y;

  const frame: CityFrame = {
    cell,
    originX,
    originY,
    pan: options.pan ?? { x: 0, y: 0 },
    extent: {
      x: originX + minX * cell,
      y: originY + minY * cell,
      width: spread.x * cell,
      height: spread.y * cell,
    },
    openedShare,
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

/** How far in from an edge a district brought into the window stands, at the least: room for its nameplate's height. */
const EDGE_CLEAR = 48;

/** A district the window does not reach, the edge it lies past, and the pan that brings it in. */
export interface PastTheEdge {
  /** The district's card: `kind:<kind>`. */
  readonly id: string;
  readonly kind: string;
  readonly side: "left" | "right" | "top" | "bottom";
  /** Where along that edge it lies, clamped to the canvas: y for left and right, x for top and bottom. */
  readonly along: number;
  /** The move that brings it a quarter of the way in from that edge. */
  readonly by: { readonly x: number; readonly y: number };
}

/**
 * THE EDGE SAYS WHAT IS PAST IT. A city wider than the window is reached
 * by panning, and a district has a corner of its own that no phone is
 * allowed to move — so on a 390-pixel phone the conference's Topics and
 * Staff stood wholly off the canvas, with nothing on it saying they were
 * there or which way to go. Every district whose middle is past the edge
 * is named here with the side it lies past, so the scene can put a sign on
 * that edge, and with the pan that brings it into the window.
 */
export function districtsPastTheEdge(result: Pick<Layout, "nodes" | "width" | "height" | "city">): readonly PastTheEdge[] {
  if (!result.city) return [];
  const { width, height } = result;
  const out: PastTheEdge[] = [];
  for (const node of result.nodes) {
    if (!node.id.startsWith("kind:") || Math.round(node.plane) !== 2) continue;
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const side = cx < 0 ? "left" : cx > width ? "right" : cy < 0 ? "top" : cy > height ? "bottom" : null;
    if (!side) continue;
    const across = side === "left" || side === "right";
    const along = across ? Math.max(0, Math.min(height, cy)) : Math.max(0, Math.min(width, cx));
    // A quarter of the way in from the edge it was past; along that edge, only as far as keeps it off the other two.
    const inward = (at: number, span: number) => (at < span / 4 ? span / 4 - at : at > (span * 3) / 4 ? (span * 3) / 4 - at : 0);
    const clear = (at: number, span: number) => (at < EDGE_CLEAR ? EDGE_CLEAR - at : at > span - EDGE_CLEAR ? span - EDGE_CLEAR - at : 0);
    const by = across ? { x: inward(cx, width), y: clear(cy, height) } : { x: clear(cx, width), y: inward(cy, height) };
    out.push({ id: node.id, kind: node.id.slice("kind:".length), side, along, by });
  }
  return out;
}

/**
 * THE PAN THAT KEEPS THE POINT UNDER THE POINTER STILL when the city is
 * zoomed. The city is placed about the canvas's centre, so scaling its cell
 * by `ratio` moves every point away from (or toward) the centre; the pan
 * moves the opposite way by the pointer's share of that, and what was under
 * the finger stays under it. Whole offset in, pan out: the camera's own
 * flight is part of where the city is, and only the pan is the person's.
 */
export function panForZoom(
  pan: { readonly x: number; readonly y: number },
  camera: { readonly x: number; readonly y: number },
  pointer: { readonly x: number; readonly y: number },
  centre: { readonly x: number; readonly y: number },
  ratio: number,
): { readonly x: number; readonly y: number } {
  return {
    x: pan.x + (pointer.x - pan.x - camera.x - centre.x) * (1 - ratio),
    y: pan.y + (pointer.y - pan.y - camera.y - centre.y) * (1 - ratio),
  };
}
