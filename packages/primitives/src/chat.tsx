import type { AnySchema } from "@graview/core";
import { useAttention, useGraview, useSelection } from "@graview/react";
import { kindCardId, withFocus, withOverview, withSelection } from "@graview/layout";
import {
  configuredResponder,
  createToolRuntime,
  describeIntelligence,
  describeProposal,
  loadPins,
  resolveProposal,
  stillNeeded,
  type LocalStatus,
  type ProposedCall,
  type Responder,
  type ToolCall,
} from "@graview/tools";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSubject } from "./companion.js";
import { describeSource, proposalKey, SeatComposer, SeatHeader, SeatSettings, SeatThread, Settled, useSeatConversation } from "./seat.js";
import { AnswerArgs } from "./workbench/index.js";
import { closeToTrigger } from "./popover.js";

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
 *
 * The conversation itself — turns, outcomes, the thread, the header and the
 * field — is `seat.tsx`, shared with the studio's declaration seat; what is
 * this panel's own is what a proposal does here: apply to the graph.
 */

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
   * Where a pick goes — a thing the words found, pressed. The scene focuses
   * and selects it; a face with no scene to move (the pages' drawer) goes
   * to the record's page instead.
   */
  readonly onPick?: (id: string) => void;
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
  onPick,
  testId = "chat",
}: ChatPanelProps<S>) {
  const { store, views, principal, setView, seatWho, noteSeat, session, intelligence: config, registerHostAnswers } = useGraview<S>();
  const { selection } = useSelection();
  const subject = useSubject<S>();
  /* The chat writes as the tab's seat when one has sat down, so the two are one robot — in this tab's own session. */
  const who = seatWho ?? "chat";
  const author = useMemo(() => ({ kind: "agent" as const, id: who, session }), [who, session]);
  const [shown, setOpen] = useState(false);
  // Inside the rail there is nothing to open: the rail is what opens.
  const open = inside || shown;
  const [settings, setSettings] = useState(false);
  /*
   * THE LADDER IS A SETTING — the provider's, chosen in the profile pane
   * beside text size and scheme, and read here. There is no gear on the
   * chat: the profile is on the same bar. "Let a model read it" shows the
   * same setting in place. A host that passes `respond` has decided.
   */
  const [warmth, setWarmth] = useState<LocalStatus | null>(null);
  useEffect(() => setWarmth(null), [config]);
  // A host that passes `respond` has decided which rung answers; the profile's ladder steps aside.
  useEffect(() => {
    registerHostAnswers(respond !== undefined);
    return () => registerHostAnswers(false);
  }, [respond, registerHostAnswers]);
  const anchor = useRef<HTMLDivElement | null>(null);

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
        places: () => views.places(),
      }),
    [store, principal, author, views],
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
      if (event.key === "Escape") closeToTrigger(anchor.current, () => setOpen(false));
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const conversation = useSeatConversation({
    /*
     * "THIS" IS THE COMPANION'S SUBJECT: the selection, else what the
     * pointer has settled on, else where you are. One answer for the whole
     * frame, so the panel and the header above it cannot disagree.
     */
    answer: (text, context) =>
      answer(store, text, {
        ...context,
        selection: subject.id ? [subject.id] : selection,
        principal: { ...author, ...(principal.roles ? { roles: principal.roles } : {}) },
      }),
    onReply: (reply) => {
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
      const withheld = reply.proposals.find((proposal) => !permitted(proposal));
      if (withheld) {
        const verdict = store.permits({ name: withheld.mutation, args: { ...withheld.args } }, principal);
        if (!verdict.ok) noteSeat({ type: "refused", author, where: gateOf(withheld.mutation), say: verdict.refusal.message });
      }
    },
  });
  const { outcomes, settle } = conversation;

  const permitted = (proposal: ProposedCall) =>
    store.permits({ name: proposal.mutation, args: { ...proposal.args } }, principal).ok;
  const gateOf = (mutation: string) => {
    const kinds = store.allMutations().find((m) => m.name === mutation)?.subject?.kinds;
    return Array.isArray(kinds) && kinds[0] ? kindCardId(kinds[0] as string) : null;
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
  const [answering, setAnswering] = useState<{
    proposal: ProposedCall;
    open: ReturnType<typeof stillNeeded>;
    key: string;
  } | null>(null);

  const apply = async (offered: ProposedCall, key: string): Promise<boolean> => {
    /*
     * Resolved AT THE PRESS, not when it was offered: a sowing proposed in
     * the same breath as its plot names a plot that exists only once the
     * first press has landed.
     */
    const proposal = resolveProposal(store, offered);
    const said = describeProposal(store, proposal);
    /*
     * The runtime RESOLVES refusals rather than throwing them — a policy
     * denial, a validation failure — so the flag must be read. Skipping it
     * had the chat saying "Done" over a change the store had refused, which
     * is the one lie a seat must never tell.
     */
    const result = await runtime.call(proposal.mutation, { ...proposal.args });
    if (!result.ok) {
      settle(key, { state: "refused", error: result.error });
      noteSeat({ type: "refused", author, where: gateOf(proposal.mutation), say: result.error });
      return false;
    }
    settle(key, { state: "applied", said });
    return true;
  };

  /*
   * ONE REQUEST, ONE PRESS. "Add a plot and put a sunflower in it" is two
   * proposals and one intention; applied in order, each resolved after the
   * one before it has landed, stopping at the first that still needs an
   * answer (asked, as ever) or is refused.
   */
  const applyAll = async (turn: number, proposals: readonly ProposedCall[]) => {
    for (const [at, proposal] of proposals.entries()) {
      const key = proposalKey(turn, at);
      if (outcomes.get(key)?.state === "applied" || !permitted(proposal)) continue;
      const owed = stillNeeded(store, proposal);
      if (owed.length > 0) {
        setAnswering({ proposal, open: owed, key });
        return;
      }
      if (!(await apply(proposal, key))) return;
    }
  };

  const offerOne = (turnIndex: number, at: number, proposal: ProposedCall, key: string) => {
    /*
     * WITHHELD, NOT OFFERED — the same rule as the strip. The responder
     * proposes from the graph and knows nothing of the policy, so the seat
     * was handed "Add an item" with an apply button and refused on press.
     * The store's own verdict, asked as the person at the keyboard, decides
     * whether a proposal is a press or a struck line with the policy's
     * reason beside it.
     */
    const verdict = store.permits({ name: proposal.mutation, args: { ...proposal.args } }, principal);
    if (!verdict.ok) {
      return (
        <span data-testid={`${testId}-withheld`} style={{ fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
          <s>{describeProposal(store, proposal)}</s> — {verdict.refusal.message}
        </span>
      );
    }
    // The same question asked of the ACT rather than of the policy: has the responder said what this needs?
    const owed = stillNeeded(store, proposal);
    /*
     * WAITING, NOT MISSING. A thing named by an earlier proposal in this
     * same reply — the plot it stakes out — is an answer that has not
     * landed yet, so the press waits for that one rather than asking again.
     */
    const before = (conversation.turns[turnIndex]?.proposals ?? [])
      .slice(0, at)
      .filter((_, was) => outcomes.get(proposalKey(turnIndex, was))?.state !== "applied")
      .find((earlier) =>
        owed.some((one) => one.kinds && typeof proposal.args[one.name] === "string" && earlier.args["label"] === proposal.args[one.name]),
      );
    return (
      <button
        type="button"
        data-testid={`${testId}-apply`}
        data-graview-asks={owed.length > 0 ? owed.length : undefined}
        disabled={before !== undefined}
        onClick={() => (owed.length > 0 ? setAnswering({ proposal, open: owed, key }) : void apply(proposal, key))}
        title={
          before
            ? `After “${describeProposal(store, before)}”`
            : owed.length > 0
              ? `${proposal.why ?? "Apply this change"} — needs ${owed.map((one) => one.name).join(", ")}`
              : (proposal.why ?? "Apply this change")
        }
        style={{ fontSize: "0.8125rem", textAlign: "start" }}
      >
        {describeProposal(store, proposal)}
        {owed.length > 0 && !before ? " …" : ""}
      </button>
    );
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
            { display: "grid", gridTemplateRows: "min-content", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0, minHeight: "min-content" }
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
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.875rem" }}
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
                   * SIZED BY WHAT IS IN IT, in the rail. The log carries its
                   * own floor and ceiling, scrolling; everything else is as
                   * tall as it needs to be, and the rail's own column
                   * scrolls. A fixed box painted the field and the chips
                   * over the relation key below.
                   */
                  gridTemplateRows: "auto auto auto auto",
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
            /*
             * ONE COLUMN THAT TAKES THE PANE'S WIDTH, no more. A grid column
             * sizes to its content by default, and an input's own idea of
             * its width is about 180px: in a pane the rail's share of a
             * 1000px scene made 220px wide, the conversation ran fifty
             * pixels past the edge and was clipped mid-word.
             */
            gridTemplateColumns: "minmax(0, 1fr)",
            minWidth: 0,
            ...(inside ? {} : { gridTemplateRows: "auto 1fr auto" }),
            /*
             * CLIPPED, EVEN IN THE RAIL: across engines, a squeezed box
             * painting its field over the section below is the ugly
             * failure; clipped, the worst case is a section that scrolls in
             * a rail that already scrolls.
             */
            overflow: "hidden",
          }}
        >
          {inside ? null : (
            <SeatHeader
              label="Seat"
              testId={testId}
              source={respond ? "app-provided" : describeSource(describeIntelligence(config), warmth)}
              {...(warmth?.state === "failed" && warmth.detail ? { sourceTitle: warmth.detail } : {})}
            />
          )}
          {settings && !respond ? (
            <SeatSettings testId={testId} onDone={() => setSettings(false)} />
          ) : (
            <SeatThread
              turns={conversation.turns}
              outcomes={outcomes}
              busy={conversation.busy}
              testId={testId}
              minHeight={inside ? 0 : 120}
              empty={
                inside ? null : (
                  <>
                    Ask what's wrong, ask about anything by name, or say a change in its own words.
                    {selection.length > 0 ? " “This” means what you have selected." : ""}
                  </>
                )
              }
              renderProposal={(proposal, { key, turn, at }) => offerOne(turn, at, proposal, key)}
              ready={(proposal) => permitted(proposal)}
              onApplyAll={(turn, proposals) => void applyAll(turn, proposals)}
              {...(respond || config.source !== "graph" ? {} : { onChooseModel: () => setSettings(true) })}
              renderAfter={(turn, index) => [
                /*
                 * WHAT THE WORDS FOUND, each a press that goes there — the
                 * Find box's strip, answered in the thread.
                 */
                ...(turn.picks?.length
                  ? [
                      <div key={`${index}:picks`} data-testid={`${testId}-picks`} style={{ display: "flex", flexWrap: "wrap", gap: 4, justifySelf: "start" }}>
                        {turn.picks.map((hit) => (
                          <button
                            key={hit.id}
                            type="button"
                            data-testid={`${testId}-pick`}
                            data-chat-pick={hit.id}
                            title={hit.why.field === "label" ? `Go to ${hit.label}` : `${hit.why.reading}: ${hit.why.fragment}`}
                            onClick={() =>
                              onPick ? onPick(hit.id) : setView((stop) => withSelection(withFocus(withOverview(stop, false), hit.id), [hit.id]))
                            }
                            style={{ fontSize: "0.8125rem", minHeight: 28 }}
                          >
                            {hit.label}
                          </button>
                        ))}
                      </div>,
                    ]
                  : []),
                ...(turn.questions ?? []).map((asked) => {
                  const key = `${index}:q:${asked.id}`;
                  const outcome = outcomes.get(key);
                  /*
                   * A QUESTION STANDS AT ITS NODE. The seat was not sure
                   * enough to propose — a split, or a shrug — so it asks,
                   * naming the node, with each option as a press that lands
                   * through the same path a proposal does.
                   */
                  return (
                    <div
                      key={asked.id}
                      data-testid={`${testId}-question`}
                      data-chat-question-node={asked.nodeId}
                      style={{ display: "grid", gap: 4, justifySelf: "start", maxWidth: 260 }}
                    >
                      <span style={{ fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
                        {asked.nodeLabel ? <strong>{asked.nodeLabel}: </strong> : null}
                        {asked.asks}
                        {asked.because === "split" ? " (it could be either)" : " (it was not sure)"}
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {asked.options.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            data-testid={`${testId}-option`}
                            disabled={!option.call}
                            title={option.call ? option.call.why ?? "Take this answer" : "Nothing to do for this answer"}
                            onClick={() => (option.call ? void apply(option.call, key) : undefined)}
                            style={{ fontSize: "0.8125rem" }}
                          >
                            {option.value} {Math.round(option.probability * 100)}%
                          </button>
                        ))}
                      </div>
                      {outcome ? <Settled outcome={outcome} testId={testId} /> : null}
                    </div>
                  );
                }),
              ]}
            />
          )}
          {/*
            * THE ASK, in the thread where it was proposed: the same
            * component the actions strip raises, given the same shape, so
            * what the model already answered stays answered and the
            * questions are only the ones it left open.
            */}
          {answering ? (
            <div data-testid={`${testId}-asking`} style={{ padding: "0 8px 6px" }}>
              <AnswerArgs
                affordance={{
                  id: `chat:${answering.proposal.mutation}`,
                  mutation: answering.proposal.mutation,
                  label: describeProposal(store, answering.proposal),
                  // What it is, honestly: a responder's suggestion.
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
                  void apply(proposal, answering.key);
                }}
                onCancel={() => setAnswering(null)}
              />
            </div>
          ) : null}
          {/* What it can answer about what is in front of you, before anybody types. */}
          {(offer ?? []).length > 0 && conversation.turns.length === 0 ? (
            <div data-testid={`${testId}-offers`} style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "0 8px 6px" }}>
              {(offer ?? []).slice(0, 3).map((question) => (
                <button
                  key={question}
                  type="button"
                  data-testid={`${testId}-offer`}
                  disabled={conversation.busy}
                  onClick={() => void conversation.send(question)}
                  style={{ font: "inherit", fontSize: "0.75rem", minHeight: 24, padding: "0 8px", borderRadius: 999 }}
                >
                  {question}
                </button>
              ))}
            </div>
          ) : null}
          <SeatComposer
            busy={conversation.busy}
            placeholder={inside && selection.length > 0 ? "Ask about this…" : "Ask, or say a change…"}
            ariaLabel="Message the seat"
            testId={testId}
            onSend={(text) => void conversation.send(text)}
          />
          {/*
            * IN THE RAIL, WHAT ANSWERS IS A LINE UNDER THE FIELD, not a
            * title over the thread: "SEAT · graph-native" over a paragraph
            * explaining what to type was the pane's tallest thing and the
            * least often read. The field says what to do, the offers say
            * what it can answer, and this says who is answering.
            */}
          {inside ? (
            <SeatHeader
              foot
              label="Seat"
              testId={testId}
              source={respond ? "app-provided" : describeSource(describeIntelligence(config), warmth)}
              {...(warmth?.state === "failed" && warmth.detail ? { sourceTitle: warmth.detail } : {})}
              {...(!respond ? { settings, onSettings: () => setSettings((was) => !was) } : {})}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
