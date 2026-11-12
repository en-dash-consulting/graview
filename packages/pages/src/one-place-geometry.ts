/*
 * PAGES AND THE SCENE ARE ONE PLACE: THE ARITHMETIC
 * (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * Pure, no DOM. One number says where a person is: the ALTITUDE, from 0
 * (the page, the whole window) through 1 (the page as a panel beside its
 * place in the city) to 2 (the city, every page and view of the app a
 * board standing on its place, this page among them). It is not a mode: it
 * is read off the Scene's own camera — how close it is — so a slow pinch
 * moves everything a little, and the levels are where it rests when let go.
 * From it follow the page's box, where it stands, and where the camera aims.
 *
 * THE PROJECTION IS THE CITY'S OWN. The city is drawn isometric, its ground
 * a 2:1 lattice, and in that projection the ground's diagonal that runs
 * across the window is level on the window. A board standing upright along
 * that diagonal is therefore drawn as an upright rectangle: no shear, no
 * turn, no perspective, at every zoom — only moved and scaled, as the
 * camera moves and scales everything else. So a page goes into its board by
 * translation and uniform scale alone, and the boards keep their shape as
 * the camera rises or falls.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface View {
  readonly width: number;
  readonly height: number;
  /** How much of the window's top the app's bar holds: it stays there at every level, and nothing moves under it. */
  readonly top?: number;
  /** The panel as the person sized it: its width at a desk, the share of the window under the bar a phone's sheet leaves above it. Unsaid, the default. */
  readonly panel?: number;
}

/** How wide a desk's panel may be, and how high a phone's sheet may stand (the share above it), on this window. */
export function panelRange(view: View): { readonly min: number; readonly max: number; readonly default: number } {
  // A phone's sheet never rises so far that the city above it is lost under the control: it keeps the control's room and a band of city.
  if (phoneOf(view)) return { min: Math.min(0.4, Math.max(0.15, (CONTROL_ROOM + 180) / Math.max(1, view.height - (view.top ?? 0)))), max: 0.7, default: 0.4 };
  const fallback = Math.round(Math.max(420, Math.min(760, view.width * 0.36)));
  return { min: Math.min(fallback, 360), max: Math.max(fallback, Math.round(view.width * 0.72)), default: fallback };
}

/** What a page address is in the city. */
export type PageWhere =
  | { readonly type: "home" }
  | { readonly type: "overview" }
  | { readonly type: "record"; readonly id: string; readonly kind: string }
  | { readonly type: "list"; readonly kind: string }
  | { readonly type: "place"; readonly as: string; readonly kinds: readonly string[] };

/** The levels: the page, the panel beside the city, the city. */
export const PAGE = 0;
export const PANEL = 1;
export const CITY = 2;
export const LEVELS = CITY;

/** What each level is called, where a person is told it. */
export const LEVEL_NAMES: readonly [string, string, string] = ["Page", "Nearby", "City"];

/** The height the control at the foot keeps on a phone, above the sheet, with its margin. */
export const CONTROL_ROOM = 72;

/** A window narrower than this is a phone's: the panel a sheet from the foot. */
export const PHONE = 600;
const phoneOf = (view: View) => view.width <= PHONE;

/**
 * HOW CLOSE THE SCENE'S CAMERA IS AT EACH LEVEL — its own zoom from
 * altitude, where 1 is the whole city fitted to the window — closest at
 * the page and furthest at the city, so pulling back from a page is the
 * camera rising. The page's own (level 0) is where the camera waits, a
 * little closer than the panel's, so stepping out begins as a pull back.
 */
export function levelZooms(where: PageWhere, view: View): readonly [number, number, number] {
  if (where.type === "record") {
    const panel = phoneOf(view) ? 2 : 2.2;
    return [Math.min(2.9, panel * 1.3), panel, 1];
  }
  if (where.type === "home" || where.type === "overview") return [1.8, 1.4, 1];
  return [2.1, 1.6, 1];
}

/**
 * THE ALTITUDE A ZOOM IS AT: between two levels, as far between them as the
 * zoom is, on the ratio (so each step of a pinch moves it as much). Held
 * within the page and the city.
 */
export function altitudeAt(zoom: number, zooms: readonly number[]): number {
  if (zoom >= zooms[0]!) return 0;
  for (let level = 0; level < zooms.length - 1; level++) {
    const near = zooms[level]!;
    const far = zooms[level + 1]!;
    if (zoom <= near && zoom >= far) return level + Math.log(near / zoom) / Math.log(near / far);
  }
  return zooms.length - 1;
}

