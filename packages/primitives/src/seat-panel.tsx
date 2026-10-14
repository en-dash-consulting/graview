import { onePerPicture, type AnySchema } from "@graview/core";
import { failureWords } from "@graview/core/words";
import { withFocus, withOverview, withSelection } from "@graview/layout/view";
import { useAffordances, useApplyAffordance, useGraview, useSeatTalkState, useViolations, type SeatTalk } from "@graview/react";
import { problemLine, useLined } from "./rule-line.js";
import { loadPins, type Affordance, type Responder, type SeatMove, type ToolCall } from "@graview/tools";
// Its own entry: a bundler places a file in every chunk that can reach it, and only the open seat uses this.
import { offeredActs, suggestionsFor, whereLine } from "@graview/tools/suggest";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ChatPanel, LINK, QUIET_BUTTON } from "./chat.js";
import { useSubject } from "./subject.js";
import { VISUALLY_HIDDEN } from "./primitives/index.js";
import { AnswerArgs } from "./workbench/index.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * THE OPEN SEAT — fetched when the seat is first opened (`seat-field.tsx`).
 *
 * A row of two quiet controls (the other foot, and close; on a phone a
 * grab line to tap or pull down, and close), then — with nothing asked yet — one plain line about
 * where the reader is, at most three things to ask and at most three acts,
 * and the conversation. No heading over it saying what it is about, no
 * stack of acts, no stars, no filter: the rest is one question away.
 */

export interface SeatPanelProps {
  readonly phone: boolean;
  readonly side: "left" | "right";
  /** The app's name, as the field says it: "Ask Things". */
  readonly name: string;
  readonly onClose: () => void;
  readonly respond?: Responder<AnySchema>;
  readonly onCall?: (call: ToolCall) => void;
  readonly onPick?: (id: string) => void;
  /** Where an answer takes the app: the router on Pages; the scene's own stops when unsaid. */
  readonly onMove?: (move: SeatMove) => void;
  /** The place the reader stands in, by its slug, as the face knows it. */
  readonly place?: string;
  /** A view was drawn: the face shows it (Pages goes to `/~draft`). */
  readonly onDraft?: () => void;
}

export function SeatPanel({ phone, side, name, onClose, respond, onCall, onPick, onMove, place, onDraft }: SeatPanelProps) {
  const { seatTalk } = useGraview();
  const talk = useSeatTalkState(seatTalk);
  const go = useSeatGo(onPick);
  const latest = [...talk.turns].reverse().find((turn) => turn.role === "seat");
  /*
   * A PHONE'S SHEET YIELDS TO A DRAWN VIEW. Asked for a board, the sheet
   * stood over most of it until it was put away: with a draft in place it
   * keeps only the latest answer's lines above the field (the rest of the
   * talk scrolls behind them), so the view is what the reader looks at.
   */
  const yielding = phone && talk.draft !== null;
  /*
   * THE LATEST ANSWER IN SIGHT: the panel scrolls to its foot as a turn
   * arrives. Opened again with nothing new said, it stands where the reader
   * left it (FR-164): put away to look at the page, the talk is not lost.
   */
  const body = useRef<HTMLDivElement | null>(null);
  const opened = useRef(true);
  useLayoutEffect(() => {
    const at = body.current;
    if (!at) return;
    // Yielding, the sheet is exactly as tall as the latest answer (up to its cap): no half a line of the turn before it.
    const last = yielding ? [...at.querySelectorAll<HTMLElement>("ol > li")].pop() : undefined;
    if (last) {
      // From the answer's top to the end of the talk (what follows it is the list's own foot).
      const from = last.getBoundingClientRect().top - at.getBoundingClientRect().top + at.scrollTop;
      at.style.maxHeight = `min(${Math.ceil(at.scrollHeight - from)}px, ${YIELDED})`;
    }
    const left = opened.current ? SCROLLED.get(seatTalk) : undefined;
    opened.current = false;
    at.scrollTop = left && left.turns === talk.turns.length && !talk.busy ? left.top : at.scrollHeight;
  }, [talk.turns.length, talk.busy, yielding]);
  return (
    <div data-testid="seat-panel" {...(yielding ? { "data-graview-seat-yields": "" } : {})} style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 4, minHeight: 0 }}>
      <div
        data-testid="seat-top"
        {...(phone ? { onPointerDown: (event: ReactPointerEvent<HTMLElement>) => pullDown(event, onClose) } : {})}
        // On a phone the top row is the sheet's handle: a drag down on it is the sheet's, never the page's scroll.
        style={{ display: "flex", alignItems: "center", justifyContent: phone ? "center" : "flex-end", gap: 2, position: "relative", minHeight: 28, ...(phone ? { touchAction: "none" } : {}) }}
      >
        {phone ? (
          /* A GRAB LINE, the sheet's own way away: a real button the width of a thumb, tapped or pulled down. */
          <button type="button" data-testid="seat-grab" aria-label={`Close Ask ${name}`} title="Close" onClick={onClose} style={{ ...ICON, width: 64 }}>
            <span aria-hidden="true" style={{ display: "block", width: 36, height: 4, margin: "0 auto", borderRadius: 2, background: "var(--graview-edge-strong, var(--graview-ink-faint))" }} />
          </button>
        ) : (
          <button
            type="button"
            data-testid="seat-side"
            aria-label={side === "left" ? "Move to the right" : "Move to the left"}
            title={side === "left" ? "Move to the right" : "Move to the left"}
            onClick={() => seatTalk.setSide(side === "left" ? "right" : "left")}
            style={ICON}
          >
            <span aria-hidden="true">⇄</span>
          </button>
        )}
        {/* Close, on a phone as on a desk: a sheet with no way away that reads as one is a trap (FR-164). */}
        <button
          type="button"
          data-testid="seat-close"
          aria-label={`Close Ask ${name}`}
          title="Close"
          onClick={onClose}
          style={phone ? { ...ICON, position: "absolute", top: 0, right: 0 } : ICON}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <div
        ref={body}
        data-testid="seat-body"
        // Where the reader had scrolled to, for the sheet opened again.
        onScroll={(event) => void SCROLLED.set(seatTalk, { top: event.currentTarget.scrollTop, turns: talk.turns.length })}
        style={{
          minHeight: 0,
          // A drawn view on a phone: the sheet yields to it, keeping the latest answer's lines over the field.
          maxHeight: yielding ? YIELDED : phone ? "calc(70cqh - 96px)" : "min(520px, calc(100cqh - 112px))",
          overflowY: "auto",
          overflowX: "hidden",
          padding: "0 4px",
        }}
      >
        <ChatPanel
          shared
          composer={false}
          testId="seat"
          onPick={go}
          {...(onMove ? { onMove } : {})}
          {...(place ? { place } : {})}
          {...(onDraft ? { onDraft } : {})}
          empty={<SeatHere {...(place ? { here: place } : {})} />}
          {...(respond ? { respond } : {})}
          {...(onCall ? { onCall } : {})}
        />
      </div>
      {/* The latest answer, said aloud as it arrives. */}
      <p aria-live="polite" data-testid="seat-said" style={VISUALLY_HIDDEN}>
        {talk.busy ? "" : (latest?.text ?? "")}
      </p>
    </div>
  );
}

