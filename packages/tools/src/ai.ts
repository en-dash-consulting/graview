import type { SearchRanker } from "@graview/core";
import type { AiCatalog, AiContextState, AiInteraction, AiTarget, AiUsage } from "@graview/core/catalog";
import type { ToolDefinition } from "./agent/tool-definition.js";
import type { Completion } from "./intelligence.js";
import type { Decide } from "./fast.js";

/**
 * THE AI A SEAT MAY USE, AS THE HOST DECIDED IT — once, in code.
 *
 * There used to be a ladder a reader climbed: "Graph only", "Onboard AI",
 * "Jev", "LLM", picked under a ⚙ on the seat and again in the person's
 * menu, remembered in their browser, with a key field for whoever had one.
 * A person asking "what's overdue" was being asked which machine should
 * answer, which is not their question. Now the host decides, and a reader
 * never sees a rung name:
 *
 *  - the graph answers first, always — where things are, what is wrong,
 *    what a record says, the repairs a rule names, a drawn view from a
 *    template. None of it needs a model, so none of it waits for one;
 *  - an open question goes to `turn` when the host gave one — its model
 *    reads the graph with the seat's own read tools before it answers —
 *    else to `complete`, one prompt in and text out;
 *  - a view no template draws goes to `complete`, or to `turn` with no
 *    tools when that is all the host gave;
 *  - a typed decision goes to `decide` when the host gave one, else to a
 *    decision provider the app's declaration names (through the dev
 *    server's door), else to `complete` behind the parse-and-refuse layer;
 *  - a model in the reader's own browser runs only when the host turns
 *    `onDevice` on.
 *
 * Plain data and functions: it is handed to `GraviewProvider`, `mount`,
 * `<Embed>` or a routed face's context as `ai`, and nothing about it is
 * kept in the reader's storage.
 */
