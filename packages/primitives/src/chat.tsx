import type { AnySchema, GraviewApp } from "@graview/core";
import { useAttention } from "@graview/react/drawing";
import { useGraview, useSeatTalkState, useSelection } from "@graview/react/provider";
import { kindCardId, withFocus, withOverview, withSelection } from "@graview/layout/view";
import {
  completionFor,
  createToolRuntime,
  describeProposal,
  loadPins,
  resolveProposal,
  seatResponder,
  stillNeeded,
  type ChatReply,
  type ProposedCall,
  type Responder,
  type SeatMove,
  type ToolCall,
} from "@graview/tools";
import type { SeatTurn } from "@graview/react/provider";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLensKeeping } from "./lens-keeping.js";
import { useSceneGo } from "./seat-move.js";
import { useSubject } from "./subject.js";
import { proposalKey, SeatComposer, SeatThread, Settled, useSeatConversation } from "./seat.js";
import { AnswerArgs } from "./workbench/index.js";

/**
 * A SEAT YOU CAN TALK TO — the conversation itself.
 *
 * Every answer comes from a Responder — the graph first, always, and the
 * model the host gave (`ai` on the provider) for what the graph cannot
 * read; a reader is never asked which — and every proposal is an ordinary validated call, applied through
 * the same runtime a seat uses, attributed to `chat` in the log,
 * previewer-visible, undoable. Words in, the usual paths out.
 *
 * The seat (`seat-field.tsx`, `seat-panel.tsx`) draws this inside its
 * panel, with the app's conversation (`shared`), so a face switch keeps
 * it, and its own field outside it; drawn alone, it keeps its own
 * conversation and its own field.
 *
 * WHAT AN ANSWER CARRIES, AND WHERE IT GOES, is drawn here and nowhere
 * else: the words, the names the words found (each a link that moves the
 * app, through `onPick`), a question at its node, and a proposal as one
 * line with "Do it" and "Not now".
 */

export interface ChatPanelProps<S extends AnySchema> {
  /** How the seat answers. Defaults to the graph's own responder. */
  readonly respond?: Responder<S>;
  /**
   * Where a name in an answer goes, pressed. The scene focuses and selects
   * it; a face with no scene to move (Pages) goes to the record's page.
   */
  readonly onPick?: (id: string) => void;
  /** Feeds the app's activity rail, like any other seat. */
  readonly onCall?: (call: ToolCall) => void;
  readonly testId?: string;
  /** Said before anybody asks: the seat's line, its suggestions and its acts. */
  readonly empty?: ReactNode;
  /**
   * The app's conversation rather than this panel's own: kept by the
   * provider, so it outlives the panel and a face switch, and asked into
   * from outside (the seat's field, a suggestion, Find's "Ask:" row).
   */
  readonly shared?: boolean;
  /** Its own field; the seat's is outside it. */
  readonly composer?: boolean;
  /**
   * WHERE AN ANSWER TAKES THE APP ("go to The week"): the routed face
   * navigates to the move's address; the scene makes it a stop when unsaid.
   */
  readonly onMove?: (move: SeatMove) => void;
  /** The place the reader stands in, by its slug, when the face knows it better than the scene's stop does (Pages). */
  readonly place?: string;
  /** A view was drawn: a face that shows it somewhere of its own (Pages' `/~draft`) goes there. */
  readonly onDraft?: () => void;
}

/** An ask for a way of seeing: a board, a calendar, a timeline, who covers what, a list of … */
const DRAW = /\b(?:board|kanban|timeline|calendar|gantt|who covers|covers what|coverage|floor plan|layout|draw|chart|(?:list|table) of|as an? (?:list|table|board|calendar|timeline|grid))\b/i;
/** An ask that changes the view on screen: group by, sort by, only, call it, as a … */
const REFINE = /\b(?:group(?:ed)? by|split by|sort(?:ed)? by|order(?:ed)? by|only|call it|name it|as an? (?:board|kanban|calendar|timeline|list|table|cards|rows|grid|plan|layout)|show all|all of them|clear the filter|no filter)\b/i;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** What a move is called in the sentence that says it: a link that goes there again. */
const nameOfMove = (move: SeatMove): string => (move.to === "record" ? move.label : move.to === "problems" ? "problems" : move.title);