/** The zoom an altitude is at: `altitudeAt` the other way. */
export function zoomAtAltitude(altitude: number, zooms: readonly number[]): number {
  const a = Math.max(0, Math.min(zooms.length - 1, altitude));
  const level = Math.min(zooms.length - 2, Math.floor(a));
  const near = zooms[level]!;
  const far = zooms[level + 1]!;
  return near * Math.pow(far / near, a - level);
}

/** The level an altitude rests at when let go: the nearest. */
export const restingLevel = (altitude: number): number => Math.max(PAGE, Math.min(CITY, Math.round(altitude)));

/**
 * THE PANEL'S BOX: on a desk a column at the window's right, the city to
 * its left; on a phone a sheet from the foot, the city above it.
 */
export function panelBox(view: View): Box {
  const bar = view.top ?? 0;
  const range = panelRange(view);
  const asked = view.panel === undefined ? range.default : Math.max(range.min, Math.min(range.max, view.panel));
  if (phoneOf(view)) {
    const top = Math.round(bar + (view.height - bar) * asked);
    return { x: 8, y: top, width: view.width - 16, height: view.height - top - 8 };
  }
  const width = Math.round(asked);
  return { x: view.width - width - 12, y: bar + 12, width, height: view.height - bar - 24 };
}

/** Where the place stands on the window: beside the panel at the page and the panel, the city's middle at the city. */
export function aimAt(level: number, view: View, room: number = CONTROL_ROOM): Point {
  const bar = view.top ?? 0;
  if (level <= PANEL) {
    const panel = panelBox(view);
    // On a phone the control (and the legend, when it is open) rides at the foot of the city, above the sheet: the place is aimed in what they leave, never less than half of it.
    const kept = Math.max(CONTROL_ROOM, Math.min(room, (panel.y - bar) / 2));
    if (phoneOf(view)) return { x: view.width / 2, y: (bar + panel.y - kept) / 2 };
    // At a desk the control and the legend stand at the foot of the city's column: the place is aimed in what they leave above them.
    const foot = Math.max(0, Math.min(room - CONTROL_ROOM, (view.height - bar) / 2));
    return { x: panel.x / 2, y: bar + (view.height - bar - foot) / 2 };
  }
  // A little below the middle of what the bar leaves: the boards rise from the city, and want the room above it.
  return { x: view.width / 2, y: bar + (view.height - bar) * 0.56 };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** The page's box at an altitude: the window at 0, the panel from 1 on, every step between drawn. */
export function pageBox(altitude: number, view: View): Box {
  // The page under the bar: the window less the bar, which stays where it is.
  const bar = view.top ?? 0;
  const full = { x: 0, y: bar, width: view.width, height: view.height - bar };
  const panel = panelBox(view);
  const t = ease(Math.min(1, Math.max(0, altitude)));
  return { x: lerp(full.x, panel.x, t), y: lerp(full.y, panel.y, t), width: lerp(full.width, panel.width, t), height: lerp(full.height, panel.height, t) };
}

/*
 * THE BOARDS. Every page and view of the app stands in the city as a board:
 * an upright face, its foot on its place. A board is what a page is at the
 * city — the page's own top, cut to a board's proportion — so the page a
 * person was reading becomes its own board by moving and shrinking, and the
 * others are drawn the same way.
 */

/** A board's width in the city's own pixels, at the city's zoom (1). */
export const BOARD_WIDTH = 96;
/** A board's width at the city's zoom on this window: a fifth of a phone's width, at most `BOARD_WIDTH`. The city is fitted to the window, so the boards are sized with it. */
export const boardWidthFor = (view: View): number => Math.round(Math.max(64, Math.min(BOARD_WIDTH, view.width * 0.18)));
/** A board is this much wider than it is tall. */
export const BOARD_ASPECT = 1.5;

/** How tall a page is cut as it becomes its board: its own width over the board's proportion. */
export const boardCut = (panel: Box): number => panel.width / BOARD_ASPECT;

/**
 * THE PAGE AT AN ALTITUDE PAST THE PANEL: how much of it is shown (its box
 * cut from the panel's height to a board's proportion) and where its foot
 * stands, as a translation and a uniform scale of the panel — never a turn
 * or a shear. At 1 it is the panel as it is; at 2 it is its board, its
 * foot's middle on `foot` and as wide as `width`.
 */
export interface Standing {
  /** How far the foot's middle is moved. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  /** The page's box's height, cut from the panel's. */
  readonly height: number;
}

export function standingAt(altitude: number, panel: Box, foot: Point, width: number): Standing {
  const t = ease(Math.max(0, Math.min(1, altitude - PANEL)));
  const height = lerp(panel.height, boardCut(panel), t);
  const from = { x: panel.x + panel.width / 2, y: panel.y + height };
  const scale = Math.exp(lerp(0, Math.log(width / panel.width), t));
  return { x: lerp(0, foot.x - from.x, t), y: lerp(0, foot.y - from.y, t), scale, height };
}

/** The standing as CSS, about the page's foot (`SHEET_ORIGIN`): a translation and a uniform scale, nothing else. */
export function standingCss(standing: Standing): string {
  if (standing.x === 0 && standing.y === 0 && standing.scale === 1) return "none";
  return `translate(${standing.x.toFixed(2)}px, ${standing.y.toFixed(2)}px) scale(${standing.scale.toFixed(5)})`;
}

/** The transform's origin: the middle of the page's foot. */
export const SHEET_ORIGIN = "50% 100%";

/** The camera between stops, as the Scene paints it: a point `p` of the picture is on screen at `p · s + (x, y)`. */
export interface Live {
  readonly x: number;
  readonly y: number;
  readonly s: number;
}

export const LEVEL_LIVE: Live = { x: 0, y: 0, s: 1 };

/** Where the camera puts a point of the picture. */
export const project = (live: Live, p: Point): Point => ({ x: p.x * live.s + live.x, y: p.y * live.s + live.y });

/** The camera that grows the picture by `s` and puts its point `p` at the window's point `at`. */
export const cameraPutting = (p: Point, at: Point, s: number): Live => ({ s, x: at.x - p.x * s, y: at.y - p.y * s });

/**
 * BETWEEN TWO CAMERAS, AS FAR AS `t`: the place the page stands on moves in
 * a straight line on the window while the picture grows or shrinks
 * steadily, so it never swings out of the way and back.
 */
export function cameraBetween(from: Live, to: Live, about: Point, t: number): Live {
  const a = project(from, about);
  const b = project(to, about);
  const s = Math.exp(lerp(Math.log(from.s), Math.log(to.s), t));
  return cameraPutting(about, { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }, s);
}

/** The smallest box around boxes, or null for none. */
export function unionOf(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

const middleOf = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const inside = (point: Point, box: Box) => point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height;

/**
 * WHERE A PLACE OF SEVERAL KINDS STANDS: where their districts meet — the
 * middle of their middles — unless that falls inside one kind's district,
 * when it stands on a plaza at the city's edge, above the districts it
 * shows. Never inside one kind's district.
 */
export function meetingOf(districts: readonly Box[], all: readonly Box[]): Point | null {
  if (districts.length === 0) return null;
  const middles = districts.map(middleOf);
  const meet = { x: middles.reduce((sum, one) => sum + one.x, 0) / middles.length, y: middles.reduce((sum, one) => sum + one.y, 0) / middles.length };
  if (districts.length > 1 && !all.some((box) => inside(meet, box))) return meet;
  const around = unionOf(all.length > 0 ? all : districts)!;
  return { x: meet.x, y: around.y - 12 };
}

/**
 * THE POINT OF THE PICTURE A PAGE STANDS ON: its building's roof, its
 * district's middle, where its districts meet, or — the home — a plaza at
 * the city's back edge, over all of it.
 */
export function anchorOf(where: PageWhere, place: { readonly building?: Box | null; readonly district?: Box | null; readonly districts?: readonly Box[]; readonly all?: readonly Box[] }): Point | null {
  if (where.type === "record" && place.building) return { x: place.building.x + place.building.width / 2, y: place.building.y + place.building.height * 0.3 };
  if ((where.type === "record" || where.type === "list") && place.district) return middleOf(place.district);
  if (where.type === "place") return place.districts?.length === 1 ? middleOf(place.districts[0]!) : meetingOf(place.districts ?? [], place.all ?? []);
  const city = unionOf(place.all ?? []);
  return city ? middleOf(city) : null;
}

/**
 * WHERE A PAGE'S BOARD STANDS: on a district, at its back corner, so the
 * board rises behind the district's buildings rather than in front of them; on a
 * record, on its building's roof; the home, at the city's back edge.
 */
export function footOf(where: PageWhere, place: { readonly building?: Box | null; readonly district?: Box | null; readonly districts?: readonly Box[]; readonly all?: readonly Box[] }): Point | null {
  if (where.type === "record" && place.building) return { x: place.building.x + place.building.width / 2, y: place.building.y + place.building.height * 0.3 };
  // The district's back corner: the top of its tile as the window has it.
  const back = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + 2 });
  if ((where.type === "record" || where.type === "list") && place.district) return back(place.district);
  if (where.type === "place") {
    if (place.districts?.length === 1) return back(place.districts[0]!);
    return meetingOf(place.districts ?? [], place.all ?? []);
  }
  const city = unionOf(place.all ?? []);
  return city ? { x: city.x + city.width / 2, y: city.y - 8 } : null;
}

