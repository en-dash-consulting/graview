import { type AnySchema } from "@graview/core";
import { cityMap, PITCH, toIso, type CityMap, type Plot } from "@graview/core/city";
import type { CityFrame, Layout } from "./types.js";

/**
 * THE CITY AT ALTITUDE: districts on the lattice, one uniform scale.
 *
 * The map is the declaration's (`cityMap`): a kind's plot never moves
 * because of what happened today. What this file decides is how the
 * lattice meets the canvas — ONE scale and ONE translate, so the city keeps
 * its shape at every width — and which way up it stands: up and to the
 * right along the ground in a wide window, down it in a tall one, whichever
 * draws it larger.
 *
 * THE WHOLE CITY OPENS IN THE WINDOW. The cell is the largest at which
 * every plot, and the name under it, stands inside the room the canvas
 * leaves once its chrome is paid for — the bar's corner controls at the
 * top, the ask field and the zoom at the foot. The names are a fixed size
 * on the screen, so the city never grows past the window to make room for
 * them: where two would collide at this scale, the less pressing one says
 * less — its name and count without the bar, then nothing until the camera
 * comes closer. A district with problems is the last to go quiet.
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
  /** The name under the district, on the screen: its whole size, and its size said short (name and count). */
  readonly nameplate?: { readonly width: number; readonly height: number; readonly short: { readonly width: number; readonly height: number } };
  /** How pressing it is to say: problems first, then population. The most pressing names are placed first. */
  readonly weight?: number;
}

/**
 * How much a district's name says at this scale — all of it, its name and
 * count, or nothing until closer — and whether it stands beside the plot
 * (`-aside`) because the ground under it is the next district's.
 */
export type Nameplate = "full" | "short" | "full-above" | "short-above" | "full-aside" | "short-aside" | "none";

