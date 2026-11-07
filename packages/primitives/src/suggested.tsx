import { actingAs, nameOfAuthor, VOTE_SUGGESTION, type AnySchema, type DismissalStore, type Suggestion } from "@graview/core";
import { acceptSuggestion, declineSuggestion, isProposal, mayDecide, stoppedSuggestions, stopSuggesting, suggestions, voteSuggestion, withdrawSuggestion } from "@graview/core/tidying";
import { suggestionGroups, suggestionSentence, whyWords, type SentencePart } from "./suggestion-sentence.js";
import { useGoTo, useGraph, useGraview } from "@graview/react/provider";
import { useEffect, useId, useMemo, useReducer, useState, type ReactNode } from "react";
import { dismissalsOf, tomorrow } from "./dismissals.js";
import { VISUALLY_HIDDEN } from "./primitives/index.js";
import { nameOf } from "./workbench/answer-args.js";
import { NamedRecord } from "./workbench/named-record.js";
import { SuggestionItems } from "./suggested-items.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * WHAT THE APP'S OWN ACTOR LEFT WHILE A PERSON WAS AWAY, in a line: "3
 * suggestions waiting · tidied 12 things while you were away", or undefined
 * when there is nothing to say — and, when the host counted them
 * (`AwaySummary.agreed`), how many agree with one: "3 readers agree with one
 * that waits".
 */
export function awayWords(waiting: number, tidied: number, agreed = 0): string | undefined {
  const parts = [
    waiting > 0 ? `${waiting === 1 ? "one suggestion" : `${waiting} suggestions`} waiting` : "",
    waiting > 0 && agreed > 0 ? `${agreed === 1 ? "a reader agrees" : `${agreed} readers agree`} with one that waits` : "",
    tidied > 0 ? `tidied ${tidied === 1 ? "one thing" : `${tidied} things`} while you were away` : ""].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ").replace(/^./, (first) => first.toUpperCase()) : undefined;
}

/** What still waits for this person: the suggestions their "Not now" has not put out of sight. */
function useWaiting() {
  const { store, principal, dismissals: host, app } = useGraview<AnySchema>();
  const nodes = useGraph();
  const notNow = useMemo(() => dismissalsOf(host, app?.name ?? "app", principal), [host, app?.name, principal]);
  const [said, changed] = useReducer((count: number) => count + 1, 0);
  useEffect(() => notNow.onChange?.(changed), [notNow]);
  // A vote changes no record, so the graph says nothing of it: the tally is read again when one lands (Roadmap f-suggestion-votes).
  useEffect(() => store.subscribe((_, ops) => ops.some((op) => op.vote !== undefined) && changed()), [store]);
  const waiting = useMemo(() => suggestions(store, principal, { dismissed: notNow.list() }), [store, principal, nodes, notNow, said]);
  return { waiting, notNow };
}

/**
 * HOW MANY WAIT FOR THIS PERSON, told to the inbox's bell (Roadmap
 * f-app-bar-calm): fetched with the tray, once the log holds a
 * suggestion, so a page with none carries none of it. Draws nothing.
 */
export function SuggestedCount({ onCount }: { readonly onCount: (count: number) => void }) {
  const { waiting } = useWaiting();
  useEffect(() => onCount(waiting.length), [onCount, waiting.length]);
  return null;
}

/**
 * WHAT TIDYING SUGGESTS, IN THE INBOX'S "FOR YOU" (Roadmap f-app-bar-calm):
 * what the app's own actor proposed and did not make (`suggest`,
 * `@graview/core/tidying`), waiting for a person. Each says what it would
 * do, who suggested it, what it was based on and how sure, and the records
 * it names; Accept makes it as the person, carrying its lineage, Decline
 * keeps the decline in the log, so it is never suggested again, and Not now
 * puts it out of this person's sight until tomorrow — kept where the host
 * keeps their own state (`dismissals`), so nobody else is told and the
 * actor is held to nothing. What was done while the person was away is
 * under Updates (`SuggestedUpdates`).
 *
 * A reader who may see a suggestion and may not make its change is not
 * refused (Roadmap f-suggestion-votes): their Accept and Decline are a
 * vote, the row says "Your vote was recorded" and stays, pressed again
 * the other way it changes, and Withdraw vote takes it back; whoever may
 * decide sees the tally beside Accept, "4 for, 1 against". A shared or
 * signed-out seat whose vote the store would refuse (Roadmap
 * f-votes-shared-seat) is offered the host's "Sign in to vote" in their
 * place, or no vote at all where the host gave no way in.
 *
 * "Don't suggest this kind of thing" stands beside No, for whoever may
 * decide a suggestion of the app's own (Roadmap f-inbox-needs-you-first): it
 * answers every change of that act, in the log, with its way back in
 * Activity and under Updates (`SuggestedUpdates`, `stopSuggesting`).
 *
 * What a person proposed (Roadmap f-proposals-for-review) is listed apart,
 * first, under "Proposed": each "Proposed by Ada", answered by whoever
 * may make it as the app's own suggestions are — and its proposer, who may
 * not, is offered Withdraw in their place.
 */
