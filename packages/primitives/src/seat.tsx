import { createSeatTalk, useSeatTalkState, type SeatOutcome, type SeatTalk, type SeatTurn } from "@graview/react/provider";
import { ANSWERED_WITH_AI } from "@graview/tools/frame";
import type { ChatContext, ChatReply, ProposedCall } from "@graview/tools";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

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
 * each proposal, what the model is told happened, the thread and the
 * field. What differs is only
 * what a proposal is FOR — a change to the graph, applied; a change to the
 * declaration, checked and kept — so a surface supplies how one proposal is
 * drawn and nothing else.
 */

/*
 * A TURN AND AN OUTCOME are the provider's types: the app's conversation is
 * held there so a face switch keeps it (see `@graview/react`'s seat talk).
 */
export type { SeatOutcome, SeatTurn };

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
  talk,
}: {
  readonly answer: SeatAnswer;
  /** Said from the body too, or refused at a gate: whatever the surface does with a reply besides showing it. */
  readonly onReply?: (reply: ChatReply) => void;
  /**
   * Where the conversation is kept: the app's (`useGraview().seatTalk`), so
   * it outlives this surface and a face switch, or this surface's own when
   * not given — the studio's declaration seat keeps its own.
   */
  readonly talk?: SeatTalk;
}) {
  const [own] = useState(() => createSeatTalk(null));
  const kept = talk ?? own;
  const { turns, outcomes, busy } = useSeatTalkState(kept);

  const settle = useCallback((key: string, outcome: SeatOutcome) => kept.settle(key, outcome), [kept]);

  const send = async (text: string): Promise<void> => {
    const asked = text.trim();
    if (!asked || kept.get().busy) return;
    kept.setBusy(true);
    const before = kept.get();
    kept.setTurns((current) => [...current, { role: "person", text: asked }]);
    const history = before.turns.map((turn, index) => {
      const landed = (turn.proposals ?? []).flatMap((_, at) => {
        const outcome = before.outcomes.get(proposalKey(index, at));
        return outcome?.state === "applied" ? [outcome.said] : [];
      });
      return { role: turn.role, text: landed.length > 0 ? `${turn.text} [applied: ${landed.join("; ")}]` : turn.text };
    });
    let reply: ChatReply;
    try {
      reply = await answer(asked, { history });
    } catch (error) {
      reply = { say: `That couldn't be answered: ${error instanceof Error ? error.message : String(error)}`, proposals: [] };
    }
    kept.setTurns((current) => [
      ...current,
      {
        role: "seat",
        text: reply.say,
        proposals: reply.proposals,
        ...(reply.questions ? { questions: reply.questions } : {}),
        ...(reply.picks?.length ? { picks: reply.picks } : {}),
        ...(reply.moves?.length ? { moves: reply.moves } : {}),
        ...(reply.offer ? { offer: reply.offer } : {}),
        ...(reply.unsure ? { unsure: true } : {}),
        ...(reply.via ? { via: reply.via } : {}),
      },
    ]);
    onReply?.(reply);
    kept.setBusy(false);
  };

  return { turns, outcomes, busy, send, settle };
}

export function SeatHeader({
  label,
  testId,
}: {
  /** What the seat talks about: "Declaration" in the studio. */
  readonly label: string;
  readonly testId: string;
}) {
  return (
    <div data-testid={`${testId}-header`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 12px", borderBottom: "1px solid var(--graview-edge)" }}>
      <span style={{ fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--graview-ink-faint)" }}>{label}</span>
    </div>
  );
}

/**
 * The seat's trailing aside — "(AI didn't answer just now, …)" — is about
 * the answer, not the answer: kept, and set quieter than what was said.
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
  renderSaid,
  ready = () => true,
  onApplyAll,
  applyAllLabel = "Apply all",
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
  /** The seat's own words, drawn: in the app, the names its moves went to are links. */
  readonly renderSaid?: (turn: SeatTurn, said: string) => ReactNode;
  /** Whether a proposal could be taken at all here; one that could not is not counted for "all". */
  readonly ready?: (proposal: ProposedCall, key: string) => boolean;
  /** One request, one press: take this turn's open proposals in order. */
  readonly onApplyAll?: (turn: number, proposals: readonly ProposedCall[]) => void;
  readonly applyAllLabel?: string;
}) {
  const log = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    // A log that cannot be scrolled — jsdom, a print stylesheet — is not a reason to throw.
    log.current?.scrollTo?.({ top: log.current.scrollHeight });
  }, [turns]);

  // Nothing said, nothing to say before it, nothing coming: no empty list standing in the panel.
  if (turns.length === 0 && empty === null && !busy) return null;
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
        empty === null ? null : <li style={{ fontSize: "0.8125rem", color: "var(--graview-ink-muted)", lineHeight: 1.5 }}>{empty}</li>
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
              * differed by a shade of gray read as one voice talking to
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
                {renderSaid ? renderSaid(turn, aside.said) : aside.said}
                {aside.aside ? (
                  <span style={{ display: "block", marginTop: 2, fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
                    {aside.aside}
                  </span>
                ) : null}
                {/* A MODEL ANSWERED: said once, quietly. The graph answering is said by saying nothing. */}
                {turn.via ? (
                  <span data-testid={`${testId}-answered-with-ai`} style={{ display: "block", marginTop: 2, fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
                    {ANSWERED_WITH_AI}
                  </span>
                ) : null}
              </p>
            )}
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
