import type { PointerMenu } from "@graview/react/provider";

/*
 * THE PLACE MENU, FROM THE BAR (Roadmap f-place-menu-views): the place you
 * are on and each entry of the places drop-down open the Pages menu — a
 * right-click, Shift+F10 or the menu key, a finger resting on it — about the
 * place: its Open and new tab, and Hide and Delete where the viewer may
 * tidy it. The bar hears the gesture (`usePlaceGestures` in app-bar.tsx);
 * this, fetched with the bar's panes on the first one, opens the menu. On
 * Pages the menu is the routed face's own, asked for with
 * `PLACE_MENU_EVENT` on the face (it keeps its own provider under the
 * bar's); on the scene, the scene's.
 */

/** The event the bar asks the routed face's menu to open with; its `detail` is the menu, placed. */
export const PLACE_MENU_EVENT = "graview:place-menu";

/** A place's menu, before it is placed: its name, the kind's group, and what it is called. */
export type PlaceAim = Pick<PointerMenu, "place" | "about" | "title">;

/** What the bar's places say a place is by their keys: a picture (`place:` on Pages, `scene:` on the scene), or a kind's list. */
export function placeAim(place: { readonly key: string; readonly label: string; readonly group: string; readonly kind?: string | undefined }): PlaceAim {
  const picture = /^(?:place|scene):([^:]+):(.+)$/.exec(place.key);
  if (picture) return { place: picture[2]!, about: [`aggregate:${picture[1]}`], title: place.label };
  // A kind's list is about the kind; the home, or the whole thing, about nothing: the page's own rows, Find among them.
  return { about: place.group === "lists" && place.kind ? [`aggregate:${place.kind}`] : [], title: place.label };
}

/** Opens a place's menu at `element` — at the point a pointer gave, else at the element's start, as the keyboard does. */
export function openPlaceMenu(
  element: HTMLElement,
  place: Parameters<typeof placeAim>[0],
  scene: boolean,
  setMenuAt: (menu: PointerMenu | null) => void,
  x?: number,
  y?: number,
): void {
  const aim = placeAim(place);
  const box = element.getBoundingClientRect();
  const menu: PointerMenu = {
    ...aim,
    face: scene ? "scene" : "pages",
    x: Math.round(x ?? box.left + Math.min(16, box.width / 2)),
    y: Math.round(y ?? Math.min(box.bottom, box.top + 36)),
    returnTo: element,
  };
  // The routed face under this bar keeps its own menu: it is asked to open it.
  const face = scene ? null : (element.closest("[data-graview-embed], [data-graview-shell]")?.querySelector("[data-graview-face='pages']") ?? document.querySelector("[data-graview-face='pages']"));
  if (face) face.dispatchEvent(new CustomEvent(PLACE_MENU_EVENT, { detail: menu }));
  else setMenuAt(menu);
}

/** Where and when the keyboard or a resting finger opened a menu last: the browser's own contextmenu after it, on the same place, is not a second gesture. */
let openedBy = { on: null as HTMLElement | null, at: 0 };
/** How long a finger rests before the menu opens, and how far it may wander and still be resting — as on Pages. */
const LONG_PRESS_MS = 500;
const SLOP = 10;

/**
 * A GESTURE THE BAR HEARD ON A PLACE (`usePlaceGestures` in app-bar.tsx), on
 * `element` — a place's entry (`app-place-<key>`), or the one control
 * (`app-places-open`), which is the place you are on: a right-click opens
 * its menu at the pointer; the keyboard at the place; a finger, once it has
 * rested there half a second without wandering or lifting — and the press
 * that opened it then follows no link.
 */
export function placeGesture(
  event: Event,
  element: HTMLElement,
  places: readonly Parameters<typeof placeAim>[0][],
  current: string | null,
  scene: boolean,
  setMenuAt: (menu: PointerMenu | null) => void,
  lifted: { readonly at: number },
): void {
  const id = element.getAttribute("data-testid") ?? "";
  const key = id === "app-places-open" ? current : id.slice("app-place-".length);
  const place = places.find((one) => one.key === key);
  if (!place) return;
  if (event.type === "keydown") {
    openedBy = { on: element, at: Date.now() };
    return openPlaceMenu(element, place, scene, setMenuAt);
  }
  const { clientX: x, clientY: y } = event as MouseEvent;
  if (event.type === "contextmenu") {
    if (openedBy.on === element && Date.now() - openedBy.at < 700) return;
    return x === 0 && y === 0 ? openPlaceMenu(element, place, scene, setMenuAt) : openPlaceMenu(element, place, scene, setMenuAt, x, y);
  }
  // A finger: it went down when the event was made, and has rested once LONG_PRESS_MS have passed since.
  const down = Date.now() - Math.max(0, performance.now() - event.timeStamp);
  let wandered = false;
  const move = (moved: PointerEvent) => {
    if (Math.hypot(moved.clientX - x, moved.clientY - y) > SLOP) wandered = true;
  };
  document.addEventListener("pointermove", move);
  setTimeout(() => {
    document.removeEventListener("pointermove", move);
    if (wandered || (lifted.at !== 0 && lifted.at - down < LONG_PRESS_MS)) return;
    openedBy = { on: element, at: Date.now() };
    element.addEventListener(
      "click",
      (click) => {
        click.preventDefault();
        click.stopPropagation();
      },
      { capture: true, once: true },
    );
    openPlaceMenu(element, place, scene, setMenuAt, x, y);
  }, Math.max(0, LONG_PRESS_MS - (Date.now() - down)));
}
