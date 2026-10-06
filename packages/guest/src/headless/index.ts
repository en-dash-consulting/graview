/*
 * RUN A WORKER VIEW HEADLESS, AND SAY WHAT IT DREW (FR-95):
 * `@graview/guest/headless`.
 *
 * Graview Cloud checks a chat's view before it applies it: does it run,
 * within its limits, against the proposer's own view of the app, and what
 * does it draw? This runs a view once, with no network and no DOM, and says
 * what it drew in the words `describePlace` says a place in (FR-89) — or
 * why it will not do, by the same reasons a page stops a view for (FR-94),
 * and two of its own: an act its manifest does not name, and an isolate
 * that could not run it.
 *
 * NEVER IN THE HOST'S OWN CONTEXT. The host supplies the isolate: `run` is
 * handed one script and one JSON string, loads the script into an isolate
 * of its choosing — a workerd isolate with no outbound network (Cloud's
 * Worker Loader), a browser worker, a worker thread's fresh context
 * (`@graview/guest/headless/node`) — calls its entry with the string, and
 * hands back the string the entry resolves with. Nothing but text crosses.
 * There is no default: without a `run`, this throws rather than run a line
 * of the view where the host's own credentials, network and data are.
 *
 * What the isolate says is not taken on its word: the host judges the
 * transcript again here — the view's messages held to its limits and
 * manifest, its drawing drawn by the open kit's own renderer into a tree of
 * plain objects, and said as a place is said.
 */
import type { AnySchema, Principal, Store } from "@graview/core";
import type { PlaceDescription } from "@graview/core/describe";
import { checkManifest, manifestActs, workerViewProps, type WorkerViewManifest } from "../host/manifest.js";
import type { GuestViewInput } from "../host/session.js";
import { checkViewSource } from "../host/view-source.js";
import type { WorkerViewLimits } from "../host/view.js";
import type { GuestPlace, GuestProps, GuestTheme } from "../protocol.js";
import { judgeTranscript } from "./judge.js";
import { HEADLESS_ENTRY, HEADLESS_VIEW, type HeadlessFailureReason, type HeadlessInput, type HeadlessTranscript } from "./protocol.js";
import { HEADLESS_RUNTIME } from "./runtime.generated.js";

export { describeDrawing } from "./describe.js";
export type { DescribeDrawingContext, DescribedDrawing } from "./describe.js";
export { drawTranscript } from "./draw.js";
export type { DrawnTranscript } from "./draw.js";
export { judgeTranscript, sayRefusal } from "./judge.js";
export type { Judged } from "./judge.js";
export { HEADLESS_ENTRY, HEADLESS_VIEW } from "./protocol.js";
export type { HeadlessFailureReason, HeadlessInput, HeadlessOutcome, HeadlessTranscript } from "./protocol.js";
export { createTree, TreeDocument, TreeElement, TreeText } from "./tree.js";

/**
 * WHAT THE HOST'S ISOLATE IS HANDED. Load `script` into the isolate as code
 * (a classic script, or the body of a module), call the global function it
 * leaves under the name `entry` with `input`, once, and hand back the
 * string it resolves with. Stop the isolate past `timeoutMs`.
 */
export interface HeadlessPayload {
  /** The headless runtime, then the view: one strict script that loads nothing. */
  readonly script: string;
  /** The global the script leaves: call it once with `input`. */
  readonly entry: typeof HEADLESS_ENTRY;
  /** What the view is shown and held to, as JSON text. Pass it through untouched. */
  readonly input: string;
  /** How long the isolate may run, in milliseconds, before the host stops it. */
  readonly timeoutMs: number;
}

/**
 * THE HOST'S ISOLATE: run a payload where the host's own context is not.
 * Resolve with the text the entry resolved with. Reject when the isolate
 * stopped it; an error whose `reason` is `"slow"` says it ran past
 * `timeoutMs`, any other says the isolate could not run it.
 */
export type HeadlessRun = (payload: HeadlessPayload) => Promise<string>;

/** The script a host's isolate runs for a view's source: the headless runtime, then the view, as a function handed to it at once. */
export function headlessScript(source: string): string {
  return `${HEADLESS_RUNTIME}\n;${HEADLESS_VIEW}(function (graview) {\n"use strict";\n${source}\n});\n`;
}

/** The limits a headless run holds a view to: a page's (FR-94), and how long the isolate may take at all. */
export interface HeadlessLimits extends Pick<WorkerViewLimits, "maxSourceBytes" | "maxNodes" | "messages" | "pushMs"> {
  /** How long the whole run may take in the isolate, loading included, in milliseconds. 5 000 by default. */
  readonly runMs?: number;
}

