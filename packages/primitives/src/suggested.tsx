import { nameOfAuthor, type AnySchema, type DismissalStore, type Suggestion } from "@graview/core";
import { lineageWords } from "@graview/core/provenance";
import { acceptSuggestion, declineSuggestion, suggestions } from "@graview/core/tidying";
import { POPOVER_STYLE, useGraph, useGraview, usePopover } from "@graview/react/provider";
import { useEffect, useId, useMemo, useReducer, useState } from "react";
import { dismissalsOf, tomorrow } from "./dismissals.js";
import { Chip, VISUALLY_HIDDEN } from "./primitives/index.js";
import { nameOf } from "./workbench/answer-args.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * WHAT THE APP'S OWN ACTOR LEFT WHILE A PERSON WAS AWAY, in a line: "3
 * suggestions waiting · tidied 12 things while you were away", or undefined
 * when there is nothing to say.
 */
export function awayWords(waiting: number, tidied: number): string | undefined {
  const parts = [waiting > 0 ? `${waiting === 1 ? "one suggestion" : `${waiting} suggestions`} waiting` : "", tidied > 0 ? `tidied ${tidied === 1 ? "one thing" : `${tidied} things`} while you were away` : ""].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ").replace(/^./, (first) => first.toUpperCase()) : undefined;
}

/**
 * THE SUGGESTED TRAY: what the app's own actor proposed and did not make
 * (`suggest`, `@graview/core/tidying`), waiting for a person — quietly, on the bar beside
 * Activity, never in the way of anything. Each says what it would do, who
 * suggested it, what it was based on and how sure, and the records it
 * names; Accept makes it as the person, carrying its lineage, Decline
 * keeps the decline in the log, so it is never suggested again, and Not now
 * puts it out of this person's sight until tomorrow — kept where the host
 * keeps their own state (`dismissals`), so nobody else is told and the
 * actor is held to nothing. Fetched when the log holds a suggestion, or
 * the host said what was done while the person was away (`BarSuggested`),
 * so a page with neither carries none of it; drawn while one still waits
 * for this person, or there is something to say of their time away.
 */
export function SuggestedTray() {
  const { store, principal, dismissals: host, whileAway, app } = useGraview<AnySchema>();
  const nodes = useGraph();
  const notNow = useMemo(() => dismissalsOf(host, app?.name ?? "app", principal), [host, app?.name, principal]);
  const [said, changed] = useReducer((count: number) => count + 1, 0);
  useEffect(() => notNow.onChange?.(changed), [notNow]);
  const waiting = useMemo(() => suggestions(store, principal, { dismissed: notNow.list() }), [store, principal, nodes, notNow, said]);
  const [heard, hear] = useState("");
  const popover = usePopover("suggested");
  const tidied = whileAway?.tidied ?? 0;
  const away = whileAway ? awayWords(waiting.length, tidied) : undefined;
  if (waiting.length === 0 && tidied === 0) return null;
  /*
   * A ROW SETTLED, THE KEYBOARD STAYS IN THE TRAY: on the next row's first
   * button. The last one settled, the tray closes, and the keyboard goes to
   * Activity, where what was just made is — never to <body>.
   */
  const settled = (word: string) => {
    hear(word);
    if (waiting.length > 1) {
      requestAnimationFrame(() => (document.querySelector('[data-testid="suggested"] [data-testid="suggestion-accept"]') as HTMLElement | null)?.focus());
      return;
    }
    popover.setOpen(false);
    // Activity, else, where nothing has been made yet, the bar's next control.
    (document.querySelector<HTMLElement>('[data-testid="activity-button"]') ?? document.querySelector<HTMLElement>('[data-graview-app-bar] button:not([data-testid="suggested-button"])'))?.focus();
  };
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="suggested-button"
        {...popover.trigger}
        onClick={popover.toggle}
        title={away ?? "What tidying suggests, waiting for you"}
        {...(away ? { "aria-label": `Suggested: ${away}` } : {})}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: 30,
          padding: "0 8px",
          borderRadius: 8,
          border: "1px solid transparent",
          background: "transparent",
          boxShadow: "none",
          fontSize: "0.875rem",
          whiteSpace: "nowrap",
          color: "var(--graview-ink-muted)",
        }}
      >
        {waiting.length > 0 ? waiting.length : `Tidied ${tidied}`}
        {/* On a phone's bar the word gives its room and the mark stands for it, as Activity's does. */}
        <svg className="graview-activity-mark" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style={{ display: "var(--graview-activity-mark, none)" }}>
          <path d="M3 4.5 H13 M3 8 H10 M3 11.5 H8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="12.25" cy="11.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        {waiting.length > 0 ? <span className="graview-activity-word"> Suggested</span> : null}
      </button>
      {popover.open ? (
        <section
          {...popover.pane}
          aria-label="Suggested"
          data-testid="suggested"
          data-graview-offstage=""
          style={{
            ...POPOVER_STYLE,
            width: 320,
            maxHeight: "min(52cqh, 460px)",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 9,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
          }}
        >
          <h2 style={{ ...VISUALLY_HIDDEN, margin: 0 }}>Suggested</h2>
          {away ? (
            <p data-testid="while-away" style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.45, color: "var(--graview-ink-muted)" }}>
              {away}.
            </p>
          ) : null}
          <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.45, color: "var(--graview-ink-faint)" }}>{waiting.length > 0 ? "Not made yet: each waits for you." : "What it did is in Activity."}</p>
          <ol data-testid="suggestions" style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10, fontSize: "0.8125rem" }}>
            {waiting.map((one) => (
              <SuggestionRow key={one.id} suggestion={one} notNow={notNow} settled={settled} />
            ))}
          </ol>
          {/* What the last press did, said to a screen reader: the row it was on is gone. */}
          <span role="status" data-testid="suggestion-heard" style={VISUALLY_HIDDEN}>
            {heard}
          </span>
        </section>
      ) : null}
    </div>
  );
}

