import type { ChatContext, ChatReply, LocalStatus, OfferedQuestion, ProposedCall } from "@graview/tools";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LadderSetting } from "./ladder.js";

/**
 * ONE CONVERSATION WITH A SEAT, WHEREVER IT IS HELD.
 *
 * The app's chat and the studio's declaration seat were two conversations
 * written twice, and they drifted the way copies do: one put the person in
 * a bubble and the seat in prose, the other boxed both; one settled a
 * proposal in place, the other wrote "Kept — … undo takes it back" under
 * it; one told the model what had been applied, the other did not. A
 * person moving from the app into its studio met a second assistant.
 *
 * What is shared is everything a conversation IS: the turns, what became of
 * each proposal, what the model is told happened, the header that says
 * which rung is answering, the thread and the field. What differs is only
 * what a proposal is FOR — a change to the graph, applied; a change to the
 * declaration, checked and kept — so a surface supplies how one proposal is
 * drawn and nothing else.
 */

export interface SeatTurn {
  readonly role: "person" | "seat";
  readonly text: string;
  readonly proposals?: readonly ProposedCall[];
  /** Questions the seat is asking back, each at the node it is about. */
  readonly questions?: readonly OfferedQuestion[];
  /** The rung could not read the sentence: a model would, one press away. */
  readonly unsure?: boolean;
}

/**
 * WHAT BECAME OF A PROPOSAL, said where it was offered. Each settling used
 * to post a message of its own, so one request read as five; the press
 * becomes its own outcome instead, in place.
 */
export type SeatOutcome =
  | { readonly state: "applied"; readonly said: string }
  | { readonly state: "declined"; readonly said: string }
  | { readonly state: "refused"; readonly error: string };

/** The key of a proposal in the thread: which turn, which of its proposals. */
export const proposalKey = (turn: number, at: number): string => `${turn}:${at}`;

export type SeatAnswer = (text: string, context: Pick<ChatContext, "history">) => Promise<ChatReply>;

/**
 * The conversation's state and its one loop: ask, answer, record.
 *
 * WHAT WAS DONE is part of what was said. "Erin tends that plot" means the
 * plot the last turn made, and the model only knows which if the history
 * carries what landed, by name — so every surface sends it, not just one.
 */
export function useSeatConversation({
  answer,
  onReply,
}: {
  readonly answer: SeatAnswer;
  /** Said from the body too, or refused at a gate: whatever the surface does with a reply besides showing it. */
  readonly onReply?: (reply: ChatReply) => void;
}) {
  const [turns, setTurns] = useState<readonly SeatTurn[]>([]);
  const [outcomes, setOutcomes] = useState<ReadonlyMap<string, SeatOutcome>>(new Map());
  const [busy, setBusy] = useState(false);

  const settle = useCallback(
    (key: string, outcome: SeatOutcome) => setOutcomes((current) => new Map(current).set(key, outcome)),
    [],
  );

  const send = async (text: string): Promise<void> => {
    const asked = text.trim();
    if (!asked || busy) return;
    setBusy(true);
    setTurns((current) => [...current, { role: "person", text: asked }]);
    const history = turns.map((turn, index) => {
      const landed = (turn.proposals ?? []).flatMap((_, at) => {
        const outcome = outcomes.get(proposalKey(index, at));
        return outcome?.state === "applied" ? [outcome.said] : [];
      });
      return { role: turn.role, text: landed.length > 0 ? `${turn.text} [applied: ${landed.join("; ")}]` : turn.text };
    });
    let reply: ChatReply;
    try {
      reply = await answer(asked, { history });
    } catch (error) {
      reply = { say: `The seat could not answer: ${error instanceof Error ? error.message : String(error)}`, proposals: [] };
    }
    setTurns((current) => [
      ...current,
      {
        role: "seat",
        text: reply.say,
        proposals: reply.proposals,
        ...(reply.questions ? { questions: reply.questions } : {}),
        ...(reply.unsure ? { unsure: true } : {}),
      },
    ]);
    onReply?.(reply);
    setBusy(false);
  };

  return { turns, outcomes, busy, send, settle };
}

/** Where answers are coming from right now, for the header — the same words on every surface. */
export function describeSource(described: string, warmth: LocalStatus | null, floor = "graph"): string {
  if (warmth?.state === "warming") {
    return `warming${warmth.progress !== undefined ? ` ${Math.round(warmth.progress * 100)}%` : "…"}`;
  }
  if (warmth?.state === "failed") return `${floor} answering — ${warmth.detail ?? "the local model failed"}`;
  return described;
}

