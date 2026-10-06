/*
 * AN ISOLATE FOR A HEADLESS RUN, IN NODE (FR-95): `@graview/guest/headless/node`.
 *
 * The reference `run` for `runWorkerViewHeadless`, for tests, for
 * `graview view check`, and for a Node host that has nothing better. Each
 * run gets a worker thread of its own, with a memory ceiling, and in it a
 * fresh V8 context made from nothing: the language's own globals and no
 * others — no `process`, no `require`, no `fetch`, no sockets, no timers —
 * with code from strings and WebAssembly refused. The script is run there
 * with a deadline that covers the microtasks it queues, and only text comes
 * back. Past the deadline the context is abandoned and the thread ended.
 *
 * A context is not a security boundary in Node's own words, and this does
 * not lean on it alone: nothing of the thread's is put into the context to
 * be climbed back out of, the view is hardened inside it as a worker's
 * would be, and the thread is ended when the run is done. A host that runs
 * views it did not write, at scale, should run them in an isolate built
 * for it — workerd with no outbound network is what Graview Cloud uses.
 */
import { Worker } from "node:worker_threads";
import type { HeadlessPayload, HeadlessRun } from "./index.js";

export interface NodeIsolateOptions {
  /** The thread's heap ceiling, in megabytes. 128 by default. */
  readonly maxHeapMb?: number;
}

/** What runs in the thread: the context, the script, the entry called once, and text back. */
const THREAD = `
const { parentPort, workerData } = require("node:worker_threads");
const vm = require("node:vm");
const { script, entry, input, timeoutMs } = workerData;
const deadline = Date.now() + timeoutMs;
const left = () => Math.max(1, deadline - Date.now());
const context = vm.createContext(Object.create(null), {
  name: "graview headless view",
  codeGeneration: { strings: false, wasm: false },
  microtaskMode: "afterEvaluate",
});
try {
  vm.runInContext(script, context, { timeout: left(), filename: "graview-headless-view.js" });
  const read = vm.runInContext(
    "(function () { var out; var run = globalThis[" + JSON.stringify(entry) + "]; if (typeof run === 'function') run(" + JSON.stringify(input) + ").then(function (text) { out = text; }); return function () { return out; }; })()",
    context,
    { timeout: left() },
  );
  const text = read();
  parentPort.postMessage(typeof text === "string" ? { ok: true, text } : { ok: false, reason: "isolate", error: "The view's run did not finish: it waits on something a headless run never gives it." });
} catch (error) {
  const late = error !== null && typeof error === "object" && error.code === "ERR_SCRIPT_EXECUTION_TIMEOUT";
  parentPort.postMessage({ ok: false, reason: late ? "slow" : "isolate", error: late ? "It ran past its deadline." : String(error && typeof error === "object" && "message" in error ? error.message : error).slice(0, 500) });
}
`;

/** A `run` that gives each headless run a worker thread and a fresh, empty context of its own. */
export function nodeIsolate(options: NodeIsolateOptions = {}): HeadlessRun {
  return (payload: HeadlessPayload) =>
    new Promise<string>((resolve, reject) => {
      const worker = new Worker(THREAD, {
        eval: true,
        workerData: { script: payload.script, entry: payload.entry, input: payload.input, timeoutMs: payload.timeoutMs },
        resourceLimits: { maxOldGenerationSizeMb: options.maxHeapMb ?? 128 },
        env: {},
        stdout: true,
        stderr: true,
      });
      let done = false;
      const end = (settle: () => void) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        void worker.terminate();
        settle();
      };
      const refuse = (reason: "slow" | "isolate", message: string) => end(() => reject(Object.assign(new Error(message), { reason })));
      /* The thread's own deadline covers the script and its microtasks; this one covers a thread that never answers. */
      const timer = setTimeout(() => refuse("slow", "It ran past its deadline."), payload.timeoutMs + 500);
      worker.once("message", (message: { ok: boolean; text?: string; reason?: "slow" | "isolate"; error?: string }) => {
        if (message.ok && typeof message.text === "string") end(() => resolve(message.text!));
        else refuse(message.reason === "slow" ? "slow" : "isolate", message.error ?? "The isolate could not run it.");
      });
      worker.once("error", (error) => refuse("isolate", (error as { code?: string }).code === "ERR_WORKER_OUT_OF_MEMORY" ? "It used more memory than a headless run may." : error.message));
      worker.once("exit", () => refuse("isolate", "The isolate stopped before it answered."));
    });
}
