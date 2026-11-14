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
  /** Stood before the others of no building: beside a page, a view before a kind's own list. */
  readonly first?: boolean;
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
  /** Words the picture draws itself (a district's "+n"): no name touches them, as none touches another name. */
  readonly words?: readonly Box[];
  /** What the camera can show: past it is covered, as far as it reaches past. */
  readonly bounds?: Box;
  /** A board with no clear place by its district stands nowhere, rather than smaller than can be read or over something (a phone). */
  readonly dropCovered?: boolean;
  /** Whether a board may be drawn a little smaller to stand on its own district: not where its words would drop below reading. */
  readonly shrink?: boolean;
  /** The narrowest a board may be drawn (`boardLeast`, where a small window's words are still read): a board is drawn as small as this, or half its size, before it stands nowhere. */
  readonly least?: number;
  /** How many half-boards up over its district a board may stand: a small window's City, which pans, takes them higher. */
  readonly reach?: number;
  /** Whether the views of no one kind stand on the plaza: not beside a page, where the plaza is behind the city. */
  readonly plaza?: boolean;
}

export interface SignsPlaced {
  /** Each board's foot: the middle of its card's lower edge, where its post meets it. */
  readonly feet: ReadonlyMap<string, Point>;
  /** Each board's post, from its foot down to the ground or the roof it stands on. */
  readonly posts: ReadonlyMap<string, number>;
  /** A board drawn smaller than the rest to stand by its own district where the room there is short: its share of their size. */
  readonly scales: ReadonlyMap<string, number>;
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

/**
 * What a pixel of a post across a board weighs, beside a pixel of a board on
 * what it must never stand on (1 and more): a crossing the length of a card
 * weighs less than one pixel of that, and more than any distance from where
 * a board belongs.
 */
const POST_CROSSING = 1e-3;

export function placeSigns(asked: SignsAsked): SignsPlaced {
  const { tiles, buildings, board } = asked;
  const reserved = asked.reserved ?? [];
  const words = asked.words ?? [];
  const bounds = asked.bounds;
  /** How much of a box the camera cannot show. */
  const outside = (box: Box): number => (bounds ? box.width * box.height - overlap(box, bounds) : 0);
  const names = new Map<string, Box>();
  const feet = new Map<string, Point>();
  const posts = new Map<string, number>();
  const scales = new Map<string, number>();
  const stood: Box[] = [];
  /** Each board's post as it stands: no other board stands across it. */
  const stoodPosts: Box[] = [];
  const kinds = [...tiles.keys()];

  const { width, height, post, gap } = board;
  const card = (foot: Point, scale = 1): Box => ({ x: foot.x - (width * scale) / 2, y: foot.y - height * scale, width: width * scale, height: height * scale });
  const taken = (box: Box, length: number) => ({ ...box, height: box.height + length });
  /** A board's post, from its foot down, as wide as it is drawn. */
  const postOf = (foot: Point, length: number): Box => ({ x: foot.x - 1, y: foot.y, width: 2, height: Math.max(0, length) });
  const nameBoxes = [...names.values()];
  /** What a board's card and post would stand on, weighed: another board or a name most, then ground, then what is kept clear. */
  // Past `bound` the sum is not finished: a place already worse than the best found is not weighed to the end.
  const covers = (foot: Point, length: number, ground: readonly Box[], blocks: readonly Box[], scale = 1, near?: { readonly stood: readonly Box[]; readonly posts: readonly Box[]; readonly names: readonly Box[] }, bound = Infinity): number => {
    const face = card(foot, scale);
    const cardBox = grow(face, gap / 2);
    const whole = taken(face, length);
    const named = grow(whole, 2);
    /*
     * A POST NEVER CROSSES A BOARD (Nick's decision). Each board placed is
     * an obstacle to the posts: this one's post down across a board already
     * standing, or this card across a post already standing. It is weighed
     * after what a board must never stand on — another board, a name, a
     * district's ground — and before how far a board stands from where it
     * belongs: of the places clear of those, one whose post crosses nothing
     * is always taken. Where none is, the post is drawn under the board it
     * crosses (`one-place.tsx`), never over its words.
     */
    const pole = postOf(foot, length);
    let crossed = 0;
    for (const other of near?.stood ?? stood) crossed += overlap(pole, other);
    for (const other of near?.posts ?? stoodPosts) crossed += overlap(cardBox, other);
    let sum = crossed * POST_CROSSING;
    for (const other of near?.stood ?? stood) sum += overlap(cardBox, other) * 4;
    for (const other of near?.names ?? nameBoxes) sum += overlap(named, other) * 4;
    if (sum > bound) return sum;
    // A district's ground is its diamond: the bare corners of its box are the street.
    for (const other of ground) {
      if (overlap(face, other) === 0) continue;
      const reach = diamondReach(face, other);
      if (reach < 1) sum += (1 - reach) * overlap(face, other) + 1;
    }
    if (sum > bound) return sum;
    for (const other of blocks) sum += overlap(face, other);
    for (const other of reserved) sum += overlap(whole, other) * 2;
    return sum + outside(whole) * 4;
  };
  const stand = (key: string, foot: Point, length: number, scale = 1) => {
    feet.set(key, foot);
    posts.set(key, length);
    if (scale !== 1) scales.set(key, scale);
    stood.push(grow(card(foot, scale), gap / 2));
    stoodPosts.push(postOf(foot, length));
  };
  const allTiles = [...tiles.values()];

  /* THE PAGE BEING READ, ON ITS BUILDING: straight over it, on the shortest post that stands its card clear — never to one side, where its post would come down on another building. */
  for (const sign of asked.signs) {
    if (!sign.building) continue;
    const roof = { x: sign.building.x + sign.building.width / 2, y: sign.building.y };
    const own = sign.kind ? tiles.get(sign.kind) : undefined;
    const ground = allTiles.filter((tile) => tile !== own);
    let best: { foot: Point; length: number; cost: number } | null = null;
    for (let raise = 0; raise <= 12; raise++) {
      const length = post + raise * (height / 3);
      const foot = { x: roof.x, y: roof.y - length };
      const cost = covers(foot, length, [...ground, ...(own ? [own] : [])], buildings) + raise * 2;
      if (!best || cost < best.cost) best = { foot, length, cost };
      if (best && best.cost <= raise * 2 + 0.5 && covers(best.foot, best.length, [...ground, ...(own ? [own] : [])], buildings) <= 0.5) break;
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
      if (asked.dropCovered && best && best.cost < 1e6) break;
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
    if (best && !(asked.dropCovered && best.cost >= 1e6)) stand(key, best.foot, post);
  };
  /*
   * A KIND'S VIEWS STAND ON ITS DISTRICT: each card over the district's
   * back, its post coming down onto the district's own ground — never
   * beside a neighbor, never in a column off to the side, where its post
   * pointed at bare ground. The shortest post first and nearest the
   * district's middle; where the room over it is short, a little to one
   * side, then drawn a little smaller; and only where nothing there is
   * clear, the place that covers least — or, asked (a phone), none.
   */
  const tries: { scale: number; raise: number; side: number; prefer: number }[] = [];
  // Smaller, as far as its words are still read, before a board with no clear place stands nowhere.
  const smaller = asked.shrink === false ? [1] : [1, 0.85, 0.7, 0.6, 0.5, 0.42, 0.35].filter((scale) => scale === 1 || (asked.least !== undefined ? scale >= 0.5 && width * scale >= asked.least : scale >= 0.7));
  for (const scale of smaller) for (let raise = 0; raise <= (asked.reach ?? 12); raise++) for (const side of [0, -0.3, 0.3, -0.55, 0.55, -0.8, 0.8]) tries.push({ scale, raise, side, prefer: raise * 10 + Math.abs(side) * 30 + (1 - scale) * 120 });
  tries.sort((a, b) => a.prefer - b.prefer);
  const standOn = (key: string, kind: string) => {
    // A district with many views stops looking long before it has tried every place for the last of them.
    const cap = (ofKind(kind).length > 6 ? 48 : Infinity);
    const tile = tiles.get(kind)!;
    // A district any of which is seen keeps its views' boards: they stand where it is seen.
    if (bounds && overlap(tile, bounds) < tile.width * tile.height * 0.05) return;
    const half = { w: tile.width / 2, h: tile.height / 2 };
    const middleX = tile.x + half.w;
    const middleY = tile.y + half.h;
    const roofs = buildings.filter((one) => one.x + one.width / 2 > tile.x && one.x + one.width / 2 < tile.x + tile.width && one.y + one.height > tile.y && one.y + one.height < tile.y + tile.height);
    const top = Math.min(tile.y, ...roofs.map((one) => one.y)) - 2;
    // Only what stands near enough to be stood on is weighed: the search stays as cheap with a thousand buildings as with ten.
    // The cards stand over the district's back, at most four of their heights up and a little to either side: what can stand there is all that is weighed.
    const reachX = half.w * 0.55 + width / 2 + gap;
    const up = ((asked.reach ?? 12) / 2 + 1) * height;
    const region = { x: middleX - reachX - half.w * 0.25, y: top - gap - up, width: 2 * reachX + half.w * 0.5, height: middleY - (top - gap - up) };
    const groundNear = allTiles.filter((one) => overlap(one, region) > 0);
    const blocksNear = buildings.filter((one) => overlap(one, region) > 0);
    const near = { stood: stood.filter((one) => overlap(one, region) > 0), posts: stoodPosts.filter((one) => overlap(one, region) > 0), names: nameBoxes.filter((one) => overlap(one, region) > 0) };
    let best: { foot: Point; length: number; scale: number; cost: number } | null = null;
    // The places tried, the least to ask first, and no more than so many: a district with sixty views stops looking long before it has tried every place for the sixtieth.
    let tried = 0;
    for (const { scale, raise, side, prefer } of tries) {
      if (best && prefer >= best.cost) break;
      if (++tried > cap && best) break;
      // Where the post meets the ground: on the district's back half, inside its diamond.
      const ground = { x: middleX + side * half.w, y: middleY - half.h * (1 - Math.abs(side)) * 0.6 };
      const foot = { x: ground.x, y: top - gap - raise * ((height * scale) / 2) };
      const length = ground.y - foot.y;
      const bound: number = best ? (best.cost - prefer) / 1e6 : Infinity;
      const cost: number = covers(foot, length, groundNear, blocksNear, scale, near, bound) * 1e6 + prefer;
      if (!best || cost < best.cost) best = { foot, length, scale, cost };
    }
    if (!best || (asked.dropCovered && best.cost >= 1e6)) return;
    stand(key, best.foot, best.length, best.scale);
  };
  // A kind's views first, the kinds with most of them first: they have one district to stand on, the plaza's have the whole back edge.
  const ofKind = (kind: string) => asked.signs.filter((one) => !one.building && one.kind === kind);
  /*
   * THE BOARDS ASKED FIRST STAND FIRST (beside a page, the app's views
   * before the kinds' own lists): where the city's side is narrow, a
   * district's view is not left without room by a neighbor's list board
   * climbing over it. The district with least room over its back — the
   * nearest the top of what is shown — first: its neighbors in front have
   * room to stand higher, it has none.
   */
  const firsts = asked.signs.filter((one) => one.first && !one.building && one.kind !== null && tiles.has(one.kind));
  const roomOver = (kind: string) => tiles.get(kind)!.y - (bounds?.y ?? 0);
  for (const sign of [...firsts].sort((a, b) => roomOver(a.kind!) - roomOver(b.kind!))) standOn(sign.key, sign.kind!);
  for (const kind of [...kinds].sort((a, b) => ofKind(b).length - ofKind(a).length)) {
    for (const sign of ofKind(kind)) if (!sign.first) standOn(sign.key, kind);
  }
  const plaza = asked.plaza === false ? [] : asked.signs.filter((sign) => !sign.building && (sign.kind === null || !tiles.has(sign.kind)));
  if (city) {
    plaza.forEach((sign, index) => standNear(sign.key, null, { x: city.x + city.width / 2 + (index - (plaza.length - 1) / 2) * stepX, y: city.y - post - 6 }));
  }

  /*
   * THE NAMES, LAST: beside the district, else under its front corner,
   * and only where none of those is clear on the district's own ground —
   * never over its buildings and their names, which are what Nearby is
   * for: a name drawn as a card over its records hid them.
   */
  const roofs = buildings.map((one) => ({ x: one.x - 4, y: one.y - 14, width: one.width + 8, height: one.height + 14 }));
  // And never on a board, nor across the post it stands on: the views stood first, where they belong; a name has more places to go.
  const signRooms = [...feet].flatMap(([key, foot]) => {
    const face = card(foot, scales.get(key) ?? 1);
    return [face, { x: foot.x - 3, y: foot.y, width: 6, height: posts.get(key) ?? post }];
  });
  const byFront = [...kinds].sort((a, b) => tiles.get(b)!.y + tiles.get(b)!.height - (tiles.get(a)!.y + tiles.get(a)!.height));
  for (const kind of byFront) {
    const size = asked.names.get(kind);
    if (!size) continue;
    const tile = tiles.get(kind)!;
    // A district the camera does not show says nothing: its name past the edge is a name cut off.
    if (bounds && overlap(tile, bounds) < tile.width * tile.height * 0.15) continue;
    const cx = tile.x + tile.width / 2;
    // Beside it first: the ground over its back and under its front is where its views and its front neighbor's stand.
    const middle: Box[] = [
      { x: tile.x + tile.width + 2, y: tile.y + tile.height / 2 - size.height / 2, ...size },
      { x: tile.x - size.width - 2, y: tile.y + tile.height / 2 - size.height / 2, ...size },
      { x: cx - size.width / 2, y: tile.y + tile.height + 2, ...size },
      { x: cx - size.width * 0.9, y: tile.y + tile.height + 2, ...size },
      { x: cx - size.width * 0.1, y: tile.y + tile.height + 2, ...size },
      { x: tile.x + tile.width + 2, y: tile.y + tile.height * 0.8 - size.height / 2, ...size },
      { x: tile.x - size.width - 2, y: tile.y + tile.height * 0.8 - size.height / 2, ...size },
      { x: cx - size.width / 2, y: tile.y + tile.height + size.height + 6, ...size },
      { x: tile.x + tile.width + 2, y: tile.y + tile.height / 2 - size.height * 1.5 - 2, ...size },
      { x: tile.x - size.width - 2, y: tile.y + tile.height / 2 - size.height * 1.5 - 2, ...size },
      { x: tile.x + tile.width + 2, y: tile.y + tile.height / 2 + size.height / 2 + 2, ...size },
      { x: tile.x - size.width - 2, y: tile.y + tile.height / 2 + size.height / 2 + 2, ...size },
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
      [...names.values(), ...words].reduce((sum, other) => sum + overlap(grow(box, 3), other) * 8, 0) +
      reserved.reduce((sum, other) => sum + overlap(box, other), 0) +
      outside(box) * 2 +
      roofs.reduce((sum, roof) => sum + overlap(box, roof), 0) +
      signRooms.reduce((sum, room) => sum + overlap(grow(box, 2), room) * 8, 0) +
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
    /*
     * Where every place by the district is taken (a small window's City,
     * the lattice dense), the nearest clear place round it: a little further
     * from its district, never over another name.
     */
    if (least > 0.5) {
      search: for (let ring = 1; ring <= 10; ring++) {
        for (let row = -ring; row <= ring; row++) {
          for (let col = -ring; col <= ring; col++) {
            if (Math.max(Math.abs(row), Math.abs(col)) !== ring) continue;
            const box = { x: cx - size.width / 2 + (col * (size.width + 6)) / 2, y: tile.y + tile.height / 2 - size.height / 2 + row * (size.height + 4), ...size };
            const c = cost(box);
            if (c < least - 0.5) {
              least = c;
              best = box;
            }
            if (c <= 0.5) break search;
          }
        }
      }
    }
    // Never past the edge of what is shown: kept inside it, as near its district as it can stand.
    if (bounds && outside(best) > 0.5) {
      best = { ...best, x: Math.max(bounds.x, Math.min(bounds.x + bounds.width - best.width, best.x)), y: Math.max(bounds.y, Math.min(bounds.y + bounds.height - best.height, best.y)) };
      if (best.x > tile.x + tile.width || best.x + best.width < tile.x) continue;
    }
    /*
     * NEVER ON ANOTHER NAME, NOR A BOARD. A name and its problems are
     * controls: one standing on another took the other's presses. Where
     * every place by its district is taken (a small window beside a page),
     * the nearest place clear of them both, inside what is shown, on a
     * district's ground if it must be; with none, the district says no name
     * here rather than one over another.
     */
    const onAnother = (box: Box) => [...names.values(), ...words].some((other) => overlap(grow(box, 2), other) > 0.5) || signRooms.some((room) => overlap(grow(box, 2), room) > 0.5);
    if (onAnother(best)) {
      let clear: Box | null = null;
      let leastClear = Infinity;
      for (let ring = 1; ring <= 10 && !clear; ring++) {
        for (let row = -ring; row <= ring; row++) {
          for (let col = -ring; col <= ring; col++) {
            if (Math.max(Math.abs(row), Math.abs(col)) !== ring) continue;
            const box = { x: best.x + (col * (size.width + 6)) / 3, y: best.y + row * (size.height + 4), ...size };
            if ((bounds && outside(box) > 0.5) || onAnother(box)) continue;
            const c = cost(box);
            if (c < leastClear) {
              leastClear = c;
              clear = box;
            }
          }
        }
      }
      if (!clear) continue;
      best = clear;
    }
    names.set(kind, best);
  }

  const boxes: Box[] = [...allTiles, ...names.values(), ...[...feet].map(([key, foot]) => taken(card(foot, scales.get(key) ?? 1), posts.get(key) ?? post))];
  const whole = boxes.length === 0 ? null : boxes.reduce((a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x), height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y) }));
  return { feet, posts, scales, names, whole };
}