export function SeatHeader({
  label,
  source,
  sourceTitle,
  testId,
  settings,
  onSettings,
}: {
  /** What the seat talks about: "Seat" in the app, "Declaration" in the studio. */
  readonly label: string;
  readonly source: string;
  readonly sourceTitle?: string;
  readonly testId: string;
  readonly settings?: boolean;
  /** Absent when the ladder is not the reader's to set — a host answers for them. */
  readonly onSettings?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px 6px 12px",
        borderBottom: "1px solid var(--graview-edge)",
      }}
    >
      <span style={{ fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--graview-ink-faint)" }}>
        {label}
      </span>
      <span data-testid={`${testId}-source`} title={sourceTitle} style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
        {source}
      </span>
      <span style={{ flex: "1 1 auto" }} />
      {onSettings ? (
        <button
          type="button"
          data-testid={`${testId}-settings`}
          aria-expanded={settings ?? false}
          onClick={onSettings}
          title="Choose what answers: the graph itself, a model in this browser, a decision provider, or your own key"
          style={{ fontSize: "0.8125rem", padding: "2px 8px", minHeight: 24 }}
        >
          ⚙
        </button>
      ) : null}
    </div>
  );
}

/**
 * The seat's trailing aside — "(from the graph)", "(the local model is
 * warming …)" — is which rung answered, not the answer: kept, and set
 * quieter than what was said.
 */
export const splitAside = (text: string): { said: string; aside?: string } => {
  const match = /^([\s\S]*?)\s*(\((?:[^()]|\([^()]*\))*\))\s*$/.exec(text);
  return match && match[1] ? { said: match[1], aside: match[2]! } : { said: text };
};

export function SeatThread({
  turns,
  outcomes,
  busy,
  testId,
  empty,
  minHeight = 64,
  maxHeight = "min(46cqh, 400px)",
  renderProposal,
  renderAfter,
  ready = () => true,
  onApplyAll,
  applyAllLabel = "Apply all",
  onChooseModel,
}: {
  readonly turns: readonly SeatTurn[];
  readonly outcomes: ReadonlyMap<string, SeatOutcome>;
  readonly busy: boolean;
  readonly testId: string;
  /** What is said before anybody types. */
  readonly empty: ReactNode;
  readonly minHeight?: number;
  readonly maxHeight?: string;
  /** One open proposal, as this surface offers it. */
  readonly renderProposal: (proposal: ProposedCall, at: { readonly key: string; readonly turn: number; readonly at: number }) => ReactNode;
  /** Whatever else a seat turn carries on this surface — questions at nodes, in the app. */
  readonly renderAfter?: (turn: SeatTurn, index: number) => ReactNode;
  /** Whether a proposal could be taken at all here; one that could not is not counted for "all". */
  readonly ready?: (proposal: ProposedCall, key: string) => boolean;
  /** One request, one press: take this turn's open proposals in order. */
  readonly onApplyAll?: (turn: number, proposals: readonly ProposedCall[]) => void;
  readonly applyAllLabel?: string;
  /** Offered under a turn the rung could not read, when a model is one press away. */
  readonly onChooseModel?: () => void;
}) {
  const log = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    // A log that cannot be scrolled — jsdom, a print stylesheet — is not a reason to throw.
    log.current?.scrollTo?.({ top: log.current.scrollHeight });
  }, [turns]);

  return (
    <ol
      ref={log}
      style={{
        margin: 0,
        padding: 10,
        listStyle: "none",
        display: "grid",
        gap: 8,
        alignContent: "start",
        maxHeight,
        minHeight,
        overflowY: "auto",
      }}
    >
      {turns.length === 0 ? (
        <li style={{ fontSize: "0.8125rem", color: "var(--graview-ink-muted)", lineHeight: 1.5 }}>{empty}</li>
      ) : null}
      {turns.map((turn, index) => {
        const proposals = turn.proposals ?? [];
        const open = proposals.filter((proposal, at) => {
          const key = proposalKey(index, at);
          const outcome = outcomes.get(key);
          return outcome?.state !== "applied" && outcome?.state !== "declined" && ready(proposal, key);
        });
        const aside = splitAside(turn.text);
        return (
          <li key={index} style={{ display: "grid", gap: 6, justifyItems: turn.role === "person" ? "end" : "start" }}>
            {/*
              * THE PERSON IN A BUBBLE, THE SEAT IN PROSE. Two boxes that
              * differed by a shade of grey read as one voice talking to
              * itself; the seat's words sit on the panel like any other
              * text there, and what it did sits under them.
              */}
            {turn.role === "person" ? (
              <p
                style={{
                  margin: 0,
                  maxWidth: "85%",
                  padding: "6px 10px",
                  borderRadius: "12px 12px 4px 12px",
                  fontSize: "0.875rem",
                  lineHeight: 1.45,
                  background: "var(--graview-panel-muted)",
                  color: "var(--graview-ink)",
                }}
              >
                {turn.text}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.5, color: "var(--graview-ink)" }}>
                {aside.said}
                {aside.aside ? (
                  <span style={{ display: "block", marginTop: 2, fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
                    {aside.aside}
                  </span>
                ) : null}
              </p>
            )}
            {turn.unsure && onChooseModel ? (
              <button
                type="button"
                data-testid={`${testId}-offer-model`}
                onClick={onChooseModel}
                title="A model reads a sentence however it is phrased, and proposes the acts it describes"
                style={{ fontSize: "0.8125rem", justifySelf: "start" }}
              >
                Let a model read it →
              </button>
            ) : null}
            {renderAfter?.(turn, index)}
            {proposals.map((proposal, at) => {
              const key = proposalKey(index, at);
              const outcome = outcomes.get(key);
              if (outcome?.state === "applied" || outcome?.state === "declined") {
                return <Settled key={key} outcome={outcome} testId={testId} />;
              }
              return (
                <span key={key} style={{ display: "grid", gap: 4, justifySelf: "stretch", justifyItems: "start" }}>
                  {renderProposal(proposal, { key, turn: index, at })}
                  {outcome ? <Settled outcome={outcome} testId={testId} /> : null}
                </span>
              );
            })}
            {onApplyAll && open.length >= 2 ? (
              <button
                type="button"
                data-testid={`${testId}-apply-all`}
                onClick={() => onApplyAll(index, proposals)}
                title="Take these in order; anything still missing is asked for"
                style={{ fontSize: "0.8125rem", justifySelf: "start", fontWeight: 600 }}
              >
                {applyAllLabel} {open.length}
              </button>
            ) : null}
          </li>
        );
      })}
      {busy ? <li style={{ fontSize: "0.8125rem", color: "var(--graview-ink-faint)" }}>thinking…</li> : null}
    </ol>
  );
}

