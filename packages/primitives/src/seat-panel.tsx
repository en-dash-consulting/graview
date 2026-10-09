import { failureWords, type AnySchema } from "@graview/core";
import { withFocus, withOverview, withSelection } from "@graview/layout/view";
import { useAffordances, useApplyAffordance, useGraview, useSeatTalkState, useViolations } from "@graview/react";
import { loadPins, type Affordance, type Responder, type SeatMove, type ToolCall } from "@graview/tools";
// Its own entry: a bundler places a file in every chunk that can reach it, and only the open seat uses this.
import { offeredActs, suggestionsFor, whereLine } from "@graview/tools/suggest";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChatPanel, LINK, QUIET_BUTTON } from "./chat.js";
import { useSubject } from "./subject.js";
import { VISUALLY_HIDDEN } from "./primitives/index.js";
import { AnswerArgs } from "./workbench/index.js";

/**
 * THE OPEN SEAT — fetched when the seat is first opened (`seat-field.tsx`).
 *
 * A row of three quiet controls (the other foot, what answers, close; on a
 * phone a grab line), then — with nothing asked yet — one plain line about
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
  const [settings, setSettings] = useState(false);
  const go = useSeatGo(onPick);
  const latest = [...talk.turns].reverse().find((turn) => turn.role === "seat");
  /*
   * A PHONE'S SHEET YIELDS TO A DRAWN VIEW. Asked for a board, the sheet
   * stood over most of it until it was put away: with a draft in place it
   * keeps only the latest answer's lines above the field (the rest of the
   * talk scrolls behind them), so the view is what the reader looks at.
   */
  const yielding = phone && talk.draft !== null;
  /* THE LATEST ANSWER IN SIGHT: the panel scrolls to its foot as a turn arrives. */
  const body = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const at = body.current;
    if (at) at.scrollTop = at.scrollHeight;
  }, [talk.turns.length, talk.busy, yielding]);
  return (
    <div data-testid="seat-panel" {...(yielding ? { "data-graview-seat-yields": "" } : {})} style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 4, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: phone ? "center" : "flex-end", gap: 2, position: "relative", minHeight: 28 }}>
        {phone ? (
          /* A GRAB LINE, the sheet's own way away: a real button the width of a thumb. */
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
        {respond ? null : (
          <button
            type="button"
            data-testid="seat-settings"
            aria-label="What answers"
            aria-expanded={settings}
            title="What answers: the graph itself, a model in this browser, a decision provider, or your own key"
            onClick={() => setSettings((was) => !was)}
            style={phone ? { ...ICON, position: "absolute", right: 0 } : ICON}
          >
            <span aria-hidden="true">⚙</span>
          </button>
        )}
        {phone ? null : (
          <button type="button" data-testid="seat-close" aria-label={`Close Ask ${name}`} title="Close" onClick={onClose} style={ICON}>
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>
      <div
        ref={body}
        data-testid="seat-body"
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
          settings={settings}
          onSettings={setSettings}
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
  const violations = useViolations();
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
    places: views.places().map((one) => ({ title: one.title, kind: one.kind as string, picture: true })),
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

/** A small square control in the panel's top row: a glyph, its name said to the screen reader. */
/** How much of the talk a phone's sheet keeps over a drawn view: the latest answer's lines. */
const YIELDED = "min(5.5em, 22cqh)";

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
