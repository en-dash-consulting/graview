import type { Outset } from "@graview/render";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Room past what is measured, for a shadow or an edge's antialiasing. */
const SLACK = 4;
const NONE: Outset = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * WHAT A HOST DRAWS PAST ITS BOX, measured, so the capture path can take it.
 *
 * The capture takes an element's box and nothing outside it. A district on
 * its plot draws past its box on purpose: its name hangs under the plot,
 * its landmark stands over it, a name said "above" or "aside" stands
 * beside it. On the DOM path all of that shows; captured, the name was
 * cut off and the landmark lost its head. So, on the GPU path, the host
 * measures how far its contents reach past its layout box on each side, in
 * its own pixels, and grows its box by that much (as padding, so nothing
 * inside it moves) and says so (`data-graview-outset`); the compositor
 * draws the bigger box with the layout box where it was.
 *
 * Measured against the layout box, not the box as grown, so the answer does
 * not depend on the last one. Retaken when the subtree changes, when a hand
 * or the keyboard reaches into it (what comes up on hover or focus), and
 * when a transition ends.
 */
export function useCapturedOutset(ref: RefObject<HTMLElement | null>, on: boolean): Outset | null {
  const [outset, setOutset] = useState<Outset | null>(null);
  const held = useRef<Outset | null>(null);
  held.current = outset;
  useLayoutEffect(() => {
    const host = ref.current;
    if (!on || !host) {
      setOutset(null);
      return;
    }
    const measure = () => {
      const box = host.getBoundingClientRect();
      const scale = host.offsetWidth > 0 ? box.width / host.offsetWidth : 1;
      if (!(scale > 0)) return;
      const pad = held.current ?? NONE;
      const inner = {
        top: box.top + pad.top * scale,
        right: box.right - pad.right * scale,
        bottom: box.bottom - pad.bottom * scale,
        left: box.left + pad.left * scale,
      };
      let top = 0;
      let right = 0;
      let bottom = 0;
      let left = 0;
      for (const element of host.querySelectorAll("*")) {
        const at = element.getBoundingClientRect();
        if (at.width === 0 && at.height === 0) continue;
        top = Math.max(top, inner.top - at.top);
        right = Math.max(right, at.right - inner.right);
        bottom = Math.max(bottom, at.bottom - inner.bottom);
        left = Math.max(left, inner.left - at.left);
      }
      const side = (past: number) => (past > 0.5 ? Math.ceil(past / scale) + SLACK : 0);
      const next = { top: side(top), right: side(right), bottom: side(bottom), left: side(left) };
      const was = held.current ?? NONE;
      if (next.top === was.top && next.right === was.right && next.bottom === was.bottom && next.left === was.left) return;
      const none = next.top + next.right + next.bottom + next.left === 0;
      held.current = none ? null : next;
      setOutset(none ? null : next);
    };
    let queued = 0;
    const later = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        measure();
      });
    };
    measure();
    const content = typeof MutationObserver === "undefined" ? null : new MutationObserver(later);
    content?.observe(host, { childList: true, subtree: true, characterData: true, attributes: true });
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(later);
    sizes?.observe(host);
    const reached = ["pointerover", "pointerout", "focusin", "focusout", "transitionend", "animationend"] as const;
    for (const name of reached) host.addEventListener(name, later);
    return () => {
      if (queued) cancelAnimationFrame(queued);
      content?.disconnect();
      sizes?.disconnect();
      for (const name of reached) host.removeEventListener(name, later);
    };
  }, [ref, on]);
  return outset;
}