export interface RunWorkerViewHeadlessOptions<S extends AnySchema> {
  /** The view: its manifest, and its plain source against the `graview` global (FR-96). */
  readonly manifest: WorkerViewManifest;
  readonly source: string;
  /** The store, seated as the one principal the view is run for: it is handed their sight, cut to its manifest (FR-91). */
  readonly store: Store<S>;
  readonly principal: Principal;
  /** The isolate the host picked. Required: there is no in-process fallback. */
  readonly run: HeadlessRun;
  /** Where the view is drawn: the record, or the members, a face would hand it. Every member the seat sees by default. */
  readonly input?: GuestViewInput;
  /** The app's look. A light one in the framework's own colours by default. */
  readonly theme?: GuestTheme;
  /** The app's named places, which the view may link to (FR-93). */
  readonly places?: readonly GuestPlace[];
  readonly limits?: HeadlessLimits;
  /**
   * The width it is said at, in CSS pixels, as `describePlace` takes it:
   * 1440 by default. Nothing is laid out headless, so it changes the words
   * "phone" and "wide", never what is listed.
   */
  readonly width?: number;
}

/** Why a view will not do, and a sentence saying it. */
export interface HeadlessFailure {
  readonly ok: false;
  readonly reason: HeadlessFailureReason;
  readonly detail: string;
  /** What it sent before it was stopped, when it got that far. */
  readonly transcript?: HeadlessTranscript;
}

/** What a view drew for one seat, said as a place is said. */
export interface HeadlessDescribed {
  readonly ok: true;
  /** In `describePlace`'s shape (FR-89), drawn by `view:<name>`. */
  readonly description: PlaceDescription;
  /** What it was shown. */
  readonly props: GuestProps;
  /** What it sent: every batch it drew, its stylesheet, the acts it asked for and where it asked to go. */
  readonly transcript: HeadlessTranscript;
}

export type HeadlessResult = HeadlessDescribed | HeadlessFailure;

/** The framework's own look, light, for a run that is handed none. */
export const HEADLESS_THEME: GuestTheme = {
  scheme: "light",
  accent: "#2f7d8c",
  ground: "#f6f8f9",
  panel: "#ffffff",
  ink: "#14212b",
  inkMuted: "#4f6470",
  edge: "rgba(20, 33, 43, 0.14)",
  fontBody: "system-ui, sans-serif",
  fontMono: "ui-monospace, monospace",
};

const failed = (reason: HeadlessFailureReason, detail: string, transcript?: HeadlessTranscript): HeadlessFailure => ({ ok: false, reason, detail, ...(transcript ? { transcript } : {}) });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const REASONS: readonly HeadlessFailureReason[] = ["manifest", "source", "refused", "error", "silent", "nodes", "flood", "slow", "act", "isolate"];

/** A transcript as an isolate said it, held to its shape: anything else is no transcript. */
function transcriptOf(value: unknown): HeadlessTranscript | undefined {
  if (!isRecord(value)) return undefined;
  const { renders, css, asked, went, ms, logs, messages } = value;
  if (!Array.isArray(renders) || !renders.every(Array.isArray) || !Array.isArray(asked) || !Array.isArray(went) || !Array.isArray(logs)) return undefined;
  if (typeof ms !== "number" || typeof messages !== "number" || (css !== undefined && typeof css !== "string")) return undefined;
  return {
    renders: renders as unknown[][],
    ...(typeof css === "string" ? { css } : {}),
    asked: asked.filter(isRecord).map((one) => ({ name: String(one["name"]), args: one["args"] })),
    went: went.filter(isRecord).flatMap((one): HeadlessTranscript["went"][number][] => (typeof one["record"] === "string" ? [{ record: one["record"] }] : typeof one["place"] === "string" ? [{ place: one["place"] }] : [])),
    ms,
    logs: logs.map(String).slice(0, 50),
    messages,
  };
}

/** The seat a description is for, said as `describePlace` says it. */
const seatOf = (principal: Principal) => (principal.kind === "system" ? "the system" : (principal.roles ?? []).length > 0 ? (principal.roles ?? []).join(", ") : principal.kind);
const slugOf = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * RUN A WORKER VIEW ONCE, HEADLESS, IN THE HOST'S ISOLATE, AND SAY WHAT IT
 * DREW FOR ONE SEAT. The manifest is checked against the app and the
 * source against what a view may say before anything runs; the view is
 * handed the seat's sight cut to its manifest; what comes back is judged
 * here, in the host's context, from the transcript alone.
 */
