import type { AiTarget, PointedAt } from "@graview/core/catalog";
import type { AiDesk } from "@graview/react/provider";
import { useSyncExternalStore } from "react";

/**
 * WHERE THE QUICK ASK IS OPEN, AND WHETHER IT IS DRAWN, per app's desk
 * (Roadmap f-quick-ask-framework) — apart from its door, so Find, the bar
 * and the search page ask it without carrying the door up front.
 */

/** What the bar is opened on, and words already asked there. */
export interface QuickAskOpening {
  /** What a menu or a selection pointed at; read as a target when the bar is drawn (`aiTargetOf`). */
  readonly pointed?: PointedAt;
  /** A target already read, as an entry in Activity keeps it. */
  readonly target?: AiTarget;
  /** Words to ask at once: the card opens answering them. */
  readonly asked?: string;
  /** Where the keyboard goes back to when the bar is put away. */
  readonly returnTo?: HTMLElement | null;
  /** Where the menu stood, when the card is the menu turned into it: the card opens with this top-left corner and never moves. */
  readonly from?: { readonly left: number; readonly top: number };
  /** The kept telling a menu's suggestion was taken from (Roadmap f-menu-learns): its words are asked, previewed as any, and the telling they make names it as its example. */
  readonly suggested?: string;
}

/** Where a menu stands now, as the card it turns into opens: its top-left corner in the window. */
export const whereMenuStands = (menu: Element | null | undefined): { readonly left: number; readonly top: number } | undefined => {
  // The menu as it is drawn: the outermost of a menu inside a menu (the pages' frame around the rows).
  let outer = menu ?? null;
  while (outer?.parentElement?.closest('[data-testid="context-menu"]')) outer = outer.parentElement.closest('[data-testid="context-menu"]');
  const box = outer?.getBoundingClientRect();
  return box && box.width > 0 ? { left: box.left, top: box.top } : undefined;
};

interface Held {
  open: (QuickAskOpening & { readonly at: number }) | null;
  drawn: number;
  readonly listeners: Set<() => void>;
  /** Fetches the card and the plan's code ahead of Enter: set by the drawn door, called at the first letter typed in the menu. */
  preload?: () => void;
}
export const HELD = new WeakMap<AiDesk, Held>();
export const heldOf = (desk: AiDesk): Held => {
  let held = HELD.get(desk);
  if (!held) HELD.set(desk, (held = { open: null, drawn: 0, listeners: new Set() }));
  return held;
};
/** The quick ask's code fetched before it is asked for, so pressing Enter never waits on it. */
export const preloadQuickAsk = (desk: AiDesk): void => {
  const held = HELD.get(desk);
  if (!held?.preload) return;
  // Marked, so a page (and its harness) can tell the fetch began at the first letter.
  if (typeof performance !== "undefined" && typeof performance.mark === "function") performance.mark("graview:quick-ask-preload");
  held.preload();
  held.preload = undefined;
};
export const tell = (held: Held) => {
  for (const listener of [...held.listeners]) listener();
};
let opened = 0;

/** Opens the bar (or, with words, an answer card) on this app's desk; null puts it away. */
export function openQuickAsk(desk: AiDesk, opening: QuickAskOpening | null): void {
  const held = heldOf(desk);
  held.open = opening ? { ...opening, at: ++opened } : null;
  tell(held);
}

const subscribeTo = (desk: AiDesk) => (listener: () => void) => {
  const held = heldOf(desk);
  held.listeners.add(listener);
  return () => void held.listeners.delete(listener);
};

/** Whether a quick ask is drawn on this app's desk: Find offers "Ask: ‘…’" only where one is. False with no desk (a bar drawn outside any app). */
export function useQuickAskDrawn(desk: AiDesk | undefined): boolean {
  const drawn = () => (desk ? heldOf(desk).drawn > 0 : false);
  return useSyncExternalStore(desk ? subscribeTo(desk) : NO_SUBSCRIPTION, drawn, drawn);
}
const NO_SUBSCRIPTION = () => () => undefined;

/** What the bar is open on now, or null. */
export function useOpening(desk: AiDesk) {
  const open = () => heldOf(desk).open;
  return useSyncExternalStore(subscribeTo(desk), open, open);
}

