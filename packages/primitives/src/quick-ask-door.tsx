import { retryingImport } from "@graview/core/retry";
import { lazyModule, useGraview, usePlayback } from "@graview/react/provider";
import { heldOf, openQuickAsk, tell, useOpening } from "./quick-ask-desk.js";
import { inlineAiOn } from "@graview/tools/frame";
import { Suspense, useEffect, useRef, type ComponentType } from "react";
import type { QuickAskCardProps } from "./quick-ask.js";

/**
 * THE QUICK ASK (Roadmap f-quick-ask-framework): the command bar, opened
 * with ⌘K (Ctrl+K) beside what the person is on — the selection, a record's
 * page, a list, else the place — and the answer cards it leaves there.
 *
 * It replaced the Ask box: a field at the picture's foot that grew into a
 * chat thread over the picture, on both faces. Now words are asked where
 * the thing is. The bar completes the acts on the target, its places, its
 * records and "Show …" (a panel the catalog can draw); words that complete
 * nothing are asked, and the answer is a card placed beside the record or
 * the list, with what acts on it — a change waits as a ghost, never made
 * until accepted — and a field for a follow-up on the card. A follow-up
 * replaces the card's answer: it is a quick ask, not a thread.
 *
 * Drawn only where the host gave a model and did not say AI is off, and
 * where the app's setting (`quickAsk`) leaves it on: otherwise there is no
 * bar, no card and no chord, and ⌘K is Find's again. The bar and the card
 * are fetched when first opened: a page whose reader never asks carries
 * neither.
 *
 * Find's last row ("Ask: ‘…’") and the context menu's "Ask about this…"
 * open it too, through `openQuickAsk`.
 */

export type { QuickAskOpening } from "./quick-ask-desk.js";

const cardModule = /* @__PURE__ */ lazyModule(retryingImport(() => import("./quick-ask.js")));
const Card = /* @__PURE__ */ cardModule.part(
  (module, props: QuickAskCardProps) => {
    const Drawn = module.QuickAskCard as ComponentType<QuickAskCardProps>;
    return <Drawn {...props} />;
  },
  { what: "The quick ask" },
);

export interface QuickAskDoorProps {
  /** The face it is drawn on: the scene places a card by the card it is about; a page by its heading. */
  readonly face: "scene" | "pages";
  /** The app's setting: false draws no quick ask at all (see `quickAskOf`). */
  readonly on?: boolean;
}

/** The quick ask's chord, bar and card, where it is drawn at all. */
export function QuickAskDoor({ face, on = true }: QuickAskDoorProps) {
  const { ai, aiDesk, selection, view } = useGraview();
  /* While somebody looks back through the timeline, nothing is asked of the app (Roadmap f-playback). */
  const lookingBack = usePlayback()?.open ?? false;
  const drawn = on && inlineAiOn(ai) && !lookingBack;
  const opening = useOpening(aiDesk);
  const marker = useRef<HTMLSpanElement | null>(null);
  const here = useRef({ selection, place: view.within?.["view"] });
  here.current = { selection, place: view.within?.["view"] };

  /* Drawn: Find offers "Ask: ‘…’", and the first look points at the chord. */
  useEffect(() => {
    if (!drawn) return;
    const held = heldOf(aiDesk);
    held.drawn += 1;
    /* Fetched at the first letter typed in the menu, or once the page is idle: Enter never waits for the card or the plan. */
    held.preload = () => {
      void cardModule.load().catch(() => undefined);
      void import("./quick-ask-plan.js").catch(() => undefined);
    };
    tell(held);
    return () => {
      held.drawn = Math.max(0, held.drawn - 1);
      if (held.drawn === 0) held.open = null;
      tell(held);
    };
  }, [drawn, aiDesk]);

  /*
   * ⌘K OR CTRL+K, FROM ANYWHERE IN THE APP: the bar, beside what is
   * selected. Heard before Find hears it (the capture phase), so where the
   * quick ask is drawn the chord is its, and `/` stays Find's. Inside an
   * embed only a key pressed in the embed or on nothing at all is the bar's,
   * and of two embeds the first to answer has it, as Find's rule is.
   */
  useEffect(() => {
    if (!drawn) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const root = marker.current?.closest("[data-graview-embed]");
      const target = event.target;
      const nowhere = !(target instanceof Node) || target === document.body || target === document.documentElement;
      if (root && !(nowhere || (target instanceof Node && root.contains(target)))) return;
      event.preventDefault();
      cardModule.prefetch();
      const at = document.activeElement;
      const { selection: chosen, place } = here.current;
      openQuickAsk(aiDesk, {
        pointed: { ...(chosen[0] !== undefined ? { on: chosen[0] } : {}), about: chosen, ...(place ? { place } : {}) },
        returnTo: at instanceof HTMLElement && at !== document.body ? at : null,
      });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [drawn, aiDesk]);

  if (!drawn) return null;
  return (
    <>
      {/* Where the chord is heard, and what the first look reads to know a quick ask is here. */}
      <span ref={marker} hidden data-graview-quick-ask={face} />
      {opening ? (
        <Suspense fallback={null}>
          <Card key={opening.at} face={face} opening={opening} close={() => openQuickAsk(aiDesk, null)} />
        </Suspense>
      ) : null}
    </>
  );
}
