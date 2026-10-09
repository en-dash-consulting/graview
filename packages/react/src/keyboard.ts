import { useEffect, type RefObject } from "react";

/**
 * THE KEYBOARD ALWAYS LANDS SOMEWHERE.
 *
 * An act removes what the keyboard stood on all the time here: Escape
 * closes the popover, a chip's × drops the selection it was, Back takes the
 * page away, an answered form gives way to the record it changed. A browser
 * does nothing about it — the keyboard falls to <body>, Tab starts again at
 * the top of the document, and a screen reader says nothing at all. Six
 * walks found that eight times, on eight different surfaces, each fixed on
 * its own surface (W-053, W-070, W-083, W-090, W-092, W-111, W-125, W-136).
 *
 * So it is one rule at the root instead. While the keyboard is inside this
 * root, the line of elements it stands in is remembered; when the element it
 * stood on is removed and nothing else took the keyboard, it lands on the
 * nearest of those that still stands — the first control inside it, or the
 * element itself when it can take the keyboard — which is the place the
 * removed thing was IN: the bar a closed menu hung from, the panel a closed
 * form sat in, the card that still draws what was deselected.
 *
 * A surface that knows better (Escape's own landing on the card that still
 * draws the record, `landTheKeyboard`) moves the keyboard first, and this
 * then finds it somewhere and does nothing. Only a keyboard left on nothing
 * is moved, and only one that was in this root, so a host page around an
 * embed is never touched.
 */
const CONTROL =
  'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

const takesTheKeyboard = (el: Element): el is HTMLElement =>
  el instanceof HTMLElement && (el.matches(CONTROL) || el.hasAttribute("tabindex"));

const shown = (el: HTMLElement): boolean =>
  typeof el.checkVisibility === "function" ? el.checkVisibility() : el.getClientRects().length > 0;

/**
 * The same control, drawn again: a re-render that replaced the element the
 * keyboard stood on is not the control going away.
 */
