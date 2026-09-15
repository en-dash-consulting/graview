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
