/**
 * THE LOCAL DOOR'S CONTRACT — what a page and a dev server agree on.
 *
 * `reach: ["local"]` says a provider can be reached by a process on this
 * machine. This is the whole of what the two sides share: one path and three
 * message shapes. It carries no Node and no DOM, so the browser bundle and
 * the dev-server plugin can both hold it, and neither has to import the
 * other — which matters here, because the plugin lives a tier above the
 * hook that probes it.
 *
 * Not to be confused with a model running IN the browser (`localCompletion`
 * in `@graview/tools`, which downloads weights and runs them on WebGPU).
 * This door is a process on the machine the dev server is running on:
 * somebody's own CLI, already installed, already logged in, already paid
 * for, and reachable for as long as `pnpm dev` is up.
 */

/** Where the bridge answers unless an app says otherwise. */
export const LOCAL_BRIDGE_PATH = "/__graview/local";

/** GET — is the door open on this machine, and what is behind it? */
export type LocalBridgeStatus =
  | { readonly available: true; readonly version: string }
  | { readonly available: false; readonly reason: string };

/** POST — words, and photographs as base64 data URLs. */
export interface LocalBridgeAsk {
  readonly prompt: string;
  readonly photos?: readonly string[];
}

/** What comes back: what it said, or why there is nothing. */
export type LocalBridgeAnswer = { readonly text: string } | { readonly error: string };

/* ---------------------------------------------------- the decision door */

/**
 * THE DOOR A DECISION PROVIDER IS REACHED BY from a browser: the dev server
 * holds the key, the page holds the questions. Same three shapes as the
 * local door — a probe, an ask, an answer — and the same rule about who may
 * knock: the page this server serves, and nobody else.
 *
 * The key is read on the SERVER side from the environment, so it is never
 * in a bundle, a repo or the browser's storage: the person running
 * `pnpm dev` set it once, and the page never sees it.
 */
export const DECISION_BRIDGE_PATH = "/__graview/decide";

/** GET — is a decision provider reachable through this server, and which? */
export type DecisionBridgeStatus =
  | { readonly available: true; readonly model: string }
  | { readonly available: false; readonly reason: string };

/** POST — one state, a map of typed questions. The provider's own wire shape. */
export interface DecisionBridgeAsk {
  readonly state: unknown;
  readonly questions: Readonly<Record<string, unknown>>;
}

/** What comes back: the provider's answers under the same keys, or why not. */
export type DecisionBridgeAnswer =
  | {
      readonly answers: Readonly<Record<string, unknown>>;
      readonly usage?: { readonly input_tokens?: number; readonly output_tokens?: number };
    }
  | { readonly error: string; readonly status?: number };

/* ------------------------------------------------------ the model door */

/**
 * THE DOOR A HOST'S MODEL IS REACHED BY in development: the dev server
 * holds `ANTHROPIC_API_KEY` from the environment it was started in, the
 * page holds the words. GET says whether a key is there — and, when it is
 * not, how to set one, which is the only place that sentence is said: a
 * built page has no server here, so its probe finds nothing and its seat
 * says only what any product's says.
 */
export const AI_BRIDGE_PATH = "/__graview/ai";

/** GET — is a model reachable through this server, and if not, how to make it so. */
export type AiBridgeStatus =
  | { readonly configured: true; readonly model: string; readonly name: string }
  | { readonly configured: false; readonly howTo: string };

/** POST — a prompt in, as `Completion` takes it. */
export interface AiBridgeAsk {
  readonly prompt: string;
}

/** What comes back: the model's text, or why there is none. Never the key. */
export type AiBridgeAnswer = { readonly text: string } | { readonly error: string };
