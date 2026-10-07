import { layer } from "@graview/core";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/**
 * EVERY POPOVER THE FRAMEWORK DRAWS, BY NAME — the family a harness opens
 * one by one rather than a list somebody keeps by hand (FR-77). Each says
 * the `data-testid` of what opens it and of its pane, how it is opened,
 * where the framework draws it, and where the keyboard goes when it opens:
 * into the pane, except under the Find box, which is a combobox's listbox
 * and keeps the keyboard in the box (its rows are `aria-activedescendant`).
 * A popover that is not in here is not in the family, and `usePopover`
 * takes no name that is not.
 */
export const POPOVERS = {
  /** Who you are and your own settings, from the bar and the embed's strip. */
  profile: { trigger: "profile-button", pane: "profile", opens: "press", focus: "into", drawn: ["shell", "embed"] },
  /** What is broken, from Standing, on the bar and the strip. */
  problems: { trigger: "standing", pane: "problems", opens: "press", focus: "into", drawn: ["shell", "embed"] },
  /** The app's places the bar's row could not hold, from "More" (FR-131). */
  places: { trigger: "app-places-more", pane: "app-places-more-list", opens: "press", focus: "into", drawn: ["embed"] },
  /** What has happened, from the bar. */
  activity: { trigger: "activity-button", pane: "activity", opens: "press", focus: "into", drawn: ["shell"] },
  /** What the words find, under the Find box. */
  find: { trigger: "find-box", pane: "find-strip", opens: "typing", focus: "stays", drawn: ["shell"] },
  /** The districts the row could not hold, from "+N more" on the ground. */
  districts: { trigger: "beyond-more", pane: "beyond-list", opens: "press", focus: "into", drawn: ["shell", "embed"] },
  /** A card's acts at the pointer: right-click, the context menu. The card is what the keyboard goes back to. */
  acts: { trigger: null, pane: "context-menu", opens: "context-menu", focus: "into", drawn: ["shell", "embed"] },
  /** The conversation as a pill's popover, where an app puts `ChatPanel` on a bar of its own. */
  chat: { trigger: "chat", pane: "chat-panel", opens: "press", focus: "into", drawn: [] },
  /** The studio's own seat, from its bar. */
  "studio-ask": { trigger: "studio-agent", pane: "studio-agent-panel", opens: "press", focus: "into", drawn: ["studio"] },
} as const;

export type PopoverName = keyof typeof POPOVERS;

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
        // The notices stay over it: the ladder's top rung is theirs.
        raiseAgain();
      } catch {
        // Not connected, or shown already: the ladder's rung still holds it over every rail.
      }
    }
    let frame = 0;
    const place = (event?: Event) => {
      // The pane's own scrolling moves nothing it hangs from.
      if (event?.target instanceof Node && element.contains(event.target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => placePane(element, anchor, { align }));
    };
    placePane(element, anchor, { align });
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => place());
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

/**
 * WHAT STANDS OVER A POPOVER: the notices (FR-75), the ladder's top rung.
 * The top layer is ordered by when a thing was shown, so a popover opened
 * after a toast would stand over it; each element here is shown again,
 * over it, the moment a popover of the family opens.
 */
const raised = new Set<HTMLElement>();

/** Keeps an element in the top layer over any popover that opens after it; returns the way to stop. */
export function raiseOverPopovers(element: HTMLElement): () => void {
  raised.add(element);
  return () => raised.delete(element);
}

function raiseAgain(): void {
  for (const element of raised) {
    if (!element.isConnected || !inTopLayer(element)) continue;
    try {
      element.hidePopover();
      element.showPopover();
    } catch {
      // Not shown after all: nothing to raise.
    }
  }
}

/**
 * THE ONE OPEN POPOVER, page-wide. Opening one closes the one before it —
 * two embeds on a page included — so a profile and a problems list are
 * never open over each other, each sure it is the one on top.
 */
let current: { readonly name: PopoverName; readonly close: () => void } | null = null;

