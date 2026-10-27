import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { PointerMenu } from "./context.js";

/*
 * THE SCENE'S GROUND ANSWERS A RIGHT-CLICK (FR-228, Roadmap
 * f-scene-right-click-always-ours). Only a card answered the gesture: a
 * right-click on empty ground opened nothing and left the browser's own
 * menu — reported from Graview Public as "the Scene often shows the
 * browser's menu". The ground now opens the scene's menu at the pointer,
 * about what is chosen or about nothing, as the routed face's ground does;
 * the browser keeps its own menu where it means something — Shift held, a
 * text field, text somebody selected — and a card keeps its own answer
 * (`SceneViewHost`, which stops the event). A finger resting half a second
 * on the ground or on a card opens the same menu on a phone, where there
 * is no right button, and the press that opened it then chooses nothing.
 */

/** How long a finger rests before the menu opens, and how far it may wander and still be resting — as on Pages. */
const LONG_PRESS_MS = 500;
const SLOP = 10;

/** Whether this is somewhere a person types, where the browser's own menu (paste, spelling) stays. */
function typingIn(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable || element.tagName === "TEXTAREA" || element.tagName === "SELECT") return true;
  return element.tagName === "INPUT" && !["button", "submit", "reset", "checkbox", "radio", "image", "file", "color", "range"].includes((element as HTMLInputElement).type);
}

/** Whether the press landed on text somebody selected: the browser's menu copies it. */
function onSelectedText(element: Element): boolean {
  const selected = typeof getSelection === "function" ? getSelection() : null;
  return selected !== null && !selected.isCollapsed && selected.containsNode(element, true);
}

/** The record a press landed on, when it landed on one: a pick target inside a view, else the view's own record. */
function recordUnder(target: Element): string | undefined {
  return target.closest("[data-graview-pick]")?.getAttribute("data-graview-pick") ?? target.closest("[data-graview-view]")?.getAttribute("data-graview-view") ?? undefined;
}

export function useGroundMenu({
  swallow,
  setMenuAt,
  setSelection,
}: {
  /** The drag's own flag for the click it is about to produce: a resting finger sets it too, so the press chooses nothing. */
  readonly swallow: RefObject<boolean>;
  readonly setMenuAt: (menu: PointerMenu | null) => void;
  readonly setSelection: (ids: readonly string[]) => void;
}) {
  /** When a resting finger opened the menu last: the browser's own contextmenu after it is not a second gesture. */
  const restedAt = useRef(0);
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const stop = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  const open = (target: Element, x: number, y: number) => {
    const on = recordUnder(target);
    // A press on a card chooses it and opens the menu about it, as a right-click on the card does; the ground's is about what is chosen.
    if (on) setSelection([on]);
    setMenuAt(on ? { x, y, on } : { x, y });
  };
  return {
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target as Element;
      // The browser's own: Shift held, a text field, editable text, text somebody selected.
      if (event.shiftKey || typingIn(target) || onSelectedText(target)) return;
      event.preventDefault();
      // A right-click in a menu or a pane already open over the ground opens no second one; a card's is the card's (it stopped the event).
      if (target.closest("[data-graview-popover], [data-graview-offstage]")) return;
      // A resting finger's own gesture, said again by the browser, opens nothing new.
      if (Date.now() - restedAt.current < 700) return;
      open(target, event.clientX, event.clientY);
    },
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      stop();
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      const target = event.target as Element;
      if (typingIn(target) || target.closest("[data-graview-popover], [data-graview-offstage], button, a, input, select, textarea")) return;
      const { clientX: x, clientY: y } = event;
      press.current = {
        x,
        y,
        timer: setTimeout(() => {
          press.current = null;
          restedAt.current = Date.now();
          // The click the lift will make is the press that opened the menu: it chooses nothing and closes nothing.
          swallow.current = true;
          setTimeout(() => (swallow.current = false), 700);
          open(target, x, y);
        }, LONG_PRESS_MS),
      };
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const held = press.current;
      if (held && Math.hypot(event.clientX - held.x, event.clientY - held.y) > SLOP) stop();
    },
    onPointerUp: stop,
  };
}
