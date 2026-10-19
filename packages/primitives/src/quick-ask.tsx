import { layer, pluralOf, type AnySchema } from "@graview/core";
import { aiTargetOf, catalogOf, existingViewsOf, recordsOfTarget, type AiCandidate, type AiTarget } from "@graview/core/catalog";
import { search } from "@graview/core/search";
import { useAiDeskState, useGraview } from "@graview/react/provider";
import { applyAffordance, deriveAffordances, previewAffordance } from "@graview/tools/derive";
import { answerHere, targetWords, type InlineResult } from "@graview/tools/inline-ai";
import type { Affordance } from "@graview/tools/frame";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { askOf, drawPanel, GhostTray, takeOffer } from "./inline-ai-menu.js";
import { useInlineEnv } from "./inline-ai-env.js";
import { openQuickAsk, type QuickAskOpening } from "./quick-ask-desk.js";
import { VISUALLY_HIDDEN } from "./primitives/measure.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * THE COMMAND BAR AND ITS ANSWER CARD (`quick-ask-door.tsx`), fetched when
 * first opened.
 *
 * One card beside what it is about. Opened, it is the bar: a field that
 * completes the acts on the target, "Show …" for the panels the catalog can
 * draw of it, its places and its records, and — for words that are a
 * question — "Ask: ‘…’". Asked, the same card holds the answer: a few
 * sentences, the places, records and panels that act on it, and the
 * changes it proposes as a ghost on the card, accepted all or some as one
 * batch, with its one undo. Its field
 * stays, for a follow-up: asked there, the answer replaces the one before,
 * and the model is told only that one step back.
 */

export interface QuickAskCardProps {
  readonly face: "scene" | "pages";
  readonly opening: QuickAskOpening;
  readonly close: () => void;
}

/** One row of the bar's list: what it is, how it reads, and what taking it does. */
interface Row {
  readonly id: string;
  readonly kind: "act" | "show" | "place" | "record" | "ask";
  readonly label: string;
  readonly hint?: string;
  readonly take: () => void;
}

/** What the card answered, or is answering. */
interface Answering {
  readonly said: string;
  readonly result: InlineResult | null;
}

/** Words that say what kind of row is wanted, not which: "show", "go to", "open". */
const LEADING = new Set(["show", "go", "to", "open", "the", "a", "an", "me"]);
const folded = (text: string): string => text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
/** Whether every word typed (but the leading ones) is in the row's words. */
const fits = (label: string, words: readonly string[]): boolean => {
  const said = folded(label);
  return words.every((word) => said.includes(word));
};
const sentenceCase = (text: string): string => (text ? `${text[0]!.toLowerCase()}${text.slice(1)}` : text);

/** How many of each kind of row the bar lists. */
const MOST = { act: 4, show: 3, place: 3, record: 4 } as const;
/** The card's width on a desk, and its distance from what it stands beside and from the window's edges. */
const WIDTH = 360;
const GAP = 12;

