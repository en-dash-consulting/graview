import type { AnySchema } from "@graview/core";
import { useAttention, useGraview, useSelection } from "@graview/react";
import { kindCardId } from "@graview/layout";
import {
  configuredResponder,
  createToolRuntime,
  describeIntelligence,
  describeProposal,
  loadPins,
  stillNeeded,
  type ChatReply,
  type IntelligenceConfig,
  type LocalStatus,
  type OfferedQuestion,
  type ProposedCall,
  type Responder,
  type ToolCall,
} from "@graview/tools";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSubject } from "./companion.js";
import { AnswerArgs } from "./workbench/index.js";

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
  /** Questions the seat is asking back, each at the node it is about. */
  readonly questions?: readonly OfferedQuestion[];
}

export interface ChatPanelProps<S extends AnySchema> {
  /**
   * Drawn INSIDE something that already frames it — the companion rail —
   * rather than as a pill on the bar with a panel hanging off it: no
   * trigger, no float, no border of its own, and always open, because the
   * rail is what opens and closes.
   */
  readonly inside?: boolean;
  /** How the seat answers. Defaults to the graph's own responder. */
  readonly respond?: Responder<S>;
  /**
   * GROUNDED QUESTIONS, OFFERED BEFORE ANYBODY TYPES. A panel showing an
   * empty field asks the person to guess what it can answer; these are
   * questions the graph's own responder can answer about what is in front
   * of them, and pressing one asks it.
   */
  readonly offer?: readonly string[];
  /** Feeds the app's activity rail, like any other seat. */
  readonly onCall?: (call: ToolCall) => void;
  readonly testId?: string;
}

