import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";

/*
 * WHAT THE FRAME OF EVERY FACE MEASURES WITH (FR-104): the room a view has,
 * and a caption kept for the ear alone. Their own module rather than the
 * primitives' index, because a bundler assigns a whole file to every chunk
 * that can reach it: the frame took these two from the index, and so the
 * page's first chunk carried the index's lenses' parts with them.
 */

/**
 * THE ROOM A VIEW HAS, in pixels, or null before the first measurement.
 *
 * A lens is drawn into whatever box the layout gives it — the focus card
 * in a 360px embed, a billboard, a page's column — and the ones that laid
 * themselves out for a desk (a 316px label column, seven day columns) were
 * unreadable in half of them. The width is the fact they need to choose a
 * shape by; this is the one place it is read.
 *
 * DRAWN IN THE ROOM IT HAS, FROM ITS FIRST FRAME. The width was read after
 * the paint, and a change to it was rendered after the paint too: a card
 * on the ground is given its size by the scene after the lens inside it
 * first measured, and the coverage matrix in a 225-pixel card on
 * graview.dev at 360 wide painted one frame laid out for a desk — its
 * rotated column names 83 pixels past the screen — before it stacked, and
 * the watch saw that frame. It is read before the first paint, of the box
 * the ref holds now, and a change the browser reports before a paint is
 * drawn in that paint.
 */
export function useWidth(ref: { current: HTMLElement | null }): number | null {
  const [width, setWidth] = useState<number | null>(null);
  const [element, setElement] = useState<HTMLElement | null>(null);
  // After every render, before the paint: the box the ref holds now.
  useLayoutEffect(() => {
    if (ref.current !== element) setElement(ref.current);
  });
  useLayoutEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const measured = () => Math.round(element.getBoundingClientRect().width);
    let drawn = measured();
    setWidth(drawn);
    // The browser reports a resize after layout and before the paint; rendered then, the paint has it.
    const observer = new ResizeObserver(() => {
      const next = measured();
      /*
       * ONLY A WIDTH THAT CHANGED IS DRAWN AT ONCE. The observer reports
       * every box it is given once, unchanged, and a flushSync renders
       * everything waiting, not only this width: a board that had just
       * measured its own room had its new shape drawn inside the browser's
       * round of resize reports, the room it watches changed size there,
       * and Firefox said "ResizeObserver loop completed with undelivered
       * notifications" on the org app's Pages home.
       */
      if (next === drawn) return;
      drawn = next;
      flushSync(() => setWidth(next));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return width;
}

/**
 * THE SCREEN'S HEIGHT, MEASURED (FR-165): `innerHeight` in pixels while
 * `on`, else undefined. CSS's viewport units were trusted once: after a
 * phone turned, a box of `100vh` or `100dvh` kept the height it had been
 * given and the app was drawn in the top half of the screen. This reads
 * the window on `resize`, `orientationchange` and the visual viewport's
 * `resize`, and again a beat later for the phones that report a turn late.
 *
 * THE KEYBOARD DOES NOT SHRINK IT. The figure is the layout viewport's
 * (`innerHeight`), not the visual viewport's: the on-screen keyboard and a
 * pinch change the second and not the first, so the app keeps its height
 * while somebody types and the browser scrolls the field into view, rather
 * than every lens laying itself out again for half a screen and back.
 */
export function useViewportHeight(on = true): number | undefined {
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    if (!on) return setHeight(undefined);
    let beat = 0;
    const read = () => setHeight(innerHeight);
    const turned = () => {
      read();
      clearTimeout(beat);
      beat = window.setTimeout(read, 300);
    };
    const each = (verb: "addEventListener" | "removeEventListener") => {
      for (const [target, event] of [[window, "resize"], [window, "orientationchange"], [window.visualViewport, "resize"]] as const) target?.[verb](event, turned);
    };
    each("addEventListener");
    read();
    return () => {
      clearTimeout(beat);
      each("removeEventListener");
    };
  }, [on]);
  return height;
}

/**
 * Present to a screen reader, absent to the eye — the one idiom, written
 * once.
 *
 * Written out by hand in two places, which meant two shapes for the same
 * decision and no way for a harness to tell either of them from a caption
 * that had genuinely been cut off. `scripts/survey-ui.mjs` reported both as
 * "overflowing" on every screen of every app, twenty lines of noise that a
 * real clipped caption would have hidden behind.
 */
export const VISUALLY_HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
} as const satisfies CSSProperties;
