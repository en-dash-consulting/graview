import { layer } from "@graview/core";
import { aiTargetOf, type AiCandidate, type AiTarget } from "@graview/core/catalog";
import { inTopLayer } from "@graview/react/provider";
import { fastOf, HOVER_CHIP_CONFIDENCE, type InlineResult } from "@graview/tools/inline-ai";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { HoverRest } from "./hover-chips.js";
import { useInlineEnv } from "./inline-ai-env.js";
import { heldSuggestion, suggestOnce, takeOffer } from "./inline-ai-menu.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * THE QUIET HOVER CHIP (Roadmap f-inline-ai-framework-finish): beside the
 * record the pointer rests on, the Fast slot's first suggestion there, in
 * one small press — only when the model was at least `HOVER_CHIP_CONFIDENCE`
 * sure of it, and only ever the Fast slot's. Asked through the menu's own
 * keeping (`suggestOnce`), so a chip and the menu opened on the same record
 * ask once between them, until the record changes. Taken, it is what the
 * menu's row would be: a change waits as a ghost to be accepted, a panel is
 * drawn, a place or a record is gone to.
 */

export interface HoverChipProps {
  readonly rest: HoverRest;
  /** The pointer is on the chip: keep it. */
  readonly hold: () => void;
  /** The pointer has left the chip, or it was taken: put it away (`now` for at once). */
  readonly leave: (now?: boolean) => void;
}

/** The first suggestion, when the model was sure enough of it. */
function sureOf(result: InlineResult | undefined): { readonly offer: AiCandidate; readonly confidence: number } | null {
  if (!result || result.interaction.outcome === "failed") return null;
  const offer = result.offers[0];
  const confidence = offer ? result.interaction.offered.find((one) => one.id === offer.id)?.confidence : undefined;
  return offer && confidence !== undefined && confidence >= HOVER_CHIP_CONFIDENCE ? { offer, confidence } : null;
}

export function HoverChip({ rest, hold, leave }: HoverChipProps) {
  const env = useInlineEnv();
  const target = useMemo<AiTarget>(() => aiTargetOf(rest.target, (id) => env.store.graph.has(id)), [rest.target, env.store]);
  const asks = target.on === "record" && fastOf(env.ai) !== undefined;
  const held = asks ? heldSuggestion(env, target) : undefined;
  const key = JSON.stringify(target);
  const [answered, setAnswered] = useState<{ readonly key: string; readonly result: InlineResult } | null>(null);
  useEffect(() => {
    if (!asks || held !== undefined) return;
    let live = true;
    void suggestOnce(env, target).then((result) => {
      if (live) setAnswered({ key, result });
    });
    return () => {
      live = false;
    };
    // Asked once per record it rests on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, asks]);
  const result = held ?? (answered?.key === key ? answered.result : undefined);
  const sure = asks ? sureOf(result) : null;
  const shown = sure?.offer.id ?? null;
  const chip = useRef<HTMLButtonElement | null>(null);

  /* Put away by a press anywhere else, the wheel, or the window moving: a chip never stands over what moved under it. */
  useEffect(() => {
    if (shown === null) return;
    const away = (event: Event) => {
      if (event.target instanceof Node && chip.current?.contains(event.target)) return;
      leave(true);
    };
    document.addEventListener("pointerdown", away, { capture: true, passive: true });
    document.addEventListener("contextmenu", away, { capture: true, passive: true });
    addEventListener("scroll", away, { capture: true, passive: true });
    addEventListener("resize", away, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", away, { capture: true });
      document.removeEventListener("contextmenu", away, { capture: true });
      removeEventListener("scroll", away, { capture: true });
      removeEventListener("resize", away);
    };
  }, [shown, leave]);

  useLayoutEffect(() => {
    const element = chip.current;
    if (!element) return;
    if (typeof element.showPopover === "function" && !inTopLayer(element)) {
      try {
        element.showPopover();
      } catch {
        // The toast rung holds it over the face where the top layer is not there.
      }
    }
    // At the record's top edge, inside the window: above it where there is room, else just inside it.
    const box = rest.element.getBoundingClientRect();
    const own = element.getBoundingClientRect();
    const top = box.top - own.height - 4 >= 4 ? box.top - own.height - 4 : Math.min(innerHeight - own.height - 4, box.top + 4);
    const left = Math.max(4, Math.min(innerWidth - own.width - 4, box.right - own.width));
    element.style.top = `${Math.round(top)}px`;
    element.style.left = `${Math.round(left)}px`;
  }, [shown, rest.element]);

  if (!sure) return null;
  const { offer, confidence } = sure;
  const kindSaid = offer.type === "panel" ? "a panel" : offer.type === "place" ? "go there" : offer.type === "record" ? "open it" : "suggested";
  return (
    <button
      ref={chip}
      type="button"
      {...({ popover: "manual" } as Record<string, string>)}
      data-testid="hover-chip"
      data-ai-offer={offer.id}
      data-ai-offer-type={offer.type}
      data-graview-overlay=""
      data-graview-popover=""
      aria-label={`Suggested by AI: ${offer.label}`}
      title={`Suggested by AI, ${Math.round(confidence * 100)}% sure`}
      onPointerEnter={hold}
      onPointerLeave={() => leave()}
      onClick={() => {
        // The keyboard goes back to the record the chip was about, never <body>, as the chip goes.
        const home = rest.element.closest<HTMLElement>("[tabindex], a[href], button");
        home?.focus({ preventScroll: true });
        leave(true);
        void takeOffer(env, result!, offer);
      }}
      style={CHIP}
    >
      <span aria-hidden="true" style={{ color: "var(--graview-accent)" }}>
        ✦{" "}
      </span>
      {offer.label}
      <span style={{ color: "var(--graview-ink-faint)" }}> · {kindSaid}</span>
    </button>
  );
}

const CHIP: CSSProperties = {
  position: "fixed",
  inset: "auto",
  top: 0,
  left: 0,
  margin: 0,
  zIndex: layer("toast"),
  boxSizing: "border-box",
  width: "max-content",
  maxWidth: "min(320px, calc(100vw - 8px))",
  height: "auto",
  minHeight: 24,
  padding: "2px 10px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  borderRadius: 999,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-float)",
  color: "var(--graview-ink)",
  boxShadow: "var(--graview-lift-high)",
  font: "inherit",
  fontSize: "0.75rem",
  cursor: "pointer",
};
