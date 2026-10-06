import { GUEST_PROTOCOL, isGuestReady, type HostHello } from "../protocol.js";
import { mintNonce } from "./nonce.js";
import type { GuestLimiter } from "./session.js";

/**
 * Where a worker guest's code comes from: a URL the host already holds (a
 * `blob:` URL, typically, or a script the host serves from its own origin),
 * or the script's text, which the host makes into a `blob:` URL itself. A
 * chat's widget receives the text through a tool call and never fetches it.
 */
export type GuestWorkerSource = { readonly url: string } | { readonly script: string };

/**
 * Why the worker is not running, as the start and the watchdog say it.
 * `start`: it never said ready — the page's policy refused it, it failed
 * before its first line ran, or `readyMs` passed. `silent`: it said ready,
 * then went `silentMs` without answering the heartbeat.
 */
export type WorkerStop = "start" | "silent";

export interface StartedWorker {
  readonly worker: Worker | undefined;
  /** Whether a port message was the runtime's answer to a heartbeat (and so not the session's). */
  answer(data: unknown): boolean;
  /** Terminate it, close the port, and stop watching. */
  stop(): void;
}

export interface StartWorkerOptions {
  readonly source: GuestWorkerSource;
  /** The worker's name: the view's. */
  readonly name: string;
  readonly limiter: GuestLimiter;
  /** How long it has to say ready. */
  readonly readyMs: number;
  /** How long its runtime may go without answering a heartbeat, once ready. */
  readonly silentMs: number;
  /** A message to the worker's owner that was not one ready: dropped, and counted. */
  readonly onDropped: () => void;
  /** It said ready: here is its nonce and the host's end of its port, the hello already sent. */
  readonly onReady: (nonce: string, port: MessagePort) => void;
  /**
   * It never started (`start`), or stopped answering (`silent`): it has
   * been stopped, and this is said once. `detail` says why it did not
   * start: the directive the page's policy lacks, the engine's own words,
   * or the time it was given.
   */
  readonly onStop: (reason: WorkerStop, detail?: string) => void;
  /** It threw, uncaught, after it said ready: the engine's words for it. */
  readonly onError?: (detail: string) => void;
}

/*
 * WHAT A PAGE'S POLICY MUST ALLOW (FR-102). The engines refuse a worker
 * three ways: Chromium and WebKit throw a SecurityError from `new Worker`;
 * Firefox makes the worker, fires `securitypolicyviolation` on the document
 * and then `error` on the worker with no message. The directive is
 * `worker-src`, or `script-src` on a page with no `worker-src`, or
 * `default-src` on a page with neither.
 */
const warned = new WeakSet<object>();

/** The source a refused URL needed: `blob:` for a `blob:` URL, else the URL's origin. */
function sourceOf(url: string, window: Window): string {
  if (url.startsWith("blob:")) return "blob:";
  try {
    return new URL(url, window.location.href).origin;
  } catch {
    return url;
  }
}

/** The sentence for a start the page's policy refused; the page's console is told once, however many views it refuses. */
function refusedByPolicy(window: Window, url: string, directive?: string): string {
  const source = sourceOf(url, window);
  const said = `this page's Content-Security-Policy${directive ? ` (${directive})` : ""} does not allow a worker from ${source}: it needs worker-src ${source}`;
  if (!warned.has(window)) {
    warned.add(window);
    (window as Window & { console?: Console }).console?.warn?.(
      `Graview: worker views cannot start on this page, because ${said}. A host that will not allow ${source} serves each view's whole script from its own origin and passes worker: { url } (the @graview/guest README, "What the host page allows").`,
    );
  }
  return said;
}

/** Whether a policy violation is about this worker's URL: a `blob:` URL is reported as its scheme alone. */
function aboutUrl(blocked: string, url: string): boolean {
  if (blocked === "") return true;
  if (url.startsWith("blob:")) return blocked.startsWith("blob");
  return url.startsWith(blocked) || blocked.startsWith(url);
}

/**
 * START A CLASSIC WORKER AND WATCH IT (FR-68): never `type: "module"`,
 * which a `blob:` URL in an opaque origin cannot start; one `guest-ready`,
 * answered with a fresh nonce and a MessageChannel; and, once it is ready,
 * a heartbeat its runtime must answer, so a worker whose event loop is
 * blocked is stopped. Shared by the kit's guest (`mountGuestWorker`) and the
 * open kit's view (`mountWorkerView`).
 *
 * A WORKER THAT DOES NOT START SAYS `start` (FR-102), once: `new Worker`
 * threw, it erred before it said ready, or `readyMs` passed with no ready.
 * Each runtime says ready before a line of the guest runs, so no ready is
 * no start. When the page's policy was the cause — a SecurityError, or a
 * `securitypolicyviolation` the page reported for it — the sentence names
 * the directive it lacks.
 */