export interface HostAi {
  /** The host's model: prompt in, text out. Absent (and no `turn`), open questions are answered by saying AI is not on. */
  readonly complete?: Completion;
  /**
   * THE HOST'S MODEL WITH TOOLS (FR-160): a turn in, the final text out.
   *
   * The seat hands over its framing (`system`), the conversation so far
   * ending with the person's words (`messages`), and its own read surface:
   * `tools`, the read-only tools `toolDefinitions` derives (`search_graph`,
   * `get_node`, `get_violations`…), and `call`, which runs one of them as
   * the person, under their sight. The host runs its model's tool loop —
   * each tool use the model asks for goes to `call`, and what it resolves
   * with goes back to the model — and resolves with the model's last text,
   * which the seat reads exactly as it reads a completion: the JSON answer,
   * its proposals validated and previewed before anything is applied.
   *
   * `call` never writes and never rejects: a name not in `tools`, a record
   * the person may not see, and every call past the twelfth in one turn
   * resolve to `{ error }`. Preferred over `complete` when both are given.
   * `turnThroughMessages` runs the loop over one Messages API request.
   */
  readonly turn?: (turn: HostTurn) => Promise<string>;
  /** A decision provider (`jevDecide(...)`): typed questions in, answers with a confidence out. */
  readonly decide?: Decide;
  /**
   * THE HOST'S RANKER FOR FIND (embeddings, a model): when the words find
   * few records exactly, it is handed the words and the records this seat
   * sees — never a hidden one, nor its text — and answers the near ones'
   * scores, at once or later. Find shows the exact hits at once and these
   * as they arrive, said as near; `search_graph` answers them as
   * `near: true`. Unsaid, near hits come from spelling and word forms alone.
   */
  readonly near?: SearchRanker;
  /**
   * A model in the reader's browser (Chrome's built-in model, else WebLLM
   * over WebGPU — a download of a gigabyte or two). Off unless the host
   * turns it on; used only when there is no `complete`. WebLLM is fetched
   * at one pinned version (`WEBLLM_URL`), or from `webllm`, a host's copy.
   */
  readonly onDevice?: boolean | { readonly model?: string; readonly webllm?: string };
  /**
   * What the op log records a change it proposed as coming through:
   * `via: "ai:<name>"`. Never shown to a reader. "model" when unsaid.
   */
  readonly name?: string;
  /**
   * What the seat says when an ask needs a model and there is none, in
   * place of `NO_AI_SAID`. For a host that can say how to turn one on —
   * a dev server holding no key, through `aiThroughDevServer` — and nobody
   * else: a product's readers are never told about keys.
   */
  readonly withoutModel?: string;
  /**
   * THE HOST SAYS AI IS OFF. Every AI part is HIDDEN, not disabled, on
   * both faces: the inline AI in the context menu, a proposal waiting to
   * be accepted, a panel it drew, the quick ask (the command bar and its
   * answer cards), Activity's AI entries and its AI filter. No model is asked, whatever else is given here.
   */
  readonly off?: boolean;
  /**
   * THE FAST SLOT: a typed-decision model — Jev (`jevDecide`), or another
   * behind the same shape. The inline AI asks it to pick among the
   * catalog's candidates and to fill fields, as typed questions over the
   * context state. Unsaid, `decide` serves it.
   */
  readonly fast?: FastProvider;
  /**
   * THE THINKING SLOT: a language model, for what a pick among candidates
   * cannot say — a panel drawn for an ask. Unsaid, `complete` serves it.
   */
  readonly thinking?: ThinkingProvider;
  /**
   * THE LIGHT MODEL (Roadmap f-menu-type-anything): the provider's quick one
   * — a non-reasoning model, a small one — that words an open answer the
   * graph could not decide, before the full Thinking slot is asked; the
   * full one only where it had nothing. The dev server lends its fast model
   * here.
   */
  readonly light?: ThinkingProvider;
  /**
   * WHETHER A CONTEXT MENU ASKS FOR SUGGESTIONS AS IT OPENS (FR-185). Only
   * ever the Fast slot's: with no Fast slot a menu never asks on its own,
   * and offers a "Suggest…" row that asks — the Thinking slot then — when
   * pressed. `false` makes it that row with a Fast slot too, for a host
   * that meters every call. Unsaid, a menu asks on opening where there is a
   * Fast slot, once per record until the record changes (FR-186).
   */
  readonly suggestOnOpen?: boolean;
  /**
   * A QUIET HOVER CHIP: the pointer resting on a record for as long as it
   * takes the menu to get ready shows, beside it, the Fast slot's one
   * suggestion there — only when the model is sure of it
   * (`HOVER_CHIP_CONFIDENCE`), at most one on the screen, asked once per
   * record until it changes, never on a pointer passing over and never of
   * the Thinking slot. Off unless the host says `true`: a hover is not a
   * question the reader asked, and a host that meters every call should
   * not pay for one it did not choose. Only with a Fast slot; each reader
   * may turn it off again in the person menu.
   */
  readonly hoverChips?: boolean;
  /**
   * THE QUICK ASK'S ANSWERS (Roadmap f-quick-ask-framework): what answers
   * words asked from the command bar (⌘K) or on an answer card, about the
   * target they were asked on. Handed the words, the target, the state
   * the viewer may see and the catalog; answers prose and, optionally,
   * candidate ids from the catalog — a change among them is proposed as a
   * ghost, never made. Unsaid, the Thinking slot answers (else the Fast
   * slot picks among the candidates), so a host that filled those slots
   * need not fill this one.
   */
  readonly answer?: AnswerProvider;
  /**
   * WHERE AI INTERACTIONS ARE KEPT (Roadmap f-ai-interaction-history): the
   * entries Activity draws, handed back by `load` when Activity first
   * opens, and each one made or changed handed to `keep`, by id. Unsaid,
   * the entries live as long as the page.
   */
  readonly interactions?: AiInteractionHost;
  /** Told of every call to a model, with the interaction it served: tier, model, tokens and cost, for a host that meters. */
  readonly meter?: (usage: AiUsage & { readonly interaction: string }) => void;
}

/** What a model of either slot costs, per million tokens, in US dollars: the interaction's cost is read from it when the provider does not say. */
export interface AiPrice {
  readonly inputPerMillion?: number;
  readonly outputPerMillion?: number;
}

/**
 * THE FAST SLOT (a System One model): Jev's own shape — one state and a map
 * of typed questions (`Choice`, `Noul`, `Score`) in, typed answers with a
 * confidence and the call's usage out (`Decide`). The state is the
 * catalog's (`AiContextState`), with the candidates it may pick among.
 */
export interface FastProvider {
  /** The model, as metering and lineage name it: "jev-latest". */
  readonly model: string;
  readonly decide: Decide;
  readonly price?: AiPrice;
}

/** What the thinking slot is asked: its framing, the ask, and the state and catalog it was built from. */
export interface ThinkingRequest {
  readonly system: string;
  readonly prompt: string;
  readonly state: AiContextState;
  readonly catalog: AiCatalog;
}

/** What it answers: its text (the inline AI reads JSON from it) and the call's usage, when known. */
export interface ThinkingReply {
  readonly text: string;
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number; readonly costUsd?: number };
}

/** THE THINKING SLOT: a language model, one request in and its text out. */
export interface ThinkingProvider {
  readonly model: string;
  think(request: ThinkingRequest): Promise<ThinkingReply>;
  readonly price?: AiPrice;
}

