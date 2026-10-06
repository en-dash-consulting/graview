/*
 * A HEADLESS RUN'S RUNTIME (FR-95): what runs INSIDE the isolate a host
 * picked, in front of the view.
 *
 * Bundled into one classic script (headless/runtime.generated.ts, by
 * scripts/guest-view-runtime.mjs), which `headlessScript(source)` puts in
 * front of a view's own source. Loaded into an isolate — a worker thread's
 * fresh context, a workerd isolate with no outbound network, a browser
 * worker — the script first makes the isolate the worker's: the same
 * `graview` global a worker's runtime makes (worker/view-global.ts), over a
 * transcript rather than a port; a console that writes to the transcript;
 * timers that never fire; and then everything outside the worker's
 * allowlist taken from the global (worker/harden.ts). Only then is the view
 * read, and its top line run. The script leaves one entry:
 *
 *   graviewHeadless(input)     the run: JSON text in (HeadlessInput), JSON text out (HeadlessOutcome)
 *
 * which pushes the view what it is shown, once, and holds what it sent to
 * its limits and manifest, drawn by the open kit's own renderer into a tree
 * of plain objects and said as a place is said (judge.ts).
 *
 * Nothing here reaches a network, and the isolate is what keeps the view
 * from one: the hardening is a second wall, not the first. A view can lie
 * to its own check — patch what the runtime reads after it, draw one thing
 * here and another in a page — so the host judges the transcript again in
 * its own context, and the check says what the view drew, never that it is
 * honest. What it may reach is the page's to hold, as it always is.
 */
import "@remote-dom/core/polyfill";
import type { GuestAnswer, GuestProps } from "../protocol.js";
import { harden, type Hardening } from "../worker/harden.js";
import { createViewRuntime, type GraviewView } from "../worker/view-global.js";
import { judgeTranscript } from "./judge.js";
import { HEADLESS_ENTRY, HEADLESS_VIEW, type HeadlessFailureReason, type HeadlessInput, type HeadlessOutcome, type HeadlessTranscript } from "./protocol.js";

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U[] : T[K] };

/* Taken before a line of the view runs: what the run builds with stays as it found it. */
const scope = globalThis as unknown as Record<string, unknown>;
const then = Promise.prototype.then;
const settled = Promise.resolve();
const microtask = (task: () => void) => void then.call(settled, task);
const performance = scope["performance"] as { now?: () => number } | undefined;
const clock: () => number = performance && typeof performance.now === "function" ? performance.now.bind(performance) : Date.now;
const stringify = JSON.stringify;
const parse = JSON.parse;
const define = Object.defineProperty;

const say = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 500);
/** Plain data for the transcript: what the view passed, with nothing of its that runs. */
const plain = (value: unknown): unknown => {
  try {
    return parse(stringify(value ?? null));
  } catch {
    return null;
  }
};

const transcript: Mutable<HeadlessTranscript> = { renders: [], asked: [], went: [], ms: 0, logs: [], messages: 0 };
let failure: { reason: HeadlessFailureReason; detail: string } | undefined;
const fail = (reason: HeadlessFailureReason, detail: string) => {
  failure ??= { reason, detail };
};
const log = (text: string) => {
  if (transcript.logs.length < 50) transcript.logs.push(text.slice(0, 500));
};

let hardened: Hardening = { removed: [], stuck: [], sealed: false };
const runtime = createViewRuntime({
  send(request) {
    transcript.messages += 1;
    if (request.type === "render") transcript.renders.push(plain(request.records) as unknown[]);
    else if (request.type === "style") transcript.css = String(request.css);
    else if (request.type === "navigate" && "place" in request) transcript.went.push({ place: String(request.place) });
  },
  act(name, args) {
    transcript.messages += 1;
    transcript.asked.push({ name: String(name), args: plain(args) });
    return Promise.resolve<GuestAnswer>({ type: "answer", id: transcript.asked.length, ok: false, reason: "refused", message: "Nothing is applied in a headless run." });
  },
  navigate(to) {
    transcript.messages += 1;
    transcript.went.push({ record: String(to) });
  },
  microtask,
  now: clock,
  threw: (error) => fail("error", `It threw: ${say(error)}`),
  warn: log,
  hardening: () => hardened,
});

