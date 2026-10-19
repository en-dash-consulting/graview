import { retryingImport } from "@graview/core/retry";
import { lazyModule, useGraviewIfAny, type MenuTarget, type ReaderMemory } from "@graview/react/provider";
import { hoverChipsOn } from "@graview/tools/frame";
import { Suspense, useCallback, useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import type { HoverChipProps } from "./hover-chip.js";

/**
 * THE QUIET HOVER CHIPS (Roadmap f-inline-ai-framework-finish). Where the
 * host asked for hover chips (`ai.hoverChips: true`, with a Fast slot) and
 * the reader has not turned them off, the pointer resting on a record for
 * as long as it takes the menu to get ready (the menu's own dwell, in
 * `inspector-door.tsx`, which tells `restOn` and `leaveRest`) shows, beside
 * it, the Fast slot's one suggestion there — when the model is sure enough
 * of it (`HOVER_CHIP_CONFIDENCE`).
 *
 * ONE PLACE THE POINTER RESTS, so AT MOST ONE CHIP: resting somewhere else
 * moves it, leaving puts it away. A pointer passing over rests nowhere and
 * asks nothing; the keyboard and a finger never raise one. Fetched only
 * where the host asked for chips, and the chip itself with the first rest
 * (`hover-chip.tsx`): a page whose host did not ask never carries either.
 */

/** Where the pointer rests, and on what: one at a time. */
export interface HoverRest {
  readonly target: MenuTarget;
  readonly element: Element;
}

let resting: HoverRest | null = null;
let leaving: ReturnType<typeof setTimeout> | null = null;
const told = new Set<() => void>();
const tell = () => {
  for (const listener of told) listener();
};
const listen = (listener: () => void) => {
  told.add(listener);
  return () => void told.delete(listener);
};

/** How long a chip stays once the pointer leaves what it is about: long enough to reach the chip itself. */
const LEAVE_MS = 300;

const stopLeaving = () => {
  if (leaving !== null) clearTimeout(leaving);
  leaving = null;
};

/** The pointer has rested on a record: its chip, if it has one, is the only one. */
export function restOn(target: MenuTarget, element: Element): void {
  stopLeaving();
  chip.prefetch();
  if (resting?.element === element && resting.target.on === target.on) return;
  resting = { target, element };
  tell();
}

/** The pointer has left: the chip goes, a moment later, unless the pointer reaches it. */
export function leaveRest(now = false): void {
  stopLeaving();
  if (resting === null) return;
  if (now) {
    resting = null;
    tell();
    return;
  }
  leaving = setTimeout(() => {
    leaving = null;
    resting = null;
    tell();
  }, LEAVE_MS);
}

/** The pointer is on the chip: it stays. */
export const holdRest = (): void => stopLeaving();

const restingNow = () => resting;

// ── the reader's own switch ─────────────────────────────────────────────────

const WANTED_KEY = "graview:hover-chips";
let wantedHere: boolean | undefined;

/** Whether this reader wants hover chips: yes unless they turned them off, kept where their other choices are. */
export function hoverChipsWanted(memory?: ReaderMemory): boolean {
  if (wantedHere !== undefined) return wantedHere;
  try {
    return (memory ?? localStorage).getItem(WANTED_KEY) !== "off";
  } catch {
    return true;
  }
}

/** The reader turns hover chips on or off, for this browser (or the host's memory). */
export function setHoverChipsWanted(on: boolean, memory?: ReaderMemory): void {
  wantedHere = on;
  try {
    (memory ?? localStorage).setItem(WANTED_KEY, on ? "on" : "off");
  } catch {
    // The choice still holds for this visit.
  }
  if (!on) resting = null;
  tell();
}

/** The reader's switch as a hook: whether the host offers chips at all, whether this reader wants them, and the way to change it. */
export function useHoverChipsSetting(): { readonly offered: boolean; readonly on: boolean; readonly set: (on: boolean) => void } {
  const context = useGraviewIfAny();
  const offered = hoverChipsOn(context?.ai);
  const memory = context?.memory;
  const on = useSyncExternalStore(listen, () => hoverChipsWanted(memory), () => false);
  const set = useCallback((next: boolean) => setHoverChipsWanted(next, memory), [memory]);
  return { offered, on: offered && on, set };
}

const chip = /* @__PURE__ */ lazyModule(retryingImport(() => import("./hover-chip.js")));
const Chip = /* @__PURE__ */ chip.part(
  (module, props: HoverChipProps) => {
    const Drawn = module.HoverChip as ComponentType<HoverChipProps>;
    return <Drawn {...props} />;
  },
  { quiet: true },
);

/* Two faces on one page each have a door; the first one drawn draws the chip, so there is still only one. */
let drawing: symbol | null = null;
const drawingNow = () => drawing;

/** The one chip, where the pointer rests; nothing where chips are off, AI is off, or the pointer rests nowhere. */
export function HoverChipDoor() {
  const { on } = useHoverChipsSetting();
  const rest = useSyncExternalStore(listen, restingNow, () => null);
  const [me] = useState(() => Symbol("hover-chip"));
  const owner = useSyncExternalStore(listen, drawingNow, () => null);
  useEffect(() => {
    if (!on) return;
    if (drawing === null) {
      drawing = me;
      tell();
    }
    return () => {
      if (drawing !== me) return;
      // Gone with the face it was drawn on: where the pointer rested there is no longer anywhere.
      drawing = null;
      resting = null;
      stopLeaving();
      tell();
    };
  }, [on, me, owner]);
  if (!on || rest === null || owner !== me || !rest.element.isConnected) return null;
  return (
    <Suspense fallback={null}>
      <Chip rest={rest} hold={holdRest} leave={leaveRest} />
    </Suspense>
  );
}
