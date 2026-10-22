import type { DescribedPart, DescribedProblem } from "@graview/core/describe";
import type { GuestProps } from "../protocol.js";
import type { NamedPlace } from "../host/links-words.js";

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
  /** The fields files dropped on it go in: the manifest's accepts (FR-193). */
  readonly accepts?: readonly { readonly kind: string; readonly field: string }[];
  /** The `https:` origins the host lists for a view's images (WorkerViewOptions.images). */
  readonly imageOrigins?: readonly string[];
  /** The `https:` origins the host lists for a view's links beyond what it was handed (WorkerViewOptions.links). */
  readonly linkOrigins?: readonly string[];
  /** The live host says where the app's own images live (WorkerViewOptions.asset): an image by that path is drawn. */
  readonly assets?: boolean;
  /** The app's page's origin, so the page's own address for one of its images is that image. */
  readonly origin?: string;
  /** The app's places, by slug, each with its title: a view may name one by either. */
  readonly places: readonly NamedPlace[];
  /** The host did not hand the run the views it keeps: a titled view's place may be missing from `places`, so a name none of them is, is said as a doubt. */
  readonly placesUnsure?: boolean;
  /** The kinds' lists the seat sees, by their plural's slug and by the kind's name: where a view may go by name besides a place. */
  readonly lists?: readonly string[];
  readonly limits: { readonly maxNodes: number; readonly messages: number; readonly pushMs: number };
  /** Press what this selector matches, once it has drawn: the view hears the click as it would on a page (0.1.45). */
  readonly press?: { readonly selector: string };
}

/** What the view said, in order: every message the host would have heard. */
export interface HeadlessTranscript {
  /** Each batch of Remote DOM mutation records it sent. */
  readonly renders: readonly unknown[][];
  /** Its stylesheets, every one it gave, in order, as it gave them. */
  readonly sheets?: readonly string[];
  /** The acts it asked for from its code. Nothing is applied in a headless run. */
  readonly asked: readonly { readonly name: string; readonly args: unknown }[];
  /** Where it asked to go: narrowed (`where`) and to a section, as it asked. */
  readonly went: readonly ({ readonly record: string; readonly where?: unknown; readonly section?: string } | { readonly place: string; readonly where?: unknown; readonly section?: string })[];
  /** The view's own time, at the top of its script and over the push, as the isolate's clock says it. */
  readonly ms: number;
  /** What it wrote to the console, the first 50 lines. */
  readonly logs: readonly string[];
  /** How many messages it sent. */
  readonly messages: number;
  /** Where it listens for a wheel, a drag or a pinch, as it last said it (0.1.42). */
  readonly gestures?: readonly { readonly event: string; readonly selector: string }[];
  /** The ids of what it drew that a `graview.on("click", selector)` of its matches, once it had drawn and before any press. */
  readonly clicks?: readonly string[];
  /**
   * The press the run was asked to make (0.1.45): its selector, the id of
   * the element it matched (none when it matched nothing), and how many
   * acts asked, places gone to and batches drawn there were before it, so
   * what came after is what the press did.
   */
  readonly pressed?: { readonly selector: string; readonly target?: string; readonly asked: number; readonly went: number; readonly renders: number };
}

/**
 * Why a headless run says a view will not do: the live host's reasons
 * (`WorkerViewFailure`) but `start`, which a run with no worker to start
 * cannot meet; `refused`, the isolate's own refusal to run it; and two more.
 */
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