/**
 * WHERE A LINE LEAVES THE PAGE: from the page's edge that faces the city —
 * its left at a desk, its top on a phone — level with the part it is
 * about, so no line is drawn across the words of the page.
 */
export function leaveFrom(part: Point, page: Box, phone: boolean): Point {
  if (phone) return { x: Math.max(page.x + 12, Math.min(page.x + page.width - 12, part.x)), y: page.y };
  return { x: page.x, y: Math.max(page.y + 12, Math.min(page.y + page.height - 12, part.y)) };
}

/**
 * A LINE THAT WOULD END UNDER THE PAGE ends at the page's edge nearest its
 * building instead, an arrow there pointing on toward it. Null when the
 * building is not under the page.
 */
export function edgeToward(to: Point, page: Box): Point | null {
  if (!inside(to, page)) return null;
  const edges = [
    { x: page.x, y: to.y },
    { x: page.x + page.width, y: to.y },
    { x: to.x, y: page.y },
    { x: to.x, y: page.y + page.height },
  ];
  return edges.reduce((best, p) => (Math.hypot(p.x - to.x, p.y - to.y) < Math.hypot(best.x - to.x, best.y - to.y) ? p : best));
}

/**
 * THE NEAREST BOARD IN A DIRECTION, for the arrow keys: among the boxes
 * whose middle lies that way, the one nearest, the way it points counting
 * double against the way across. Null when there is none that way.
 */