export function SuggestedList({ close, done }: {
  /** Puts the inbox away, as the reader goes to a record a suggestion names. */
  readonly close: () => void;
  /** The last one settled: the inbox takes the keyboard to what was just made. */
  readonly done: () => void;
}) {
  const { store } = useGraview<AnySchema>();
  const { waiting, notNow } = useWaiting();
  const [heard, hear] = useState("");
  const goTo = useGoTo();
  /* A record a suggestion names goes somewhere while it is still here: the inbox closes behind the reader as they go (FR-225). */
  const goes = (id: string) =>
    store.graph.has(id)
      ? (to: string) => {
          close();
          goTo.record(to);
        }
      : null;
  /*
   * A ROW SETTLED, THE KEYBOARD STAYS IN THE LIST: on the next row's first
   * button — one press may settle several, stopping a kind — else on what
   * else needs this person. Nothing left, the inbox says what was made, in
   * Activity — never <body>.
   */
  const settled = (word: string) => {
    hear(word);
    requestAnimationFrame(() => {
      const next = document.querySelector<HTMLElement>('[data-testid="suggested"] [data-testid="suggestion-accept"], [data-testid="inbox-needs-you"] [data-testid="suggestion-accept"], [data-testid="inbox-needs-you"] [data-testid="inbox-problem-words"]:is(button), [data-testid="inbox-needs-you"] [data-testid="inbox-notification"]:is(a, button)');
      if (next) next.focus();
      else done();
    });
  };
  const status = (
    <span role="status" data-testid="suggestion-heard" style={VISUALLY_HIDDEN}>
      {heard}
    </span>
  );
  if (waiting.length === 0) return status;
  return (
    <div data-testid="suggested" style={{ display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
      {/* A person's proposals apart from the app's own suggestions, and first: somebody is waiting on an answer. */}
      {[waiting.filter(isProposal), waiting.filter((one) => !isProposal(one))].map((some, at) =>
        some.length === 0 ? null : (
          <div key={at} style={{ display: "grid", gap: 6, minWidth: 0 }}>
            {waiting.some(isProposal) ? (
              <h4 style={{ margin: 0, fontSize: "0.75rem", fontWeight: 600, color: "var(--graview-ink-muted)" }}>{at === 0 ? "Proposed" : "Suggested by the app"}</h4>
            ) : null}
            <ol data-testid={at === 0 ? "proposals" : "suggestions"} style={LIST}>
              {/*
               * Several about one record under its name, said once as a link (Roadmap f-suggestions-grouped-by-record), each row
               * saying only what differs; of the rest, several alike under one line, "3 notes to put in chapters", each a row of its own.
               */}
              {suggestionGroups(store, some).map((group) =>
                group.record ? (
                  <RecordGroup key={group.suggestions[0]!.id} record={group.record} level={waiting.some(isProposal) ? 5 : 4} go={goes(group.record.record)}>
                    {(under) => group.suggestions.map((one) => <SuggestionRow key={one.id} suggestion={one} notNow={notNow} settled={settled} heard={hear} goes={goes} under={under} />)}
                  </RecordGroup>
                ) : group.words ? (
                  <li key={group.suggestions[0]!.id} data-testid="suggestion-group" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6, minWidth: 0 }}>
                    <span style={{ ...WRAPS, fontSize: "0.75rem", fontWeight: 600, color: "var(--graview-ink-muted)" }}>{group.words}</span>
                    <ol style={LIST}>
                      {group.suggestions.map((one) => (
                        <SuggestionRow key={one.id} suggestion={one} notNow={notNow} settled={settled} heard={hear} goes={goes} />
                      ))}
                    </ol>
                  </li>
                ) : (
                  group.suggestions.map((one) => <SuggestionRow key={one.id} suggestion={one} notNow={notNow} settled={settled} heard={hear} goes={goes} />)
                ),
              )}
            </ol>
          </div>
        ),
      )}
      {/* What the last press did, said to a screen reader: the row it was on is gone. */}
      {status}
    </div>
  );
}