export function startWorker(window: Window & typeof globalThis, options: StartWorkerOptions): StartedWorker {
  const made = "script" in options.source ? window.URL.createObjectURL(new window.Blob([options.source.script], { type: "text/javascript" })) : undefined;
  const url = "script" in options.source ? made! : options.source.url;
  let worker: Worker | undefined;
  let port: MessagePort | undefined;
  let ready = false;
  let stopped = false;
  let silence = 0;
  let watchdog = 0;
  let nonce = "";
  let beat = 0;
  let answered = 0;
  const clock = window.performance;
  let heard = clock.now();

  /* A policy violation on the page while this worker starts: Firefox's one sign that the policy, not the script, refused it. */
  let violated: string | undefined;
  const violation = (event: Event) => {
    const said = event as Event & { effectiveDirective?: string; violatedDirective?: string; blockedURI?: string };
    const directive = String(said.effectiveDirective || said.violatedDirective || "").split(" ")[0]!;
    if (!/^(worker-src|script-src|script-src-elem|child-src|default-src)$/.test(directive)) return;
    if (aboutUrl(String(said.blockedURI ?? ""), url)) violated = directive;
  };
  const page = window.document;
  page?.addEventListener("securitypolicyviolation", violation);
  const unhear = () => page?.removeEventListener("securitypolicyviolation", violation);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    port?.close();
    worker?.terminate();
    worker = undefined;
    window.clearTimeout(silence);
    window.clearInterval(watchdog);
    unhear();
    if (made) window.URL.revokeObjectURL(made);
  };
  const halt = (reason: WorkerStop, detail?: string) => {
    if (stopped) return;
    stop();
    options.onStop(reason, detail);
  };

  const begin = () => {
    window.clearTimeout(silence);
    unhear();
    nonce = mintNonce();
    const channel = new window.MessageChannel();
    port = channel.port1;
    /*
     * THE WATCHDOG. The host asks on an interval, and the worker's runtime
     * answers with the beat and the nonce. An answer is not a request: it
     * spends none of the guest's message allowance.
     */
    const silentMs = Math.max(1, options.silentMs);
    const every = Math.max(10, Math.min(1_000, Math.floor(silentMs / 4)));
    heard = clock.now();
    let ticked = heard;
    watchdog = window.setInterval(() => {
      const at = clock.now();
      /* The host's own page was held up: that time is not the guest's silence. */
      if (at - ticked > every * 2) heard += at - ticked - every;
      ticked = at;
      if (at - heard >= silentMs) return halt("silent");
      beat += 1;
      channel.port1.postMessage({ type: "heartbeat", beat });
    }, every);
    const hello: HostHello = { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce, view: options.name };
    worker!.postMessage(hello, [channel.port2]);
    options.onReady(nonce, channel.port1);
  };

  try {
    /* Classic, on purpose: a module worker from a blob: URL is refused in an opaque origin (Chromium), which is where a chat's widget runs. */
    worker = new window.Worker(url, { name: options.name });
  } catch (error) {
    worker = undefined;
    const thrown = error as { name?: unknown; message?: unknown } | null;
    const detail = thrown?.name === "SecurityError" ? refusedByPolicy(window, url, violated) : `the worker could not be made: ${String(thrown?.message ?? error)}`;
    queueMicrotask(() => halt("start", detail));
  }
  if (worker) {
    silence = window.setTimeout(() => halt("start", `it never said it was ready in ${options.readyMs.toLocaleString("en-US")} ms`), options.readyMs);
    worker.onerror = (event: ErrorEvent) => {
      const said = typeof event.message === "string" && event.message !== "" ? event.message : undefined;
      if (ready) return void options.onError?.(said ?? "an error");
      window.clearTimeout(silence);
      /* Decided a task later, so a violation the page reports after the error (the order is the engine's) is heard. */
      window.setTimeout(
        () =>
          !ready &&
          halt(
            "start",
            violated
              ? refusedByPolicy(window, url, violated)
              : said
                ? `it failed before it said ready: ${said}`
                : "it failed before it said ready, and the engine gave no reason (a page policy that refuses it, or a script that does not load)",
          ),
        0,
      );
    };
    worker.onmessage = (event: MessageEvent) => {
      /*
       * A worker's messages come from that worker alone. Its one message
       * here is `guest-ready`, said once: a worker is one realm for its
       * whole life, so a second ready is not a reload but a forgery.
       */
      if (!options.limiter.message() || ready || !isGuestReady(event.data) || event.data.protocol !== GUEST_PROTOCOL) {
        options.onDropped();
        return;
      }
      ready = true;
      begin();
    };
  }

  return {
    get worker() {
      return worker;
    },
    answer(data) {
      const said = data as { type?: unknown; nonce?: unknown; beat?: unknown } | null;
      if (typeof said !== "object" || said === null || said.type !== "heartbeat" || said.nonce !== nonce) return false;
      if (typeof said.beat === "number" && said.beat > answered && said.beat <= beat) {
        answered = said.beat;
        heard = clock.now();
      }
      return true;
    },
    stop,
  };
}
