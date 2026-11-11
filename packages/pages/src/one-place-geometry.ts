/*
 * PAGES AND THE SCENE ARE ONE PLACE: THE ARITHMETIC
 * (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * Pure, no DOM. Every page address is a place in the Scene's own city, and
 * altitude is the Scene's own camera: the page, the panel, stood back,
 * the city. What is measured — where the Scene draws a building or a
 * district now — is measured on the Scene (`one-place-city.tsx`); here is
 * only what follows from it: which stops an address has, how close the
 * Scene's camera comes at each, where the place should stand on the window,
 * and how the page stands on it.
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

/** What a page address is in the city. */
export type PageWhere =
  | { readonly type: "home" }
  | { readonly type: "overview" }
  | { readonly type: "record"; readonly id: string; readonly kind: string }
  | { readonly type: "list"; readonly kind: string }
  | { readonly type: "place"; readonly as: string; readonly kinds: readonly string[] };

/**
 * One altitude. `page` (L0) is the page read; `panel` (L1) is the Scene's
 * map panel holding the page's place, the city beside it; `back` (L2) is
 * the page standing angled on its place with the city around it; `city` is
 * the Scene, with nothing over it.
 */
export type Stop = "page" | "panel" | "back" | "city";

/** A window narrower than this is a phone's: fewer stops, and the page drawn flat from above. */
export const PHONE = 600;

/**
 * THE STOPS, LOWEST FIRST: the page, the panel, stood back, the city — on a
 * phone too, where the panel is a sheet from the foot and the page stands
 * flat. Home has no panel (nothing is chosen on the map), so it stands over
 * the whole city and then is the overview.
 */
export function stopsOf(where: PageWhere, _width: number): readonly Stop[] {
  switch (where.type) {
    case "overview":
      return ["city"];
    case "home":
      return ["page", "back", "city"];
    default:
      return ["page", "panel", "back", "city"];
  }
}

/** The first stop above the page. */
export const firstStepOf = (where: PageWhere, width: number): Stop => stopsOf(where, width)[1] ?? "city";

/**
 * HOW CLOSE THE SCENE'S CAMERA COMES AT A STOP: its own zoom from altitude,
 * where 1 is the whole city fitted to the window. The page itself is the
 * first step's (the camera waits there, so stepping back begins in place).
 */
export function zoomAt(stop: Stop, where: PageWhere, width: number): number {
  const phone = width <= PHONE;
  const at = stop === "page" ? firstStepOf(where, width) : stop;
  if (at === "city" || where.type === "home" || where.type === "overview") return 1;
  if (where.type === "record") return at === "panel" ? (phone ? 2 : 2.2) : 1.3;
  return at === "panel" ? 1.6 : 1.15;
}

/**
 * THE STOP A ZOOM IS AT. The camera is the person's once a stop has been
 * reached: a zoom past the middle between this stop's camera and the next
 * one's, with some slack so a hand resting on a boundary does not flicker,
 * is that stop. Zoomed in past the panel's camera is the page again.
 */
export function stopAtZoom(zoom: number, now: Stop, where: PageWhere, width: number): Stop {
  if (now === "page") return now;
  const stops = stopsOf(where, width);
  const index = stops.indexOf(now);
  if (index < 0) return now;
  const here = zoomAt(now, where, width);
  const SLACK = 1.12;
  if (now === "panel" && zoom > here * 1.25) return "page";
  const above = stops[index + 1];
  if (above) {
    const out = zoomAt(above, where, width);
    if (out <= here && zoom < Math.sqrt(out * here) / SLACK) return above;
  }
  const below = stops[index - 1];
  if (below && below !== "page") {
    const close = zoomAt(below, where, width);
    if (close > here && zoom > Math.sqrt(close * here) * SLACK) return below;
  }
  return now;
}

/** How small the page stands at a stop: at a desk and on a phone. */
export function sheetScale(where: PageWhere, stop: Stop, width: number): number {
  const phone = width <= PHONE;
  if (stop === "page") return 1;
  if (stop === "city" || stop === "panel") return 0.04;
  // Stepped back: about a third of the window, where its words still read as a page.
  if (where.type === "home") return phone ? 0.44 : 0.4;
  return phone ? 0.42 : 0.34;
}