/**
 * UNDER UPDATES (Roadmap f-inbox-needs-you-first): what the app's own actor
 * did while the person was away, in a line, when the host said (`whileAway`);
 * and each kind of thing people said not to suggest, with the way to let it
 * suggest them again long after Activity has moved on. It says "No updates."
 * itself where it is `alone`, since only the tray knows it has nothing to say.
 */
export function SuggestedUpdates({ alone }: {
  /** Whether nothing else stands under Updates, so this says when it has nothing either. */
  readonly alone: boolean;
}) {
  const { store, whileAway, principal } = useGraview<AnySchema>();
  const { waiting } = useWaiting();
  useGraph();
  const [refused, setRefused] = useState<string | null>(null);
  const tidied = whileAway?.tidied ?? 0;
  const away = whileAway ? awayWords(waiting.length, tidied, whileAway.agreed) : undefined;
  const stopped = stoppedSuggestions(store);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, minWidth: 0 }}>
      {away ? (
        <p data-testid="while-away" style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.45, color: "var(--graview-ink-muted)" }}>
          {away}.
        </p>
      ) : null}
      {stopped.length > 0 ? (
        <ul data-testid="suggestions-stopped" aria-label="What is not suggested any more" style={{ ...LIST, gap: 6 }}>
          {stopped.map((one) => (
            <li key={one.batch} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 4, minWidth: 0, color: "var(--graview-ink-muted)" }}>
              <span style={{ ...WRAPS, flex: "1 1 14em" }}>{one.words}</span>
              <button
                type="button"
                data-testid="suggestion-suggest-again"
                onClick={() => {
                  setRefused(null);
                  try {
                    store.undo(one.batch, { author: principal });
                  } catch (error) {
                    setRefused(error instanceof Error ? error.message : String(error));
                  }
                  // The row it was on is gone: the keyboard goes back to the tab, never <body>.
                  requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="inbox"] [aria-selected="true"]')?.focus());
                }}
                style={BUTTON}
              >
                Suggest again
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {refused ? (
        <span role="alert" style={{ ...WRAPS, fontSize: "0.75rem", color: "var(--graview-warn)" }}>
          {refused}
        </span>
      ) : null}
      {alone && !away && stopped.length === 0 ? (
        <p data-testid="inbox-updates-empty" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
          No updates.
        </p>
      ) : null}
    </div>
  );
}

/**
 * SEVERAL SUGGESTIONS ABOUT ONE RECORD (Roadmap
 * f-suggestions-grouped-by-record): the record named once, a link heading
 * the list of them, and each row under it said without it. Spacing, not a
 * box: the rows sit a step in from the name they hang from.
 */
function RecordGroup({ record, level, go, children }: { readonly record: { readonly record: string; readonly label: string }; readonly level: 4 | 5; readonly go: ((id: string) => void) | null; readonly children: (under: string) => ReactNode }) {
  const heading = useId();
  return (
    <li data-testid="suggestion-record-group" data-record={record.record} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 4, minWidth: 0 }}>
      <span id={heading} role="heading" aria-level={level} data-testid="suggestion-record-heading" style={{ ...WRAPS, display: "block", fontSize: "0.8125rem", lineHeight: 1.45 }}>
        <SentenceRecord part={record} go={go} />
      </span>
      <ol aria-labelledby={heading} style={{ ...LIST, gap: 6, paddingInlineStart: 12 }}>
        {children(heading)}
      </ol>
    </li>
  );
}

