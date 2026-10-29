import { useEffect, type RefObject } from "react";

/*
 * A PRESS LANDS ON WHAT WAS AIMED AT.
 *
 * A tap that chooses a district can move the city — the sheet it opens on a
 * phone covers the foot, and the chosen district is brought up above it —
 * and a person's next tap, a beat later, was aimed at the picture as it
 * stood when they lifted their finger. The second tap of a double-tap found
 * the zoom's "+" where the district had been, and a quick tap on the next
 * district chose whatever had slid under it.
 *
 * So the tap that chose takes a note of where every card stood as it was
 * pressed (`cards`), and the next press, if it comes within a beat, is
 * judged against that note: when the card it was aimed at is not the one
 * now under it, the press is the aimed card's — a click on it, or, when it
 * is the card the first tap chose, the double-tap that goes in. The press
 * on what slid under the finger is heard by nobody. A press after the beat,
 * or one whose target never moved, is left exactly as it was.
 */

/** How long after a tap the next press is judged against the picture the tap was aimed at. */
export const AIM_MS = 650;
/** How soon a second tap on the card the first one chose is a double-tap. */
export const DOUBLE_TAP_MS = 400;

interface Aim {
  readonly at: number;
  /** The card the tap chose, if it was on one. */
  readonly on: string | null;
  readonly cards: readonly { readonly id: string; readonly box: DOMRect }[];
}

const CARD = "[data-graview-view]";
const CHROME = "button, a, input, select, textarea, [role='button'], aside, section[aria-label], [data-graview-popover], [data-graview-offstage], [data-graview-overlay]";

/** The control a press landed on, inside the scene: chrome over it, or a control a view drew in a card — not a mark a view draws to be picked. */
function controlUnder(target: EventTarget | null, ground: Element): boolean {
  if (!(target instanceof Element) || target.closest("[data-graview-pick]")) return false;
  const control = target.closest(CHROME);
  return control !== null && control !== ground && ground.contains(control);
}

function cardOf(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest(CARD) : null;
}

/** The card that stood under a point when the note was taken: the smallest box holding it, as the nearest card is drawn over the plot under it. */
function aimedAt(aim: Aim, x: number, y: number): string | null {
  let best: { id: string; area: number } | null = null;
  for (const { id, box } of aim.cards) {
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;
    const area = box.width * box.height;
    if (!best || area < best.area) best = { id, area };
  }
  return best?.id ?? null;
}

export function useAimedPress(ground: RefObject<HTMLElement | null>, swallow: RefObject<boolean>): void {
  useEffect(() => {
    const element = ground.current;
    if (!element) return;
    let aim: Aim | null = null;
    /** The press now being given to the card it was aimed at, from its pointer-down to its click. */
    let taken: { readonly to: string | null; readonly double: boolean } | null = null;
    /** Until when a double-click the browser makes is not heard: the press it ends was given elsewhere. */
    let quietUntil = -Infinity;
    /** While this hook says a press itself: its own click and double-click pass by it. */
    let saying = false;

    const onDown = (event: PointerEvent) => {
      const noted = aim;
      aim = null;
      taken = null;
      if (!event.isPrimary || event.button !== 0 || !noted || event.timeStamp - noted.at > AIM_MS) return;
      const under = cardOf(event.target)?.getAttribute("data-graview-view") ?? null;
      const aimed = aimedAt(noted, event.clientX, event.clientY);
      /*
       * A FINGER'S DOUBLE-TAP IS OURS TO HEAR. A browser on a phone says a
       * double-click for two taps only sometimes (Safari not at all for a
       * page that is not zoomable, Chrome only when nothing moved between
       * them), so a second tap on the card the first one chose, soon enough,
       * is the double-tap that goes in, whatever is under it now.
       */
      const doubleTap = event.pointerType === "touch" && noted.on !== null && aimed === noted.on && event.timeStamp - noted.at <= DOUBLE_TAP_MS;
      if (!doubleTap) {
        // What the person aimed at is what is under the finger: nothing moved, nothing to do.
        if (aimed === under) return;
        /*
         * A PRESS ON A CONTROL IS THE CONTROL'S — the sheet the tap opened, its
         * "Add", a pane, the zoom. A quick hand reaches for the panel the
         * choice opened the moment it is there, and that press is aimed at
         * the panel, not at the card that stood where it now stands. Only a
         * finger's second tap of a double-tap is taken from a control (above).
         */
        if (controlUnder(event.target, element)) return;
        // Aimed at bare ground: whatever is there now keeps its press.
        if (aimed === null) return;
      }
      event.stopPropagation();
      taken = { to: aimed, double: aimed !== null && aimed === noted.on };
    };
    const say = (target: EventTarget, type: "click" | "dblclick", from: MouseEvent, double: boolean) => {
      saying = true;
      try {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: from.clientX, clientY: from.clientY, detail: double ? 2 : 1 }));
      } finally {
        saying = false;
      }
    };
    const onClick = (event: MouseEvent) => {
      if (saying) return;
      if (taken) {
        const { to, double } = taken;
        taken = null;
        quietUntil = event.timeStamp + 500;
        event.stopPropagation();
        event.preventDefault();
        const card = to === null ? null : [...element.querySelectorAll(CARD)].find((one) => one.getAttribute("data-graview-view") === to);
        // Aimed at bare ground: the ground's own click, which puts the choice down.
        if (to === null) say(element, "click", event, false);
        // The double-tap's second press goes in, as a double-click on the card does; a different card is chosen.
        else if (card) say(card, double ? "dblclick" : "click", event, double);
        return;
      }
      // A tap, not the end of a drag: note where everything stood as it was aimed at, before what it chooses moves anything.
      if (swallow.current) return;
      /*
       * A CONTROL moves no card — the zoom over the scene, a pane, a menu, a
       * button a view drew inside its card: pressing "+" or a calendar's
       * "next" twice is pressing it twice. A mark a view draws to be picked
       * (`data-graview-pick`) is a card's own.
       */
      const control = event.target instanceof Element ? event.target.closest(CHROME) : null;
      if (control && control !== element && element.contains(control) && !(event.target as Element).closest("[data-graview-pick]")) return;
      const on = cardOf(event.target)?.getAttribute("data-graview-view") ?? null;
      aim = {
        at: event.timeStamp,
        on,
        cards: [...element.querySelectorAll(CARD)].map((card) => ({ id: card.getAttribute("data-graview-view")!, box: card.getBoundingClientRect() })),
      };
    };
    const onDouble = (event: MouseEvent) => {
      if (saying || event.timeStamp > quietUntil) return;
      // The browser's double-click on what slid under the finger, or a double-tap already said: the aimed card has had its own.
      event.stopPropagation();
      event.preventDefault();
      quietUntil = -Infinity;
    };
    const onUp = (event: PointerEvent) => {
      if (taken) event.stopPropagation();
    };
    element.addEventListener("pointerdown", onDown, true);
    element.addEventListener("pointerup", onUp, true);
    element.addEventListener("click", onClick, true);
    element.addEventListener("dblclick", onDouble, true);
    return () => {
      element.removeEventListener("pointerdown", onDown, true);
      element.removeEventListener("pointerup", onUp, true);
      element.removeEventListener("click", onClick, true);
      element.removeEventListener("dblclick", onDouble, true);
    };
  }, [ground, swallow]);
}
