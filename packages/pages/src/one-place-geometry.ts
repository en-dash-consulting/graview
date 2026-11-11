/*
 * PAGES AND THE SCENE ARE ONE PLACE: THE ARITHMETIC
 * (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * Pure, no DOM. Every page address is a place in the Scene's own city, and
 * altitude is the camera: the page, stepped back, the district, the city.
 * What is measured — where a building or a district stands — is measured on
 * the Scene itself (`one-place-city.tsx`); here is only what follows from
 * it: which stops an address has, where the camera stands at each, and how
 * the page stands over the place it is.
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
  | { readonly type: "place"; readonly kinds: readonly string[] };

/** One altitude. `page` is the page read; `city` is the Scene, with nothing over it. */
export type Stop = "page" | "back" | "district" | "city";

/** A window narrower than this is a phone's: fewer stops, and the page drawn flat from above. */
export const PHONE = 600;

/**
 * THE STOPS, LOWEST FIRST. A record has all four at a desk; a phone has
 * page, district and city. A kind's list stands on its district, so its
 * step back is the district; home stands over the whole city, so stepping
 * back from it once more is the overview.
 */
export function stopsOf(where: PageWhere, width: number): readonly Stop[] {
  const phone = width <= PHONE;
  switch (where.type) {
    case "record":
      return phone ? ["page", "district", "city"] : ["page", "back", "district", "city"];
    case "list":
      return phone ? ["page", "district", "city"] : ["page", "back", "city"];
    case "overview":
      return ["city"];
    default:
      return ["page", "back", "city"];
  }
}