export function QuickAskCard({ face, opening, close }: QuickAskCardProps) {
  const env = useInlineEnv();
  const { setMenuAt } = useGraview<AnySchema>();
  const target = useMemo<AiTarget>(() => opening.target ?? aiTargetOf(opening.pointed ?? { about: [] }, (id) => env.store.graph.has(id)), [opening, env.store]);
  const about = useMemo(() => targetWords(env.store, target, env.places), [env.store, target, env.places]);
  const [words, setWords] = useState("");
  const [active, setActive] = useState(-1);
  const [answering, setAnswering] = useState<Answering | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const pane = useRef<HTMLElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const list = useId();
  const live = useRef(true);
  const { ghost: held } = useAiDeskState(env.desk);
  useEffect(
    () => () => {
      live.current = false;
      // Put away with a change still proposed on it: the change waits on the tray at the foot instead.
      const waiting = env.desk.get().ghost;
      if (waiting?.onCard) env.desk.setGhost({ ...waiting, onCard: false });
    },
    [env.desk],
  );

  /* THE CATALOG OF THIS TARGET: its panels ("Show …") and places, and the acts the derivation offers this viewer on its records. */
  const catalog = useMemo(() => {
    const ask = askOf(env, target);
    return catalogOf(env.store, target, { principal: env.principal, places: env.places, ...(ask.acts ? { acts: ask.acts } : {}) });
  }, [env, target]);
  const acts = useMemo(() => {
    const ids = recordsOfTarget(target);
    if (ids.length === 0) return [];
    const offered = new Set(catalog.candidates.flatMap((candidate) => (candidate.type === "act" ? [candidate.mutation] : [])));
    return deriveAffordances(env.store, ids, { principal: env.principal, ...(ids.length === 1 ? { focus: ids[0]! } : {}) }).affordances.filter((affordance) => !affordance.destructive && offered.has(affordance.mutation));
  }, [env.store, env.principal, target, catalog]);

  /* Where the keyboard goes when the card is put away: where it was, else the thing it was about, else the face. */
  const putAway = useCallback(() => {
    const back = opening.returnTo;
    const anchor = anchorOf(pane.current, target, face);
    close();
    requestAnimationFrame(() => {
      if (back?.isConnected && !back.closest("[inert]")) return back.focus({ preventScroll: true });
      const home = (anchor && anchor.tabIndex >= 0 ? anchor : null) ?? document.querySelector<HTMLElement>("[data-graview-page-title]") ?? document.querySelector<HTMLElement>("main");
      if (home && home.tabIndex < 0 && !home.hasAttribute("tabindex")) home.setAttribute("tabindex", "-1");
      home?.focus({ preventScroll: true });
    });
  }, [opening.returnTo, target, face, close]);

  const act = useCallback(
    (affordance: Affordance) => {
      if (affordance.open.length > 0) {
        // An act that asks for something is asked in its own form, on the menu at its subject.
        const box = pane.current?.getBoundingClientRect();
        close();
        setMenuAt({ x: box?.left ?? 0, y: box?.top ?? 0, on: (affordance.args["id"] as string | undefined) ?? recordsOfTarget(target)[0], about: recordsOfTarget(target) });
        return;
      }
      try {
        previewAffordance(env.store, affordance, {});
        applyAffordance(env.store, affordance, {}, { author: env.principal });
        putAway();
      } catch (error) {
        setSaid(error instanceof Error ? error.message : String(error));
      }
    },
    [env.store, env.principal, close, putAway, setMenuAt, target],
  );

  const ask = useCallback(
    async (question: string) => {
      const asked = question.trim();
      if (!asked) return;
      const before = answering?.result?.answer ? { said: answering.said, answer: answering.result.answer } : undefined;
      setWords("");
      setActive(-1);
      setSaid(null);
      setAnswering({ said: asked, result: null });
      const result = await answerHere(env.ai, { ...askOf(env, target, asked), said: asked, ...(before ? { follows: before } : {}) });
      env.desk.record(result.interaction);
      // Its proposed change is a ghost, drawn on this card: accepted there as one batch, with its one undo.
      if (result.ghost && result.ghost.proposals.length > 0) env.desk.setGhost({ ghost: result.ghost, onCard: true });
      if (live.current) setAnswering({ said: asked, result });
    },
    [answering, env, target],
  );

  /* Opened with words already (Find's "Ask: ‘…’", Activity's "Ask again"): asked at once. */
  const first = useRef(opening.asked);
  useEffect(() => {
    const asked = first.current;
    first.current = undefined;
    if (asked) void ask(asked);
    // Once, as the card opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* THE ROWS: what fits the words, of each kind, then the words asked. */
  const rows = useMemo<readonly Row[]>(() => {
    const typed = words.trim();
    // An answer card lists nothing until a follow-up is typed: the answer is what it shows.
    if (!typed && answering) return [];
    const wanted = folded(typed).split(/\s+/).filter((word) => word && !LEADING.has(word));
    const showing = /^show\b/i.test(typed);
    const going = /^(go|open)\b/i.test(typed);
    const out: Row[] = [];
    if (!showing && !going) {
      for (const affordance of acts.filter((one) => fits(one.label, wanted)).slice(0, MOST.act)) {
        out.push({ id: `act:${affordance.id}`, kind: "act", label: affordance.label, hint: affordance.open.length > 0 ? "asks more" : "do it", take: () => act(affordance) });
      }
    }
    /*
     * A VIEW THE APP ALREADY HAS, BEFORE A NEW ONE: the places the words
     * fit, best first, ahead of a panel drawn new. One that fits in part is
     * opened with the bar on it, the words asked of it there.
     */
    // A question is asked of the model, Enter on it asking: no view stands ahead of its Ask row.
    const existing = typed && !/\?\s*$/.test(typed) ? existingViewsOf(env.store, target, { principal: env.principal, places: env.places, said: typed }) : [];
    for (const view of existing) {
      out.push({
        id: `place:${view.place}`,
        kind: "place",
        label: view.fit === "full" ? `Open ${view.title}` : `Open and adjust ${view.title}`,
        hint: view.fit === "full" ? "a view you have" : "adjust it",
        take: () => {
          close();
          env.goTo.place(view.place);
          if (view.fit === "partial") openQuickAsk(env.desk, { target: { on: "lens", place: view.place, ...(view.kind ? { kind: view.kind } : {}) }, asked: typed });
        },
      });
    }
    if (!going) {
      const panels = catalog.candidates.filter((candidate): candidate is Extract<AiCandidate, { type: "panel" }> => candidate.type === "panel");
      for (const panel of panels.filter((one) => fits(`show ${one.label}`, wanted)).slice(0, MOST.show)) {
        out.push({
          id: panel.id,
          kind: "show",
          label: `Show ${sentenceCase(panel.label)}`,
          hint: "a panel",
          take: () => {
            close();
            void drawPanel(env, { title: panel.label, recipe: { ...panel.panel, title: panel.label } });
          },
        });
      }
    }
    if (!showing) {
      for (const place of env.places.filter((one) => fits(one.title, wanted) && !existing.some((view) => view.place === one.as)).slice(0, MOST.place)) {
        out.push({ id: `place:${place.as}`, kind: "place", label: `Go to ${place.title}`, take: () => (close(), env.goTo.place(place.as)) });
      }
      if (wanted.length > 0) {
        const hits = search(env.store, typed.replace(/^(go to|open)\s+/i, ""), { principal: env.principal, from: recordsOfTarget(target), limit: MOST.record }).hits;
        for (const hit of hits) {
          if (hit.about !== "node") continue;
          out.push({ id: `record:${hit.id}`, kind: "record", label: hit.label, hint: pluralOf(env.store.schema, hit.kind), take: () => (close(), env.goTo.record(hit.id)) });
        }
      }
    }
    if (typed) out.push({ id: "ask", kind: "ask", label: typed, take: () => void ask(typed) });
    return out;
  }, [words, acts, catalog, env, target, act, ask, close, answering]);

  // Words typed light the first row; with none, nothing is lit until the arrows move.
  useEffect(() => setActive(words.trim() ? 0 : -1), [words]);

  /* PLACED BESIDE WHAT IT IS ABOUT, in the top layer, following it as the picture moves. */
  useLayoutEffect(() => {
    const element = pane.current;
    if (!element) return;
    if (typeof (element as { showPopover?: unknown }).showPopover === "function") {
      try {
        element.showPopover();
      } catch {
        // Shown already, or not in the page yet: the ladder's rung still holds it over the rails.
      }
    }
    field.current?.focus({ preventScroll: true });
    let frame = 0;
    const follow = () => {
      placeBeside(element, anchorOf(element, target, face));
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [target, face]);

  /* A press outside the bar puts it away; an answer stays until it is closed. */
  useEffect(() => {
    if (answering) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && pane.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [answering, close]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && rows.length > 0) {
      event.preventDefault();
      setActive((at) => Math.min(rows.length - 1, at + 1));
    } else if (event.key === "ArrowUp" && rows.length > 0) {
      event.preventDefault();
      setActive((at) => Math.max(0, at - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[active];
      if (row) row.take();
      else if (words.trim()) void ask(words);
    }
  };

  const result = answering?.result ?? null;
  const lit = rows[active];
  return (
    <section
      ref={pane}
      popover="manual"
      role="region"
      aria-label={answering ? `Answer about ${about}` : `Ask about ${about}`}
      data-testid="quick-ask"
      data-quick-ask={answering ? "answer" : "bar"}
      data-quick-ask-face={face}
      // Chrome, not scene: no line is ever anchored to it.
      data-graview-offstage=""
      data-graview-overlay=""
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        // The card's Escape is the card's: the scene's back-out does not hear it too.
        event.preventDefault();
        event.stopPropagation();
        putAway();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      style={CARD}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <p data-testid="quick-ask-about" style={{ margin: 0, flex: "1 1 auto", minWidth: 0, fontSize: "0.75rem", color: "var(--graview-ink-muted)", overflowWrap: "anywhere" }}>
          About {about}
        </p>
        <button type="button" data-testid="quick-ask-close" aria-label="Close" title="Close" onClick={putAway} style={ICON}>
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      {answering ? (
        <div data-testid="quick-answer" style={{ display: "grid", gap: 8 }}>
          <p data-testid="quick-answer-asked" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--graview-ink-muted)", fontStyle: "italic", overflowWrap: "anywhere" }}>
            “{answering.said}”
          </p>
          <p data-testid="quick-answer-text" aria-live="polite" style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.45, color: result?.interaction.outcome === "failed" ? "var(--graview-warn)" : "var(--graview-ink)", overflowWrap: "anywhere" }}>
            {result === null ? "Thinking…" : result.interaction.outcome === "failed" ? (result.interaction.failed ?? "The AI could not answer that here.") : (result.answer ?? "")}
          </p>
          {result && result.offers.length > 0 ? (
            <ul aria-label="What acts on it" style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {result.offers.map((offer) => (
                <li key={offer.id}>
                  <button
                    type="button"
                    data-testid="quick-answer-offer"
                    data-ai-offer={offer.id}
                    data-ai-offer-type={offer.type}
                    onClick={() => {
                      // Put away as it lands, the way this face goes; a failure is said on the card that offered it.
                      void takeOffer(env, result, offer, close).then((failed) => {
                        if (failed && live.current) setSaid(failed);
                      });
                    }}
                    style={OFFER}
                  >
                    {offer.type === "panel" ? `Show ${sentenceCase(offer.label)}` : offer.type === "place" ? `Go to ${offer.label}` : offer.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {held?.onCard && held.ghost.interaction === result?.interaction.id ? <GhostTray placement="card" /> : null}
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 4 }}>
        <input
          ref={field}
          type="text"
          role="combobox"
          data-testid="quick-ask-input"
          aria-label={answering ? `Ask a follow-up about ${about}` : `Ask about ${about}, or go somewhere`}
          aria-expanded={rows.length > 0}
          aria-controls={list}
          aria-autocomplete="list"
          {...(lit ? { "aria-activedescendant": `${list}-${active}` } : {})}
          autoComplete="off"
          enterKeyHint="go"
          placeholder={answering ? "Ask a follow-up…" : "Ask, or go to…"}
          value={words}
          // Read-only while it answers, never disabled: a disabled field lets go of the keyboard.
          readOnly={answering !== null && result === null}
          aria-busy={answering !== null && result === null}
          onChange={(event) => setWords(event.target.value)}
          onKeyDown={onKeyDown}
          style={FIELD}
        />
        <div id={list} role="listbox" aria-label={words.trim() ? `What “${words.trim()}” finds here` : "What can be done here"} hidden={rows.length === 0} style={{ display: rows.length === 0 ? "none" : "grid", gap: 1, maxHeight: 280, overflowY: "auto" }}>
          {rows.map((row, at) => (
            <div
              key={row.id}
              id={`${list}-${at}`}
              role="option"
              aria-selected={at === active}
              data-testid="quick-ask-option"
              data-quick-ask-kind={row.kind}
              data-quick-ask-row={row.id}
              onMouseEnter={() => setActive(at)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={row.take}
              style={{ ...OPTION, background: at === active ? "var(--graview-panel-muted)" : "transparent", ...(row.kind === "ask" ? { borderTop: "1px solid var(--graview-edge)", marginTop: 2 } : {}) }}
            >
              {row.kind === "ask" ? (
                <span>
                  Ask: <span style={{ fontWeight: 600 }}>‘{row.label}’</span>
                </span>
              ) : (
                <span>
                  {row.label}
                  {row.hint ? <span style={{ color: "var(--graview-ink-faint)" }}> · {row.hint}</span> : null}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {said ? (
        <p role="alert" data-testid="quick-ask-refused" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--graview-warn)" }}>
          {said}
        </p>
      ) : null}
      <span style={VISUALLY_HIDDEN} aria-live="polite">
        {rows.length > 0 && words.trim() ? `${rows.length} ${rows.length === 1 ? "way" : "ways"} to go on` : ""}
      </span>
    </section>
  );
}

/**
 * WHAT THE CARD STANDS BESIDE: the record's card or the kind's district on
 * the scene, else where the record is picked from (a district's row, a
 * page's row), else the page's own heading; nothing for a place, and the
 * card stands under the bar.
 */
function anchorOf(pane: HTMLElement | null, target: AiTarget, face: "scene" | "pages"): HTMLElement | null {
  const root: ParentNode = pane?.closest("[data-graview-embed]") ?? document;
  const ids = target.on === "list" ? [`aggregate:${target.kind}`, `kind:${target.kind}`] : target.on === "lens" && target.kind ? [`aggregate:${target.kind}`] : recordsOfTarget(target);
  for (const id of ids) {
    // The record's own card where the picture draws one; else where it is picked from (a row of a district's list).
    for (const element of root.querySelectorAll<HTMLElement>(`[data-graview-view="${CSS.escape(id)}"], [data-graview-pick="${CSS.escape(id)}"]`)) {
      if (pane?.contains(element)) continue;
      const box = element.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) return element;
    }
  }
  if (face === "pages") return root.querySelector<HTMLElement>("main [data-graview-page-title]") ?? root.querySelector<HTMLElement>("main h1");
  return null;
}

/** Beside the anchor where the window has room — its right, else its left — else under it (over it, near the window's foot); under the bar for nothing. */
function placeBeside(pane: HTMLElement, anchor: HTMLElement | null): void {
  const view = { width: document.documentElement.clientWidth || innerWidth, height: innerHeight };
  const width = Math.min(WIDTH, view.width - 2 * GAP);
  const height = pane.getBoundingClientRect().height;
  const at = anchor?.getBoundingClientRect();
  let left: number;
  let top: number;
  let side: string;
  const clampTop = (wanted: number) => Math.max(GAP, Math.min(wanted, view.height - height - GAP));
  if (at && at.width > 0 && at.bottom > 0 && at.top < view.height) {
    if (at.right + GAP + width <= view.width - GAP) {
      left = at.right + GAP;
      top = clampTop(at.top);
      side = "right";
    } else if (at.left - GAP - width >= GAP) {
      left = at.left - GAP - width;
      top = clampTop(at.top);
      side = "left";
    } else {
      left = Math.max(GAP, Math.min(at.left, view.width - width - GAP));
      const below = at.bottom + GAP;
      top = below + height <= view.height - GAP ? below : clampTop(at.top - GAP - height);
      side = below + height <= view.height - GAP ? "below" : "above";
    }
  } else {
    left = (view.width - width) / 2;
    top = clampTop(72);
    side = "top";
  }
  const style = pane.style;
  const next = { left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, width: `${Math.round(width)}px` };
  if (style.left !== next.left) style.left = next.left;
  if (style.top !== next.top) style.top = next.top;
  if (style.width !== next.width) style.width = next.width;
  const beside = anchor?.getAttribute("data-graview-view") ?? anchor?.getAttribute("data-graview-pick") ?? (anchor ? "page" : "");
  if (pane.getAttribute("data-quick-ask-beside") !== beside) pane.setAttribute("data-quick-ask-beside", beside);
  if (pane.getAttribute("data-quick-ask-side") !== side) pane.setAttribute("data-quick-ask-side", side);
}

const CARD: CSSProperties = {
  position: "fixed",
  inset: "auto",
  margin: 0,
  zIndex: layer("popover"),
  boxSizing: "border-box",
  display: "grid",
  gap: 10,
  padding: 12,
  borderRadius: 12,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-float)",
  color: "var(--graview-ink)",
  boxShadow: "var(--graview-lift-high)",
  maxHeight: "calc(100dvh - 24px)",
  overflowY: "auto",
  fontSize: "0.875rem",
};
const ICON: CSSProperties = { display: "inline-grid", placeItems: "center", width: 28, height: 28, padding: 0, font: "inherit", fontSize: "0.875rem", lineHeight: 1, color: "var(--graview-ink-muted)", background: "transparent", border: "1px solid transparent", borderRadius: 6, boxShadow: "none", cursor: "pointer" };
const FIELD: CSSProperties = { boxSizing: "border-box", width: "100%", height: 36, padding: "0 10px", font: "inherit", fontSize: "max(1rem,16px)", color: "var(--graview-ink)", background: "var(--graview-panel)", border: "1px solid var(--graview-edge)", borderRadius: 8 };
const OPTION: CSSProperties = { display: "flex", alignItems: "center", minHeight: 30, padding: "4px 8px", borderRadius: 6, cursor: "pointer", overflowWrap: "anywhere" };
const OFFER: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 30, padding: "2px 10px", font: "inherit", fontSize: "0.8125rem", borderRadius: 8 };

