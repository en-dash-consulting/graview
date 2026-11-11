import { toolStyle } from "@graview/primitives/pages";
import { createContext, useContext } from "react";

/**
 * THE WAY UP FROM A PAGE THAT STANDS IN THE SCENE'S CITY (`one-place.tsx`),
 * on the page's own bar: what pressing it does, said. Null on a face that
 * draws no city under its pages, and the bar draws nothing.
 */
export interface OnePlaceUpValue {
  readonly up: () => void;
  readonly said: string;
}

export const OnePlaceUpContext = createContext<OnePlaceUpValue | null>(null);

/** Up, on the bar: from the page to its place in the city. */
export function OnePlaceUp() {
  const up = useContext(OnePlaceUpContext);
  if (!up) return null;
  return (
    <button type="button" data-testid="up" aria-label={up.said} title={up.said} onClick={up.up} style={{ ...toolStyle, gap: 4, padding: "0 8px", color: "var(--graview-ink)" }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
      </svg>
      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Up</span>
    </button>
  );
}