/** The camera: the Scene scaled by `scale` about the window's top left, then moved by `x`, `y`. */
export interface Camera {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export const LEVEL: Camera = { scale: 1, x: 0, y: 0 };

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const middle = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** The camera that puts a point of the Scene at a point of the window, at a scale. */
export function cameraOn(at: Point, on: Point, scale: number): Camera {
  return { scale, x: on.x - at.x * scale, y: on.y - at.y * scale };
}

/** Where a point of the Scene is on the window, through a camera. */
export const through = (camera: Camera, point: Point): Point => ({ x: point.x * camera.scale + camera.x, y: point.y * camera.scale + camera.y });

/** The camera as CSS, about the window's top left. */
export const cameraCss = (camera: Camera): string => `translate(${camera.scale === 1 && camera.x === 0 && camera.y === 0 ? "0px, 0px" : `${camera.x.toFixed(1)}px, ${camera.y.toFixed(1)}px`}) scale(${camera.scale.toFixed(4)})`;

/** How small the page stands at a stop: at a desk and on a phone. */
export function sheetScale(where: PageWhere, stop: Stop, width: number): number {
  const phone = width <= PHONE;
  if (stop === "page") return 1;
  if (stop === "city") return 0.04;
  if (stop === "district") return where.type === "record" && !phone ? 0.16 : 0.34;
  // Stepped back: about a third of the window, where its words still read as a page.
  if (where.type === "home") return phone ? 0.44 : 0.4;
  return phone ? 0.42 : 0.34;
}

/**
 * WHERE THE CAMERA STANDS AT A STOP, given where the place stands in the
 * Scene (with no camera): the record's building, its district, the
 * districts a place shows, or the whole city. The page stands on the
 * place, so the camera leaves room above it for a page of this scale.
 */
export function cameraAt(stop: Stop, where: PageWhere, view: { readonly width: number; readonly height: number }, place: { readonly building?: Box | null; readonly district?: Box | null; readonly districts?: readonly Box[]; readonly city?: Box | null }): Camera {
  const { width, height } = view;
  if (stop === "city" || where.type === "home" || where.type === "overview") return LEVEL;
  const room = sheetScale(where, stop === "page" ? (width <= PHONE ? "district" : "back") : stop, width) * height;
  // The place's foot stands low enough that the page above it fits under the window's top.
  const foot = (scaled: number) => clamp(Math.max(height * 0.6, room + 40 + scaled / 2), height * 0.35, height - 40);
  const stepped = stop === "page" ? (width <= PHONE ? "district" : "back") : stop;
  if (where.type === "record" && stepped === "back" && place.building) {
    const box = place.building;
    const scale = clamp(120 / Math.max(box.width, box.height, 6), 1.8, 3.5);
    return cameraOn(middle(box), { x: width / 2, y: foot(box.height * scale) }, scale);
  }
  const district = where.type === "place" ? unionOf(place.districts ?? []) : place.district;
  if (district) {
    const fit = width <= PHONE ? 0.8 : where.type === "record" ? 0.34 : 0.5;
    const scale = clamp(Math.min((width * fit) / Math.max(district.width, 1), (height * (where.type === "record" ? 0.3 : 0.45)) / Math.max(district.height, 1)), 0.8, where.type === "record" ? 2 : 3);
    return cameraOn(middle(district), { x: width / 2, y: foot(district.height * scale) }, scale);
  }
  return LEVEL;
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

const inside = (point: Point, box: Box) => point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height;

/**
 * WHERE A PLACE OF SEVERAL KINDS STANDS: where their districts meet — the
 * middle of their middles — unless that falls inside one kind's district,
 * when it stands on a plaza at the city's edge, above the districts it
 * shows. Never inside one kind's district.
 */
export function meetingOf(districts: readonly Box[], all: readonly Box[]): Point | null {
  if (districts.length === 0) return null;
  const middles = districts.map(middle);
  const meet = { x: middles.reduce((sum, one) => sum + one.x, 0) / middles.length, y: middles.reduce((sum, one) => sum + one.y, 0) / middles.length };
  if (districts.length > 1 && !all.some((box) => inside(meet, box))) return meet;
  const around = unionOf(all.length > 0 ? all : districts)!;
  return { x: meet.x, y: around.y - 12 };
}

/**
 * WHERE THE PAGE'S FOOT STANDS, on the window: the top of its building's
 * roof, the top of its district, where its districts meet, or over the
 * middle of the city.
 */
export function standingPoint(stop: Stop, where: PageWhere, camera: Camera, place: { readonly building?: Box | null; readonly district?: Box | null; readonly districts?: readonly Box[]; readonly all?: readonly Box[]; readonly city?: Box | null }, view: { readonly width: number; readonly height: number }): Point {
  if (where.type === "record" && place.building && stop !== "district") return through(camera, { x: place.building.x + place.building.width / 2, y: place.building.y + 2 });
  if (where.type === "record" && place.building) return through(camera, { x: place.building.x + place.building.width / 2, y: place.building.y });
  if (where.type === "place") {
    const meet = meetingOf(place.districts ?? [], place.all ?? []);
    if (meet) return through(camera, meet);
  }
  const district = place.district;
  if (district && (where.type === "record" || where.type === "list")) return through(camera, { x: district.x + district.width / 2, y: district.y + district.height * 0.35 });
  const city = place.city;
  if (city) return through(camera, { x: city.x + city.width / 2, y: city.y + city.height * 0.5 });
  return { x: view.width / 2, y: view.height * 0.6 };
}

/**
 * HOW THE PAGE STANDS: its foot's middle on the point, at its scale. At a
 * desk it is turned a little, a panel standing in the city; on a phone it
 * is flat, seen from above. In, it is the page, untransformed.
 */
export function sheetTransform(stop: Stop, where: PageWhere, at: Point, view: { readonly width: number; readonly height: number }): string {
  if (stop === "page") return "none";
  const scale = sheetScale(where, stop, view.width);
  const tx = at.x - view.width / 2;
  // A page on the plaza or over the city floats a little above where it stands; on a building it stands on the roof.
  const lift = stop === "city" ? 0 : 6;
  const ty = at.y - view.height - lift;
  const angled = view.width > PHONE && stop !== "city";
  const turn = angled ? ` perspective(${Math.round(Math.max(view.width, view.height) * 1.4)}px) rotateY(-14deg) rotateX(5deg)` : "";
  return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)${turn} scale(${scale.toFixed(4)})`;
}

/** The transform's origin: the middle of the page's foot. */
export const SHEET_ORIGIN = "50% 100%";