/** A proposal that landed, was set aside, or was refused — in the place it was offered. */
export function Settled({ outcome, testId }: { readonly outcome: SeatOutcome; readonly testId: string }) {
  if (outcome.state === "refused") {
    return (
      <span data-testid={`${testId}-refused`} style={{ fontSize: "0.8125rem", color: "var(--graview-warn)" }}>
        Refused: {outcome.error}
      </span>
    );
  }
  const applied = outcome.state === "applied";
  return (
    <span
      data-testid={`${testId}-${outcome.state}`}
      style={{ fontSize: "0.8125rem", color: applied ? "var(--graview-ink-muted)" : "var(--graview-ink-faint)" }}
    >
      {applied ? <span aria-hidden="true" style={{ color: "var(--graview-accent)" }}>✓ </span> : null}
      {applied ? outcome.said : <s>{outcome.said}</s>}
    </span>
  );
}

export function SeatComposer({
  busy,
  placeholder,
  ariaLabel,
  testId,
  onSend,
}: {
  readonly busy: boolean;
  readonly placeholder: string;
  readonly ariaLabel: string;
  readonly testId: string;
  readonly onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || draft.trim().length === 0) return;
        onSend(draft);
        setDraft("");
      }}
      style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid var(--graview-edge)" }}
    >
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-testid={`${testId}-draft`}
        style={{
          flex: 1,
          // An input's own minimum is about 180px; in a narrow pane it must give way.
          minWidth: 0,
          font: "inherit",
          fontSize: "0.875rem",
          padding: "6px 9px",
          borderRadius: 8,
          border: "1px solid var(--graview-edge)",
          background: "var(--graview-panel)",
          color: "var(--graview-ink)",
        }}
      />
      <button type="submit" data-testid={`${testId}-send`} disabled={busy || draft.trim().length === 0} style={{ fontSize: "0.875rem" }}>
        Send
      </button>
    </form>
  );
}

/**
 * WHAT ANSWERS, chosen where the seat is. The same one setting the profile
 * holds — pills, and a key field only when a rung needs one — so a person
 * pressing "Let a model read it" is shown the choice they would find in
 * the profile, not a second form that could disagree with it.
 */
export function SeatSettings({ testId, onDone }: { readonly testId: string; readonly onDone: () => void }) {
  return (
    <div data-testid={`${testId}-ladder`} style={{ display: "grid", gap: 10, padding: 12 }}>
      <LadderSetting />
      <button type="button" onClick={onDone} style={{ justifySelf: "start", fontSize: "0.875rem" }}>
        Back to the conversation
      </button>
    </div>
  );
}
