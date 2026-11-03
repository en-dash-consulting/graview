import type { HeadlessPayload, HeadlessRun } from "./index.js";

/*
 * AN ISOLATE FOR A HEADLESS RUN, IN A PAGE (Roadmap f-make-any-page-better):
 * the `run` a page hands `runWorkerViewHeadless` to press a draft's controls
 * before anybody sees it. Each run gets a dedicated worker of its own, made
 * from the script and nothing else, and is ended when it answers or when
 * its deadline passes. A worker shares nothing with the page but the text
 * it is handed and the text it hands back.
 */

/**
 * What runs in the worker before the script: the answer's door, set while
 * the worker's global can still be written — the runtime hardens it — and
 * the entry the script leaves called once with its input, its text posted back.
 */
const ANSWER = (entry: string) => `
;(function () {
  var post = self.postMessage.bind(self);
  self.addEventListener("message", function (event) {
    var run = self[${JSON.stringify(entry)}];
    if (typeof run !== "function") return post({ ok: false, error: "The view's run did not start." });
    Promise.resolve(run(event.data)).then(
      function (text) { post(typeof text === "string" ? { ok: true, text: text } : { ok: false, error: "The view's run did not finish." }); },
      function (error) { post({ ok: false, error: String(error && error.message ? error.message : error).slice(0, 500) }); }
    );
  });
})();
`;

/** A `run` that gives each headless run a worker of its own in this page. */
export function browserIsolate(): HeadlessRun {
  return (payload: HeadlessPayload) =>
    new Promise<string>((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([ANSWER(payload.entry), payload.script], { type: "text/javascript" }));
      let worker: Worker;
      try {
        worker = new Worker(url);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(Object.assign(new Error(error instanceof Error ? error.message : "The isolate could not start."), { reason: "isolate" }));
        return;
      }
      let done = false;
      const end = (settle: () => void) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        worker.terminate();
        URL.revokeObjectURL(url);
        settle();
      };
      const timer = setTimeout(() => end(() => reject(Object.assign(new Error("It ran past its deadline."), { reason: "slow" }))), payload.timeoutMs + 500);
      worker.onmessage = (event: MessageEvent<{ ok: boolean; text?: string; error?: string }>) => {
        const answer = event.data;
        if (answer.ok && typeof answer.text === "string") end(() => resolve(answer.text!));
        else end(() => reject(Object.assign(new Error(answer.error ?? "The isolate could not run it."), { reason: "isolate" })));
      };
      worker.onerror = (event) => end(() => reject(Object.assign(new Error(event.message || "The isolate could not run it."), { reason: "isolate" })));
      worker.postMessage(payload.input);
    });
}
