import type { SearchRanker } from "@graview/core";
import type { ToolDefinition } from "./agent/tools.js";
import type { Completion } from "./intelligence.js";
import type { Decide } from "./providers/jev.js";

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
   * turns it on; used only when there is no `complete`.
   */
  readonly onDevice?: boolean | { readonly model?: string };
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

/** No AI: the graph answers alone. */
export const NO_AI: HostAi = {};

/** Whether the host gave the seat any model that talks. */
export const aiTalks = (ai: HostAi): boolean => ai.complete !== undefined || ai.turn !== undefined || Boolean(ai.onDevice);

/** Said, once, when an ask needs a model and the host gave none. */
export const NO_AI_SAID = "I can answer about what's in this app. Open questions need AI, which isn't on here.";

/** The quiet note under an answer a model gave. Nothing is said under one the graph gave. */
export const ANSWERED_WITH_AI = "Answered with AI";
