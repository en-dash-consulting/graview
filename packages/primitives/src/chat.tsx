import type { AnySchema } from "@graview/core";
import { useAttention, useGraview, useSelection } from "@graview/react";
import {
  createToolRuntime,
  describeProposal,
  graphResponder,
  type ChatReply,
  type ProposedCall,
  type Responder,
  type ToolCall,
} from "@graview/tools";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A SEAT YOU CAN TALK TO.
 *
 * The agent seat runs a turn when pressed; the providers whisper into the
 * inspector; nothing let a person ASK. This panel does — and it earns no
 * new trust to do it: every answer comes from a Responder (the graph's own
 * deterministic one by default, a model through the one-function seam when
 * the host supplies it), and every proposal is an ordinary validated call,
 * applied through the same runtime a seat uses, attributed to `chat` in
 * the log, previewer-visible, undoable. Words in, the usual paths out.
 */

interface Turn {
  readonly role: "person" | "seat";
  readonly text: string;
  readonly proposals?: readonly ProposedCall[];
}

export interface ChatPanelProps<S extends AnySchema> {
  /** How the seat answers. Defaults to the graph's own responder. */
  readonly respond?: Responder<S>;
  /** Feeds the app's activity rail, like any other seat. */
  readonly onCall?: (call: ToolCall) => void;
  readonly testId?: string;
}

export function ChatPanel<S extends AnySchema>({
  respond,
  onCall,
  testId = "chat",
}: ChatPanelProps<S>) {
  const { store, principal } = useGraview<S>();
  const { selection } = useSelection();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const anchor = useRef<HTMLDivElement | null>(null);
  const log = useRef<HTMLOListElement | null>(null);

  const runtime = useMemo(
    () =>
      createToolRuntime(store, {
        author: {
          kind: "agent",
          id: "chat",
          session: "ui",
          ...(principal.roles ? { roles: principal.roles } : {}),
        },
      }),
    [store, principal],
  );
  const answer = useMemo<Responder<S>>(() => respond ?? graphResponder<S>(), [respond]);

  useEffect(() => (onCall ? runtime.onCall(onCall) : undefined), [runtime, onCall]);
  // What the conversation looked at reaches the picture, like any seat's reads.
  useAttention(runtime);

  // Escape and click-away close it — it floats over the scene.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [turns]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    setTurns((current) => [...current, { role: "person", text }]);
    let reply: ChatReply;
    try {
      reply = await answer(store, text, {
        selection,
        history: turns.map((turn) => ({ role: turn.role, text: turn.text })),
      });
    } catch (error) {
      reply = {
        say: `The seat could not answer: ${error instanceof Error ? error.message : String(error)}`,
        proposals: [],
      };
    }
    setTurns((current) => [
      ...current,
      { role: "seat", text: reply.say, proposals: reply.proposals },
    ]);
    setBusy(false);
  };

  const apply = async (proposal: ProposedCall) => {
    try {
      await runtime.call(proposal.mutation, { ...proposal.args });
      setTurns((current) => [
        ...current,
        { role: "seat", text: `Done — ${describeProposal(store, proposal)}. Undo works.` },
      ]);
    } catch (error) {
      // A refusal is a result, in the thread where the ask was made.
      setTurns((current) => [
        ...current,
        {
          role: "seat",
          text: `Refused: ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    }
  };

  return (
    <div ref={anchor} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid={testId}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        title="Talk to the seat: ask about anything here, or say a change in words"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}
      >
        <span aria-hidden="true">◆</span>
        Ask
      </button>

      {open ? (
        <div
          data-testid={`${testId}-panel`}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 30,
            width: 320,
            display: "grid",
            gridTemplateRows: "1fr auto",
            borderRadius: 10,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
            overflow: "hidden",
          }}
        >
          <ol
            ref={log}
            style={{
              margin: 0,
              padding: 10,
              listStyle: "none",
              display: "grid",
              gap: 8,
              alignContent: "start",
              maxHeight: "min(46vh, 400px)",
              minHeight: 120,
              overflowY: "auto",
            }}
          >
            {turns.length === 0 ? (
              <li style={{ fontSize: 12, color: "var(--graview-ink-muted)", lineHeight: 1.5 }}>
                Ask what's wrong, ask about anything by name, or say a change in its own words.
                {selection.length > 0 ? " “This” means what you have selected." : ""}
              </li>
            ) : null}
            {turns.map((turn, index) => (
              <li key={index} style={{ display: "grid", gap: 6, justifyItems: turn.role === "person" ? "end" : "start" }}>
                <p
                  style={{
                    margin: 0,
                    maxWidth: 260,
                    padding: "6px 10px",
                    borderRadius: 10,
                    fontSize: 12.5,
                    lineHeight: 1.45,
                    background: turn.role === "person" ? "var(--graview-panel-muted)" : "var(--graview-panel)",
                    border: "1px solid var(--graview-edge)",
                    color: "var(--graview-ink)",
                  }}
                >
                  {turn.text}
                </p>
                {(turn.proposals ?? []).map((proposal, at) => (
                  <button
                    key={at}
                    type="button"
                    data-testid="chat-apply"
                    onClick={() => void apply(proposal)}
                    title={proposal.why ?? "Apply this change"}
                    style={{ fontSize: 12, justifySelf: "start" }}
                  >
                    {describeProposal(store, proposal)}
                  </button>
                ))}
              </li>
            ))}
            {busy ? (
              <li style={{ fontSize: 12, color: "var(--graview-ink-faint)" }}>thinking…</li>
            ) : null}
          </ol>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid var(--graview-edge)" }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask, or say a change…"
              aria-label="Message the seat"
              style={{
                flex: 1,
                font: "inherit",
                fontSize: 12.5,
                padding: "6px 9px",
                borderRadius: 8,
                border: "1px solid var(--graview-edge)",
                background: "var(--graview-panel)",
                color: "var(--graview-ink)",
              }}
            />
            <button type="submit" disabled={busy || draft.trim().length === 0} style={{ fontSize: 12.5 }}>
              Send
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