export function nearestThatWay(from: Box, others: readonly { readonly key: string; readonly box: Box }[], way: "left" | "right" | "up" | "down"): string | null {
  const at = middleOf(from);
  let best: { key: string; cost: number } | null = null;
  for (const other of others) {
    const m = middleOf(other.box);
    const dx = m.x - at.x;
    const dy = m.y - at.y;
    const along = way === "left" ? -dx : way === "right" ? dx : way === "up" ? -dy : dy;
    const across = way === "left" || way === "right" ? Math.abs(dy) : Math.abs(dx);
    if (along <= 1) continue;
    const cost = along + across * 2;
    if (!best || cost < best.cost) best = { key: other.key, cost };
  }
  return best?.key ?? null;
}

/*
 * THE VIEWS STAND ON THEIR DISTRICTS. A view of one kind stands as a sign in
 * the ground the city keeps for it under its district's name — the layout
 * holds that room (`LayoutOptions.standing`), so no other district's name
 * is placed on it — three to a row, the rows one behind another down the
 * ground; a view of several kinds, or of none (the home, the connections),
 * stands on the plaza at the city's back edge, the rows rising behind it.
 * Each sign is an upright card on a short post, facing the camera: in the
 * city's projection a face along the level diagonal is drawn as it is.
 */

/** Signs side by side in a row before another stands behind. */
export const SIGNS_PER_ROW = 3;
/** The post a sign stands on, and the room between signs, in the city's pixels at its zoom. */
export const SIGN_POST = 10;
export const SIGN_GAP = 8;

/** The room a district keeps under its name for so many signs this wide: what the layout is asked to hold. */
export function signRoom(count: number, width: number): { readonly width: number; readonly height: number } {
  const rows = Math.ceil(count / SIGNS_PER_ROW);
  const cols = Math.min(count, SIGNS_PER_ROW);
  return { width: cols * width + (cols - 1) * SIGN_GAP, height: rows * (width / BOARD_ASPECT + SIGN_POST + SIGN_GAP) };
}

/**
 * WHERE EACH SIGN'S CARD STANDS — the middle of its foot, where its post
 * meets it — for signs in rows from a point: `down` from the top of the
 * room under a district's name (the first row at the top), or `up` from the
 * plaza's front edge (the first row in front, the rest rising behind).
 */
