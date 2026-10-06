import type { DescribedPart, DescribedProblem } from "@graview/core/describe";
import type { GuestProps } from "../protocol.js";

/*
 * WHAT A HOST AND A HEADLESS RUN SAY TO EACH OTHER (FR-95): text in, text
 * out. The host hands its isolate one script and one JSON string; the
 * isolate calls the script's entry with the string and hands back the
 * string it resolves with. Nothing else crosses — no object, no function —
 * so an isolate the host picked (workerd, a worker thread, a browser
 * worker) is all a run needs, and the host's own context never runs a line
 * of the view.
 */

/** The global function a headless script leaves for its isolate to call, once. */
export const HEADLESS_ENTRY = "graviewHeadless";

/** The global a headless script hands the view to, as a function, on its own last line: run at once. */
export const HEADLESS_VIEW = "graviewHeadlessView";

/** What a run is told, as the JSON text of `HeadlessPayload.input`. */
export interface HeadlessInput {
  /** What the view is shown: the seat's sight cut to its manifest (FR-91). */
  readonly props: GuestProps;
  /** What the view may ask for or bind a press to, by the name it uses: the manifest's acts. */
  readonly acts: readonly string[];
  /** The app's places, by slug. */
  readonly places: readonly string[];
  readonly limits: { readonly maxNodes: number; readonly messages: number; readonly pushMs: number };
}

/** What the view said, in order: every message the host would have heard. */
export interface HeadlessTranscript {
  /** Each batch of Remote DOM mutation records it sent. */
  readonly renders: readonly unknown[][];
  /** Its stylesheet, as it gave it. */
  readonly css?: string;
  /** The acts it asked for from its code. Nothing is applied in a headless run. */
  readonly asked: readonly { readonly name: string; readonly args: unknown }[];
  /** Where it asked to go. */
  readonly went: readonly ({ readonly record: string } | { readonly place: string })[];
  /** The view's own time, at the top of its script and over the push, as the isolate's clock says it. */
  readonly ms: number;
  /** What it wrote to the console, the first 50 lines. */
  readonly logs: readonly string[];
  /** How many messages it sent. */
  readonly messages: number;
}

/** Why a headless run says a view will not do. The live host's reasons (`WorkerViewFailure`), and two of its own. */
export type HeadlessFailureReason =
  | "manifest"
  | "source"
  | "refused"
  | "error"
  | "silent"
  | "nodes"
  | "flood"
  | "slow"
  /** It names an act its manifest does not: asked from its code, or bound to a press (`data-act`). */
  | "act"
  /** The host's isolate could not run it, or answered with something that is not an outcome. */
  | "isolate";

/** What an isolate answers, as the JSON text its entry resolves with. */
export type HeadlessOutcome =
  | {
      readonly ok: true;
      readonly transcript: HeadlessTranscript;
      /** What it drew, as the isolate read it. A host that has the transcript reads it again itself. */
      readonly drawn: { readonly parts: readonly DescribedPart[]; readonly problems: readonly DescribedProblem[] };
      /** How many names hardening took from the isolate's global, and whether it takes no new ones. */
      readonly hardening: { readonly removed: number; readonly sealed: boolean };
    }
  | { readonly ok: false; readonly reason: HeadlessFailureReason; readonly detail: string; readonly transcript?: HeadlessTranscript };
