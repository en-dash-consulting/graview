import type { Box, Point } from "./one-place-geometry.js";

/*
 * WHERE EVERYTHING AT THE CITY STANDS, CLEAR OF EVERYTHING ELSE
 * (Graview HQ feature:f-one-face-city-reads-clean).
 *
 * On a rich app — eleven kinds, three hundred records, ten views — the
 * City read badly: a view's board stood on a district's name, the page's
 * own shrunk board stood on a district, and most districts said no name at
 * all, because the Scene's names are a fixed size on the screen and the
 * City is fitted further out than the Scene lays them out for. So the one
 * face places the City's words itself, in one pass, in the picture's own
 * pixels as the camera has it at rest:
 *
 * - each district's NAME first, under its front corner where that ground
 *   is clear, else on its own ground — always said, never on another
 *   district's ground or another name;
 * - the board of the page being read on its building, its post as long as
 *   it takes to stand clear of every name and every other district;
 * - the views of one kind beside that kind's district, the nearest clear
 *   place to the room under its name, never nearer another district;
 * - the views of no one kind on the plaza at the city's back edge.
 *
 * Nothing placed stands on anything placed before it, nor on a district's
 * ground or buildings (a board), nor on what the caller keeps clear (the
 * page beside the city, what stands at the foot). Where nothing is clear —
 * a phone's City can run out of room — the place that covers least is
 * taken, and the camera's fit takes in all of it.
 */

/** One board to stand: what it is about decides where. */
export interface SignAsked {
  readonly key: string;
  /** The one kind it is a view of, by whose district it stands; null for the plaza. */
  readonly kind: string | null;
  /** The building it stands on: the page of one record. */
  readonly building?: Box | null;
}

export interface SignsAsked {
  /** Each district's ground, its box (the diamond inside it is its ground). */
  readonly tiles: ReadonlyMap<string, Box>;
  readonly buildings: readonly Box[];
  /** Each district's name, as wide and tall as it is drawn, in the picture's pixels; a district with none says none. */
  readonly names: ReadonlyMap<string, { readonly width: number; readonly height: number }>;
  readonly signs: readonly SignAsked[];
  /** A board's card, and the post it stands on at the least. */
  readonly board: { readonly width: number; readonly height: number; readonly post: number; readonly gap: number };
  /** What nothing stands on. */
  readonly reserved?: readonly Box[];
  /** What the camera can show: past it is covered, as far as it reaches past. */
  readonly bounds?: Box;
}

export interface SignsPlaced {
  /** Each board's foot: the middle of its card's lower edge, where its post meets it. */
  readonly feet: ReadonlyMap<string, Point>;
  /** Each board's post, from its foot down to the ground or the roof it stands on. */
  readonly posts: ReadonlyMap<string, number>;
  /** Each district's name, where it stands. */
  readonly names: ReadonlyMap<string, Box>;
  /** Everything placed and every district: what the City's camera fits. */
  readonly whole: Box | null;
}

const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const grow = (box: Box, by: number): Box => ({ x: box.x - by, y: box.y - by, width: box.width + 2 * by, height: box.height + 2 * by });

/** How far into a district's diamond a box reaches: above 1 is clear of it; the least of `|dx|/half-width + |dy|/half-height` over the box. */
export function diamondReach(box: Box, tile: Box): number {
  const cx = tile.x + tile.width / 2;
  const cy = tile.y + tile.height / 2;
  const nearest = (from: number, to: number, at: number) => Math.max(from, Math.min(to, at));
  const dx = Math.abs(nearest(box.x, box.x + box.width, cx) - cx) / Math.max(1, tile.width / 2);
  const dy = Math.abs(nearest(box.y, box.y + box.height, cy) - cy) / Math.max(1, tile.height / 2);
  return dx + dy;
}

/** From a point to the nearest edge of a box: none inside it. */
const gapTo = (p: Point, b: Box): number => Math.hypot(Math.max(b.x - p.x, 0, p.x - (b.x + b.width)), Math.max(b.y - p.y, 0, p.y - (b.y + b.height)));

