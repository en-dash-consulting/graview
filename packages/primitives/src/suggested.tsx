import { nameOfAuthor, type AnySchema, type DismissalStore, type Suggestion } from "@graview/core";
import { lineageWords } from "@graview/core/provenance";
import { acceptSuggestion, declineSuggestion, mayDecide, suggestions, voteSuggestion } from "@graview/core/tidying";
import { POPOVER_STYLE, useGoTo, useGraph, useGraview, usePopover } from "@graview/react/provider";
import { useEffect, useId, useMemo, useReducer, useState } from "react";
import { dismissalsOf, tomorrow } from "./dismissals.js";
import { VISUALLY_HIDDEN } from "./primitives/index.js";
import { nameOf } from "./workbench/answer-args.js";
import { NamedRecord } from "./workbench/named-record.js";
import { SuggestionItems } from "./suggested-items.js";
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
 *
 * A reader who may see a suggestion and may not make its change is not
 * refused (Roadmap f-suggestion-votes): their Accept and Decline are a
 * vote, the row says "Your vote was recorded" and stays, pressed again
 * the other way it changes, and Withdraw vote takes it back; whoever may
 * decide sees the tally beside Accept, "4 for, 1 against".
 */
export function SuggestedTray() {
  const { store, principal, dismissals: host, whileAway, app } = useGraview<AnySchema>();
  const nodes = useGraph();
  const notNow = useMemo(() => dismissalsOf(host, app?.name ?? "app", principal), [host, app?.name, principal]);
  const [said, changed] = useReducer((count: number) => count + 1, 0);
  useEffect(() => notNow.onChange?.(changed), [notNow]);
  // A vote changes no record, so the graph says nothing of it: the tally is read again when one lands (Roadmap f-suggestion-votes).
  useEffect(() => store.subscribe((_, ops) => ops.some((op) => op.vote !== undefined) && changed()), [store]);
  const waiting = useMemo(() => suggestions(store, principal, { dismissed: notNow.list() }), [store, principal, nodes, notNow, said]);
  const [heard, hear] = useState("");
  const popover = usePopover("suggested");
  const goTo = useGoTo();
  /* A record a suggestion names goes somewhere while it is still here: the tray closes behind the reader as they go (FR-225). */
  const goes = (id: string) =>
    store.graph.has(id)
      ? (to: string) => {
          popover.setOpen(false);
          goTo.record(to);
        }
      : null;
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
            /*
             * NEVER SIDEWAYS: never wider than the page, and what it holds wraps
             * rather than widening it. Seventeen suggestions naming
             * "@tanstack/react-router" ran their sentences, their basis and their
             * chips past the right edge, and the panel scrolled sideways.
             */
            width: "min(320px, calc(100vw - 16px))",
            maxHeight: "min(52cqh, 460px)",
            overflowX: "hidden",
            overflowY: "auto",
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
          <ol data-testid="suggestions" style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, fontSize: "0.8125rem", minWidth: 0 }}>
            {waiting.map((one) => (
              <SuggestionRow key={one.id} suggestion={one} notNow={notNow} settled={settled} heard={hear} goes={goes} />
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

/** A line of the tray's that breaks anywhere rather than widen it: a record's name may be one unbroken word longer than the panel. */
const WRAPS = { minWidth: 0, overflowWrap: "anywhere" } as const;

/** What each answer to a suggestion is said as, once the row it was on is gone. */
const HEARD = { accept: "Accepted.", decline: "Declined: it will not be suggested again.", later: "Hidden from you until tomorrow." } as const;

/** What a vote is said as, to the person who cast it: the row stays, since the suggestion still waits. */
const VOTED = { recorded: "Your vote was recorded.", withdrawn: "Your vote was withdrawn." } as const;

/** A suggestion of several said after who suggests it: a headline that starts with their name ("Fill out next week's events: …") says it once. */
const headlineAfter = (by: string, headline: string): string => (headline.startsWith(`${by}: `) ? headline.slice(by.length + 2) : headline);

/** The votes on a suggestion, said beside Accept to whoever may decide: "4 for, 1 against". */
export const tallyWords = (tally: Suggestion["tally"]): string => `${tally.for} for, ${tally.against} against`;

/**
 * One suggestion: what it would do and why, its records, and Accept,
 * Decline and Not now, each a sentence when refused. From a seat that may
 * not make the change, Accept and Decline are a vote for and against
 * (Roadmap f-suggestion-votes): the row stays, says so, and offers to
 * withdraw it; whoever may decide reads the tally beside Accept.
 */
function SuggestionRow({ suggestion, notNow, settled, heard, goes }: { readonly suggestion: Suggestion; readonly notNow: DismissalStore; readonly settled: (heard: string) => void; readonly heard: (word: string) => void; readonly goes: (id: string) => ((id: string) => void) | null }) {
  const { store, principal, seats, people } = useGraview<AnySchema>();
  const [refused, setRefused] = useState<string | null>(null);
  const [voted, setVoted] = useState<string | null>(null);
  const hint = useId();
  const voting = useId();
  const by = nameOfAuthor(suggestion.author, { graph: store.graph as never, schema: store.schema, seats, people });
  // Whether this seat decides it, or votes on it: the store's own answer, the one Accept would meet.
  const decides = useMemo(() => mayDecide(store, suggestion, principal), [store, suggestion, principal]);
  const { tally } = suggestion;
  const settle = async (how: keyof typeof HEARD | "withdraw") => {
    setRefused(null);
    try {
      if (how === "accept" || how === "decline") {
        const answer = how === "accept" ? acceptSuggestion(store, suggestion.id, { author: principal }) : declineSuggestion(store, suggestion.id, { author: principal });
        // A vote, not the change: the suggestion still waits, so the row stays and says so.
        if (answer.voted !== undefined) {
          setVoted(VOTED.recorded);
          heard(VOTED.recorded);
          return;
        }
      } else if (how === "withdraw") {
        voteSuggestion(store, suggestion.id, null, { author: principal });
        setVoted(VOTED.withdrawn);
        heard(VOTED.withdrawn);
        return;
      }
      // The person's own, not the app's: nothing in the log, and the actor bound to nothing.
      else await notNow.dismiss({ suggestion: suggestion.id, at: new Date().toISOString(), until: tomorrow() });
      settled(HEARD[how]);
    } catch (error) {
      setRefused(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <li data-testid="suggestion" data-suggestion={suggestion.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 5, lineHeight: 1.45, minWidth: 0 }}>
      <span data-graview-suggestion-words="" style={WRAPS}>
        <strong style={{ fontWeight: 600 }}>{by}</strong> <span style={{ color: "var(--graview-ink-muted)" }}>suggests</span> {suggestion.items.length > 1 ? headlineAfter(by, suggestion.headline ?? suggestion.intent) : suggestion.intent}
      </span>
      <SuggestionItems suggestion={suggestion} decides={decides} heard={heard} />
      {suggestion.lineage ? (
        <span data-graview-lineage="" style={{ ...WRAPS, color: "var(--graview-ink-faint)" }}>
          {lineageWords(suggestion.lineage)}
        </span>
      ) : null}
      {suggestion.about.length > 0 ? (
        <div data-graview-suggestion-records="" style={{ display: "flex", flexWrap: "wrap", gap: 4, minWidth: 0 }}>
          {/* Each a button that goes to the record (FR-225); one still too wide for the row is cut with an ellipsis, its whole name in its title (Chip). */}
          {suggestion.about.slice(0, 4).map((id) => (
            <NamedRecord key={id} id={id} label={nameOf(store, id)} go={goes(id)} testId="suggestion-record" />
          ))}
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, minWidth: 0 }}>
        <button
          type="button"
          data-testid="suggestion-accept"
          onClick={() => void settle("accept")}
          {...(decides ? {} : { "aria-pressed": tally.mine === "for", "aria-describedby": voting })}
          style={{ minHeight: 24, padding: "1px 10px", fontSize: "0.75rem" }}
        >
          {decides && suggestion.items.length > 1 ? "Accept all" : "Accept"}
        </button>
        {/* The votes so far, to whoever may decide: a voter is told their own, not everyone's. */}
        {decides && tally.for + tally.against > 0 ? (
          <span data-testid="suggestion-tally" style={{ ...WRAPS, fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
            {tallyWords(tally)}
          </span>
        ) : null}
        <button
          type="button"
          data-testid="suggestion-decline"
          onClick={() => void settle("decline")}
          {...(decides ? {} : { "aria-pressed": tally.mine === "against", "aria-describedby": voting })}
          style={{ minHeight: 24, padding: "1px 10px", fontSize: "0.75rem" }}
        >
          Decline
        </button>
        {!decides ? (
          <span id={voting} style={VISUALLY_HIDDEN}>
            Counts as your vote; somebody who may make it decides.
          </span>
        ) : null}
        {!decides && tally.mine !== undefined ? (
          <button
            type="button"
            data-testid="suggestion-withdraw-vote"
            onClick={() => void settle("withdraw")}
            style={{ minHeight: 24, padding: "1px 10px", fontSize: "0.75rem", border: "1px solid transparent", background: "transparent", boxShadow: "none", color: "var(--graview-ink-muted)" }}
          >
            Withdraw vote
          </button>
        ) : null}
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
      {voted ? (
        <span data-testid="suggestion-voted" role="status" style={{ ...WRAPS, fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
          {voted}
        </span>
      ) : null}
      {refused ? (
        <span data-testid="suggestion-refused" role="alert" style={{ ...WRAPS, fontSize: "0.75rem", color: "var(--graview-warn)" }}>
          {refused}
        </span>
      ) : null}
    </li>
  );
}