function twinIn(standing: Element, gone: Element): HTMLElement | null {
  const css = (value: string) => value.replace(/["\\]/g, "\\$&");
  const testid = gone.getAttribute("data-testid");
  const pick = gone.getAttribute("data-graview-pick");
  const label = gone.getAttribute("aria-label");
  const selector = testid
    ? `[data-testid="${css(testid)}"]`
    : pick
      ? `[data-graview-pick="${css(pick)}"]`
      : label
        ? `${gone.tagName.toLowerCase()}[aria-label="${css(label)}"]`
        : null;
  if (!selector) return null;
  const twin = standing.querySelector(selector);
  return twin && takesTheKeyboard(twin) && shown(twin) ? twin : null;
}

/** Still there, and still able to hold the keyboard: a person who clicked away left it on purpose. */
const standsAndTakesTheKeyboard = (el: Element): boolean =>
  el.isConnected && takesTheKeyboard(el) && !el.matches(":disabled") && el instanceof HTMLElement && shown(el);

/** Where the keyboard goes inside what still stands. Exported for its test. */
export function landingIn(standing: Element, gone?: Element): HTMLElement | null {
  const twin = gone ? twinIn(standing, gone) : null;
  if (twin) return twin;
  // A drawn record first: in the scene the picture is what the keys mean.
  const view = standing.querySelector<HTMLElement>("[data-graview-view][tabindex]");
  if (view && shown(view)) return view;
  for (const candidate of standing.querySelectorAll<HTMLElement>(CONTROL)) {
    if (shown(candidate)) return candidate;
  }
  return takesTheKeyboard(standing) && shown(standing) ? standing : null;
}

export function useTheKeyboardLandsSomewhere(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const at = root.current;
    if (!at || typeof MutationObserver === "undefined") return;
    // The line the keyboard stands in, innermost first, up to this root.
    let line: Element[] = [];
    const remember = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      line = [];
      for (let el: Element | null = target; el && el !== at.parentElement; el = el.parentElement) line.push(el);
    };
    let queued = false;
    // Unmounted: what was asked for later asks nothing of a document that may be gone.
    let gone = false;
    /*
     * The root's own document, not the global one, and nothing asked of it
     * once its window is closed: a page torn down without unmounting (a
     * test's environment) has no global document left, and a timer set a
     * moment before read it there.
     */
    const doc = at.ownerDocument;
    const live = () => !gone && doc.defaultView !== null;
    const after = (ms: number, run: () => void) => void setTimeout(() => live() && run(), ms);
    const nextFrame = (run: () => void) => void requestAnimationFrame(() => live() && run());
    const land = (afterAnAct: boolean) => {
      queued = false;
      if (gone) return;
      const active = doc.activeElement;
      const onNothing = active === null || active === doc.body || active === doc.documentElement;
      if (!onNothing || line.length === 0) return;
      if (standsAndTakesTheKeyboard(line[0]!)) {
        // Still there: after a press of its own it gets the keyboard back; a
        // person who clicked away from it left it on purpose.
        if (afterAnAct && line[0] instanceof HTMLElement) line[0].focus({ preventScroll: true });
        return;
      }
      for (const el of line.slice(1)) {
        if (!el.isConnected) continue;
        const target = landingIn(el, line[0]);
        if (target) {
          target.focus({ preventScroll: true });
          line = [];
          return;
        }
      }
    };
    /*
     * ASKED UNTIL IT IS SOMEWHERE, not a set number of times. The rule looked
     * at fixed moments — 60, 150, 600 ms — and on a starved machine every one
     * of them came before the change it was waiting for: the nightly's runner
     * left the keyboard on <body> after the studio's Keep for seconds. It is
     * asked again every tenth of a second until it lands, or for two and a
     * half seconds, whichever is first; a person who moves it meanwhile ends
     * it, because the keyboard is then somewhere.
     */
    const persist = (afterAnAct: boolean, until = Date.now() + 2500) => {
      after(100, () => {
        land(afterAnAct);
        const active = doc.activeElement;
        const onNothing = active === null || active === doc.body || active === doc.documentElement;
        if (onNothing && line.length > 0 && Date.now() < until) persist(afterAnAct, until);
      });
    };
    const later = () => {
      if (queued || line.length === 0) return;
      queued = true;
      // After the frame a surface that knows better gets to move it first.
      after(60, () => nextFrame(() => {
        land(false);
        persist(false);
      }));
    };
    /*
     * AND AFTER AN ACT, ASKED AGAIN. A press can take the keyboard off a
     * control without removing it or firing anything the root hears — a
     * button disabled while its answer comes, a form that resets — so after
     * a press or Enter, Space or Escape inside the root, it is asked whether
     * the keyboard is anywhere until it is.
     */
    const acted = (event: Event) => {
      if (event instanceof KeyboardEvent && !["Enter", " ", "Escape"].includes(event.key)) return;
      // A click elsewhere — on the empty picture, say — is a person leaving on purpose.
      if (!(event instanceof KeyboardEvent) && !(event.target instanceof Node && line[0]?.contains(event.target))) return;
      after(150, () => nextFrame(() => {
        land(true);
        persist(true);
      }));
    };
    const observer = new MutationObserver(() => {
      if (line.length > 0 && !line[0]!.isConnected) later();
    });
    // A control disabled or hidden while it held the keyboard stays in the
    // document and lets go of it — "Send" while the answer is coming.
    const letGo = (event: FocusEvent) => {
      if (event.relatedTarget === null) later();
    };
    at.addEventListener("focusin", remember);
    at.addEventListener("focusout", letGo);
    at.addEventListener("click", acted);
    at.addEventListener("keydown", acted);
    observer.observe(at, { childList: true, subtree: true });
    return () => {
      gone = true;
      at.removeEventListener("focusin", remember);
      at.removeEventListener("focusout", letGo);
      at.removeEventListener("click", acted);
      at.removeEventListener("keydown", acted);
      observer.disconnect();
    };
  }, [root]);
}
