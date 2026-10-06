import { useEffect, useState, type CSSProperties } from "react";

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
 */
export function useWidth(ref: { current: HTMLElement | null }): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const read = () => setWidth(Math.round(element.getBoundingClientRect().width));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
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
