import { layer } from "@graview/core";
import { useEffect, useRef } from "react";

/*
 * THE OUTLINE OVER A SECTION (Roadmap f-make-this-section-better): dashed,
 * following it as the page moves, never in the way of a pointer — over a
 * section a menu is open on, and over a draft while the card offers it.
 */

/** The box around a section's elements, in the window. */
export function boxOf(elements: readonly Element[]): DOMRect | null {
  let box: { left: number; top: number; right: number; bottom: number } | null = null;
  for (const element of elements) {
    if (!element.isConnected) continue;
    const at = element.getBoundingClientRect();
    if (at.width === 0 && at.height === 0) continue;
    box = box ? { left: Math.min(box.left, at.left), top: Math.min(box.top, at.top), right: Math.max(box.right, at.right), bottom: Math.max(box.bottom, at.bottom) } : { left: at.left, top: at.top, right: at.right, bottom: at.bottom };
  }
  return box ? new DOMRect(box.left, box.top, box.right - box.left, box.bottom - box.top) : null;
}

/** A dashed outline over a section, following it as the page moves, never in the way of a pointer. */
export function SectionOutline({ elements, label }: { readonly elements: readonly Element[]; readonly label?: string }) {
  const mark = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const place = () => {
      const box = boxOf(elements);
      const at = mark.current;
      if (at) {
        at.style.display = box ? "block" : "none";
        if (box) {
          at.style.left = `${Math.round(box.left - 3)}px`;
          at.style.top = `${Math.round(box.top - 3)}px`;
          at.style.width = `${Math.round(box.width + 6)}px`;
          at.style.height = `${Math.round(box.height + 6)}px`;
        }
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [elements]);
  return (
    <div ref={mark} aria-hidden="true" data-testid="section-outline" style={OUTLINE}>
      {label ? <span style={OUTLINE_LABEL}>{label}</span> : null}
    </div>
  );
}

const OUTLINE = { position: "fixed", display: "none", boxSizing: "border-box", border: "2px dashed var(--graview-accent)", borderRadius: 8, pointerEvents: "none", zIndex: layer("popover") } as const;
const OUTLINE_LABEL = { position: "absolute", top: -11, left: 8, padding: "0 6px", fontSize: "0.6875rem", lineHeight: "18px", borderRadius: 999, color: "var(--graview-accent-ink, #fff)", background: "var(--graview-accent)" } as const;