export async function runWorkerViewHeadless<S extends AnySchema>(options: RunWorkerViewHeadlessOptions<S>): Promise<HeadlessResult> {
  if (typeof options.run !== "function") {
    throw new TypeError("runWorkerViewHeadless runs a view only in an isolate the host supplies (`run`); it never runs one in the host's own context.");
  }
  const { manifest, source, store, principal } = options;
  const limits = {
    maxSourceBytes: options.limits?.maxSourceBytes ?? 256_000,
    maxNodes: options.limits?.maxNodes ?? 5_000,
    messages: options.limits?.messages ?? 120,
    pushMs: options.limits?.pushMs ?? 1_000,
    runMs: options.limits?.runMs ?? 5_000,
  };
  const findings = checkManifest(manifest, store);
  if (findings.length > 0) return failed("manifest", findings.join(" "));
  if (typeof source !== "string") return failed("source", "A view's source is text.");
  if (new TextEncoder().encode(source).length > limits.maxSourceBytes) return failed("source", `Its code is longer than the ${limits.maxSourceBytes.toLocaleString("en-US")} bytes a view may be.`);
  const unloadable = checkViewSource(source);
  if (unloadable.length > 0) return failed("source", unloadable.join(" "));

  const places = options.places ?? [];
  const props = workerViewProps(store, principal, { manifest, ...(options.input ? { input: options.input } : {}), theme: options.theme ?? HEADLESS_THEME, places });
  const input: HeadlessInput = {
    props,
    acts: manifestActs(manifest).map((one) => one.as ?? one.act),
    places: places.map((place) => place.as),
    limits: { maxNodes: limits.maxNodes, messages: limits.messages, pushMs: limits.pushMs },
  };

  /* The isolate, the host's: past `runMs` it is stopped, whatever its runner does. */
  let text: string;
  let stop: ReturnType<typeof setTimeout> | undefined;
  try {
    const ran = options.run({ script: headlessScript(source), entry: HEADLESS_ENTRY, input: JSON.stringify(input), timeoutMs: limits.runMs });
    const late = new Promise<never>((_, reject) => {
      stop = setTimeout(() => reject(Object.assign(new Error("past runMs"), { reason: "slow" })), limits.runMs + 1_000);
    });
    text = await Promise.race([ran, late]);
  } catch (error) {
    if (isRecord(error) && error["reason"] === "slow") return failed("slow", `It ran longer than the ${limits.runMs.toLocaleString("en-US")} ms a headless run may take.`);
    return failed("isolate", `The isolate could not run it: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (stop !== undefined) clearTimeout(stop);
  }

  let outcome: unknown;
  try {
    outcome = JSON.parse(String(text));
  } catch {
    return failed("isolate", "The isolate answered with something that is not an outcome.");
  }
  if (!isRecord(outcome)) return failed("isolate", "The isolate answered with something that is not an outcome.");
  const transcript = transcriptOf(outcome["transcript"]);
  if (outcome["ok"] !== true) {
    const reason = REASONS.includes(outcome["reason"] as HeadlessFailureReason) ? (outcome["reason"] as HeadlessFailureReason) : "isolate";
    return failed(reason, typeof outcome["detail"] === "string" ? outcome["detail"].slice(0, 2_000) : "It failed, and the isolate did not say why.", transcript);
  }
  if (!transcript) return failed("isolate", "The isolate answered without what the view sent.");

  /* Judged again here, from the transcript alone. */
  const judged = judgeTranscript(transcript, input);
  if (!judged.ok) return failed(judged.reason, judged.detail, transcript);
  const title = manifest.title ?? manifest.name;
  const slug = manifest.title ? slugOf(manifest.title) : manifest.name;
  const kind = manifest.attach === "home" ? null : manifest.attach;
  const description: Omit<PlaceDescription, "text"> = {
    place: { slug: manifest.attach === "home" ? "home" : slug, title, kind, address: manifest.attach === "home" ? "/" : `/places/${encodeURIComponent(slug)}` },
    seat: seatOf(principal),
    width: options.width ?? 1440,
    variant: (options.width ?? 1440) < 640 ? "phone" : "wide",
    drawnBy: `view:${manifest.name}`,
    parts: judged.parts,
    problems: judged.problems,
  };
  const { placeText } = await import("@graview/core/describe");
  return { ok: true, description: { ...description, text: placeText(description) }, props, transcript };
}