export function signFeet(keys: readonly string[], from: Point, width: number, way: "down" | "up"): ReadonlyMap<string, Point> {
  const height = width / BOARD_ASPECT;
  const step = height + SIGN_POST + SIGN_GAP;
  const feet = new Map<string, Point>();
  keys.forEach((key, index) => {
    const row = Math.floor(index / SIGNS_PER_ROW);
    const inRow = Math.min(SIGNS_PER_ROW, keys.length - row * SIGNS_PER_ROW);
    const col = index % SIGNS_PER_ROW;
    const x = from.x + (col - (inRow - 1) / 2) * (width + SIGN_GAP);
    const y = way === "down" ? from.y + row * step + height : from.y - SIGN_POST - row * step;
    feet.set(key, { x, y });
  });
  return feet;
}

/**
 * THE CAMERA THAT FITS THE CITY AND ITS VIEWS into the part of the window
 * nothing stands over — below the bar, above the control at the foot — with
 * a margin: how much closer (or further) than now, and where.
 */
export function fitCamera(around: Box, area: Box, margin = 16, most = Infinity): Live {
  const room = { x: area.x + margin, y: area.y + margin, width: Math.max(1, area.width - 2 * margin), height: Math.max(1, area.height - 2 * margin) };
  const s = Math.min(most, room.width / Math.max(1, around.width), room.height / Math.max(1, around.height));
  return cameraPutting({ x: around.x + around.width / 2, y: around.y + around.height / 2 }, { x: room.x + room.width / 2, y: room.y + room.height / 2 }, s);
}

/**
 * THE CITY FITTED BESIDE WHAT STANDS AT THE FOOT. The control, the legend
 * over it when it is open, and the timeline beside them each keep their
 * rect: the city is fitted either above all of them, or to the right of
 * them and above the control, whichever draws it larger — never under any.
 */
export function fitBeside(around: Box, view: View, reserved: readonly Box[], margin = 16, most = Infinity): Live {
  const bar = view.top ?? 0;
  const whole = { x: 0, y: bar, width: view.width, height: view.height - bar };
  const kept = reserved.filter((box) => box.width > 0 && box.height > 0);
  if (kept.length === 0) return fitCamera(around, whole, margin, most);
  const top = Math.min(...kept.map((box) => box.y));
  const right = Math.max(...kept.map((box) => box.x + box.width));
  const above = fitCamera(around, { x: 0, y: bar, width: view.width, height: Math.max(1, top - bar) }, margin, most);
  // Beside them, above the line of what stands lowest (the control itself): nothing is drawn down at the window's foot.
  const lowest = Math.max(...kept.map((box) => box.y + box.height));
  const foot = Math.min(...kept.filter((box) => box.y + box.height >= lowest - 1).map((box) => box.y));
  const beside = fitCamera(around, { x: right, y: bar, width: Math.max(1, view.width - right), height: Math.max(1, foot - bar) }, margin, most);
  return beside.s > above.s ? beside : above;
}

/*
 * A LINE KEEPS TO THE CITY. It leaves the page's edge outward — left at a
 * desk, up on a phone — and runs only through the part of the window the
 * city is seen in: never over the page, the bar, the control at the foot or
 * the legend over it. A record whose building is outside that part (under
 * the page, past the window, under the control) is pointed at: the line
 * ends on that part's edge nearest it, with a marker toward it. A line with
 * no way through is not drawn.
 */
export interface Route {
  /** Where the line starts: on the page's edge, inside the city's part. */
  readonly from: Point;
  /** Where the line ends: the building, or the edge of the city's part nearest it. */
  readonly to: Point;
  /** The building, when it is out of the city's part and the line points toward it. */
  readonly toward: Point | null;
  /** The curve's one control point, out from the page's edge and inside the city's part. */
  readonly bend: Point;
}

const clampTo = (p: Point, box: Box): Point => ({ x: Math.max(box.x, Math.min(box.x + box.width, p.x)), y: Math.max(box.y, Math.min(box.y + box.height, p.y)) });
const grown = (box: Box, by: number): Box => ({ x: box.x - by, y: box.y - by, width: box.width + 2 * by, height: box.height + 2 * by });
const inBox = (p: Point, box: Box): boolean => p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height;

/** A point of the curve from `from` through `bend` to `to`, as far as `t`. */
export const curveAt = (from: Point, bend: Point, to: Point, t: number): Point => ({
  x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * bend.x + t * t * to.x,
  y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * bend.y + t * t * to.y,
});