/** The seat's words with the names its moves went to made links, each the first time it is said. */
function linked(said: string, moves: readonly SeatMove[], link: (move: SeatMove, words: string) => ReactNode): ReactNode {
  const parts: ReactNode[] = [];
  let rest = said;
  for (const move of moves) {
    const name = nameOfMove(move);
    const at = name ? rest.toLowerCase().indexOf(name.toLowerCase()) : -1;
    if (at < 0) continue;
    parts.push(rest.slice(0, at), link(move, rest.slice(at, at + name.length)));
    rest = rest.slice(at + name.length);
  }
  return parts.length === 0 ? said : [...parts, rest];
}

export function ChatPanel<S extends AnySchema>({
  respond,
  onCall,
  onPick,
  testId = "chat",
  empty,
  shared = false,
  composer = true,
  onMove,
  place,
  onDraft,
}: ChatPanelProps<S>) {
  const { store, views, view, principal, setView, seatWho, noteSeat, session, ai, seatTalk, brand } = useGraview<S>();
  const sceneGo = useSceneGo();
  const go = onMove ?? sceneGo;
  const { takeBack } = useLensKeeping(go);
  const { selection } = useSelection();
  const subject = useSubject<S>();
  /* The chat writes as the tab's seat when one has sat down, so the two are one robot — in this tab's own session. */
  const who = seatWho ?? "chat";
  const author = useMemo(() => ({ kind: "agent" as const, id: who, session }), [who, session]);
  /*
   * WHAT A CHANGE CAME THROUGH: a proposal a model made is applied with the
   * model's `via`, so the log keeps which provider proposed it — the reader
   * is shown only the act.
   */
  const viaNow = useRef<string | undefined>(undefined);
  const runtime = useMemo(
    () =>
      createToolRuntime(store, {
        author: {
          ...author,
          ...(principal.roles ? { roles: principal.roles } : {}),
        },
        // The person's pins reach this seat too — read per call, so no surface disagrees about the acts.
        derive: () => ({ pins: loadPins() }),
        places: () => views.places(),
        via: () => viaNow.current,
      }),
    [store, principal, author, views],
  );
  /* THE GRAPH FIRST, THE HOST'S MODEL AFTER IT: a host that passes `respond` answers in its place. */
  const answer = useMemo<Responder<S>>(() => respond ?? seatResponder<S>(ai), [respond, ai]);

  useEffect(() => (onCall ? runtime.onCall(onCall) : undefined), [runtime, onCall]);
  // What the conversation looked at reaches the picture, like any seat's reads.
  useAttention(runtime);

  /*
   * THE APP AS A DRAFT READS IT: its kinds and who may see what. A drawn
   * view binds only what this seat may see (`draftSight`).
   */
  const seatApp = useMemo(
    () => ({ name: brand?.name ?? "app", schema: store.schema, ...(store.policy ? { policy: store.policy } : {}) }) as unknown as GraviewApp<AnySchema>,
    [store, brand],
  );
  /*
   * ASKED FOR A WAY OF SEEING, THE SEAT DRAWS IT (`@graview/tools/draft`,
   * fetched with the first such ask): a template with no model, the app's
   * model for what no template reads. With a view on screen, an ask that
   * changes it ("group by status", "only this month") changes that one.
   * Drawn, it stands in place of the picture; an ask that cannot be drawn
   * says why in one line and the last good view stays.
   */
  const drawIfAsked = async (text: string): Promise<ChatReply | undefined> => {
    const current = seatTalk.get().draft;
    const refining = current !== null && REFINE.test(text);
    if (!refining && !DRAW.test(text)) return undefined;
    const engine = await import("@graview/tools/draft");
    const complete = respond ? undefined : completionFor(ai);
    const options = { app: seatApp, sight: engine.draftSight(seatApp, seatAs), ...(complete ? { complete } : {}), ...(current ? { lastGood: current } : {}) };
    const result = refining && current ? await engine.refineDraft(current, text, options) : await engine.draftView(text, options);
    if (engine.isDraftFailure(result)) {
      const kept = result.lastGood ?? current;
      if (kept) {
        seatTalk.setDraft(kept, result.failed);
        onDraft?.();
        return { say: `${result.failed} The last view stays.`, proposals: [], grounded: true };
      }
      return { say: result.failed, proposals: [], grounded: true };
    }
    seatTalk.setDraft(result, null);
    onDraft?.();
    return { say: `Here is ${lowerFirst(result.said)} Ask to change it, or keep it as a lens.`, proposals: [], grounded: true };
  };

  const conversation = useSeatConversation({
    ...(shared ? { talk: seatTalk } : {}),
    /* "This" is the seat's subject: the selection, else what the pointer settled on, else where you are. */
    answer: async (text, context) => {
      const drawn = await drawIfAsked(text);
      if (drawn) return drawn;
      /* The places this seat may go to, and where it stands: what "go to The week" and "here" are read against. */
      const { placesFromViews } = await import("@graview/tools/go");
      const here = place ?? view.within?.["view"];
      const arranged = views.arrangement?.();
      const today = store.today();
      return answer(store, text, {
        ...context,
        selection: subject.id ? [subject.id] : selection,
        principal: { ...author, ...(principal.roles ? { roles: principal.roles } : {}) },
        // Arranged as the bar arranges them, the scene called what the bar calls it.
        places: placesFromViews(store.schema, views.places(), arranged ? { pages: arranged } : {}),
        ...(here ? { place: here } : {}),
        ...(today ? { today } : {}),
      });
    },
    onReply: (reply) => {
      /* WHERE THE ANSWER TAKES THE APP: the first move is made, and said ("Went to The week."). */
      const move = reply.moves?.[0];
      if (move) go(move);
      const asked = reply.questions?.[0];
      if (asked) {
        noteSeat({ type: "asking", author, where: asked.nodeId ?? null, say: `${asked.nodeLabel ? `${asked.nodeLabel}: ` : ""}${asked.asks}`, confidence: asked.confidence });
      } else {
        noteSeat({ type: "said", author, say: reply.say });
      }
      /* A proposal the policy withholds is a refusal said at the gate of the kind it acts on. */
      const withheld = reply.proposals.find((proposal) => !permitted(proposal));
      if (withheld) {
        const verdict = store.permits({ name: withheld.mutation, args: { ...withheld.args } }, seatAs);
        if (!verdict.ok) noteSeat({ type: "refused", author, where: gateOf(withheld.mutation), say: verdict.refusal.message });
      }
    },
  });
  const { outcomes, settle } = conversation;

  /*
   * ASKED FROM OUTSIDE: the seat's field, a suggestion, Find's "Ask:" row.
   * They put the question on the app's conversation; the panel drawing it
   * sends it, once.
   */
  const talk = useSeatTalkState(seatTalk);
  useEffect(() => {
    if (!shared || talk.pending === null || conversation.busy) return;
    const question = seatTalk.takePending();
    if (question) void conversation.send(question);
  }, [shared, talk.pending, conversation.busy]);

  /*
   * ASKED AS THE SEAT THAT WILL APPLY IT — the agent, with the person's
   * roles — which is what the runtime applies as.
   */
  const seatAs = { ...author, ...(principal.roles ? { roles: principal.roles } : {}) } as typeof principal;
  const permitted = (proposal: ProposedCall) => store.permits({ name: proposal.mutation, args: { ...proposal.args } }, seatAs).ok;
  const gateOf = (mutation: string) => {
    const kinds = store.allMutations().find((m) => m.name === mutation)?.subject?.kinds;
    return Array.isArray(kinds) && kinds[0] ? kindCardId(kinds[0] as string) : null;
  };

  /*
   * A PROPOSAL THE ACT'S OWN ARGUMENTS ARE NOT SATISFIED BY IS AN ASK, NOT
   * A REFUSAL: the person is asked for each missing argument in turn, with
   * the graph's own candidates offered for anything that names a node —
   * the same component the context menu raises.
   */
  const [answering, setAnswering] = useState<{
    proposal: ProposedCall;
    open: ReturnType<typeof stillNeeded>;
    key: string;
  } | null>(null);

  const apply = async (offered: ProposedCall, key: string): Promise<boolean> => {
    // Resolved at the press, not when offered: a name made by the press before it exists only now.
    const proposal = resolveProposal(store, offered);
    const said = describeProposal(store, proposal);
    // The runtime resolves refusals rather than throwing them, so the flag must be read: never "Done" over a refusal.
    const tool = runtime.definitions.find((definition) => definition.act === proposal.mutation)?.name ?? proposal.mutation;
    // The turn that offered it says whether a model did: its `via` goes into the log with the act.
    viaNow.current = conversation.turns[Number(key.split(":")[0])]?.via;
    const result = await runtime.call(tool, { ...proposal.args }).finally(() => {
      viaNow.current = undefined;
    });
    if (!result.ok) {
      settle(key, { state: "refused", error: result.error });
      noteSeat({ type: "refused", author, where: gateOf(proposal.mutation), say: result.error });
      return false;
    }
    settle(key, { state: "applied", said });
    return true;
  };

  /* ONE REQUEST, ONE PRESS: a turn's proposals in order, stopping at the first that asks or is refused. */
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

  /*
   * THE KEYBOARD OUTLIVES THE PROPOSAL IT PRESSED: applied, its line
   * becomes a line saying it was done, and the keyboard goes on to the
   * next one still to press, else back to the words.
   */
  const panel = useRef<HTMLDivElement | null>(null);
  const kept = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const was = kept.current;
    if (!was || was.isConnected || document.activeElement !== document.body) return;
    kept.current = null;
    const next =
      panel.current?.querySelector<HTMLElement>(`[data-testid="${testId}-apply"]:not([disabled])`) ??
      panel.current?.querySelector<HTMLElement>(`[data-testid="${testId}-draft"]`) ??
      panel.current?.closest("[data-testid='seat']")?.querySelector<HTMLElement>("[data-testid='seat-field']");
    next?.focus();
  });

  const offerOne = (turnIndex: number, at: number, proposal: ProposedCall, key: string) => {
    /* WITHHELD, NOT OFFERED: the store's own verdict decides whether a proposal is a press or a struck line with the reason. */
    const verdict = store.permits({ name: proposal.mutation, args: { ...proposal.args } }, seatAs);
    if (!verdict.ok) {
      return (
        <span data-testid={`${testId}-withheld`} style={{ fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
          <s>{describeProposal(store, proposal)}</s> — {verdict.refusal.message}
        </span>
      );
    }
    const owed = stillNeeded(store, proposal);
    /* WAITING, NOT MISSING: a thing an earlier proposal in this reply makes is an answer that has not landed yet. */
    const before = (conversation.turns[turnIndex]?.proposals ?? [])
      .slice(0, at)
      .filter((_, was) => outcomes.get(proposalKey(turnIndex, was))?.state !== "applied")
      .find((earlier) =>
        owed.some((one) => one.kinds && typeof proposal.args[one.name] === "string" && earlier.args["label"] === proposal.args[one.name]),
      );
    const said = describeProposal(store, proposal);
    /* ONE LINE, AND TWO WORDS: what it would do, "Do it", "Not now". The preview, the check and the undo are the act's own. */
    return (
      <span style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 10px" }}>
        <span style={{ fontSize: "0.875rem", color: "var(--graview-ink)" }} title={proposal.why}>
          {said}
          {owed.length > 0 && !before ? " …" : ""}
        </span>
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button
            type="button"
            data-testid={`${testId}-apply`}
            data-graview-asks={owed.length > 0 ? owed.length : undefined}
            disabled={before !== undefined}
            aria-label={`Do it: ${said}`}
            onClick={() => (owed.length > 0 ? setAnswering({ proposal, open: owed, key }) : void apply(proposal, key))}
            title={before ? `After “${describeProposal(store, before)}”` : owed.length > 0 ? `${said} — it asks for ${owed.length === 1 ? "one more thing" : `${owed.length} more things`}` : said}
            style={QUIET_BUTTON}
          >
            Do it
          </button>
          <button
            type="button"
            data-testid={`${testId}-decline`}
            aria-label={`Not now: ${said}`}
            onClick={() => settle(key, { state: "declined", said })}
            style={{ ...QUIET_BUTTON, color: "var(--graview-ink-muted)" }}
          >
            Not now
          </button>
        </span>
      </span>
    );
  };

  return (
    <div
      data-testid={`${testId}-panel`}
      ref={panel}
      onFocus={(event) => {
        kept.current = event.target as HTMLElement;
      }}
      style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", alignContent: "start", gap: 8, minWidth: 0, minHeight: 0 }}
    >
      {conversation.turns.length === 0 ? empty ?? null : null}
      <SeatThread
        turns={conversation.turns}
        outcomes={outcomes}
        busy={conversation.busy}
        testId={testId}
        minHeight={0}
        maxHeight="none"
        empty={
          empty !== undefined ? null : (
            <>
              Ask what's wrong, ask about anything by name, or say a change in its own words.
              {selection.length > 0 ? " “This” means what you have selected." : ""}
            </>
          )
        }
        renderProposal={(proposal, { key, turn, at }) => offerOne(turn, at, proposal, key)}
        ready={(proposal) => permitted(proposal)}
        onApplyAll={(turn, proposals) => void applyAll(turn, proposals)}
        applyAllLabel="Do all"
        renderSaid={(turn: SeatTurn, said: string) =>
          turn.moves?.length
            ? linked(said, turn.moves, (move, words) => (
                <button key={`${move.address}:${words}`} type="button" data-testid={`${testId}-went`} title={`Go to ${words}`} onClick={() => go(move)} style={{ ...LINK, fontSize: "inherit" }}>
                  {words}
                </button>
              ))
            : said
        }
        renderAfter={(turn, index) => [
          /* A PICTURE THE MOVES COULD NOT SHOW, offered: drawn when pressed. */
          ...(turn.offer
            ? [
                <button key={`${index}:offer`} type="button" data-testid={`${testId}-offer`} onClick={() => seatTalk.ask(`a list of ${turn.offer!.draft}`)} style={{ ...QUIET_BUTTON, justifySelf: "start" }}>
                  {turn.offer.label}
                </button>,
              ]
            : []),
          /* A LENS KEPT, with the way to take it back: the notice goes, the conversation keeps it. */
          ...(turn.kept && !turn.kept.taken
            ? [
                <button key={`${index}:take-back`} type="button" data-testid={`${testId}-take-back`} onClick={() => void takeBack(turn.kept!)} style={{ ...QUIET_BUTTON, justifySelf: "start" }}>
                  Take back
                </button>,
              ]
            : []),
          /* THE NAMES THE WORDS FOUND, each a link that goes there. */
          ...(turn.picks?.length
            ? [
                <p key={`${index}:picks`} data-testid={`${testId}-picks`} style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "2px 12px" }}>
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
                      style={LINK}
                    >
                      {hit.label}
                    </button>
                  ))}
                </p>,
              ]
            : []),
          ...(turn.questions ?? []).map((asked) => {
            const key = `${index}:q:${asked.id}`;
            const outcome = outcomes.get(key);
            /* A QUESTION STANDS AT ITS NODE, each option a press that lands through the path a proposal does. */
            return (
              <div key={asked.id} data-testid={`${testId}-question`} data-chat-question-node={asked.nodeId} style={{ display: "grid", gap: 4, justifySelf: "start" }}>
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
                      style={QUIET_BUTTON}
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
      {answering ? (
        <div data-testid={`${testId}-asking`}>
          <AnswerArgs
            affordance={{
              id: `chat:${answering.proposal.mutation}`,
              mutation: answering.proposal.mutation,
              label: describeProposal(store, answering.proposal),
              provider: "llm",
              why: answering.proposal.why ?? "Suggested in the conversation.",
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
      {composer ? (
        <SeatComposer
          busy={conversation.busy}
          placeholder={selection.length > 0 ? "Ask about this…" : "Ask, or say a change…"}
          ariaLabel="Ask"
          testId={testId}
          onSend={(text) => (shared ? seatTalk.ask(text) : void conversation.send(text))}
        />
      ) : null}
    </div>
  );
}

/** A press that reads as a word, not a capsule: hairline, square-ish, small. */
export const QUIET_BUTTON = {
  font: "inherit",
  fontSize: "0.8125rem",
  minHeight: 26,
  padding: "0 9px",
  borderRadius: 6,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel)",
  boxShadow: "none",
  color: "var(--graview-ink)",
  cursor: "pointer",
} as const;

/** A name in an answer, or a suggestion: a link that does something, in the accent. */
export const LINK = {
  font: "inherit",
  fontSize: "0.875rem",
  minHeight: 24,
  padding: 0,
  border: 0,
  borderRadius: 2,
  background: "transparent",
  boxShadow: "none",
  color: "var(--graview-accent)",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  textAlign: "start",
  cursor: "pointer",
} as const;