/**
 * WHERE A NAME IN AN ANSWER TAKES THE READER — the one place the seat moves
 * the app. A face that knows its own way (Pages: the record's page) says so
 * with `onPick`; on the scene the thing is chosen and flown to. When the
 * seat's answers carry moves of their own (a place, a list narrowed by a
 * date), they are applied here too, so both faces move the same way.
 */
export function useSeatGo(onPick?: (id: string) => void): (id: string) => void {
  const { setView } = useGraview();
  return useCallback(
    (id: string) => (onPick ? onPick(id) : setView((stop) => withSelection(withFocus(withOverview(stop, false), id), [id]))),
    [onPick, setView],
  );
}

/**
 * WITH NOTHING ASKED: one line about where the reader is, a few things to
 * ask, and at most three acts — the repairs a broken rule names for this
 * thing, and the ones the reader pinned.
 */
function SeatHere({ here }: { readonly here?: string }) {
  const { store, views, view, seatTalk } = useGraview<AnySchema>();
  const subject = useSubject({ hover: false });
  // Each with its rule's line, so the line about where the reader is says the shape and the record's values.
  const lined = useLined(store, useViolations());
  const violations = useMemo(() => lined.map((violation) => (violation.line ? { ...violation, message: problemLine(violation) } : violation)), [lined]);
  const record = subject.id ? store.graph.getNode(subject.id) : undefined;
  const standing = here ?? view.within?.["view"];
  const place =
    subject.because === "place" && subject.id === null
      ? views.places().find((one) => one.title === subject.name)
      : standing
        ? views.places().find((one) => one.as === standing)
        : undefined;
  const today = store.today();
  const input = {
    store,
    subject: { id: subject.id, name: subject.name },
    violations,
    place: place ? { title: place.title, kind: place.kind as string } : null,
    // Each picture once, however many kinds it is over.
    places: onePerPicture(views.places()).map((one) => ({ title: one.title, kind: one.kind as string, picture: true })),
    ...(today ? { today } : {}),
  };
  const line = whereLine(input);
  const suggestions = suggestionsFor(input);
  const options = useMemo(() => ({ pins: loadPins(), ...(record ? { focus: record.id, about: [record.id] } : {}) }), [record?.id]);
  const { affordances } = useAffordances(options);
  const acts = record ? offeredActs(affordances, { store, subject: { id: subject.id, name: subject.name } }) : [];
  const { apply, preview } = useApplyAffordance();
  const [asking, setAsking] = useState<Affordance | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const act = (affordance: Affordance, args?: Record<string, unknown>): boolean => {
    try {
      preview(affordance, args);
      apply(affordance, args);
      setSaid(null);
      return true;
    } catch (error) {
      setSaid(failureWords(store.schema, store.allMutations(), error));
      return false;
    }
  };
  return (
    <div data-testid="seat-here" style={{ display: "grid", gap: 10, padding: "2px 2px 6px" }}>
      <p data-testid="seat-where" style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.45, color: "var(--graview-ink)" }}>
        {line}
      </p>
      {acts.length > 0 ? (
        <ul aria-label="What you can do" style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {acts.map(({ affordance, label }) => (
            <li key={affordance.id}>
              <button
                type="button"
                data-testid="seat-act"
                data-affordance={affordance.id}
                aria-pressed={asking?.id === affordance.id}
                title={affordance.why}
                onClick={() => (affordance.open.length > 0 ? setAsking((was) => (was?.id === affordance.id ? null : affordance)) : void act(affordance))}
                style={{ ...QUIET_BUTTON, minHeight: 30, textAlign: "start", ...(affordance.destructive ? { color: "var(--graview-warn)" } : {}) }}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {asking ? (
        <AnswerArgs
          affordance={asking}
          onApply={(args) => {
            if (act(asking, args)) setAsking(null);
          }}
          onCancel={() => setAsking(null)}
        />
      ) : null}
      {said ? (
        <p data-testid="seat-refused" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--graview-warn)" }}>
          {said}
        </p>
      ) : null}
      {suggestions.length > 0 ? (
        <ul aria-label="Things to ask" style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 2, justifyItems: "start" }}>
          {suggestions.map((suggestion) => (
            <li key={suggestion.ask}>
              <button type="button" data-testid="seat-suggestion" data-graview-why={suggestion.why} onClick={() => seatTalk.ask(suggestion.ask)} style={LINK}>
                {suggestion.ask}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** How much of the talk a phone's sheet keeps over a drawn view: the latest answer's lines. */
const YIELDED = "min(5.5em, 22cqh)";

/** Where each conversation's talk was scrolled to, and how many turns it had then: the sheet opened again stands there. */
const SCROLLED = new WeakMap<SeatTalk, { readonly top: number; readonly turns: number }>();

/**
 * HOW FAR A PULL PUTS A PHONE'S SHEET AWAY (FR-164). Its grab line read as
 * something to pull down, and nothing followed the finger. Now the sheet
 * does, from anywhere on its top row: let go `far` pixels down, or flicked
 * down at `flick` pixels a millisecond over at least `least`, and it is put
 * away; short of both it settles back. Moved more than `tap`, it was a drag,
 * and the click the engine may send after it is not a tap on the grab.
 */
const PULL = { far: 64, flick: 0.5, least: 16, tap: 6 } as const;

function pullDown(event: ReactPointerEvent<HTMLElement>, close: () => void): void {
  if (event.button !== 0) return;
  const handle = event.currentTarget;
  const sheet = handle.closest<HTMLElement>('[data-testid="seat"]');
  if (!sheet) return;
  const id = event.pointerId;
  const from = event.clientY;
  let last = { y: from, at: event.timeStamp };
  let speed = 0;
  let moved = 0;
  try {
    handle.setPointerCapture(id);
  } catch {
    // A pointer the engine no longer holds: the moves still reach the handle while the finger is on it.
  }
  const move = (now: PointerEvent) => {
    if (now.pointerId !== id) return;
    moved = Math.max(0, now.clientY - from);
    const took = now.timeStamp - last.at;
    if (took > 0) speed = (now.clientY - last.y) / took;
    last = { y: now.clientY, at: now.timeStamp };
    sheet.style.transition = "none";
    sheet.style.transform = moved > 0 ? `translateY(${moved}px)` : "";
  };
  const end = (now: PointerEvent) => {
    if (now.pointerId !== id) return;
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
    const away = now.type === "pointerup" && (moved >= PULL.far || (moved >= PULL.least && speed >= PULL.flick));
    sheet.style.transition = away ? "" : "transform 160ms ease-out";
    sheet.style.transform = "";
    if (moved > PULL.tap) {
      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      handle.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => handle.removeEventListener("click", swallow, { capture: true }), 0);
    }
    if (away) close();
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

/** A small square control in the panel's top row: a glyph, its name said to the screen reader. */
const ICON: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 28,
  height: 28,
  padding: 0,
  font: "inherit",
  fontSize: "0.875rem",
  lineHeight: 1,
  color: "var(--graview-ink-muted)",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 6,
  boxShadow: "none",
  cursor: "pointer",
};