export interface PlacedCard {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly plot: Plot;
  readonly nameplate: Nameplate;
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/*
 * THE NAME UNDER A DISTRICT from altitude, as the scene draws it: its
 * plural in 12-pixel capitals, its count, its problems when it has any,
 * and under them the bar of its states when its kind has a status — on a
 * solid backing, a fixed size on the screen whatever the zoom. Said short,
 * it is those three without the bar. In the reader's unit.
 */
export function nameplateSize(name: string, count: number, problems: number, states: boolean, unit = 1): { width: number; height: number; short: { width: number; height: number } } {
  const digits = (n: number) => String(n).length * 7.4;
  const line = name.length * 8.6 + 6 + digits(count) + 14 + (problems > 0 ? 8 + 14 + digits(problems) : 0);
  return {
    width: Math.max(line, states ? 168 + 16 : 0) * unit,
    height: (states ? 38 : 22) * unit,
    short: { width: line * unit, height: 22 * unit },
  };
}

/** Two drawn boxes sharing ground, with a little air required between them. */
export function collides(a: Box, b: Box, air = 6): boolean {
  return a.x < b.x + b.width + air && b.x < a.x + a.width + air && a.y < b.y + b.height + air && b.y < a.y + a.height + air;
}

/** Whether a box reaches into a plot's diamond: the nearest point of the box to its center, inside the diamond. */
const onDiamond = (box: Box, center: { x: number; y: number }, halfW: number, halfH: number): boolean => {
  const px = Math.max(box.x, Math.min(center.x, box.x + box.width));
  const py = Math.max(box.y, Math.min(center.y, box.y + box.height));
  return Math.abs(px - center.x) / halfW + Math.abs(py - center.y) / halfH < 0.92;
};

/** The gap between a plot's front corner and the top of the name under it. */
const UNDER = 4;
/** How far the tallest block on a plot stands over its back corner, in cells: a name over the plot stands clear of it. */
const RISE = 0.45;

export function placeCity(
  cards: readonly CityCard[],
  schema: AnySchema,
  canvas: { readonly width: number; readonly height: number },
  inset: { readonly left?: number; readonly right?: number; readonly top?: number; readonly bottom?: number } = {},
  options: {
    readonly order?: readonly string[];
    readonly plots?: Readonly<Record<string, { col: number; row: number }>>;
    /** A factor on the fitted cell: the camera brought closer, the city allowed past the window. */
    readonly zoom?: number;
    /** The kinds whose districts are chosen: a city drawn past the window keeps these, and their names, inside it. */
    readonly keep?: readonly string[];
    /** The pan baked into the cards, recorded on the frame so the ground can tween with them. */
    readonly pan?: { readonly x: number; readonly y: number };
    /** A cell's height over its width: 0.5 at an angle, 1 from straight above. */
    readonly tilt?: number;
    /**
     * Ground already taken — the picture standing in the middle from
     * altitude, the corner controls. No district or name is laid under it:
     * the city steps aside, then draws smaller, until each has ground of its own.
     */
    readonly avoid?: readonly Box[];
  } = {},
): { readonly placed: readonly PlacedCard[]; readonly frame: CityFrame; readonly map: CityMap } {
  const counts: Record<string, number> = {};
  for (const card of cards) counts[card.kind] = card.count;
  const room = {
    x: (inset.left ?? 0) + 8,
    y: (inset.top ?? 0) + 8,
    width: canvas.width - (inset.left ?? 0) - (inset.right ?? 0) - 16,
    height: canvas.height - (inset.top ?? 0) - (inset.bottom ?? 0) - 16,
  };
  const avoid = options.avoid ?? [];
  const tilt = options.tilt ?? 0.5;
  const plate = (card: CityCard) => card.nameplate ?? { width: 120, height: 34, short: { width: 90, height: 20 } };

  /** Every plot's center in lattice pixels at one pixel a cell, and its side. */
  const shapeOf = (map: CityMap) =>
    cards.map((card) => {
      const plot = map.get(card.kind)!;
      return { card, plot, center: toIso(plot.col + plot.side / 2, plot.row + plot.side / 2, 1, tilt) };
    });
  /** The extent of the drawn city at `cell`, names and all, about the lattice's origin. */
  const extentAt = (shape: ReturnType<typeof shapeOf>, cell: number) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const { card, plot, center } of shape) {
      const x = center.x * cell;
      const y = center.y * cell;
      const half = (plot.side * cell) / 2;
      const name = card.opened > 0 ? plate(card).width : plate(card).short.width;
      // A district too full for its rows says `+n` off its left edge: room for it, so the count is never cut by the window.
      minX = Math.min(minX, x - Math.max(half + (card.count > 12 ? 30 : 0), name / 2));
      maxX = Math.max(maxX, x + Math.max(half, name / 2));
      // The tallest block stands about a cell above the plot's far corner; a name is always under its plot.
      minY = Math.min(minY, y - half * tilt - cell * RISE);
      maxY = Math.max(maxY, y + half * tilt + UNDER + plate(card).short.height);
    }
    return { minX, maxX, minY, maxY };
  };
  /** The largest cell at which the city fits the room. */
  const fit = (shape: ReturnType<typeof shapeOf>): number => {
    let lo = 4;
    let hi = 160;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const e = extentAt(shape, mid);
      if (e.maxX - e.minX <= room.width && e.maxY - e.minY <= room.height) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  /*
   * WHICH WAY UP. The map runs up and to the right in a wide window and
   * down in a tall one: whichever stands the city larger, wide when the
   * two are equal — the way a thumbnail, with no window, draws it.
   */
  const mapsAt = (pitch: number) => {
    const hints = { ...(options.order ? { order: options.order } : {}), counts, ...(options.plots ? { plots: options.plots } : {}), pitch };
    const wideMap = cityMap(schema, hints);
    const tallMap = cityMap(schema, { ...hints, upright: true });
    const wide = fit(shapeOf(wideMap));
    const tall = fit(shapeOf(tallMap));
    const map = canvas.height > canvas.width && tall >= wide ? tallMap : wideMap;
    return { map, fitted: map === tallMap ? tall : wide };
  };
  let shape: ReturnType<typeof shapeOf> = [];
  let map: CityMap = new Map();
  let fitted = 0;

  /** The city at `cell`, its middle at the room's middle shifted by `shift`; each district's box is its plot's. */
  const at = (cell: number, shift = { x: 0, y: 0 }) => {
    const e = extentAt(shape, cell);
    const originX = room.x + room.width / 2 - (e.minX + e.maxX) / 2 + shift.x;
    const originY = room.y + room.height / 2 - (e.minY + e.maxY) / 2 + shift.y;
    return { originX, originY, cell };
  };
  const draw = (where: { originX: number; originY: number; cell: number }) => {
    const { originX, originY, cell } = where;
    const rows = shape.map(({ center }) => center.y);
    const lowest = Math.max(...rows);
    const highest = Math.min(...rows);
    return shape.map(({ card, plot, center }) => {
      const x = originX + center.x * cell;
      const y = originY + center.y * cell;
      const halfW = (plot.side * cell) / 2;
      const halfH = halfW * tilt;
      const near = lowest === highest ? 0.5 : (center.y - highest) / (lowest - highest);
      return { card, plot, x, y, halfW, halfH, depth: 1 - near * 0.65 };
    });
  };
  type Drawn = ReturnType<typeof draw>[number];
  /*
   * A NAME STANDS UNDER ITS OWN DISTRICT, never beside a neighbor or over
   * one, where it would read as the neighbor's. Where the names under
   * their districts would meet one another or another district's ground,
   * the districts stand further apart — a wider street, on the same
   * lattice — rather than any name moving: the narrowest spacing at which
   * every name fits under its own district, whole or short.
   */
  const fitsUnder = (drawn: readonly Drawn[], window = true) => {
    const said: Box[] = [];
    // In the order the names are said below, most pressing first, and clear of the chrome as they must be.
    const pressing = [...drawn].sort((a, b) => (b.card.weight ?? b.card.count) - (a.card.weight ?? a.card.count) || cards.indexOf(a.card) - cards.indexOf(b.card));
    return pressing.filter((one) =>
      [plate(one.card), plate(one.card).short].some((size) => {
        const box = plateBox(one, size);
        const clear =
          (!window || (box.x >= 0 && box.y >= 0 && box.x + box.width <= canvas.width && box.y + box.height <= canvas.height)) &&
          !said.some((other) => collides(box, other, 4)) &&
          !drawn.some((other) => other !== one && onDiamond(box, other, other.halfW, other.halfH)) &&
          !avoid.some((other) => collides(box, other, 0));
        if (clear) said.push(box);
        return clear;
      }),
    ).length;
  };

  /** Where a name stands: under the plot's front corner, over its back corner and the blocks on it, or beside its right corner. */
  const plateBox = (one: Drawn, size: { width: number; height: number }, at: "under" | "above" | "aside" = "under"): Box =>
    at === "aside"
      ? { x: one.x + one.halfW + UNDER, y: one.y - size.height / 2, width: size.width, height: size.height }
      : at === "above"
        ? { x: one.x - size.width / 2, y: one.y - one.halfH - UNDER - RISE * where.cell - size.height, width: size.width, height: size.height }
        : { x: one.x - size.width / 2, y: one.y + one.halfH + UNDER, width: size.width, height: size.height };
  /** Whether a district — its ground and the least of its name — stands on something it may not. */
  const blocked = (drawn: readonly Drawn[]) =>
    drawn.some((one) => avoid.some((box) => onDiamond(box, one, one.halfW, one.halfH) || collides(box, plateBox(one, plate(one.card).short), 0)));

  /*
   * THE CITY STEPS ASIDE for what stands in the middle, when something
   * does: tried in place, then shifted by the width of what it must clear,
   * right, left, down, up and the diagonals, then drawn smaller — the
   * first that leaves every district its own ground, and keeps every one
   * of them and its name inside the window, is kept. A city pushed off the
   * edge to clear the picture is a city cropped; smaller is better.
   */
  const inWindow = (drawn: readonly Drawn[]) =>
    drawn.every((one) => {
      const name = plateBox(one, plate(one.card).short);
      return one.x - one.halfW >= 0 && one.x + one.halfW <= canvas.width && one.y - one.halfH >= 0 && name.x >= 0 && name.x + name.width <= canvas.width && name.y + name.height <= canvas.height;
    });
  /*
   * Where no spacing lets every name stand under its district — a phone,
   * with names as wide as the city — the spacing that says the most of
   * them, the narrowest of those: a wider street that says no more names
   * only draws the city smaller.
   */
  let best = { pitch: PITCH, said: -1 };
  for (const pitch of [PITCH, PITCH + 1, PITCH + 2, PITCH + 3, PITCH + 5, PITCH + 7]) {
    ({ map, fitted } = mapsAt(pitch));
    shape = shapeOf(map);
    const said = fitsUnder(draw(at(fitted)));
    if (said > best.said) best = { pitch, said };
    if (said === cards.length) break;
  }
  if (best.pitch !== PITCH + 7 || best.said !== cards.length) {
    ({ map, fitted } = mapsAt(best.pitch));
    shape = shapeOf(map);
  }
  let where = at(fitted);
  if (avoid.length > 0 && blocked(draw(where))) {
    let found: typeof where | undefined;
    for (let share = 1; share >= 0.3 && !found; share -= 0.05) {
      const cell = fitted * share;
      const dx = Math.max(...avoid.map((box) => box.width)) / 2 + cell;
      const dy = Math.max(...avoid.map((box) => box.height)) / 2 + cell / 2;
      for (const s of [0, 0.5, 0.75, 1, 1.25]) {
        for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
          const trial = at(cell, { x: ux * dx * s, y: uy * dy * s });
          const drawn = draw(trial);
          if (!blocked(drawn) && inWindow(drawn)) {
            found = trial;
            break;
          }
          if (s === 0) break;
        }
        if (found) break;
      }
    }
    if (found) where = found;
  }

  /*
   * CLOSE ENOUGH TO READ. Where no spacing says every name inside the
   * window — a phone, whose names are as wide as its city — the camera
   * starts closer, by the least that lets every name stand under its own
   * district: the city runs past the window's edges, the signs on those
   * edges say what is there, and a finger pans to it. A city drawn whole
   * but too small to name is a city nobody can press.
   */
  const closerBy = (where: { originX: number; originY: number; cell: number }, by: number) => {
    const mid = { x: canvas.width / 2, y: canvas.height / 2 };
    return { cell: where.cell * by, originX: mid.x + (where.originX - mid.x) * by, originY: mid.y + (where.originY - mid.y) * by };
  };
  let closer = 1;
  if (fitsUnder(draw(where)) < cards.length) {
    /*
     * Each spacing at the least closer camera that names every district,
     * and of those the one whose city stands smallest on the screen: a
     * wider street can say them all from further out. Where none does
     * within three times closer, the one that says the most.
     */
    let chosen = { said: fitsUnder(draw(where), false), area: Infinity, pitch: -1, by: 1 };
    const before = { map, shape, fitted, where };
    for (const pitch of [PITCH, PITCH + 1, PITCH + 2, PITCH + 3, PITCH + 5, PITCH + 7]) {
      ({ map, fitted } = mapsAt(pitch));
      shape = shapeOf(map);
      const from = at(fitted);
      for (let by = 1; by <= 3.001; by += 0.1) {
        const said = fitsUnder(draw(closerBy(from, by)), false);
        const e = extentAt(shape, fitted * by);
        const area = (e.maxX - e.minX) * (e.maxY - e.minY);
        if (said > chosen.said || (said === chosen.said && area < chosen.area)) chosen = { said, area, pitch, by };
        if (said === cards.length) break;
      }
    }
    if (chosen.pitch < 0) ({ map, shape, fitted, where } = before);
    else {
      ({ map, fitted } = mapsAt(chosen.pitch));
      shape = shapeOf(map);
      closer = chosen.by;
      where = closerBy(at(fitted), closer);
    }
    /*
     * WHAT IS CHOSEN STAYS IN SIGHT: a city drawn past the window moves,
     * the least it can, to keep the chosen district and its name inside —
     * the sheet it opened takes the foot of a phone, and a district past
     * the edge could not be pressed again or asked for its acts.
     */
    const kept = draw(where).filter((one) => options.keep?.includes(one.card.kind));
    if (kept.length > 0) {
      const boxes = kept.flatMap((one) => [{ x: one.x - one.halfW, y: one.y - one.halfH, width: one.halfW * 2, height: one.halfH * 2 }, plateBox(one, plate(one.card))]);
      const left = Math.min(...boxes.map((b) => b.x));
      const right = Math.max(...boxes.map((b) => b.x + b.width));
      const top = Math.min(...boxes.map((b) => b.y));
      const bottom = Math.max(...boxes.map((b) => b.y + b.height));
      const by = (low: number, high: number, span: number) => (high - low > span - 16 ? span / 2 - (low + high) / 2 : low < 8 ? 8 - low : high > span - 8 ? span - 8 - high : 0);
      where = { ...where, originX: where.originX + by(left, right, canvas.width), originY: where.originY + by(top, bottom, canvas.height) };
    }
  }

  /*
   * FLYING CLOSER. The fit above is the whole map in the window; a zoom is
   * the camera brought in afterwards, about the canvas's middle, so the map
   * keeps its shape and only the cell grows — the city may run past the
   * window, and the camera pans to reach it. The names stay their size.
   */
  const zoom = options.zoom && options.zoom !== 1 ? options.zoom : 1;
  if (zoom !== 1) where = closerBy(where, zoom);
  const drawn = draw(where);

  /*
   * THE NAMES, MOST PRESSING FIRST. Each is tried whole under its plot,
   * then over it, then short under and over, then beside it; one that would
   * stand on a name already placed, on another district's ground, on the
   * chrome or past the window's edge says nothing until the camera comes
   * closer.
   * Its district is still there, and still says its name to the keyboard.
   */
  const said: Box[] = [];
  const sayOf = new Map<string, Nameplate>();
  const order = [...drawn].sort((a, b) => (b.card.weight ?? b.card.count) - (a.card.weight ?? a.card.count) || cards.indexOf(a.card) - cards.indexOf(b.card));
  for (const one of order) {
    // Under its own district, whole or short: never over it or beside it, where it would read as a neighbor's.
    const sizes: [Nameplate, { width: number; height: number }, "under" | "above" | "aside"][] = [
      ["full", plate(one.card), "under"],
      ["short", plate(one.card).short, "under"],
    ];
    let chosen: Nameplate = "none";
    /*
     * THE MOST PRESSING NAME IS ALWAYS SAID. Where its district is hemmed in
     * on every side — a phone, a column of kinds a cell apart — it may stand
     * over the edge of a neighbor's ground, on its solid backing, rather
     * than leave the district the page is about unnamed or without its bar.
     * Every other name keeps off every other district's ground.
     */
    const first = one === order[0];
    type Try = readonly [Nameplate, { width: number; height: number }, "under" | "above" | "aside", boolean];
    const as = (over: boolean, kind: string): Try[] => sizes.filter(([name]) => name.startsWith(kind)).map(([n, size, at]) => [n, size, at, over] as const);
    // On clear ground first, whole and then short; only then over a neighbor's, whole and then short.
    const tries: Try[] = first ? [...as(false, "full"), ...as(false, "short"), ...as(true, "full"), ...as(true, "short")] : sizes.map(([n, size, at]) => [n, size, at, false] as const);
    for (const [name, size, at, over] of tries) {
      const box = plateBox(one, size, at);
      // Past the window's edge only counts for the whole map; flown closer, the camera pans to it.
      const inside = zoom !== 1 || closer !== 1 || (box.x >= 0 && box.y >= 0 && box.x + box.width <= canvas.width && box.y + box.height <= canvas.height);
      const clear =
        inside &&
        !said.some((other) => collides(box, other, 4)) &&
        (over || !drawn.some((other) => other !== one && onDiamond(box, other, other.halfW, other.halfH))) &&
        !avoid.some((other) => collides(box, other, 0));
      if (clear) {
        chosen = name;
        said.push(box);
        break;
      }
    }
    sayOf.set(one.card.id, chosen);
  }

  const placed: PlacedCard[] = drawn.map((one) => ({
    id: one.card.id,
    x: one.x - one.halfW,
    y: one.y - one.halfH,
    width: one.halfW * 2,
    height: one.halfH * 2 + (one.card.opened > 0 ? Math.max(one.card.openedMin ?? 0, one.card.opened) : 0),
    depth: one.depth,
    plot: one.plot,
    nameplate: sayOf.get(one.card.id) ?? "none",
  }));
  const e = extentAt(shape, where.cell);
  const frame: CityFrame = {
    cell: where.cell,
    originX: where.originX,
    originY: where.originY,
    pan: options.pan ?? { x: 0, y: 0 },
    extent: { x: where.originX + e.minX, y: where.originY + e.minY, width: e.maxX - e.minX, height: e.maxY - e.minY },
    openedShare: 1,
    ...(tilt !== 0.5 ? { tilt } : {}),
  };
  return { placed, frame, map };
}