/** A line of the tray's that breaks anywhere rather than widen it: a record's name may be one unbroken word longer than the panel. */
const WRAPS = { minWidth: 0, overflowWrap: "anywhere" } as const;

/** A list of the tray's rows, one under another. */
const LIST = { margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, fontSize: "0.8125rem", minWidth: 0 } as const;

/** A button of a row's: small, beside its sentence. */
const BUTTON = { minHeight: 24, padding: "1px 10px", fontSize: "0.75rem" } as const;
/** One quieter than Yes and No: Later, Why?, Withdraw vote. */
const QUIET = { ...BUTTON, border: "1px solid transparent", background: "transparent", boxShadow: "none", color: "var(--graview-ink-muted)" } as const;

/**
 * A RECORD NAMED IN A SUGGESTION'S SENTENCE, as a link that goes to it
 * (FR-225): a long name cut with an ellipsis where it stands, its whole
 * name its text and its title, so a hover and a screen reader have all of
 * it. One since removed is its name, plain.
 */
function SentenceRecord({ part, go }: { readonly part: Exclude<SentencePart, string>; readonly go: ((id: string) => void) | null }) {
  // A full fingertip tall, as every control beside it is.
  const clipped = { display: "inline-block", maxWidth: "min(24ch, 100%)", minHeight: 24, lineHeight: "24px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" } as const;
  const name = go ? (
    <button
      type="button"
      data-testid="suggestion-record"
      data-record={part.record}
      title={`Go to ${part.label}`}
      onClick={() => go(part.record)}
      className="graview-activity-record"
      style={{ all: "unset", ...clipped, cursor: "pointer", fontWeight: 600, color: "var(--graview-ink)", textDecoration: "underline", textDecorationColor: "color-mix(in srgb, var(--graview-ink) 35%, transparent)", textUnderlineOffset: 2 }}
    >
      {part.label}
    </button>
  ) : (
    <span title={part.label} style={{ ...clipped, fontWeight: 600 }}>
      {part.label}
    </span>
  );
  return part.quoted ? <>“{name}”</> : name;
}

/** What each answer to a suggestion is said as, once the row it was on is gone. */
const HEARD = { accept: "Accepted.", decline: "Declined: it will not be suggested again.", stop: "This kind of thing will not be suggested again. You can undo that in Activity.", later: "Hidden from you until tomorrow.", withdraw: "Withdrawn." } as const;

/** What a vote is said as, to the person who cast it: the row stays, since the suggestion still waits. */
const VOTED = { recorded: "Your vote was recorded.", withdrawn: "Your vote was withdrawn." } as const;

/** A suggestion of several said after who suggests it: a headline that starts with their name ("Fill out next week's events: …") says it once. */
const headlineAfter = (by: string, headline: string): string => (headline.startsWith(`${by}: `) ? headline.slice(by.length + 2) : headline);

/**
 * The votes on a suggestion, said beside Accept to whoever may decide: "4
 * for, 1 against" — and the advisory votes of visitors on a shared or
 * signed-out seat apart, never among them (Roadmap f-votes-shared-seat):
 * "2 for, 0 against · 3 visitors agree".
 */
export const tallyWords = (tally: Suggestion["tally"]): string => {
  const people = `${tally.for} for, ${tally.against} against`;
  const visitors = advisoryWords(tally.advisory);
  return visitors ? `${people} · ${visitors}` : people;
};

/** What visitors said, apart: "3 visitors agree, one disagrees", or "" when none voted. */
export function advisoryWords(advisory: Suggestion["tally"]["advisory"]): string {
  if (!advisory) return "";
  const agree = advisory.for === 0 ? "" : advisory.for === 1 ? "a visitor agrees" : `${advisory.for} visitors agree`;
  const disagree = advisory.against === 0 ? "" : advisory.against === 1 ? `${agree ? "one" : "a visitor"} disagrees` : `${advisory.against}${agree ? "" : " visitors"} disagree`;
  return [agree, disagree].filter(Boolean).join(", ");
}

/**
 * One suggestion: what it would do and why, its records, and Accept,
 * Decline and Not now, each a sentence when refused. From a seat that may
 * not make the change, Accept and Decline are a vote for and against
 * (Roadmap f-suggestion-votes): the row stays, says so, and offers to
 * withdraw it; whoever may decide reads the tally beside Accept.
 */
