import { nameOfAuthor, type AnySchema, type Suggestion } from "@graview/core";
import { lineageWords } from "@graview/core/provenance";
import { acceptSuggestion, declineSuggestion, suggestions } from "@graview/core/tidying";
import { POPOVER_STYLE, useGraph, useGraview, usePopover } from "@graview/react/provider";
import { useMemo, useState } from "react";
import { Chip, VISUALLY_HIDDEN } from "./primitives/index.js";
import { nameOf } from "./workbench/answer-args.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * THE SUGGESTED TRAY: what the app's own actor proposed and did not make
 * (`suggest`, `@graview/core/tidying`), waiting for a person — quietly, on the bar beside
 * Activity, never in the way of anything. Each says what it would do, who
 * suggested it, what it was based on and how sure, and the records it
 * names; Accept makes it as the person, carrying its lineage, and Decline
 * keeps the decline in the log, so it is never suggested again. Fetched
 * when the log holds a suggestion (`BarSuggested`), so a page with none
 * carries none of it; drawn while one still waits for this seat.
 */
export function SuggestedTray() {
  const { store, principal } = useGraview<AnySchema>();
  const nodes = useGraph();
  const waiting = useMemo(() => suggestions(store, principal), [store, principal, nodes]);
  const popover = usePopover("suggested");
  if (waiting.length === 0) return null;
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="suggested-button"
        {...popover.trigger}
        onClick={popover.toggle}
        title="What tidying suggests, waiting for you"
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
        {waiting.length}
        {/* On a phone's bar the word gives its room and the mark stands for it, as Activity's does. */}
        <svg className="graview-activity-mark" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style={{ display: "var(--graview-activity-mark, none)" }}>
          <path d="M3 4.5 H13 M3 8 H10 M3 11.5 H8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="12.25" cy="11.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <span className="graview-activity-word"> Suggested</span>
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
          <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.45, color: "var(--graview-ink-faint)" }}>Not made yet: each waits for you.</p>
          <ol data-testid="suggestions" style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10, fontSize: "0.8125rem" }}>
            {waiting.map((one) => (
              <SuggestionRow
                key={one.id}
                suggestion={one}
                /*
                 * THE LAST ONE SETTLED, THE TRAY GOES — and the keyboard to
                 * Activity, where what was just made is, never to <body>.
                 */
                {...(waiting.length === 1
                  ? {
                      settled: () => {
                        popover.setOpen(false);
                        (document.querySelector('[data-testid="activity-button"]') as HTMLElement | null)?.focus();
                      },
                    }
                  : {})}
              />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

/** One suggestion: what it would do and why, its records, and Accept and Decline, each a sentence when refused. */
function SuggestionRow({ suggestion, settled }: { readonly suggestion: Suggestion; readonly settled?: () => void }) {
  const { store, principal, seats, people } = useGraview<AnySchema>();
  const [refused, setRefused] = useState<string | null>(null);
  const by = nameOfAuthor(suggestion.author, { graph: store.graph as never, schema: store.schema, seats, people });
  const settle = (how: "accept" | "decline") => {
    setRefused(null);
    try {
      if (how === "accept") acceptSuggestion(store, suggestion.id, { author: principal });
      else declineSuggestion(store, suggestion.id, { author: principal });
      settled?.();
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
        <button type="button" data-testid="suggestion-accept" onClick={() => settle("accept")} style={{ minHeight: 24, padding: "1px 10px", fontSize: "0.75rem" }}>
          Accept
        </button>
        <button type="button" data-testid="suggestion-decline" onClick={() => settle("decline")} style={{ minHeight: 24, padding: "1px 10px", fontSize: "0.75rem" }}>
          Decline
        </button>
      </div>
      {refused ? (
        <span data-testid="suggestion-refused" role="alert" style={{ fontSize: "0.75rem", color: "var(--graview-warn)" }}>
          {refused}
        </span>
      ) : null}
    </li>
  );
}
