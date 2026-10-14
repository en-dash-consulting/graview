import { useEffect, useRef, type RefObject } from "react";

/*
 * THE KEYBOARD KEEPS TO WHAT IS SEEN.
 *
 * A panel floats over the scene (`--graview-dock` on a desk, `--graview-sheet`
 * on a phone), and the city's fit keeps every district in the part the
 * reader sees — until the reader comes closer, and the city runs under the
 * panel. Tab walked into districts nobody could see, the focus ring drawn
 * under the panel, and the browser scrolled the scene's own boxes to show
 * what it focused, so the picture slid out from under its camera.
 *
 * So: as Tab is pressed, a card wholly under the panel is passed over —
 * `inert` for that one press, handed back before anything else happens, so
 * a pointer, a screen reader and the next press see the card as it is. A
 * card the keyboard does land on is brought into the part that is seen by
 * the camera, and whatever the browser scrolled to show it is put back.
 */

const CARD = "[data-graview-view]";

/** The outermost card an element is in, within the scene. */
function cardOf(element: Element | null, stage: HTMLElement): HTMLElement | null {
  let card: HTMLElement | null = null;
  for (let at = element?.closest<HTMLElement>(CARD) ?? null; at && stage.contains(at); at = at.parentElement?.closest<HTMLElement>(CARD) ?? null) card = at;
  return card;
}

/** The part of the scene the reader sees: its box, less what the panel floats over. */
function seenPart(stage: HTMLElement, dock: { readonly right: number; readonly bottom: number }) {
  const box = stage.getBoundingClientRect();
  return { left: box.left, top: box.top, right: box.right - dock.right, bottom: box.bottom - dock.bottom, box };
}

export function useKeyboardKeepsToWhatIsSeen(
  stage: RefObject<HTMLElement | null>,
  dock: { readonly right: number; readonly bottom: number },
  /** Moves the camera so what stands at the screen moves by so much. */
  reveal: (dx: number, dy: number) => void,
): void {
  const live = useRef({ dock, reveal });
  live.current = { dock, reveal };
  useEffect(() => {
    const at = stage.current;
    if (!at) return;
    /* A PRESS OF TAB passes over what the panel covers. */
    const onKey = (event: KeyboardEvent) => {
      const { dock } = live.current;
      if (event.key !== "Tab" || event.defaultPrevented || (dock.right <= 0 && dock.bottom <= 0)) return;
      const seen = seenPart(at, dock);
      const passed: HTMLElement[] = [];
      for (const card of at.querySelectorAll<HTMLElement>(CARD)) {
        if (card.parentElement?.closest(CARD) || card.inert || card.contains(document.activeElement)) continue;
        const r = card.getBoundingClientRect();
        // The part of it inside the scene's box: what is off the screen is not under the panel.
        const left = Math.max(r.left, seen.box.left);
        const right = Math.min(r.right, seen.box.right);
        const top = Math.max(r.top, seen.box.top);
        const bottom = Math.min(r.bottom, seen.box.bottom);
        if (right <= left || bottom <= top) continue;
        const under = (dock.right > 0 && left >= seen.right - 1) || (dock.bottom > 0 && top >= seen.bottom - 1);
        if (!under) continue;
        card.inert = true;
        passed.push(card);
      }
      if (passed.length === 0) return;
      // Handed back once the browser has moved the keyboard: the card is covered for this press, not hidden.
      setTimeout(() => {
        for (const card of passed) card.inert = false;
      }, 0);
    };
    /* WHERE THE KEYBOARD LANDS is brought into the part that is seen. */
    const onFocus = (event: FocusEvent) => {
      const target = event.target as Element | null;
      const card = cardOf(target, at);
      if (!card) return;
      // The keyboard's landing, not a press: a card pressed with the pointer is where the reader already looks.
      let keyboard = true;
      try {
        keyboard = target?.matches(":focus-visible") ?? true;
      } catch {
        // An engine without the selector: take every landing as the keyboard's.
      }
      // After the browser has scrolled to show it, which is the camera's to do: the scene's own boxes do not scroll.
      requestAnimationFrame(() => {
        for (let box: HTMLElement | null = card.parentElement; box; box = box === at ? null : box.parentElement) {
          if (box.scrollTop !== 0) box.scrollTop = 0;
          if (box.scrollLeft !== 0) box.scrollLeft = 0;
        }
        if (keyboard && card.isConnected) bringIntoSight(card);
      });
    };
    const bringIntoSight = (card: HTMLElement) => {
      const seen = seenPart(at, live.current.dock);
      const r = card.getBoundingClientRect();
      const margin = 12;
      const shift = (low: number, high: number, from: number, to: number) =>
        // Larger than the part that is seen: its start is shown. Otherwise only as far as it takes.
        to - from > high - low - 2 * margin ? low + margin - from : from < low + margin ? low + margin - from : to > high - margin ? high - margin - to : 0;
      const dx = shift(seen.left, seen.right, r.left, r.right);
      const dy = shift(seen.top, seen.bottom, r.top, r.bottom);
      if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) live.current.reveal(Math.round(dx), Math.round(dy));
    };
    document.addEventListener("keydown", onKey, true);
    at.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      at.removeEventListener("focusin", onFocus);
    };
  }, [stage]);
}