let ran = false;
let viewed = false;

/** The view, run at once: its top line, timed, with anything it throws caught and said. */
function view(fn: unknown): void {
  if (viewed || typeof fn !== "function") return;
  viewed = true;
  if (failure) return;
  const began = clock();
  try {
    (fn as (graview: GraviewView) => void).call(undefined, runtime.view);
  } catch (error) {
    fail("error", `It threw: ${say(error)}`);
  }
  transcript.ms += clock() - began;
}

async function run(text: string): Promise<string> {
  if (ran) return stringify({ ok: false, reason: "refused", detail: "A headless script runs one view, once: something called its entry before the host did." } satisfies HeadlessOutcome);
  ran = true;
  let input: HeadlessInput;
  try {
    input = parse(String(text)) as HeadlessInput;
  } catch {
    return stringify({ ok: false, reason: "isolate", detail: "The run was not handed its input as JSON." } satisfies HeadlessOutcome);
  }
  if (!viewed && !failure) return stringify({ ok: false, reason: "isolate", detail: "The script held no view." } satisfies HeadlessOutcome);

  /* One push of what it is shown, timed with its top line. */
  const began = clock();
  if (!failure) runtime.hear({ type: "props", props: input.props as GuestProps, push: 1 });
  transcript.ms += clock() - began;
  if (transcript.ms >= input.limits.pushMs) fail("slow", `It took longer than ${input.limits.pushMs.toLocaleString("en-US")} ms to draw what it was shown.`);
  /* What it drew goes in microtasks: let them run, and anything it chained on them, a bounded number of turns. */
  for (let turn = 0; turn < 64 && !failure; turn += 1) await new Promise<void>((resolve) => microtask(resolve));
  if (failure) return stringify({ ok: false, ...failure, transcript } satisfies HeadlessOutcome);

  const judged = judgeTranscript(transcript, input);
  if (!judged.ok) return stringify({ ok: false, reason: judged.reason, detail: judged.detail, transcript } satisfies HeadlessOutcome);
  return stringify({ ok: true, transcript, drawn: { parts: judged.parts, problems: judged.problems }, hardening: { removed: hardened.removed.length, sealed: hardened.sealed } } satisfies HeadlessOutcome);
}

/*
 * THE ISOLATE, MADE THE WORKER'S, before the view's script is read. The
 * console writes to the transcript; timers never fire, since a headless run
 * is one push and what it drew; `graview` is the view's one global, beside
 * the two the script leaves; and then everything outside the worker's
 * allowlist goes and what is left stays as it is. Hardening comes first so
 * that a view whose text closes its own wrapper early runs after it all the
 * same. A name that will not go stops the run, and the view never runs.
 */
const console = Object.freeze({
  log: (...said: unknown[]) => log(said.map(String).join(" ")),
  info: (...said: unknown[]) => log(said.map(String).join(" ")),
  debug: (...said: unknown[]) => log(said.map(String).join(" ")),
  warn: (...said: unknown[]) => log(said.map(String).join(" ")),
  error: (...said: unknown[]) => log(said.map(say).join(" ")),
});
let timer = 0;
const never = () => (timer += 1);
const own: readonly (readonly [string, unknown])[] = [
  ["console", console],
  ["setTimeout", never],
  ["setInterval", never],
  ["clearTimeout", () => {}],
  ["clearInterval", () => {}],
  ["queueMicrotask", microtask],
  ["graview", runtime.view],
  [HEADLESS_VIEW, view],
  [HEADLESS_ENTRY, (text: string) => run(text)],
];
for (const [name, value] of own) define(scope, name, { value, writable: true, enumerable: false, configurable: true });
hardened = harden(globalThis, ["graview", HEADLESS_VIEW, HEADLESS_ENTRY], { primitivesStay: true });
if (hardened.stuck.length > 0) fail("refused", `This isolate could not be hardened: ${hardened.stuck.join(", ")} would not go.`);
