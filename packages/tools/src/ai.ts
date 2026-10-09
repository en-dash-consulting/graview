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
 *  - an open question, or a view no template draws, goes to `complete`
 *    when the host gave one;
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
  /** The host's model: prompt in, text out. Absent, open questions are answered by saying AI is not on. */
  readonly complete?: Completion;
  /** A decision provider (`jevDecide(...)`): typed questions in, answers with a confidence out. */
  readonly decide?: Decide;
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
}

/** No AI: the graph answers alone. */
export const NO_AI: HostAi = {};

/** Whether the host gave the seat any model that talks. */
export const aiTalks = (ai: HostAi): boolean => ai.complete !== undefined || Boolean(ai.onDevice);

/** What a change a model proposed is recorded as coming through, in the op log. */
export const aiVia = (ai: HostAi): string => `ai:${ai.name ?? (ai.complete ? "model" : "on-device")}`;

/** Said, once, when an ask needs a model and the host gave none. */
export const NO_AI_SAID = "I can answer about what's in this app. Open questions need AI, which isn't on here.";

/** The quiet note under an answer a model gave. Nothing is said under one the graph gave. */
export const ANSWERED_WITH_AI = "Answered with AI";