/** Where the keyboard can land inside a pane. */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** The first thing in the pane the keyboard can stand on, or the pane itself. */
function firstStop(pane: HTMLElement): HTMLElement {
  for (const candidate of pane.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    // Not one that is hidden, or inside something hidden (a closed setting's own pane).
    if (candidate.closest("[hidden]") === null && getComputedStyle(candidate).visibility !== "hidden") return candidate;
  }
  return pane;
}

export interface PopoverOptions extends PlaceOptions {
  /**
   * Open and closed held by somebody else — the provider's pointer menu, a
   * combobox's own rule for when its list shows. Without these the hook
   * holds it.
   */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** A point to hang from, where there is no trigger: a right-click. */
  readonly at?: () => { readonly x: number; readonly y: number } | null;
  /** Where the keyboard goes back to when there is no trigger: the card a menu was opened on. */
  readonly returnTo?: () => HTMLElement | null;
  /** False draws it as part of something else — `ChatPanel` inside a rail — and the family leaves it alone. */
  readonly popover?: boolean;
}

export interface Popover {
  readonly open: boolean;
  /** Opens or closes it; closing gives the keyboard back to the trigger when it was inside the pane. */
  setOpen(open: boolean): void;
  toggle(): void;
  /** What the trigger carries: `{...popover.trigger}` and an `onClick` of `toggle`. */
  readonly trigger: {
    readonly ref: (element: HTMLElement | null) => void;
    readonly "aria-expanded": boolean;
    readonly "aria-controls": string;
    readonly "data-graview-popover-trigger": PopoverName;
  };
  /** What the pane carries, with `POPOVER_STYLE` in its style. */
  readonly pane: {
    readonly ref: (element: HTMLElement | null) => void;
    readonly id: string;
    readonly popover: "manual";
    readonly tabIndex: -1;
    readonly "data-graview-popover": PopoverName;
    readonly "data-graview-overlay": "";
  };
}

/**
 * ONE FAMILY OF POPOVERS (FR-77).
 *
 * Every popover had its own way of closing: the profile closed on a press
 * outside it, the districts on a pointer down, the menu at the pointer a
 * frame late; one gave the keyboard back to its button and the next left
 * it on `<body>`; none moved the keyboard in when it opened, so a person
 * working from the keyboard opened the profile and was still on its button;
 * and two could be open at once. This is the one way, and every popover in
 * `POPOVERS` uses it:
 *
 *   one at a time — opening one closes any other, page-wide;
 *   the keyboard goes in — to the pane's first control, or the pane;
 *   Escape closes it, and so does a press anywhere that is not the pane or
 *     its trigger (nor a dialog the pane opened); the keyboard goes back to
 *     the trigger when it was inside the pane or the press left it nowhere;
 *   it hangs from its trigger, in the top layer (`useTopLayer`), turned
 *     over when there is more room above and no taller than the room, so
 *     no row of it is ever under the viewport's edge.
 */