function SuggestionRow({ suggestion, notNow, settled, heard, goes, under }: {
  readonly suggestion: Suggestion;
  readonly notNow: DismissalStore;
  readonly settled: (heard: string) => void;
  readonly heard: (word: string) => void;
  readonly goes: (id: string) => ((id: string) => void) | null;
  /** The heading of the record it stands under, when several are about one: the row says the rest, and is described with the name. */
  readonly under?: string;
}) {
  const { store, principal, seats, people, signIn } = useGraview<AnySchema>();
  const [refused, setRefused] = useState<string | null>(null);
  const [voted, setVoted] = useState<string | null>(null);
  const hint = useId();
  const voting = useId();
  const by = nameOfAuthor(suggestion.author, { graph: store.graph as never, schema: store.schema, seats, people });
  // Whether this seat decides it, or votes on it: the store's own answer, the one Accept would meet.
  const decides = useMemo(() => mayDecide(store, suggestion, principal), [store, suggestion, principal]);
  /*
   * AND WHETHER IT MAY VOTE AT ALL (Roadmap f-votes-shared-seat): a shared or
   * signed-out seat's vote is refused unless the host keeps it advisory. Such
   * a seat is offered the host's way in, "Sign in to vote", before it
   * presses — or, with none, no vote to press.
   */
  const votes = useMemo(() => decides || store.permits({ name: VOTE_SUGGESTION, args: { suggestion: suggestion.id, vote: "for" } }, principal).ok, [decides, store, suggestion.id, principal]);
  const { tally } = suggestion;
  // A person's proposal (Roadmap f-proposals-for-review), and whether it is this seat's own: its proposer withdraws it rather than votes on it.
  const proposal = isProposal(suggestion);
  const mine = proposal && principal !== undefined && !decides && actingAs(principal).id === suggestion.lineage!.proposedBy;
  const settle = async (how: keyof typeof HEARD | "unvote") => {
    setRefused(null);
    try {
      if (how === "withdraw") withdrawSuggestion(store, suggestion.id, { author: principal });
      else if (how === "stop") stopSuggesting(store, suggestion.id, { author: principal });
      else if (how === "accept" || how === "decline") {
        const answer = how === "accept" ? acceptSuggestion(store, suggestion.id, { author: principal }) : declineSuggestion(store, suggestion.id, { author: principal });
        // A vote, not the change: the suggestion still waits, so the row stays and says so.
        if (answer.voted !== undefined) {
          setVoted(VOTED.recorded);
          heard(VOTED.recorded);
          return;
        }
      } else if (how === "unvote") {
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
  /*
   * ONE SENTENCE, READ AT A GLANCE (Roadmap f-suggestion-card-one-line):
   * "Put “What I steer by” in 09 · Without a Map?", its records links in it,
   * then Yes, No and Later. Who suggested it, how sure and which model are
   * not said; why is behind "Why?", in the maker's words alone. A run of
   * several changes says its headline, opened to each below.
   */
  const several = suggestion.items.length > 1;
  const sentence = useMemo(() => suggestionSentence(store, suggestion), [store, suggestion]);
  const words = useId();
  const parts = under ? sentence.alone : sentence.parts;
  const described = under ? `${under} ${words}` : words;
  const named = new Set(sentence.parts.flatMap((part) => (typeof part === "string" ? [] : [part.record])));
  // A proposal's basis is the person's own words, when they gave any: "Proposed by Ada" is said once, in the sentence.
  const reason = suggestion.lineage && !(proposal && suggestion.lineage.basis.startsWith("Proposed by ")) ? whyWords(suggestion.lineage) : undefined;
  const [why, setWhy] = useState(false);
  const because = useId();
  return (
    <li data-testid="suggestion" data-suggestion={suggestion.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 4, lineHeight: 1.45, minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 4, minWidth: 0 }}>
        <span id={words} data-graview-suggestion-words="" style={{ ...WRAPS, flex: "1 1 14em" }}>
          {proposal ? (
            <>
              <span data-testid="proposed-by" style={{ color: "var(--graview-ink-muted)" }}>
                Proposed by <strong style={{ fontWeight: 600, color: "var(--graview-ink)" }}>{mine ? "you" : by}</strong>:
              </span>{" "}
            </>
          ) : several ? (
            <>
              <strong style={{ fontWeight: 600 }}>{by}</strong> <span style={{ color: "var(--graview-ink-muted)" }}>suggests</span>{" "}
            </>
          ) : null}
          {several ? headlineAfter(by, suggestion.headline ?? suggestion.intent) : parts.map((part, at) => (typeof part === "string" ? part : <SentenceRecord key={at} part={part} go={goes(part.record)} />))}
        </span>
        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginInlineStart: "auto", minWidth: 0 }}>
          {reason ? (
            <button type="button" data-testid="suggestion-why" aria-expanded={why} aria-controls={because} onClick={() => setWhy((open) => !open)} style={{ ...QUIET, padding: "1px 6px" }}>
              Why?
            </button>
          ) : null}
          {mine ? (
            <button type="button" data-testid="proposal-withdraw" onClick={() => void settle("withdraw")} style={BUTTON}>
              Withdraw
            </button>
          ) : votes ? (
            <button
              type="button"
              data-testid="suggestion-accept"
              onClick={() => void settle("accept")}
              {...(decides ? { "aria-describedby": described } : { "aria-pressed": tally.mine === "for", "aria-describedby": voting })}
              style={BUTTON}
            >
              {decides && several ? "Accept all" : "Yes"}
            </button>
          ) : signIn ? (
            <button type="button" data-testid="suggestion-sign-in" onClick={() => signIn.run()} style={BUTTON}>
              Sign in to vote
            </button>
          ) : null}
          {votes && !mine ? (
            <button
              type="button"
              data-testid="suggestion-decline"
              onClick={() => void settle("decline")}
              {...(decides ? { "aria-describedby": described } : { "aria-pressed": tally.mine === "against", "aria-describedby": voting })}
              style={BUTTON}
            >
              No
            </button>
          ) : null}
          {decides && !proposal ? (
            <button type="button" data-testid="suggestion-stop-kind" onClick={() => void settle("stop")} style={QUIET}>
              Don't suggest this kind of thing
            </button>
          ) : null}
          {!decides && votes && !mine && tally.mine !== undefined ? (
            <button type="button" data-testid="suggestion-withdraw-vote" onClick={() => void settle("unvote")} style={QUIET}>
              Withdraw vote
            </button>
          ) : null}
          <button type="button" data-testid="suggestion-not-now" onClick={() => void settle("later")} title="Hide it from you until tomorrow. It still waits for everyone else." aria-describedby={hint} style={QUIET}>
            Later
          </button>
        </span>
      </div>
      <span id={hint} style={VISUALLY_HIDDEN}>
        Hides it from you until tomorrow; it still waits for everyone else.
      </span>
      {!decides && votes && !mine ? (
        <span id={voting} style={VISUALLY_HIDDEN}>
          Counts as your vote; somebody who may make it decides.
        </span>
      ) : null}
      {reason ? (
        <span id={because} data-graview-lineage="" hidden={!why} style={{ ...WRAPS, fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
          {reason}
        </span>
      ) : null}
      {several ? <SuggestionItems suggestion={suggestion} decides={decides} heard={heard} /> : null}
      {/* Records its sentence does not name — an act said in its own words — as links below it. */}
      {suggestion.about.some((id) => !named.has(id)) && (several || named.size === 0) ? (
        <div data-graview-suggestion-records="" style={{ display: "flex", flexWrap: "wrap", gap: 4, minWidth: 0 }}>
          {suggestion.about
            .filter((id) => !named.has(id))
            .slice(0, 4)
            .map((id) => (
              <NamedRecord key={id} id={id} label={nameOf(store, id)} go={goes(id)} testId="suggestion-record" />
            ))}
        </div>
      ) : null}
      {/* The votes so far, to whoever may decide: a voter is told their own, not everyone's. */}
      {decides && tally.for + tally.against + (tally.advisory ? tally.advisory.for + tally.advisory.against : 0) > 0 ? (
        <span data-testid="suggestion-tally" style={{ ...WRAPS, fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
          {tallyWords(tally)}
        </span>
      ) : null}
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