export function placeSigns(asked: SignsAsked): SignsPlaced {
  const { tiles, buildings, board } = asked;
  const reserved = asked.reserved ?? [];
  const bounds = asked.bounds;
  /** How much of a box the camera cannot show. */
  const outside = (box: Box): number => (bounds ? box.width * box.height - overlap(box, bounds) : 0);
  const names = new Map<string, Box>();
  const feet = new Map<string, Point>();
  const posts = new Map<string, number>();
  const stood: Box[] = [];
  const kinds = [...tiles.keys()];

  /*
   * THE NAMES: under the front corner, else over the back one or beside it,
   * and only where none of those is clear on the district's own ground —
   * never over its buildings and their names, which are what Nearby is
   * for: a name drawn as a card over its records hid them.
   */
  const roofs = buildings.map((one) => ({ x: one.x - 4, y: one.y - 14, width: one.width + 8, height: one.height + 14 }));
  const byFront = [...kinds].sort((a, b) => tiles.get(b)!.y + tiles.get(b)!.height - (tiles.get(a)!.y + tiles.get(a)!.height));
  for (const kind of byFront) {
    const size = asked.names.get(kind);
    if (!size) continue;
    const tile = tiles.get(kind)!;
    // A district the camera does not show says nothing: its name past the edge is a name cut off.
    if (bounds && overlap(tile, bounds) < tile.width * tile.height * 0.15) continue;
    const cx = tile.x + tile.width / 2;
    const middle: Box[] = [
      { x: cx - size.width / 2, y: tile.y + tile.height + 2, ...size },
      { x: tile.x - size.width - 2, y: tile.y + tile.height / 2 - size.height / 2, ...size },
      { x: tile.x + tile.width + 2, y: tile.y + tile.height / 2 - size.height / 2, ...size },
      { x: cx - size.width / 2, y: tile.y + tile.height * 0.72 - size.height / 2, ...size },
      { x: cx - size.width / 2, y: tile.y + tile.height / 2 - size.height / 2, ...size },
    ];
    /*
     * At the edge of what is shown — a district half under the page beside
     * the city — each slid along inside it, as far as it stays under its own
     * district: the name whole, never cut by the edge.
     */
    const inside = (box: Box): Box => {
      if (!bounds) return box;
      const least = Math.max(bounds.x, tile.x + 24 - box.width);
      const most = Math.min(bounds.x + bounds.width - box.width, tile.x + tile.width - 24);
      return least <= most ? { ...box, x: Math.max(least, Math.min(most, box.x)) } : box;
    };
    const tries: Box[] = [...middle.map(inside), ...middle];
    const cost = (box: Box) =>
      [...names.values()].reduce((sum, other) => sum + overlap(grow(box, 3), other), 0) +
      reserved.reduce((sum, other) => sum + overlap(box, other), 0) +
      outside(box) * 2 +
      roofs.reduce((sum, roof) => sum + overlap(box, roof), 0) +
      kinds.reduce((sum, other) => sum + (other !== kind && diamondReach(box, tiles.get(other)!) < 1 ? (1 - diamondReach(box, tiles.get(other)!)) * size.width * size.height : 0), 0);
    let best = tries[0]!;
    let least = Infinity;
    for (const box of tries) {
      const c = cost(box);
      if (c < least - 0.5) {
        least = c;
        best = box;
      }
      if (c <= 0.5) break;
    }
    names.set(kind, best);
  }

  const { width, height, post, gap } = board;
  const card = (foot: Point): Box => ({ x: foot.x - width / 2, y: foot.y - height, width, height });
  const taken = (box: Box, length: number) => ({ ...box, height: box.height + length });
  const nameBoxes = [...names.values()];
  /** What a board's card and post would stand on, weighed: another board or a name most, then ground, then what is kept clear. */
  const covers = (foot: Point, length: number, ground: readonly Box[], blocks: readonly Box[]): number => {
    const cardBox = grow(card(foot), gap / 2);
    const whole = taken(card(foot), length);
    return (
      stood.reduce((sum, other) => sum + overlap(cardBox, other) * 4, 0) +
      nameBoxes.reduce((sum, other) => sum + overlap(grow(whole, 2), other) * 4, 0) +
      ground.reduce((sum, other) => sum + overlap(card(foot), other), 0) +
      blocks.reduce((sum, other) => sum + overlap(card(foot), other), 0) +
      reserved.reduce((sum, other) => sum + overlap(whole, other) * 2, 0) +
      outside(whole) * 4
    );
  };
  const stand = (key: string, foot: Point, length: number) => {
    feet.set(key, foot);
    posts.set(key, length);
    stood.push(grow(card(foot), gap / 2));
  };
  const allTiles = [...tiles.values()];

  /* THE PAGE BEING READ, ON ITS BUILDING: the shortest post that stands its card clear; a little to one side if that is shorter still. */
  for (const sign of asked.signs) {
    if (!sign.building) continue;
    const roof = { x: sign.building.x + sign.building.width / 2, y: sign.building.y };
    const own = sign.kind ? tiles.get(sign.kind) : undefined;
    const ground = allTiles.filter((tile) => tile !== own);
    let best: { foot: Point; length: number; cost: number } | null = null;
    for (let raise = 0; raise <= 12; raise++) {
      const length = post + raise * (height / 3);
      for (const side of [0, -0.5, 0.5, -1, 1]) {
        const foot = { x: roof.x + side * width, y: roof.y - length };
        const cost = covers(foot, length, [...ground, ...(own ? [own] : [])], buildings) + raise * 2 + Math.abs(side) * 4;
        if (!best || cost < best.cost) best = { foot, length, cost };
      }
      if (best && best.cost <= raise * 2 + 4 && covers(best.foot, best.length, [...ground, ...(own ? [own] : [])], buildings) <= 0.5) break;
    }
    if (best) stand(sign.key, best.foot, best.length);
  }

  /* THE PLAZA, AND EACH KIND'S VIEWS: the nearest clear place to where they belong. */
  const city = allTiles.length > 0 ? allTiles.reduce((a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x), height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y) })) : null;
  const stepX = width + gap;
  const stepY = height + post + gap;
  /* The places a board may stand round where it is wanted, nearest first: the first clear one is taken, and only where none is, the one that covers least. */
  const around: { col: number; row: number; far: number }[] = [];
  for (let row = -10; row <= 10; row++) for (let col = -14; col <= 14; col++) around.push({ col, row, far: Math.hypot((col * stepX) / 2, ((row * stepY) / 2) * 1.2) });
  around.sort((a, b) => a.far - b.far);
  /** A district the camera shows enough of to stand anything by: one past the edge says nothing, and its views stand where it is seen. */
  const inSight = (box: Box) => !bounds || overlap(box, bounds) >= box.width * box.height * 0.15;
  const standNear = (key: string, kind: string | null, want: Point) => {
    const own = kind ? tiles.get(kind) : undefined;
    // Where it belongs is out of sight (a district past the window at Nearby, the plaza behind it): it stands where that is seen, not shoved into view over something else.
    if (own ? !inSight(own) : bounds && !inSight({ x: want.x - width / 2, y: want.y - height, width, height })) return;
    let best: { foot: Point; cost: number } | null = null;
    for (const { col, row, far } of around) {
      if (best && far >= best.cost) break;
      const foot = { x: want.x + (col * stepX) / 2, y: want.y + (row * stepY) / 2 };
      // A view stands on its own district: a foot nearer another district's ground than its own reads as that one's — worse than far, never as bad as on top of something.
      const mine = own ? gapTo(foot, own) : 0;
      const astray = own !== undefined && kinds.some((other) => other !== kind && gapTo(foot, tiles.get(other)!) <= mine);
      const cost = (astray ? 1e5 : 0) + far;
      if (best && cost >= best.cost) continue;
      const covered = covers(foot, post, allTiles, buildings) * 1e6 + cost;
      if (!best || covered < best.cost) best = { foot, cost: covered };
    }
    if (best) stand(key, best.foot, post);
  };
  // A kind's views first, the kinds with most of them first: they have one district to stand by, the plaza's have the whole back edge.
  const ofKind = (kind: string) => asked.signs.filter((one) => !one.building && one.kind === kind);
  for (const kind of [...kinds].sort((a, b) => ofKind(b).length - ofKind(a).length)) {
    const tile = tiles.get(kind)!;
    const name = names.get(kind);
    const under = { x: tile.x + tile.width / 2, y: (name ? name.y + name.height : tile.y + tile.height) + gap + height };
    for (const sign of ofKind(kind)) standNear(sign.key, kind, under);
  }
  const plaza = asked.signs.filter((sign) => !sign.building && (sign.kind === null || !tiles.has(sign.kind)));
  if (city) {
    plaza.forEach((sign, index) => standNear(sign.key, null, { x: city.x + city.width / 2 + (index - (plaza.length - 1) / 2) * stepX, y: city.y - post - 6 }));
  }

  const boxes: Box[] = [...allTiles, ...names.values(), ...[...feet].map(([key, foot]) => taken(card(foot), posts.get(key) ?? post))];
  const whole = boxes.length === 0 ? null : boxes.reduce((a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x), height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y) }));
  return { feet, posts, names, whole };
}
