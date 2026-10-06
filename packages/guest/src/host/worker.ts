import type { AnySchema, Principal, Store } from "@graview/core";
import type { Kit } from "../kit.js";
import { createKitRenderer, GUEST_KIT_CSS, type KitLinks, type KitRefusal, type KitRenderer } from "./kit.js";
import { createGuestHost, createGuestLimiter, type GuestHost, type GuestLimits, type GuestStats, type GuestViewInput } from "./session.js";
import { startWorker, type GuestWorkerSource, type StartedWorker } from "./worker-start.js";
import { createDrawBudget } from "./draw-budget.js";

export type { GuestWorkerSource } from "./worker-start.js";

/** Why a worker guest is not shown, for a host that falls back to something else. */
export type GuestWorkerFailure =
  /** The page's policy refused the worker, or it failed before it said ready. */
  | "refused"
  /**
   * It never said ready in `readyMs`, or after it did, its runtime went
   * `silentMs` without answering the host's heartbeat: its event loop is
   * blocked (a `while (true)`), and it was stopped.
   */
  | "silent"
  /** It drew more than `maxNodes`; it was stopped. */
  | "budget"
  /** What it sent took the page longer than `drawMs` of a second to draw; it was stopped, and the rest left undrawn. */
  | "slow";

export interface MountGuestWorkerOptions<S extends AnySchema> {
  readonly worker: GuestWorkerSource;
  /** The view's registered name: what the rail says an act came through (`via: "view:<name>"`). */
  readonly view: string;
  readonly store: Store<S>;
  /** The viewer: what is pushed is what they may see, and what is asked for is applied as them. */
  readonly principal: Principal;
  /** What is drawn where the guest is. */
  readonly input?: () => GuestViewInput;
  readonly onNavigate?: (id: string) => void;
  /** The guest asked for a height. By default its container takes it as a minimum. */
  readonly onSize?: (height: number) => void;
  readonly limits?: GuestLimits & {
    /** The most nodes the guest may draw at once; past it the worker is stopped. 2 000 by default. */
    readonly maxNodes?: number;
    /** How long the guest has to say ready, in milliseconds. 5 000 by default. */
    readonly readyMs?: number;
    /**
     * How long, once it has said ready, the guest's runtime may go without
     * answering the host's heartbeat, in milliseconds; past it the worker
     * is stopped and `onFailure` hears `silent`. 5 000 by default. The
     * host asks every quarter of it, and at least once a second. A guest
     * that blocks its own event loop cannot answer; one that is busy but
     * yields answers late and is kept. Time the host's own page was held
     * up (a long task, a throttled background tab) is not counted.
     */
    readonly silentMs?: number;
    /**
     * The most of any one second the host's page may spend drawing what the
     * guest sent, in milliseconds: past it the batch is left undrawn, the
     * worker is stopped and `onFailure` hears `slow`. 100 by default.
     */
    readonly drawMs?: number;
  };
  /** The guest is not going to be shown, and why: the host can show something else in its place. */
  readonly onFailure?: (reason: GuestWorkerFailure) => void;
  /** The kit it may draw from. `GUEST_KIT` by default. */
  readonly kit?: Kit;
  /**
   * Where the guest's links may go: `{ origins: ["https://recipes.example"] }`
   * draws a link only to one of them, and any other with no `href`. Any
   * `https:` address by default. Every link opens with `noopener
   * noreferrer` and no referrer, in a new tab unless the kit says otherwise.
   */
  readonly links?: KitLinks;
  /** The container's accessible name. The view's name by default. */
  readonly title?: string;
}

export interface GuestWorker {
  /** The container the guest's kit is drawn in. */
  readonly element: HTMLElement;
  /** The worker, until it is stopped; undefined when the page refused it. */
  readonly worker: Worker | undefined;
  /** Push again: the view's input moved. */
  update(): void;
  readonly stats: Readonly<GuestStats>;
  /** What of the guest's drawing was refused (the last 200). */
  readonly refused: readonly KitRefusal[];
  dispose(): void;
}

const STYLE_ID = "graview-guest-kit";

/**
 * MOUNT A GUEST VIEW IN A WORKER (FR-68): a classic Web Worker — never
 * `type: "module"`, which a `blob:` URL in an opaque origin cannot start —
 * and the same protocol a frame guest speaks. Its `guest-ready` is
 * answered once, with a fresh nonce and a MessageChannel; every request
 * over the port carries the nonce. What it asks for is applied as the
 * viewer, through the view, under the same limits as a frame; what it
 * draws is drawn here, from the kit alone.
 */
