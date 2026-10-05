import { layer } from "@graview/core";
import { useLayoutEffect, type CSSProperties, type RefObject } from "react";

/**
 * A TRANSIENT SURFACE OPENS IN THE BROWSER'S TOP LAYER (FR-76).
 *
 * A popover, a menu, a list of suggestions: each used to hang from its
 * trigger with `position: absolute` and a `z-index` of its own choosing, in
 * the one stacking context the bar, the scene and the seat's rail share —
 * and on a hosted app the profile opened under the rail at 40 and could not
 * be read. The browser has a layer above every stacking context for exactly
 * this: an element shown with `showPopover()` is drawn over everything on
 * the page, whatever `z-index`, `overflow: hidden` or `backdrop-filter` its
 * ancestors carry, and it is still where it was in the DOM — so an embed's
 * scoped theme still reaches it and its custom properties are inherited,
 * and nothing of it lands on the host's page that was not there before.
 *
 * Chromium 114, Firefox 125 and Safari 17 have it, and Playwright's
 * Chromium, WebKit and Firefox do; where `showPopover` is missing, the pane
 * stands on the ladder's popover rung (`layer("popover")`), over every rail.
 *
 * In the top layer the pane's containing block is the viewport, so it is
 * placed by its anchor's rectangle: under it, or over it where there is
 * more room above (`placePane`), and kept to the viewport on both axes.
 */
/**
 * EVERY POPOVER THE FRAMEWORK DRAWS, BY NAME — the family a harness opens
 * one by one rather than a list somebody keeps by hand. Each says the
 * `data-testid` of what opens it and of the pane, how it is opened, and
 * where it is drawn. A popover not in here is not in the family.
 */
export const POPOVERS = {
  /** Who you are and your own settings, from the bar and the embed's strip. */
  profile: { trigger: "profile-button", pane: "profile", opens: "press", drawn: ["shell", "embed"] },
  /** What is broken, from Standing, on the bar and the strip. */
  problems: { trigger: "standing", pane: "problems", opens: "press", drawn: ["shell", "embed"] },
  /** What has happened, from the bar. */
  activity: { trigger: "activity-button", pane: "activity", opens: "press", drawn: ["shell"] },
  /** What the words find, under the Find box: a listbox, so the keyboard stays in the box. */
  find: { trigger: "find-box", pane: "find-strip", opens: "typing", drawn: ["shell"] },
  /** The districts the row could not hold, from "+N more" on the ground. */
  districts: { trigger: "beyond-more", pane: "beyond-list", opens: "press", drawn: ["shell", "embed"] },
  /** A card's acts at the pointer: right-click, the context menu. */
  acts: { trigger: null, pane: "context-menu", opens: "context-menu", drawn: ["shell", "embed"] },
  /** The conversation as a pill's popover, where an app puts `ChatPanel` on a bar of its own. */
  chat: { trigger: "chat", pane: "chat-panel", opens: "press", drawn: [] },
  /** The studio's own seat, from its bar. */
  "studio-ask": { trigger: "studio-agent", pane: "studio-agent-panel", opens: "press", drawn: ["studio"] },
} as const;

export type PopoverName = keyof typeof POPOVERS;

export const POPOVER_STYLE: CSSProperties = {
  position: "fixed",
  inset: "auto",
  margin: 0,
  zIndex: layer("popover"),
  boxSizing: "border-box",
};

/** What a pane hangs from: an element, or a point (a right-click). */
export type PopoverAnchor = RefObject<HTMLElement | null> | (() => { readonly x: number; readonly y: number } | null);

export interface PlaceOptions {
  /** Which edge of the anchor the pane lines up with. `end` (the default) hangs it from the anchor's right edge. */
  readonly align?: "start" | "end";
}

/** The pane's distance from its anchor, and from the viewport's edges. */
const GAP = 6;
const MARGIN = 8;

const supportsTopLayer = (pane: HTMLElement): boolean => typeof (pane as { showPopover?: unknown }).showPopover === "function";

/** Whether the pane is in the top layer now. */
export function inTopLayer(pane: HTMLElement): boolean {
  try {
    return pane.matches(":popover-open");
  } catch {
    return false;
  }
}

function anchorRect(anchor: PopoverAnchor): { left: number; right: number; top: number; bottom: number } | null {
  if (typeof anchor === "function") {
    const at = anchor();
    return at ? { left: at.x, right: at.x, top: at.y, bottom: at.y } : null;
  }
  const element = anchor.current;
  if (!element || !element.isConnected) return null;
  const rect = element.getBoundingClientRect();
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
}

/**
 * Puts the pane by its anchor, inside the viewport: under the anchor, or
 * over it when the room above is the larger and the pane does not fit
 * below; no taller than the room it was given, so what it holds scrolls
 * inside it rather than running off the screen.
 */
export function placePane(pane: HTMLElement, anchor: PopoverAnchor, options: PlaceOptions = {}): void {
  const at = anchorRect(anchor);
  if (!at) return;
  const view = { width: document.documentElement.clientWidth || innerWidth, height: innerHeight };
  // The height the pane was designed to stop at, kept the first time: the room is laid over it, never instead of it.
  const designed = (pane.dataset["graviewDesignedHeight"] ??= pane.style.maxHeight);
  pane.style.maxHeight = designed;
  const natural = pane.getBoundingClientRect();
  const below = view.height - at.bottom - GAP - MARGIN;
  const above = at.top - GAP - MARGIN;
  const down = natural.height <= below || below >= above;
  const room = Math.max(96, Math.floor(down ? below : above));
  const height = Math.min(natural.height, room);
  // Border-box (`POPOVER_STYLE`), so the room is the pane's whole height, its frame included.
  if (natural.height > room) pane.style.maxHeight = designed ? `min(${designed}, ${room}px)` : `${room}px`;
  const width = natural.width;
  const wanted = options.align === "start" ? at.left : at.right - width;
  // A sheet the viewport's width (a phone's) stands from its left edge; anything narrower keeps a margin.
  const left = width >= view.width - 2 * MARGIN ? Math.max(0, (view.width - width) / 2) : Math.max(MARGIN, Math.min(wanted, view.width - MARGIN - width));
  const top = down ? at.bottom + GAP : Math.max(MARGIN, at.top - GAP - height);
  pane.style.left = `${Math.round(left)}px`;
  pane.style.top = `${Math.round(top)}px`;
}

/**
 * Shows the pane in the top layer while `open`, placed by its anchor and
 * placed again as the page scrolls, the window changes size or the pane's
 * own content does. The pane carries `popover="manual"` and
 * `POPOVER_STYLE`; whoever draws it decides when it is open.
 */
export function useTopLayer(pane: RefObject<HTMLElement | null>, open: boolean, anchor: PopoverAnchor, options: PlaceOptions = {}): void {
  const align = options.align ?? "end";
  useLayoutEffect(() => {
    const element = pane.current;
    if (!open || !element) return;
    if (supportsTopLayer(element) && !inTopLayer(element)) {
      try {
        element.showPopover();
      } catch {
        // Not connected, or shown already: the ladder's rung still holds it over every rail.
      }
    }
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => placePane(element, anchor, { align }));
    };
    placePane(element, anchor, { align });
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    watch?.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
      watch?.disconnect();
      if (element.isConnected && inTopLayer(element)) {
        try {
          element.hidePopover();
        } catch {
          // Gone already.
        }
      }
    };
    // The anchor is read when placing, not watched: a new function each render is the same anchor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pane, align]);
}
