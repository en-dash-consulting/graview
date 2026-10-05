import type { AnySchema, Principal, Store } from "@graview/core";
import type { Kit } from "../kit.js";
import { GUEST_PROTOCOL, isGuestReady, type HostHello } from "../protocol.js";
import { createKitRenderer, GUEST_KIT_CSS, type KitLinks, type KitRefusal, type KitRenderer } from "./kit.js";
import { mintNonce } from "./nonce.js";
import { createGuestHost, createGuestLimiter, type GuestHost, type GuestLimits, type GuestStats, type GuestViewInput } from "./session.js";

/**
 * Where a worker guest's code comes from: a URL the host already holds (a
 * `blob:` URL, typically), or the script's text, which the host makes into
 * a `blob:` URL itself. A chat's widget receives the text through a tool
 * call and never fetches it.
 */
export type GuestWorkerSource = { readonly url: string } | { readonly script: string };

/** Why a worker guest is not shown, for a host that falls back to something else. */
export type GuestWorkerFailure =
  /** The page's policy refused the worker, or it failed before it said ready. */
  | "refused"
  /** It never said ready in `readyMs`. */
  | "silent"
  /** It drew more than `maxNodes`; it was stopped. */
  | "budget";

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
  let session: GuestHost | undefined;
  let port: MessagePort | undefined;
  let renderer: KitRenderer | undefined;
  let worker: Worker | undefined;
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

  const made = "script" in options.worker ? window.URL.createObjectURL(new window.Blob([options.worker.script], { type: "text/javascript" })) : undefined;
  const url = "script" in options.worker ? made! : options.worker.url;

  let silence = 0;
  const stop = () => {
    tally();
    session?.dispose();
    port?.close();
    worker?.terminate();
    session = undefined;
    port = undefined;
    worker = undefined;
    window.clearTimeout(silence);
    if (made) window.URL.revokeObjectURL(made);
  };
  const fail = (reason: GuestWorkerFailure) => {
    if (failed) return;
    failed = true;
    stop();
    renderer?.dispose();
    options.onFailure?.(reason);
  };

  const ready = () => {
    window.clearTimeout(silence);
    const nonce = mintNonce();
    const channel = new window.MessageChannel();
    port = channel.port1;
    const draw = createKitRenderer(container, {
      ...(options.kit ? { kit: options.kit } : {}),
      ...(options.links ? { links: options.links } : {}),
      onEvent: (listener, detail) => channel.port1.postMessage({ type: "event", listener, ...(detail !== undefined ? { detail } : {}) }),
      ...(options.limits?.maxNodes !== undefined ? { maxNodes: options.limits.maxNodes } : {}),
      onOverBudget: () => fail("budget"),
    });
    renderer = draw;
    const live = createGuestHost({
      store: options.store,
      principal: options.principal,
      view: options.view,
      nonce,
      send: (message) => channel.port1.postMessage(message),
      onRender: (records) => draw.apply(records),
      ...(options.input ? { input: options.input } : {}),
      ...(options.onNavigate ? { onNavigate: options.onNavigate } : {}),
      onSize: options.onSize ?? ((height) => (container.style.minHeight = `${height}px`)),
      ...(options.limits ? { limits: options.limits } : {}),
      limiter,
    });
    session = live;
    channel.port1.onmessage = (message) => {
      live.receive(message.data);
      tally();
    };
    const hello: HostHello = { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce, view: options.view };
    worker!.postMessage(hello, [channel.port2]);
    live.push();
  };

  try {
    /* Classic, on purpose: a module worker from a blob: URL is refused in an opaque origin (Chromium), which is where a chat's widget runs. */
    worker = new window.Worker(url, { name: options.view });
  } catch {
    worker = undefined;
  }
  if (!worker) {
    queueMicrotask(() => fail("refused"));
  } else {
    silence = window.setTimeout(() => fail("silent"), options.limits?.readyMs ?? 5_000);
    worker.onerror = () => {
      if (!session) fail("refused");
    };
    worker.onmessage = (event: MessageEvent) => {
      /*
       * A worker's messages come from that worker alone. Its one message
       * here is `guest-ready`, said once: a worker is one realm for its
       * whole life, so a second ready is not a reload but a forgery.
       */
      if (!limiter.message() || session || !isGuestReady(event.data) || event.data.protocol !== GUEST_PROTOCOL) {
        stats.dropped += 1;
        return;
      }
      ready();
    };
  }

  return {
    element: container,
    get worker() {
      return worker;
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