export function mountGuestWorker<S extends AnySchema>(element: HTMLElement, options: MountGuestWorkerOptions<S>): GuestWorker {
  const document = element.ownerDocument;
  const window = document.defaultView!;
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = GUEST_KIT_CSS;
    document.head.appendChild(style);
  }
  const container = document.createElement("div");
  container.className = "graview-guest";
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", options.title ?? options.view);
  container.setAttribute("data-guest-view", options.view);
  element.appendChild(container);

  const stats: GuestStats = { applied: 0, refused: 0, dropped: 0 };
  const limiter = createGuestLimiter(options.limits);
  const budget = createDrawBudget(options.limits?.drawMs ?? 100, () => window.performance.now());
  let session: GuestHost | undefined;
  let renderer: KitRenderer | undefined;
  let started: StartedWorker | undefined;
  let failed = false;
  let counted: GuestStats = { applied: 0, refused: 0, dropped: 0 };
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
  const fail = (reason: GuestWorkerFailure) => {
    if (failed) return;
    failed = true;
    stop();
    renderer?.dispose();
    options.onFailure?.(reason);
  };

  started = startWorker(window, {
    source: options.worker,
    name: options.view,
    limiter,
    readyMs: options.limits?.readyMs ?? 5_000,
    silentMs: options.limits?.silentMs ?? 5_000,
    onDropped: () => (stats.dropped += 1),
    onStop: (reason) => fail(reason),
    onReady: (nonce, port) => {
      const draw = createKitRenderer(container, {
        ...(options.kit ? { kit: options.kit } : {}),
        ...(options.links ? { links: options.links } : {}),
        onEvent: (listener, detail) => port.postMessage({ type: "event", listener, ...(detail !== undefined ? { detail } : {}) }),
        ...(options.limits?.maxNodes !== undefined ? { maxNodes: options.limits.maxNodes } : {}),
        onOverBudget: () => fail("budget"),
      });
      renderer = draw;
      const live = createGuestHost({
        store: options.store,
        principal: options.principal,
        view: options.view,
        nonce,
        send: (message) => port.postMessage(message),
        /* The host's own time drawing the guest, at most `drawMs` of any second (draw-budget.ts). */
        onRender: (records) => {
          if (!budget.draw((spent) => draw.apply(records, spent))) fail("slow");
        },
        ...(options.input ? { input: options.input } : {}),
        ...(options.onNavigate ? { onNavigate: options.onNavigate } : {}),
        onSize: options.onSize ?? ((height) => (container.style.minHeight = `${height}px`)),
        ...(options.limits ? { limits: options.limits } : {}),
        limiter,
      });
      session = live;
      /* An answer to the watchdog is the runtime's, not a request; one with any other nonce goes to the session, which drops it. */
      port.onmessage = (message) => {
        if (started?.answer(message.data)) return;
        live.receive(message.data);
        tally();
      };
      live.push();
    },
  });

  return {
    element: container,
    get worker() {
      return started?.worker;
    },
    update: () => session?.push(),
    get stats() {
      tally();
      return stats;
    },
    get refused() {
      return renderer?.refused ?? [];
    },
    dispose() {
      failed = true;
      stop();
      renderer?.dispose();
      container.remove();
    },
  };
}

export { createKitRenderer, GUEST_KIT_CSS, hostAttribute, kitValue } from "./kit.js";
export type { KitLinks, KitRefusal, KitRefusalReason, KitRenderer, KitRendererOptions } from "./kit.js";
export { GUEST_KIT, KIT_LINK_TARGETS, KIT_TONES } from "../kit.js";
export type { GuestKitElement, Kit, KitComponent, KitEvent, KitProperty, KitPropertyType, KitTone } from "../kit.js";
/*
 * A worker view on the open kit (FR-90): HTML, SVG and CSS drawn into a
 * shadow root of the host's, with what could fetch or escape not drawn.
 * Its sanitiser and renderer are a chunk of their own, fetched the first
 * time a view draws.
 */
export { mountWorkerView } from "./view.js";
export type { MountWorkerViewOptions, WorkerView, WorkerViewCode, WorkerViewFailure, WorkerViewLimits } from "./view.js";
export type { ViewRefusal } from "./open-draw.js";
export type { OpenRefusal, OpenRefusalReason } from "./open-judge.js";
export type { CssRefusal, CssRefusalReason } from "./css.js";
export type { Destination } from "./links.js";
