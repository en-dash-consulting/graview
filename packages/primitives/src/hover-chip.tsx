import { layer } from "@graview/core";
import { aiTargetOf, type AiCandidate, type AiTarget } from "@graview/core/catalog";
import { recordBoxesOnPage, type BoxOnPage } from "@graview/react/drawing";
import { inTopLayer } from "@graview/react/provider";
import { fastOf, HOVER_CHIP_CONFIDENCE, type InlineResult } from "@graview/tools/inline-ai";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { HoverRest } from "./hover-chips.js";
import { useInlineEnv } from "./inline-ai-env.js";
import { heldSuggestion, suggestOnce, takeOffer, tellOffers } from "./inline-ai-menu.js";
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

/** Where the record the pointer rests on stands — the box a worker view's host judged for it, else the element itself (a card on the scene, a row on a page) — and the other records drawn beside it, which the chip keeps off. */
function restBoxOf(rest: HoverRest): { readonly record: BoxOnPage; readonly others: readonly BoxOnPage[] } {
  const judged = rest.target.on ? recordBoxesOnPage(rest.element) : undefined;
  const record = judged?.find((one) => one.id === rest.target.on);
  if (judged && record) return { record, others: judged.filter((one) => one.id !== record.id && !inside(record, one) && !inside(one, record)) };
  const { left, top, width, height } = rest.element.getBoundingClientRect();
  return { record: { left, top, width, height }, others: [] };
}

/** Whether one box holds another: a list's card holding its rows is not beside them. */
const inside = (outer: BoxOnPage, inner: BoxOnPage) => inner.left >= outer.left && inner.top >= outer.top && inner.left + inner.width <= outer.left + outer.width && inner.top + inner.height <= outer.top + outer.height;

const overlaps = (a: BoxOnPage, b: BoxOnPage) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

/** The room kept between the chip and the record, and from the window's edges. */
const GAP = 6;
const EDGE = 4;

/**
 * WHERE THE CHIP STANDS (Graview HQ feature:f-view-menu-suggests-under-pointer):
 * beside the record, never over it or over what is drawn above it — to its
 * right, level with its top, where the window has room; else just below
 * it, from its left edge; else just above it. Where `others` (the records
 * drawn beside it) are given, the first of those that covers none of them;
 * every edge kept inside the window. In the window's pixels, rounded.
 */
export function chipPlace(
  record: BoxOnPage,
  chip: { readonly width: number; readonly height: number },
  window: { readonly width: number; readonly height: number },
  others: readonly BoxOnPage[] = [],
): { readonly left: number; readonly top: number } {
  const inside = (value: number, room: number, size: number) => Math.round(Math.max(EDGE, Math.min(room - size - EDGE, value)));
  const right = record.left + record.width;
  const bottom = record.top + record.height;
  // Level with the record's first line: centered on a row no taller than two chips, at the top of a taller card.
  const level = record.height <= chip.height * 2 ? record.top + (record.height - chip.height) / 2 : record.top + GAP;
  const left = inside(record.left, window.width, chip.width);
  const fits: { readonly left: number; readonly top: number }[] = [];
  if (right + GAP + chip.width <= window.width - EDGE) fits.push({ left: Math.round(right + GAP), top: inside(level, window.height, chip.height) });
  if (bottom + GAP + chip.height <= window.height - EDGE) fits.push({ left, top: Math.round(bottom + GAP) });
  if (record.top - GAP - chip.height >= EDGE) fits.push({ left, top: Math.round(record.top - GAP - chip.height) });
  const clear = fits.find((at) => !others.some((other) => overlaps({ left: at.left, top: at.top, width: chip.width, height: chip.height }, other)));
  return clear ?? fits[0] ?? { left, top: inside(bottom + GAP, window.height, chip.height) };
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
  /* Asked and answered, and not sure enough of anything here: said quietly, so a rest is never met by nothing at all — and no pick under the chip's confidence is shown. */
  const unsure = asks && sure === null && result !== undefined && result.interaction.outcome !== "failed";
  const chip = useRef<HTMLButtonElement | null>(null);
  const sign = useRef<HTMLSpanElement | null>(null);
  /* The chip shown, and whether it was taken: told to the host as it goes (`HostAi.onPickOutcome`). */
  const taken = useRef(false);
  const showing = useRef<{ readonly env: typeof env; readonly result: InlineResult; readonly offer: AiCandidate } | null>(null);
  showing.current = sure && result ? { env, result, offer: sure.offer } : null;
  useEffect(() => {
    if (shown === null) return;
    taken.current = false;
    const was = showing.current;
    return () => {
      if (was) tellOffers(was.env, was.result, [was.offer], taken.current ? was.offer.id : null, "chip");
    };
  }, [shown, key]);

  /* Put away by a press anywhere else, the wheel, or the window moving: a chip never stands over what moved under it. */
  useEffect(() => {
    if (shown === null && !unsure) return;
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
  }, [shown, unsure, leave]);

  useLayoutEffect(() => {
    const element = chip.current ?? sign.current;
    if (!element) return;
    if (typeof element.showPopover === "function" && !inTopLayer(element)) {
      try {
        element.showPopover();
      } catch {
        // The toast rung holds it over the face where the top layer is not there.
      }
    }
    const { record, others } = restBoxOf(rest);
    const own = element.getBoundingClientRect();
    const place = chipPlace(record, { width: own.width, height: own.height }, { width: innerWidth, height: innerHeight }, others);
    element.style.top = `${place.top}px`;
    element.style.left = `${place.left}px`;
  }, [shown, unsure, rest.element, rest.target.on]);

  if (!sure) {
    if (!unsure) return null;
    return (
      <span
        ref={sign}
        {...({ popover: "manual" } as Record<string, string>)}
        data-testid="hover-chip-unsure"
        data-graview-overlay=""
        data-graview-popover=""
        aria-hidden="true"
        style={UNSURE}
      >
        ✦ Nothing sure here · right-click for more
      </span>
    );
  }
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
        taken.current = true;
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

/* The quiet sign: no border, no lift, faint, and nothing to press — the menu is where the rest of the suggestions are. */
const UNSURE: CSSProperties = {
  ...CHIP,
  border: "1px solid transparent",
  background: "color-mix(in srgb, var(--graview-float) 80%, transparent)",
  color: "var(--graview-ink-faint)",
  boxShadow: "none",
  cursor: "default",
  pointerEvents: "none",
};