/** Where the place should stand on the window at a stop: low enough that the page above it fits. */
export function aimPoint(stop: Stop, where: PageWhere, view: { readonly width: number; readonly height: number }): Point {
  const room = sheetScale(where, stop === "page" ? firstStepOf(where, view.width) : stop, view.width) * view.height;
  return { x: view.width / 2, y: Math.min(view.height - 60, Math.max(view.height * 0.58, room + 70)) };
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
 * THE POINT THE PAGE STANDS ON, on the window, as the Scene draws it now:
 * the middle of its building's roof, the middle of its district, where its
 * districts meet, or the middle of the city.
 */
export function anchorOf(where: PageWhere, place: { readonly building?: Box | null; readonly district?: Box | null; readonly districts?: readonly Box[]; readonly all?: readonly Box[] }, view: { readonly width: number; readonly height: number }): Point | null {
  if (where.type === "record" && place.building) return { x: place.building.x + place.building.width / 2, y: place.building.y + place.building.height * 0.3 };
  if ((where.type === "record" || where.type === "list") && place.district) return middleOf(place.district);
  // A place of one kind stands on its district; of several, where they meet.
  if (where.type === "place") return place.districts?.length === 1 ? middleOf(place.districts[0]!) : meetingOf(place.districts ?? [], place.all ?? []);
  if (where.type === "home" || where.type === "overview") {
    const city = unionOf(place.all ?? []);
    return city ? middleOf(city) : { x: view.width / 2, y: view.height / 2 };
  }
  return null;
}

/** How the page stands: where its foot's middle is moved to, how small, how far turned. In, all nothing. */
export interface Standing {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly turn: number;
}

export const IN: Standing = { x: 0, y: 0, scale: 1, turn: 0 };

/**
 * HOW THE PAGE STANDS ON ITS POINT at a stop: its foot's middle on it, at
 * its scale; at a desk turned a little, a panel standing in the city; on a
 * phone flat, seen from above. Over the whole city the page floats above
 * the middle rather than standing on a roof.
 */
export function standingOn(stop: Stop, where: PageWhere, at: Point, view: { readonly width: number; readonly height: number }): Standing {
  if (stop === "page") return IN;
  const scale = sheetScale(where, stop, view.width);
  const over = where.type === "home" && stop !== "city";
  const foot = over ? { x: at.x, y: at.y + scale * view.height * 0.5 } : at;
  return { x: foot.x - view.width / 2, y: foot.y - view.height - (stop === "city" ? 0 : 4), scale, turn: view.width > PHONE && stop !== "city" ? 1 : 0 };
}

/** The standing as CSS, about the page's foot (`SHEET_ORIGIN`). */
export function standingCss(standing: Standing, view: { readonly width: number; readonly height: number }): string {
  if (standing.x === 0 && standing.y === 0 && standing.scale === 1 && standing.turn === 0) return "none";
  const turn = standing.turn > 0.001 ? ` perspective(${Math.round(Math.max(view.width, view.height) * 1.4)}px) rotateY(${(-14 * standing.turn).toFixed(2)}deg) rotateX(${(5 * standing.turn).toFixed(2)}deg)` : "";
  return `translate(${standing.x.toFixed(1)}px, ${standing.y.toFixed(1)}px)${turn} scale(${standing.scale.toFixed(4)})`;
}

/** A standing eased toward another by a share of the way. */
export function easedToward(from: Standing, to: Standing, share: number): Standing {
  const s = Math.max(0, Math.min(1, share));
  return { x: from.x + (to.x - from.x) * s, y: from.y + (to.y - from.y) * s, scale: from.scale + (to.scale - from.scale) * s, turn: from.turn + (to.turn - from.turn) * s };
}

/** The transform's origin: the middle of the page's foot. */
export const SHEET_ORIGIN = "50% 100%";
