/*
 * PAGES AND THE SCENE ARE ONE PLACE: THE ARITHMETIC
 * (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * Pure, no DOM. One number says where a person is: the ALTITUDE, from 0
 * (the page, the whole window) through 1 (the page as a panel beside its
 * place in the city) and 2 (the page standing on its building, the city
 * around it) to 3 (the whole city). It is not a mode: it is read off the
 * Scene's own camera — how close it is — so a slow pinch moves everything
 * a little, and the levels are where it rests when let go. From it follow
 * the page's box, how the page stands, and where the camera aims.
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
}

/** What a page address is in the city. */
export type PageWhere =
  | { readonly type: "home" }
  | { readonly type: "overview" }
  | { readonly type: "record"; readonly id: string; readonly kind: string }
  | { readonly type: "list"; readonly kind: string }
  | { readonly type: "place"; readonly as: string; readonly kinds: readonly string[] };

/** The levels: the page, the panel, stood back, the city. */
export const LEVELS = 3;
export const PAGE = 0;
export const PANEL = 1;
export const BACK = 2;
export const CITY = 3;

/** A window narrower than this is a phone's: the panel a sheet from the foot, the page standing flat. */
export const PHONE = 600;
const phoneOf = (view: View) => view.width <= PHONE;

/**
 * HOW CLOSE THE SCENE'S CAMERA IS AT EACH LEVEL — its own zoom from
 * altitude, where 1 is the whole city fitted to the window — closest at
 * the page and furthest at the city, so pulling back from a page is the
 * camera rising. The page's own (level 0) is where the camera waits, a
 * little closer than the panel's, so stepping out begins as a pull back.
 */
export function levelZooms(where: PageWhere, view: View): readonly [number, number, number, number] {
  if (where.type === "record") {
    const panel = phoneOf(view) ? 2 : 2.2;
    return [Math.min(2.9, panel * 1.3), panel, 1.4, 1];
  }
  if (where.type === "home" || where.type === "overview") return [1.8, 1.4, 1.15, 1];
  return [2.1, 1.6, 1.2, 1];
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
export const restingLevel = (altitude: number): number => Math.max(0, Math.min(LEVELS, Math.round(altitude)));

/**
 * THE PANEL'S BOX: on a desk a column at the window's right, the city to
 * its left; on a phone a sheet from the foot, the city above it.
 */
export function panelBox(view: View): Box {
  if (phoneOf(view)) {
    const top = Math.round(view.height * 0.42);
    return { x: 8, y: top, width: view.width - 16, height: view.height - top - 8 };
  }
  const width = Math.round(Math.max(420, Math.min(760, view.width * 0.36)));
  return { x: view.width - width - 12, y: 12, width, height: view.height - 24 };
}

/** Where the place stands on the window at a level: beside the panel at 1, low enough under the standing page at 2, the city's middle at 3. */
export function aimAt(level: number, view: View): Point {
  if (level <= PANEL) {
    const panel = panelBox(view);
    return phoneOf(view) ? { x: view.width / 2, y: panel.y / 2 } : { x: panel.x / 2, y: view.height / 2 };
  }
  if (level === BACK) return { x: view.width / 2, y: Math.round(view.height * (phoneOf(view) ? 0.7 : 0.68)) };
  return { x: view.width / 2, y: view.height / 2 };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** The page's box at an altitude: the window at 0, the panel from 1 on, every step between drawn. */
export function pageBox(altitude: number, view: View): Box {
  const full = { x: 0, y: 0, width: view.width, height: view.height };
  const panel = panelBox(view);
  const t = ease(Math.min(1, Math.max(0, altitude)));
  return { x: lerp(full.x, panel.x, t), y: lerp(full.y, panel.y, t), width: lerp(full.width, panel.width, t), height: lerp(full.height, panel.height, t) };
}

/** How the page stands: its foot's middle moved by (x, y), scaled, turned by `turn` (0 flat, 1 a desk's angle). Nothing, as a panel. */
export interface Standing {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly turn: number;
  readonly opacity: number;
}

export const AS_IT_IS: Standing = { x: 0, y: 0, scale: 1, turn: 0, opacity: 1 };

/**
 * HOW THE PAGE STANDS at an altitude past the panel, its box the panel's:
 * from the panel (1) to standing on its roof (2) — its foot's middle on the
 * point, about a fifth of the window wide at a desk and half on a phone,
 * turned a little at a desk and flat on a phone — and on to the city (3),
 * shrinking into its building and gone.
 */
export function standingAt(altitude: number, roof: Point, box: Box, view: View): Standing {
  if (altitude <= PANEL) return AS_IT_IS;
  const phone = phoneOf(view);
  const foot = { x: box.x + box.width / 2, y: box.y + box.height };
  const stoodWidth = phone ? view.width * 0.5 : Math.max(260, view.width * 0.2);
  const stood = { x: roof.x - foot.x, y: roof.y - 4 - foot.y, scale: stoodWidth / box.width, turn: phone ? 0 : 1, opacity: 1 };
  if (altitude <= BACK) {
    const t = ease(altitude - PANEL);
    return { x: lerp(0, stood.x, t), y: lerp(0, stood.y, t), scale: Math.exp(lerp(0, Math.log(stood.scale), t)), turn: lerp(0, stood.turn, t), opacity: 1 };
  }
  const t = ease(altitude - BACK);
  return { x: roof.x - foot.x, y: roof.y - foot.y, scale: stood.scale * Math.exp(lerp(0, Math.log(0.05), t)), turn: stood.turn * (1 - t), opacity: 1 - ease((t - 0.35) / 0.65) };
}

/** The standing as CSS, about the page's foot (`SHEET_ORIGIN`). */
export function standingCss(standing: Standing, view: View): string {
  if (standing.x === 0 && standing.y === 0 && standing.scale === 1 && standing.turn === 0) return "none";
  const turn = standing.turn > 0.001 ? ` perspective(${Math.round(Math.max(view.width, view.height) * 1.4)}px) rotateY(${(-14 * standing.turn).toFixed(3)}deg) rotateX(${(5 * standing.turn).toFixed(3)}deg)` : "";
  return `translate(${standing.x.toFixed(2)}px, ${standing.y.toFixed(2)}px)${turn} scale(${standing.scale.toFixed(5)})`;
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
 * THE POINT OF THE PICTURE THE PAGE STANDS ON: its building's roof, its
 * district's middle, where its districts meet, or the middle of the city.
 */
export function anchorOf(where: PageWhere, place: { readonly building?: Box | null; readonly district?: Box | null; readonly districts?: readonly Box[]; readonly all?: readonly Box[] }): Point | null {
  if (where.type === "record" && place.building) return { x: place.building.x + place.building.width / 2, y: place.building.y + place.building.height * 0.3 };
  if ((where.type === "record" || where.type === "list") && place.district) return middleOf(place.district);
  if (where.type === "place") return place.districts?.length === 1 ? middleOf(place.districts[0]!) : meetingOf(place.districts ?? [], place.all ?? []);
  const city = unionOf(place.all ?? []);
  return city ? middleOf(city) : null;
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