export function ChatPanel<S extends AnySchema>({
  inside = false,
  offer,
  respond,
  onCall,
  testId = "chat",
}: ChatPanelProps<S>) {
  const { store, principal, seatWho, noteSeat, robots, session, intelligence: config, registerHostAnswers } = useGraview<S>();
  const { selection } = useSelection();
  const subject = useSubject<S>();
  /* The chat writes as the tab's seat when one has sat down, so the two are one robot — in this tab's own session. */
  const who = seatWho ?? "chat";
  const author = useMemo(() => ({ kind: "agent" as const, id: who, session }), [who, session]);
  const robot = robots.get(`agent:${who}:${session}`);
  const [shown, setOpen] = useState(false);
  // Inside the rail there is nothing to open: the rail is what opens.
  const open = inside || shown;
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  /*
   * THE LADDER IS A SETTING — the provider's, chosen in the profile pane
   * beside text size and scheme, read here. A host that passes `respond`
   * has decided for them.
   */
  const [warmth, setWarmth] = useState<LocalStatus | null>(null);
  useEffect(() => setWarmth(null), [config]);
  // A host that passes `respond` has decided which rung answers; the profile's ladder steps aside.
  useEffect(() => {
    registerHostAnswers(respond !== undefined);
    return () => registerHostAnswers(false);
  }, [respond, registerHostAnswers]);
  const anchor = useRef<HTMLDivElement | null>(null);
  const log = useRef<HTMLOListElement | null>(null);

  const runtime = useMemo(
    () =>
      createToolRuntime(store, {
        author: {
          ...author,
          ...(principal.roles ? { roles: principal.roles } : {}),
        },
        // The person's pins reach this seat too — read per call, so a pin
        // toggled in the menu reorders the chat's tool list without a
        // rebuild. No surface may disagree with another about the acts.
        derive: () => ({ pins: loadPins() }),
      }),
    [store, principal, author],
  );
  const statusToken = useRef(0);
  /*
   * The setting as it is NOW, for a turn that started before it changed:
   * the answer says which rung made it and which the person has moved to,
   * rather than finishing silently on a rung they left.
   */
  const configNow = useRef(config);
  configNow.current = config;
  const answer = useMemo<Responder<S>>(() => {
    // A replaced responder must not keep narrating: only the current
    // build's status reaches the header.
    const token = ++statusToken.current;
    return (
      respond ??
      configuredResponder<S>(config, {
        onStatus: (status) => {
          if (token === statusToken.current) setWarmth(status);
        },
        current: () => configNow.current,
      })
    );
  }, [respond, config]);

  useEffect(() => (onCall ? runtime.onCall(onCall) : undefined), [runtime, onCall]);
  // What the conversation looked at reaches the picture, like any seat's reads.
  useAttention(runtime);

  /*
   * NO BUBBLE, NO ANCHOR. The panel used to be drawn beside the robot's
   * body while it followed the pointer; the seat has no body now and the
   * companion on the frame is where it speaks.
   */

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
    // A log that cannot be scrolled — jsdom, a print stylesheet — is not a
    // reason to throw out of an effect and take the rail down with it.
    log.current?.scrollTo?.({ top: log.current.scrollHeight });
  }, [turns]);

  const send = async (question?: string) => {
    const text = (question ?? draft).trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    setTurns((current) => [...current, { role: "person", text }]);
    let reply: ChatReply;
    /*
     * "THIS" IS THE COMPANION'S SUBJECT: the selection, else what the
     * pointer has settled on, else where you are. One answer for the whole
     * frame, so the panel and the header above it cannot disagree.
     */
    const referent = subject.id ? [subject.id] : selection;
    try {
      reply = await answer(store, text, {
        selection: referent,
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
      { role: "seat", text: reply.say, proposals: reply.proposals, ...(reply.questions ? { questions: reply.questions } : {}) },
    ]);
    /*
     * SAID FROM THE BODY TOO. The reply — prose, the graph's answer, or a
     * typed answer with the rung's own honesty sentence — is the robot's
     * bubble; a question for the person stands it on the node's doorstep.
     */
    const asked = reply.questions?.[0];
    if (asked) {
      noteSeat({ type: "asking", author, where: asked.nodeId ?? null, say: `${asked.nodeLabel ? `${asked.nodeLabel}: ` : ""}${asked.asks}`, confidence: asked.confidence });
    } else {
      noteSeat({ type: "said", author, say: reply.say });
    }
    /* A proposal the policy withholds is a refusal said at the gate of the kind it acts on. */
    const withheld = reply.proposals.find((proposal) => !store.permits({ name: proposal.mutation, args: { ...proposal.args } }, principal).ok);
    if (withheld) {
      const verdict = store.permits({ name: withheld.mutation, args: { ...withheld.args } }, principal);
      const kinds = store.allMutations().find((m) => m.name === withheld.mutation)?.subject?.kinds;
      const where = Array.isArray(kinds) && kinds[0] ? kindCardId(kinds[0] as string) : null;
      if (!verdict.ok) noteSeat({ type: "refused", author, where, say: verdict.refusal.message });
    }
    setBusy(false);
  };

  /*
   * A PROPOSAL THE ACT'S OWN ARGUMENTS ARE NOT SATISFIED BY IS AN ASK, NOT
   * A REFUSAL.
   *
   * The seat already refuses to OFFER what the policy withholds, for the
   * reason written above the proposal list: the responder proposes from the
   * graph and knows nothing of the policy. It knows just as little about
   * what an act NEEDS. A model told "add a shift called soup kitchen"
   * answers `add-shift` with a label and none of the day, the place or the
   * hours — and pressing it handed the person the validator talking to
   * itself, six clauses of "expected string, received undefined".
   *
   * The act was never impossible, only under-specified, and this framework
   * already knows what to do with an under-specified act: a person pressing
   * "Add a shift" from the menu is asked for each missing argument in turn,
   * with the graph's own candidates offered for anything that names a node.
   * The seat's proposals go the same way now — the same component, the same
   * questions, the model's own answers already filled in.
   */
  const [answering, setAnswering] = useState<{ proposal: ProposedCall; open: ReturnType<typeof stillNeeded> } | null>(null);

  const apply = async (proposal: ProposedCall) => {
    try {
      /*
       * The runtime RESOLVES refusals rather than throwing them — a
       * policy denial, a validation failure — so the flag must be read.
       * Skipping it had the chat saying "Done — … Undo works." over a
       * change the store had refused, which is the one lie a seat must
       * never tell.
       */
      const result = await runtime.call(proposal.mutation, { ...proposal.args });
      if (!result.ok) {
        setTurns((current) => [...current, { role: "seat", text: `Refused: ${result.error}` }]);
        const kinds = store.allMutations().find((m) => m.name === proposal.mutation)?.subject?.kinds;
        noteSeat({ type: "refused", author, where: Array.isArray(kinds) && kinds[0] ? kindCardId(kinds[0] as string) : null, say: result.error });
        return;
      }
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
    <div
      ref={anchor}
      style={
        inside
          ? /*
             * ONE LAYER FEWER IN THE RAIL. The wrapper exists to anchor a
             * panel that hangs off a pill; in the rail there is no pill and
             * nothing hangs, and a second box between the column and the
             * conversation is a second chance for the two to disagree about
             * how tall it is. It passes its own row straight through.
             */
            { display: "grid", gridTemplateRows: "min-content", minHeight: "min-content" }
          : { position: "relative" }
      }
    >
      {inside ? null : (
        <button
          type="button"
          data-testid={testId}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          title="Talk to the seat: ask about anything here, or say a change in words"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78125rem" }}
        >
          <span aria-hidden="true">◆</span>
          Ask
        </button>
      )}

      {open ? (
        <div
          data-testid={`${testId}-panel`}
          {...(inside ? {} : { "data-graview-offstage": "", "data-graview-overlay": "" })}
          data-graview-anchor={inside ? "rail" : "bar"}
          style={{
            ...(inside
              ? {
                  position: "static",
                  width: "auto",
                  /*
                   * SIZED BY WHAT IS IN IT, in the rail.
                   *
                   * A `1fr` middle row and a floor made the panel a fixed
                   * box: shorter than the log, the chips and the field
                   * together, so with `overflow: visible` the field and the
                   * chips were painted straight over the relation key
                   * below, and with `overflow: hidden` they were cut off
                   * instead. The log carries its own floor and ceiling
                   * (120 to 400, scrolling); everything else is as tall as
                   * it needs to be, and the rail's own column scrolls.
                   */
                  gridTemplateRows: "auto auto auto auto",
                  // And never smaller than what is in it, whatever the column decides.
                  minHeight: "min-content",
                }
              : {
                  position: "absolute" as const,
                  top: "calc(100% + 6px)",
                  right: 0,
                  zIndex: 30,
                  width: 320,
                  borderRadius: 10,
                  border: "1px solid var(--graview-edge)",
                  background: "var(--graview-float)",
                  boxShadow: "var(--graview-lift-high)",
                }),
            display: "grid",
            ...(inside ? {} : { gridTemplateRows: "auto 1fr auto" }),
            /*
             * CLIPPED, EVEN IN THE RAIL. The panel is sized by its content
             * and floored at `min-content`, so there should be nothing to
             * clip — but "should" is doing a lot of work across engines and
             * layouts, and the failure this guards against is the ugly one:
             * a squeezed box painting its chips and its field straight over
             * the relations in the section below. Clipped, the worst case
             * is a section that scrolls in a rail that already scrolls.
             */
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px 6px 12px",
              borderBottom: "1px solid var(--graview-edge)",
            }}
          >
            <span style={{ fontSize: "0.6875rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--graview-ink-faint)" }}>
              Seat
            </span>
            <span
              data-testid="chat-source"
              // The WHY rides along: "no WebGPU" is actionable, "failed" is not.
              title={warmth?.state === "failed" ? warmth.detail : undefined}
              style={{ fontSize: "0.6875rem", color: "var(--graview-ink-muted)" }}
            >
              {respond
                ? "app-provided"
                : warmth?.state === "warming"
                  ? `warming${warmth.progress !== undefined ? ` ${Math.round(warmth.progress * 100)}%` : "…"}`
                  : warmth?.state === "failed"
                    ? `graph answering — ${warmth.detail ?? "the local model failed"}`
                    : describeIntelligence(config)}
            </span>
            <span style={{ flex: "1 1 auto" }} />
          </div>
          <ol
            ref={log}
            style={{
              margin: 0,
              padding: 10,
              listStyle: "none",
              display: "grid",
              gap: 8,
              alignContent: "start",
              maxHeight: "min(46cqh, 400px)",
              /*
               * In the rail the log sits between the acts above and the key
               * below, and a hundred and twenty pixels of blank under one
               * sentence reads as something failing to load. It keeps a
               * floor — the panel must not jump as the first turn lands —
               * but a smaller one, and grows with what is said.
               */
              minHeight: inside ? 64 : 120,
              overflowY: "auto",
            }}
          >
            {turns.length === 0 ? (
              <li style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)", lineHeight: 1.5 }}>
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
                    fontSize: "0.78125rem",
                    lineHeight: 1.45,
                    background: turn.role === "person" ? "var(--graview-panel-muted)" : "var(--graview-panel)",
                    border: "1px solid var(--graview-edge)",
                    color: "var(--graview-ink)",
                  }}
                >
                  {turn.text}
                </p>
                {(turn.questions ?? []).map((asked) => (
                  /*
                   * A QUESTION STANDS AT ITS NODE. The seat was not sure
                   * enough to propose — a split, or a shrug — so it asks,
                   * naming the node, with each option as a press that lands
                   * through the same path a proposal does.
                   */
                  <div
                    key={asked.id}
                    data-testid="chat-question"
                    data-chat-question-node={asked.nodeId}
                    style={{ display: "grid", gap: 4, justifySelf: "start", maxWidth: 260 }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
                      {asked.nodeLabel ? <strong>{asked.nodeLabel}: </strong> : null}
                      {asked.asks}
                      {asked.because === "split" ? " (it could be either)" : " (it was not sure)"}
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {asked.options.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          data-testid="chat-option"
                          disabled={!option.call}
                          title={option.call ? option.call.why ?? "Take this answer" : "Nothing to do for this answer"}
                          onClick={() => (option.call ? void apply(option.call) : undefined)}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {option.value} {Math.round(option.probability * 100)}%
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {(turn.proposals ?? []).map((proposal, at) => {
                  /*
                   * WITHHELD, NOT OFFERED — the same rule as the strip. The
                   * responder proposes from the graph and knows nothing of
                   * the policy, so the seat was handed "Add an item" with
                   * an apply button and refused on press. The store's own
                   * verdict, asked as the person at the keyboard, decides
                   * whether a proposal is a press or a struck line with
                   * the policy's reason beside it.
                   */
                  const verdict = store.permits({ name: proposal.mutation, args: { ...proposal.args } }, principal);
                  if (!verdict.ok) {
                    return (
                      <span key={at} data-testid="chat-withheld" style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
                        <s>{describeProposal(store, proposal)}</s> — {verdict.refusal.message}
                      </span>
                    );
                  }
                  /*
                   * The same question asked of the ACT rather than of the
                   * policy: has the responder actually said what this needs?
                   */
                  const owed = stillNeeded(store, proposal);
                  return (
                    <button
                      key={at}
                      type="button"
                      data-testid="chat-apply"
                      data-graview-asks={owed.length > 0 ? owed.length : undefined}
                      onClick={() =>
                        owed.length > 0 ? setAnswering({ proposal, open: owed }) : void apply(proposal)
                      }
                      title={
                        owed.length > 0
                          ? `${proposal.why ?? "Apply this change"} — needs ${owed.map((one) => one.name).join(", ")}`
                          : (proposal.why ?? "Apply this change")
                      }
                      style={{ fontSize: "0.75rem", justifySelf: "start" }}
                    >
                      {describeProposal(store, proposal)}
                      {owed.length > 0 ? " …" : ""}
                    </button>
                  );
                })}
              </li>
            ))}
            {busy ? (
              <li style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>thinking…</li>
            ) : null}
          </ol>
          {/*
            * THE ASK, in the thread where it was proposed.
            *
            * The same component the actions strip raises, given the same
            * shape: what the model already answered stays answered, and the
            * questions are only the ones it left open. Answering applies
            * through the ordinary runtime, so the log, the undo and the
            * attribution are the ones every other act gets.
            */}
          {answering ? (
            <div data-testid="chat-asking" style={{ padding: "0 8px 6px" }}>
              <AnswerArgs
                affordance={{
                  id: `chat:${answering.proposal.mutation}`,
                  mutation: answering.proposal.mutation,
                  label: describeProposal(store, answering.proposal),
                  // What it is, honestly: a responder's suggestion. The union
                  // has a name for that already.
                  provider: "llm",
                  why: answering.proposal.why ?? "The seat suggested this.",
                  nodeIds: [],
                  args: answering.proposal.args,
                  open: answering.open,
                  score: 0,
                }}
                onApply={(args) => {
                  const proposal = { ...answering.proposal, args: { ...answering.proposal.args, ...args } };
                  setAnswering(null);
                  void apply(proposal);
                }}
                onCancel={() => setAnswering(null)}
              />
            </div>
          ) : null}
          {/* What it can answer about what is in front of you, before anybody types. */}
          {(offer ?? []).length > 0 && turns.length === 0 ? (
            <div data-testid="chat-offers" style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "0 8px 6px" }}>
              {(offer ?? []).slice(0, 3).map((question) => (
                <button
                  key={question}
                  type="button"
                  data-testid="chat-offer"
                  disabled={busy}
                  onClick={() => void send(question)}
                  style={{ font: "inherit", fontSize: "0.6875rem", minHeight: 24, padding: "0 8px", borderRadius: 999 }}
                >
                  {question}
                </button>
              ))}
            </div>
          ) : null}
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
                fontSize: "0.78125rem",
                padding: "6px 9px",
                borderRadius: 8,
                border: "1px solid var(--graview-edge)",
                background: "var(--graview-panel)",
                color: "var(--graview-ink)",
              }}
            />
            <button type="submit" disabled={busy || draft.trim().length === 0} style={{ fontSize: "0.78125rem" }}>
              Send
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The rung picker. Three honest choices, stated costs, one Save — and the
 * key field says exactly where the key lives: this browser's storage, sent
 * only to the provider chosen, never to a server of ours, never in a repo.
 *
 * Exported because the studio's own agent panel climbs the same ladder: a
 * second picker beside this one would be a second place a person's key
 * could be asked for, and two surfaces that could disagree about which
 * rung is chosen.
 */
export function IntelligenceSettings({
  config,
  onDone,
}: {
  readonly config: IntelligenceConfig;
  readonly onDone: (next: IntelligenceConfig) => void;
}) {
  const [source, setSource] = useState<IntelligenceConfig["source"]>(config.source);
  const [preset, setPreset] = useState<"xai" | "custom">(config.remote?.preset ?? "xai");
  const [apiKey, setApiKey] = useState(config.remote?.apiKey ?? "");
  const [model, setModel] = useState(config.remote?.model ?? "");
  const [baseUrl, setBaseUrl] = useState(config.remote?.baseUrl ?? "");
  const [decisionKey, setDecisionKey] = useState(config.decision?.apiKey ?? "");

  const label: React.CSSProperties = { fontSize: "0.6875rem", color: "var(--graview-ink-muted)" };
  const field: React.CSSProperties = {
    font: "inherit",
    fontSize: "0.78125rem",
    padding: "6px 9px",
    borderRadius: 8,
    border: "1px solid var(--graview-edge)",
    background: "var(--graview-panel)",
    color: "var(--graview-ink)",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <form
      data-testid="chat-settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        /*
         * A saved key SURVIVES switching rungs — losing it on a visit to
         * "graph" would mean re-pasting secrets — and choosing "remote"
         * with no key at all is not a save that does anything, so the
         * submit button refuses it below.
         */
        const key = apiKey || config.remote?.apiKey || "";
        const remote =
          key.length > 0
            ? {
                remote: {
                  preset,
                  apiKey: key,
                  ...(model ? { model } : {}),
                  ...(preset === "custom" && baseUrl ? { baseUrl } : {}),
                },
              }
            : config.remote
              ? { remote: config.remote }
              : {};
        /*
         * The decision rung needs no key in the browser at all — the dev
         * server's door holds one — so an empty key is a choice, not a
         * refusal: the door is used. A key typed here goes straight to
         * the provider, like the LLM rung's.
         */
        const decisionHeld = decisionKey || config.decision?.apiKey || "";
        const decision =
          decisionHeld.length > 0
            ? { decision: { ...(config.decision ?? {}), apiKey: decisionHeld } }
            : config.decision
              ? { decision: config.decision }
              : {};
        onDone({ source, ...remote, ...decision });
      }}
      style={{ display: "grid", gap: 10, padding: 12, maxHeight: "min(46cqh, 400px)", overflowY: "auto" }}
    >
      {(
        [
          ["graph", "Graph only", "Keyless and instant. The graph answers from its own structure."],
          ["local", "Onboard AI", "A small model runs in this browser. First use downloads ~1–2GB, then it is free and private."],
          ["decision", "Jev (decides, does not talk)", "A decision provider answers typed questions exactly — which surface, which zone, does this help — with a confidence. It writes no prose, so the graph still answers the chat."],
          ["remote", "LLM (your key)", "A frontier model answers. Calls go straight from this browser to the provider."],
        ] as const
      ).map(([value, title, detail]) => (
        <label key={value} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "start", cursor: "pointer" }}>
          <input
            type="radio"
            name="intelligence-source"
            value={value}
            checked={source === value}
            onChange={() => setSource(value)}
          />
          <span style={{ display: "grid", gap: 2 }}>
            <span style={{ fontSize: "0.78125rem" }}>{title}</span>
            <span style={{ ...label, lineHeight: 1.4 }}>{detail}</span>
          </span>
        </label>
      ))}

      {source === "decision" ? (
        <div style={{ display: "grid", gap: 8, paddingLeft: 22 }}>
          <label style={{ display: "grid", gap: 3 }}>
            <span style={label}>TypeSafe key (optional)</span>
            <input
              type="password"
              data-testid="chat-decision-key"
              value={decisionKey}
              onChange={(event) => setDecisionKey(event.target.value)}
              placeholder="leave empty to use the dev server's door"
              autoComplete="off"
              style={field}
            />
          </label>
          <p style={{ ...label, margin: 0, lineHeight: 1.4 }}>
            With no key here, questions go through this app's own decision door, which holds a key
            on the server side (TYPESAFE_API_KEY in the environment `pnpm dev` was started from). A
            key typed here is stored in this browser only and sent only to the provider.
          </p>
        </div>
      ) : null}

      {source === "remote" ? (
        <div style={{ display: "grid", gap: 8, paddingLeft: 22 }}>
          <label style={{ display: "grid", gap: 3 }}>
            <span style={label}>Provider</span>
            <select value={preset} onChange={(event) => setPreset(event.target.value as "xai" | "custom")} style={field}>
              <option value="xai">xAI (Grok)</option>
              <option value="custom">Custom OpenAI-compatible endpoint</option>
            </select>
          </label>
          {preset === "custom" ? (
            <label style={{ display: "grid", gap: 3 }}>
              <span style={label}>Base URL</span>
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://…/v1" style={field} />
            </label>
          ) : null}
          <label style={{ display: "grid", gap: 3 }}>
            <span style={label}>API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={preset === "xai" ? "xai-…" : "sk-…"}
              autoComplete="off"
              style={field}
            />
          </label>
          <label style={{ display: "grid", gap: 3 }}>
            <span style={label}>Model</span>
            <input value={model} onChange={(event) => setModel(event.target.value)} placeholder={preset === "xai" ? "grok-4-fast" : "model id"} style={field} />
          </label>
          <p style={{ ...label, margin: 0, lineHeight: 1.4 }}>
            The key is stored in this browser only and sent only to the provider above — never to
            any server of this app's, never into the project.
          </p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={source === "remote" && !apiKey && !config.remote?.apiKey}
        title={
          source === "remote" && !apiKey && !config.remote?.apiKey
            ? "A remote model needs a key"
            : undefined
        }
        style={{ justifySelf: "start", fontSize: "0.78125rem" }}
      >
        Use this
      </button>
    </form>
  );
}