export function usePopover(name: PopoverName, options: PopoverOptions = {}): Popover {
  const { at, returnTo, onOpenChange } = options;
  const enabled = options.popover !== false;
  const [held, setHeld] = useState(false);
  const open = options.open ?? held;
  const triggerRef = useRef<HTMLElement | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);
  // Callbacks, so a button, a section or a list can each carry them.
  const holdTrigger = useCallback((element: HTMLElement | null) => {
    triggerRef.current = element;
  }, []);
  const holdPane = useCallback((element: HTMLElement | null) => {
    paneRef.current = element;
  }, []);
  const id = `graview-popover-${useId().replace(/:/g, "")}`;
  const latest = useRef({ onOpenChange, returnTo, controlled: options.open !== undefined });
  latest.current = { onOpenChange, returnTo, controlled: options.open !== undefined };

  const change = useCallback((next: boolean) => {
    if (!latest.current.controlled) setHeld(next);
    latest.current.onOpenChange?.(next);
  }, []);

  /** Closes it; the keyboard goes back to where it came from when it was inside, or nowhere. */
  const close = useCallback(
    (giveBack: boolean) => {
      const pane = paneRef.current;
      const active = typeof document === "undefined" ? null : document.activeElement;
      const lost = active === null || active === document.body || (pane !== null && pane.contains(active));
      change(false);
      if (!giveBack || !lost) return;
      const back = triggerRef.current ?? latest.current.returnTo?.() ?? null;
      back?.focus({ preventScroll: true });
    },
    [change],
  );

  useTopLayer(paneRef, enabled && open, at ?? triggerRef, options.align ? { align: options.align } : {});

  useEffect(() => {
    if (!enabled || !open) return;
    const me = { name, close: () => close(false) };
    if (current && current.close !== me.close) current.close();
    current = me;
    /* The keyboard goes in, unless it stays in a combobox's box. */
    if (POPOVERS[name].focus === "into") {
      const pane = paneRef.current;
      if (pane && !pane.contains(document.activeElement)) firstStop(pane).focus({ preventScroll: true });
    }
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close(true);
    };
    const away = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const pane = paneRef.current;
      if (pane?.contains(target) || triggerRef.current?.contains(target)) return;
      /*
       * A CONTROL IN HERE MAY OPEN SOMETHING BIGGER THAN HERE: the studio is
       * a dialog its button in the profile opens, portaled to the body, and
       * a press inside it is not a press away from the pane that opened it.
       * A dialog the pane itself stands in (the studio's own seat) is not
       * that: a press elsewhere in it is away.
       */
      const dialog = target instanceof Element ? target.closest('[role="dialog"], [role="alertdialog"]') : null;
      if (dialog && !(pane && dialog.contains(pane))) return;
      close(false);
      /*
       * A press on something that takes the keyboard keeps it; a press on
       * bare ground gives it back to the trigger. Not to a combobox's box: a
       * press away from a text box is leaving it, and putting the keyboard
       * back in would open its list again.
       */
      if (POPOVERS[name].focus !== "into") return;
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active === null || active === document.body || (pane !== null && pane.contains(active))) {
          (triggerRef.current ?? latest.current.returnTo?.() ?? null)?.focus({ preventScroll: true });
        }
      });
    };
    /*
     * A DIALOG IT OPENED TAKES OVER. The studio is a dialog its button in
     * the profile opens; in the top layer the profile stood over it and
     * covered its bar. When the keyboard goes into a dialog the pane does
     * not hold, the pane closes (it stays mounted where its owner keeps it
     * so, and the dialog with it), and when that dialog is gone and has left
     * the keyboard nowhere — its way back was a control in the closed pane —
     * the keyboard goes to the trigger.
     */
    let handedTo: Element | null = null;
    let watching: MutationObserver | null = null;
    const takenOver = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const pane = paneRef.current;
      const dialog = target.closest('[role="dialog"], [role="alertdialog"]');
      if (!dialog || (pane && (pane.contains(dialog) || dialog.contains(pane)))) return;
      handedTo = dialog;
      close(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("focusin", takenOver);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("focusin", takenOver);
      const dialog = handedTo;
      if (dialog && typeof MutationObserver !== "undefined") {
        watching?.disconnect();
        watching = new MutationObserver(() => {
          if (dialog.isConnected) return;
          watching?.disconnect();
          requestAnimationFrame(() => {
            const active = document.activeElement;
            const lost = active === null || active === document.body || (active instanceof HTMLElement && active.closest("[hidden]") !== null);
            if (lost) (triggerRef.current ?? latest.current.returnTo?.() ?? null)?.focus({ preventScroll: true });
          });
        });
        watching.observe(document.body, { childList: true, subtree: true });
        // Given up after a while: a dialog left open for good is not waited on.
        setTimeout(() => watching?.disconnect(), 10 * 60_000);
      }
      if (current?.close === me.close) current = null;
    };
  }, [enabled, open, name, close]);

  return {
    open,
    setOpen: (next: boolean) => (next ? change(true) : close(true)),
    toggle: () => (open ? close(true) : change(true)),
    trigger: { ref: holdTrigger, "aria-expanded": open, "aria-controls": id, "data-graview-popover-trigger": name },
    pane: { ref: holdPane, id, popover: "manual", tabIndex: -1, "data-graview-popover": name, "data-graview-overlay": "" },
  };
}