/**
 * HOW FAR THE CAMERA MAY GO. A little way over a picture that fits — losing
 * the scene off the edge of its own window is not panning, it is dropping
 * it — and as far as the city reaches when the city is bigger than the
 * window: every district is reachable, none is lost. Symmetric about the
 * center so the same limit serves both directions, and read by the scene
 * and by the tests alike, so "reachable" means one thing.
 */
export function cameraLimit(result: { readonly width: number; readonly height: number; readonly city?: CityFrame; readonly visible?: { readonly width: number; readonly height: number } }): { readonly x: number; readonly y: number } {
  // The reader's window is what a panel over the scene leaves, not the whole painted ground.
  const { width, height } = result.visible ?? result;
  const slack = { x: width * 0.45, y: height * 0.45 };
  if (!result.city) return slack;
  const { extent } = result.city;
  const margin = 24;
  return {
    x: Math.max(slack.x, extent.x + extent.width - width + margin, -extent.x + margin),
    y: Math.max(slack.y, extent.y + extent.height - height + margin, -extent.y + margin),
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
export function districtsPastTheEdge(result: Pick<Layout, "nodes" | "width" | "height" | "city" | "visible">): readonly PastTheEdge[] {
  if (!result.city) return [];
  const { width, height } = result.visible ?? result;
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
 * zoomed. The city is placed about the canvas's center, so scaling its cell
 * by `ratio` moves every point away from (or toward) the center; the pan
 * moves the opposite way by the pointer's share of that, and what was under
 * the finger stays under it. Whole offset in, pan out: the camera's own
 * flight is part of where the city is, and only the pan is the person's.
 */
export function panForZoom(
  pan: { readonly x: number; readonly y: number },
  camera: { readonly x: number; readonly y: number },
  pointer: { readonly x: number; readonly y: number },
  center: { readonly x: number; readonly y: number },
  ratio: number,
): { readonly x: number; readonly y: number } {
  return {
    x: pan.x + (pointer.x - pan.x - camera.x - center.x) * (1 - ratio),
    y: pan.y + (pointer.y - pan.y - camera.y - center.y) * (1 - ratio),
  };
}