/** What a quick ask hands the answer provider: the words, what they are about, and the state and catalog it may answer from. */
export interface AnswerRequest {
  readonly said: string;
  readonly target: AiTarget;
  /** The target in words: a record's name, a kind's plural, a place's title. */
  readonly targetLabel: string;
  readonly state: AiContextState;
  readonly catalog: AiCatalog;
  /** The ask this one follows on the same card, and what it was answered: one step back, never a thread. */
  readonly follows?: { readonly said: string; readonly answer: string };
}

/** What the answer provider says: the answer in words, and the catalog's candidates that act on it, best first. */
export interface AnswerReply {
  readonly text: string;
  /** Candidate ids from the request's catalog; any other id is dropped. A change among them waits as a ghost. */
  readonly pick?: readonly string[];
  readonly usage?: { readonly inputTokens?: number; readonly outputTokens?: number; readonly costUsd?: number };
}

/** THE ANSWER SLOT: the host's own way to answer a quick ask, in place of the Thinking and Fast slots. */
export interface AnswerProvider {
  /** The model, as metering and lineage name it. */
  readonly model: string;
  answer(request: AnswerRequest): Promise<AnswerReply>;
  readonly price?: AiPrice;
}

/** A host's store of AI interactions (`AiInteraction`, `@graview/core/catalog`). */
export interface AiInteractionHost {
  /** The entries this host keeps for the app, newest first or in any order: asked once, when Activity first draws them. */
  readonly load?: () => readonly AiInteraction[] | Promise<readonly AiInteraction[]>;
  /** An entry made or changed, kept by its id. */
  readonly keep?: (entry: AiInteraction) => void | Promise<void>;
}

/** One message of a turn's conversation: the person's words (`user`) or the seat's (`assistant`). */
export interface TurnMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/** What the seat hands `HostAi.turn`: its framing, the conversation, and its read tools with the one way to run them. */
export interface HostTurn {
  readonly system: string;
  /** Oldest first, alternating, beginning and ending with the person's. */
  readonly messages: readonly TurnMessage[];
  /** The seat's read surface, as the person: reads only, never an act. */
  readonly tools: readonly ToolDefinition[];
  /** Runs one of `tools` by name; resolves with what it read, or `{ error }`. Never rejects. */
  call(name: string, args: Record<string, unknown>): Promise<unknown>;
}

/** Whether the host said AI is off: every AI part is hidden. */
export const aiOff = (ai: HostAi | undefined): boolean => ai?.off === true;

/** Whether the inline AI is drawn: AI is not off, and a fast or thinking model (or the `decide`, `complete` or `turn` that serve them) was given. */
export const inlineAiOn = (ai: HostAi | undefined): boolean =>
  ai !== undefined && !aiOff(ai) && (ai.fast !== undefined || ai.thinking !== undefined || ai.answer !== undefined || ai.decide !== undefined || ai.complete !== undefined || ai.turn !== undefined);

/** Whether a Fast slot is given (or the `decide` behind it) and AI is not off. */
export const fastGiven = (ai: HostAi | undefined): boolean => ai !== undefined && !aiOff(ai) && (ai.fast !== undefined || ai.decide !== undefined);

/**
 * WHETHER A MENU ASKS FOR SUGGESTIONS AS IT OPENS (FR-185): only with a Fast
 * slot, and only when the host did not say `suggestOnOpen: false`. Else the
 * menu offers "Suggest…", and asks when that is pressed. The selection bar
 * asks for the chosen records the same way, or not at all.
 */
export const suggestsOnOpen = (ai: HostAi | undefined): boolean => ai?.suggestOnOpen !== false && fastGiven(ai);

/** Whether the host asked for hover chips (`hoverChips: true`) and gave a Fast slot for them. */
export const hoverChipsOn = (ai: HostAi | undefined): boolean => ai?.hoverChips === true && fastGiven(ai);

/** How sure the Fast slot must be of its first suggestion for a hover chip to say it. */
export const HOVER_CHIP_CONFIDENCE = 0.6;

/** No AI: the graph answers alone. */
export const NO_AI: HostAi = {};

/** Whether the host gave the seat any model that talks. */
export const aiTalks = (ai: HostAi): boolean => !aiOff(ai) && (ai.complete !== undefined || ai.turn !== undefined || Boolean(ai.onDevice));

/** Said, once, when an ask needs a model and the host gave none. */
export const NO_AI_SAID = "I can answer about what's in this app. Open questions need AI, which isn't on here.";

/** The quiet note under an answer a model gave. Nothing is said under one the graph gave. */
export const ANSWERED_WITH_AI = "Answered with AI";
