import { useGraviewIfAny, type PointerMenu } from "@graview/react/provider";
import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

/*
 * THE PLACE MENU, FROM THE BAR (Roadmap f-place-menu-views): the place you
 * are on and each entry of the places drop-down open the Pages menu — a
 * right-click, Shift+F10 or the menu key, a finger resting on it — about the
 * place: its Open and new tab, and Hide and Delete where the viewer may
 * tidy it. On Pages the menu is the routed face's own, asked for with
 * `PLACE_MENU_EVENT` on the face (it keeps its own provider under the
 * bar's); on the scene, the scene's.
 */

/** The event the bar asks the routed face's menu to open with; its `detail` is the menu, placed. */
export const PLACE_MENU_EVENT = "graview:place-menu";

/** A place's menu, before it is placed: its name, the kind's group, and what it is called. */
export type PlaceAim = Pick<PointerMenu, "place" | "about" | "title">;

/** What the bar's places say a place is by their keys: a picture (`place:` on Pages, `scene:` on the scene), or a kind's list. */
export function placeAim(place: { readonly key: string; readonly label: string; readonly group: string; readonly kind?: string }): PlaceAim | null {
  const picture = /^(?:place|scene):([^:]+):(.+)$/.exec(place.key);
  if (picture) return { place: picture[2]!, about: [`aggregate:${picture[1]}`], title: place.label };
  if (place.group === "lists" && place.kind) return { about: [`aggregate:${place.kind}`], title: place.label };
  return null;
}

/** How long a finger rests before the menu opens, and how far it may wander and still be resting — as on Pages. */
const LONG_PRESS_MS = 500;
const SLOP = 10;

/** The handlers that open a place's menu from an element of the bar. */
export interface PlaceMenuHandlers {
  readonly onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: () => void;
  readonly onPointerCancel: () => void;
  readonly onClickCapture: (event: MouseEvent<HTMLElement>) => void;
}

/** The place menu's gestures for the bar's places; `null` where a place has no menu (the home), or nothing draws one. */
export function usePlaceMenu(scene: boolean): (aim: PlaceAim | null) => PlaceMenuHandlers | null {
  const setMenuAt = useGraviewIfAny()?.setMenuAt;
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const swallow = useRef(false);
  const openedBy = useRef(0);
  const stop = useCallback(() => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  }, []);
  useEffect(() => stop, [stop]);
  return useCallback(
    (aim: PlaceAim | null): PlaceMenuHandlers | null => {
      if (!aim || !setMenuAt) return null;
      const open = (element: HTMLElement, x?: number, y?: number) => {
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
      };
      return {
        onContextMenu: (event) => {
          // The browser's own with Shift held, as on Pages.
          if (event.shiftKey) return;
          event.preventDefault();
          event.stopPropagation();
          // The keyboard's and a resting finger's own gesture, said again by the browser, opens nothing new.
          if (Date.now() - openedBy.current < 700) return;
          if (event.clientX === 0 && event.clientY === 0) open(event.currentTarget);
          else open(event.currentTarget, event.clientX, event.clientY);
        },
        onKeyDown: (event) => {
          if (!(event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))) return;
          event.preventDefault();
          event.stopPropagation();
          openedBy.current = Date.now();
          open(event.currentTarget);
        },
        onPointerDown: (event) => {
          swallow.current = false;
          if (event.pointerType === "mouse" || !event.isPrimary) return;
          stop();
          const element = event.currentTarget;
          const { clientX: x, clientY: y } = event;
          press.current = {
            x,
            y,
            timer: setTimeout(() => {
              press.current = null;
              swallow.current = true;
              openedBy.current = Date.now();
              open(element, x, y);
            }, LONG_PRESS_MS),
          };
        },
        onPointerMove: (event) => {
          const at = press.current;
          if (at && Math.hypot(event.clientX - at.x, event.clientY - at.y) > SLOP) stop();
        },
        onPointerUp: stop,
        onPointerCancel: stop,
        onClickCapture: (event) => {
          if (!swallow.current) return;
          // The press that opened the menu by resting follows no link and presses nothing.
          swallow.current = false;
          event.preventDefault();
          event.stopPropagation();
        },
      };
    },
    [setMenuAt, scene, stop],
  );
}
