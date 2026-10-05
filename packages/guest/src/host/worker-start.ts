import { GUEST_PROTOCOL, isGuestReady, type HostHello } from "../protocol.js";
import { mintNonce } from "./nonce.js";
import type { GuestLimiter } from "./session.js";

/**
 * Where a worker guest's code comes from: a URL the host already holds (a
 * `blob:` URL, typically), or the script's text, which the host makes into
 * a `blob:` URL itself. A chat's widget receives the text through a tool
 * call and never fetches it.
 */
export type GuestWorkerSource = { readonly url: string } | { readonly script: string };

/** Why the worker is not running, as the watchdog and the start say it. */
export type WorkerStop = "refused" | "silent";

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
  /** It never started, or stopped answering: it has been stopped. `detail` is the engine's own words, when it gave some. */
  readonly onStop: (reason: WorkerStop, detail?: string) => void;
  /** It threw, uncaught, after it said ready: the engine's words for it. */
  readonly onError?: (detail: string) => void;
}

/**
 * START A CLASSIC WORKER AND WATCH IT (FR-68): never `type: "module"`,
 * which a `blob:` URL in an opaque origin cannot start; one `guest-ready`,
 * answered with a fresh nonce and a MessageChannel; and, once it is ready,
 * a heartbeat its runtime must answer, so a worker whose event loop is
 * blocked is stopped. Shared by the kit's guest (`mountGuestWorker`) and the
 * open kit's view (`mountWorkerView`).
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

  const stop = () => {
    if (stopped) return;
    stopped = true;
    port?.close();
    worker?.terminate();
    worker = undefined;
    window.clearTimeout(silence);
    window.clearInterval(watchdog);
    if (made) window.URL.revokeObjectURL(made);
  };
  const halt = (reason: WorkerStop, detail?: string) => {
    if (stopped) return;
    stop();
    options.onStop(reason, detail);
  };

  const begin = () => {
    window.clearTimeout(silence);
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
  } catch {
    worker = undefined;
  }
  if (!worker) {
    queueMicrotask(() => halt("refused"));
  } else {
    silence = window.setTimeout(() => halt("silent"), options.readyMs);
    worker.onerror = (event: ErrorEvent) => {
      const said = typeof event.message === "string" && event.message !== "" ? event.message : undefined;
      if (!ready) halt("refused", said);
      else options.onError?.(said ?? "an error");
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
