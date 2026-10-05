import type { AnySchema, Principal, Store } from "@graview/core";
import type { GuestDomEvent } from "../protocol.js";
import type { OpenDrawing, ViewRefusal } from "./open-draw.js";
import { createGuestHost, createGuestLimiter, type GuestHost, type GuestLimits, type GuestStats, type GuestViewInput } from "./session.js";
import { startWorker, type GuestWorkerSource, type StartedWorker } from "./worker-start.js";

/** Why a worker view is not shown, for a host that draws something else in its place. */
export type WorkerViewFailure =
  /** The page's policy refused the worker, or it failed before it said ready. */
  | "refused"
  /** It never said ready in `readyMs`, or its runtime went `silentMs` without answering the host's heartbeat. */
  | "silent"
  /** It drew more than `maxNodes`. */
  | "budget";

export interface WorkerViewLimits extends GuestLimits {
  /** The most nodes the view may draw at once. 5 000 by default. */
  readonly maxNodes?: number;
  /** How long it has to say ready, in milliseconds. 5 000 by default. */
  readonly readyMs?: number;
  /** How long its runtime may go without answering the host's heartbeat, once ready. 5 000 by default. */
  readonly silentMs?: number;
}

export interface MountWorkerViewOptions<S extends AnySchema> {
  /** The view's code: a classic script, its runtime first (`@graview/guest/worker/view`). */
  readonly worker: GuestWorkerSource;
  /** The view's name: what the rail says an act came through (`via: "view:<name>"`). */
  readonly view: string;
  readonly store: Store<S>;
  /** The viewer: what is pushed is what they may see, and what is asked for is applied as them. */
  readonly principal: Principal;
  /** What is drawn where the view is. */
  readonly input?: () => GuestViewInput;
  readonly onNavigate?: (id: string) => void;
  readonly limits?: WorkerViewLimits;
  /** The view is not going to be shown, and why. */
  readonly onFailure?: (reason: WorkerViewFailure, detail?: string) => void;
  /** The region's accessible name. The view's name by default. */
  readonly title?: string;
  /** The page's origin, for a `blob:` image of its own. `location.origin` by default. */
  readonly origin?: string;
}

export interface WorkerView {
  /** The region the host owns: the view is drawn in its shadow root. */
  readonly element: HTMLElement;
  readonly shadow: ShadowRoot;
  /** The worker, until it is stopped. */
  readonly worker: Worker | undefined;
  /** Push again: the view's input moved. */
  update(): void;
  readonly stats: Readonly<GuestStats>;
  /** What of the view's drawing and stylesheet was refused. */
  readonly refused: readonly ViewRefusal[];
  dispose(): void;
}

/**
 * MOUNT A WORKER VIEW ON THE OPEN KIT (FR-90).
 *
 * The view runs in a classic, hardened worker (FR-68–FR-71) and draws
 * plain HTML, SVG and one stylesheet; the host draws them into a shadow
 * root inside a region of its own — contained (`contain: layout paint
 * style`), isolated, clipped — keeping only what the open kit allows. What
 * could fetch or escape is not drawn, and is written down in `refused`.
 * The sanitiser is fetched the first time a view draws, so a page that
 * mounts none loads none of it.
 */
export function mountWorkerView<S extends AnySchema>(element: HTMLElement, options: MountWorkerViewOptions<S>): WorkerView {
  const document = element.ownerDocument;
  const window = document.defaultView! as Window & typeof globalThis;
  const region = document.createElement("div");
  region.className = "graview-worker-view";
  region.setAttribute("role", "region");
  region.setAttribute("aria-label", options.title ?? options.view);
  region.setAttribute("data-worker-view", options.view);
  /* Contained, isolated, clipped: nothing the view draws paints outside the region or stacks above the app (FR-90). */
  region.style.cssText = "display:block;position:relative;contain:layout paint style;isolation:isolate;overflow:clip;min-width:0";
  element.appendChild(region);
  const shadow = region.attachShadow({ mode: "open" });

  const stats: GuestStats = { applied: 0, refused: 0, dropped: 0 };
  const limiter = createGuestLimiter(options.limits);
  let session: GuestHost | undefined;
  let started: StartedWorker | undefined;
  let drawing: OpenDrawing | undefined;
  let failed = false;
  let counted: GuestStats = { applied: 0, refused: 0, dropped: 0 };
  /* What came before the drawing's module did: drawn, in order, once it has. */
  const waiting: (["render", unknown] | ["style", string])[] = [];
  const tally = () => {
    if (!session) return;
    const now = session.stats;
    stats.applied += now.applied - counted.applied;
    stats.refused += now.refused - counted.refused;
    stats.dropped += now.dropped - counted.dropped;
    counted = { ...now };
  };
  const stop = () => {
    tally();
    session?.dispose();
    session = undefined;
    started?.stop();
  };
  const fail = (reason: WorkerViewFailure, detail?: string) => {
    if (failed) return;
    failed = true;
    stop();
    drawing?.dispose();
    options.onFailure?.(reason, detail);
  };

  let port: MessagePort | undefined;
  const send = (message: GuestDomEvent) => port?.postMessage(message);
  const draw = (one: ["render", unknown] | ["style", string]) => {
    if (failed) return;
    if (!drawing) return void waiting.push(one);
    if (one[0] === "render") drawing.apply(one[1]);
    else drawing.style(one[1]);
  };
  void import("./open-draw.js").then(({ createOpenDrawing }) => {
    if (failed) return;
    drawing = createOpenDrawing(shadow, {
      origin: options.origin ?? window.location.origin,
      ...(options.limits?.maxNodes !== undefined ? { maxNodes: options.limits.maxNodes } : {}),
      onOverBudget: () => fail("budget"),
      send,
    });
    for (const one of waiting.splice(0)) draw(one);
  });

  started = startWorker(window, {
    source: options.worker,
    name: options.view,
    limiter,
    readyMs: options.limits?.readyMs ?? 5_000,
    silentMs: options.limits?.silentMs ?? 5_000,
    onDropped: () => (stats.dropped += 1),
    onStop: (reason, detail) => fail(reason, detail),
    onReady: (nonce, given) => {
      port = given;
      const live = createGuestHost({
        store: options.store,
        principal: options.principal,
        view: options.view,
        nonce,
        send: (message) => given.postMessage(message),
        onRender: (records) => draw(["render", records]),
        onStyle: (css) => draw(["style", css]),
        ...(options.input ? { input: options.input } : {}),
        ...(options.onNavigate ? { onNavigate: options.onNavigate } : {}),
        ...(options.limits ? { limits: options.limits } : {}),
        limiter,
      });
      session = live;
      given.onmessage = (message) => {
        if (started?.answer(message.data)) return;
        live.receive(message.data);
        tally();
      };
      live.push();
    },
  });

  return {
    element: region,
    shadow,
    get worker() {
      return started?.worker;
    },
    update: () => session?.push(),
    get stats() {
      tally();
      return stats;
    },
    get refused() {
      return drawing?.refused ?? [];
    },
    dispose() {
      failed = true;
      stop();
      drawing?.dispose();
      region.remove();
    },
  };
}