/** What each answer to a suggestion is said as, once the row it was on is gone. */
const HEARD = { accept: "Accepted.", decline: "Declined: it will not be suggested again.", later: "Hidden from you until tomorrow." } as const;

/** One suggestion: what it would do and why, its records, and Accept, Decline and Not now, each a sentence when refused. */
function SuggestionRow({ suggestion, notNow, settled }: { readonly suggestion: Suggestion; readonly notNow: DismissalStore; readonly settled: (heard: string) => void }) {
  const { store, principal, seats, people } = useGraview<AnySchema>();
  const [refused, setRefused] = useState<string | null>(null);
  const hint = useId();
  const by = nameOfAuthor(suggestion.author, { graph: store.graph as never, schema: store.schema, seats, people });
  const settle = async (how: keyof typeof HEARD) => {
    setRefused(null);
    try {
      if (how === "accept") acceptSuggestion(store, suggestion.id, { author: principal });
      else if (how === "decline") declineSuggestion(store, suggestion.id, { author: principal });
      // The person's own, not the app's: nothing in the log, and the actor bound to nothing.
      else await notNow.dismiss({ suggestion: suggestion.id, at: new Date().toISOString(), until: tomorrow() });
      settled(HEARD[how]);
    } catch (error) {
      setRefused(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <li data-testid="suggestion" data-suggestion={suggestion.id} style={{ display: "grid", gap: 5, lineHeight: 1.45 }}>
      <span>
        <strong style={{ fontWeight: 600 }}>{by}</strong> <span style={{ color: "var(--graview-ink-muted)" }}>suggests</span> {suggestion.intent}
      </span>
      {suggestion.lineage ? (
        <span data-graview-lineage="" style={{ color: "var(--graview-ink-faint)" }}>
          {lineageWords(suggestion.lineage)}
        </span>
      ) : null}
      {suggestion.about.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {suggestion.about.slice(0, 4).map((id) => (
            <Chip key={id} label={nameOf(store, id)} pickId={id} />
          ))}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" data-testid="suggestion-accept" onClick={() => void settle("accept")} style={{ minHeight: 24, padding: "1px 10px", fontSize: "0.75rem" }}>
          Accept
        </button>
        <button type="button" data-testid="suggestion-decline" onClick={() => void settle("decline")} style={{ minHeight: 24, padding: "1px 10px", fontSize: "0.75rem" }}>
          Decline
        </button>
        <button
          type="button"
          data-testid="suggestion-not-now"
          onClick={() => void settle("later")}
          title="Hide it from you until tomorrow. It still waits for everyone else."
          aria-describedby={hint}
          style={{ minHeight: 24, padding: "1px 10px", fontSize: "0.75rem", marginInlineStart: "auto", border: "1px solid transparent", background: "transparent", boxShadow: "none", color: "var(--graview-ink-muted)" }}
        >
          Not now
        </button>
        <span id={hint} style={VISUALLY_HIDDEN}>
          Hides it from you until tomorrow; it still waits for everyone else.
        </span>
      </div>
      {refused ? (
        <span data-testid="suggestion-refused" role="alert" style={{ fontSize: "0.75rem", color: "var(--graview-warn)" }}>
          {refused}
        </span>
      ) : null}
    </li>
  );
}