/** Whether no point of the curve falls inside any of the boxes. */
export function curveClear(from: Point, bend: Point, to: Point, boxes: readonly Box[], steps = 48): boolean {
  if (boxes.length === 0) return true;
  for (let i = 1; i < steps; i++) {
    const p = curveAt(from, bend, to, i / steps);
    if (boxes.some((box) => inside(p, box))) return false;
  }
  return true;
}

/** How far a line's end keeps from the page's edge: its ring's reach, and the panel's edge that is dragged there. */
export const END_ROOM = 20;
/** How far a line keeps from what is reserved: its stroke and a little air. */
const KEEP_OFF = 3;
/** And how far its end ring reaches. */
const RING = 9;

export function routeLine(given: Point, target: Point, area: Box, phone: boolean, reserved: readonly Box[] = []): Route | null {
  const keepOut = reserved.filter((box) => box.width > 0 && box.height > 0).map((box) => grown(box, KEEP_OFF));
  // The line starts where the page's edge meets the city's part: never beside the control, below or past it.
  let from = phone ? { x: Math.max(area.x, Math.min(area.x + area.width, given.x)), y: given.y } : { x: given.x, y: Math.max(area.y, Math.min(area.y + area.height, given.y)) };
  // Something standing on that edge (a phone's control rides on the sheet's top): the line leaves the edge past it.
  for (let step = 0; step < keepOut.length; step++) {
    const on = keepOut.find((box) => (phone ? from.x >= box.x && from.x <= box.x + box.width && box.y + box.height >= from.y - 40 && box.y <= from.y : from.y >= box.y && from.y <= box.y + box.height && box.x + box.width >= from.x - 40 && box.x <= from.x));
    if (!on) break;
    from = phone ? { x: on.x + on.width + 8, y: from.y } : { x: from.x, y: on.y - 8 };
  }
  if (phone ? from.x > area.x + area.width : from.y < area.y) return null;
  // The end keeps clear of the page's edge, by its ring and the edge that is dragged there.
  const ends: Box = phone ? { ...area, height: Math.max(0, area.height - END_ROOM) } : { ...area, width: Math.max(0, area.width - END_ROOM) };
  let to = inBox(target, ends) ? target : clampTo(target, ends);
  // An end under what is reserved stops at its nearest edge instead, pointing on.
  const under = keepOut.find((box) => inside(to, grown(box, RING)));
  if (under) {
    const out = grown(under, RING + 1);
    const at = to;
    const ways = [
      { x: at.x, y: out.y },
      { x: out.x + out.width, y: at.y },
      { x: out.x, y: at.y },
      { x: at.x, y: out.y + out.height },
    ].filter((p) => inBox(p, ends) && !keepOut.some((box) => inside(p, grown(box, RING))));
    if (ways.length === 0) return null;
    to = ways.reduce((best, p) => (Math.hypot(p.x - at.x, p.y - at.y) < Math.hypot(best.x - at.x, best.y - at.y) ? p : best));
  }
  const toward = to.x === target.x && to.y === target.y ? null : target;
  /*
   * THE BEND: out along the edge's normal and never past the city's part —
   * every point of the curve lies between its ends and this one — as near
   * the edge as lets the curve keep off everything reserved.
   */
  const reach = Math.min(80, Math.max(16, Math.hypot(to.x - from.x, to.y - from.y) / 2));
  const span = phone ? from.y - area.y : from.x - area.x;
  for (let out = reach; out <= Math.max(reach, span) + 12; out += 12) {
    const bend = clampTo(phone ? { x: from.x, y: from.y - out } : { x: from.x - out, y: from.y }, area);
    if (curveClear(from, bend, to, keepOut)) return { from, to, toward, bend };
  }
  return null;
}

/** The part of the window the city is seen in beside the page: left of it at a desk, above it on a phone; under the bar, above the control. */
export function cityArea(page: Box, view: View, control: Box | null, phone: boolean): Box {
  const top = (view.top ?? 0) + 6;
  // Above the control: on a phone it rides on the sheet, so the city's part ends over it.
  const bottom = phone ? page.y - 6 : Math.min(view.height - 6, control ? control.y - 6 : Infinity);
  const right = phone ? view.width - 6 : page.x - 6;
  return { x: 6, y: top, width: Math.max(0, right - 6), height: Math.max(0, bottom - top) };
}
