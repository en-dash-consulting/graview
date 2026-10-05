import type { AnySchema, Principal, Store } from "@graview/core";
import type { GuestDomEvent, GuestTheme } from "../protocol.js";
import { checkManifest, workerViewProps, type WorkerViewManifest } from "./manifest.js";
import type { OpenDrawing, ViewRefusal } from "./open-draw.js";
import { createGuestHost, createGuestLimiter, type GuestHost, type GuestLimits, type GuestStats, type GuestViewInput } from "./session.js";
import { startWorker, type GuestWorkerSource, type StartedWorker } from "./worker-start.js";

/** Why a worker view is not shown, for a host that draws something else in its place. */
export type WorkerViewFailure =
  /** Its manifest names a kind, an edge or an act the app does not declare (FR-91): it was never started. */
  | "manifest"
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
  /** What the view is and may touch (FR-91): its name, title, what it attaches to, what it reads, what it may ask. */
  readonly manifest: WorkerViewManifest;
  /** The view's code: a classic script, its runtime first (`@graview/guest/worker/view`). */
  readonly worker: GuestWorkerSource;
  readonly store: Store<S>;
  /** The viewer: what is pushed is what they may see, and what is asked for is applied as them. */
  readonly principal: Principal;
  /** Where the view is drawn: the record, or the members, the face hands it. */
  readonly input?: () => GuestViewInput;
  readonly onNavigate?: (id: string) => void;
  /**
   * The app's look now. Read off the region by default: the `--graview-*`
   * tokens it inherits, and the scheme of the nearest `data-graview-scheme`
   * (the embed's), else its `color-scheme`.
   */
  readonly theme?: () => GuestTheme;
  readonly limits?: WorkerViewLimits;
  /** The view is not going to be shown, and why. */
  readonly onFailure?: (reason: WorkerViewFailure, detail?: string) => void;
  /** The page's origin, for a `blob:` image of its own. `location.origin` by default. */
  readonly origin?: string;
  /** Who made it, said under the region (ADR 0007: "Made by Claude for Nick"). Nothing by default. */
  readonly author?: string;
}

export interface WorkerView {
  /** The region the host owns: the view is drawn in its shadow root. */
  readonly element: HTMLElement;
  readonly shadow: ShadowRoot;
  /** The worker, until it is stopped. */
  readonly worker: Worker | undefined;
  /** Push again: the view's input, or the app's look, moved. */
  update(): void;
  readonly stats: Readonly<GuestStats>;
  /** What of the view's drawing and stylesheet was refused. */
  readonly refused: readonly ViewRefusal[];
  dispose(): void;
}

const TOKENS: readonly (readonly [keyof Omit<GuestTheme, "scheme">, string])[] = [
  ["accent", "--graview-accent"],
  ["ground", "--graview-ground"],
  ["panel", "--graview-panel"],
  ["ink", "--graview-ink"],
  ["inkMuted", "--graview-ink-muted"],
  ["edge", "--graview-edge"],
  ["fontBody", "--graview-font-body"],
  ["fontMono", "--graview-font-mono"],
];

/** The app's look as the region inherits it: its tokens, and the app's scheme — its own toggle, not the system's. */
export function readTheme(region: Element): GuestTheme {
  const window = region.ownerDocument.defaultView!;
  const style = window.getComputedStyle(region);
  const stamped = region.closest("[data-graview-scheme]")?.getAttribute("data-graview-scheme");
  const said = stamped === "dark" || stamped === "light" ? stamped : /\bdark\b/.test(style.colorScheme ?? "") ? "dark" : /\blight\b/.test(style.colorScheme ?? "") ? "light" : window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const theme = { scheme: said } as { -readonly [K in keyof GuestTheme]: GuestTheme[K] };
  for (const [key, variable] of TOKENS) theme[key] = style.getPropertyValue(variable).trim();
  return theme;
}

/**
 * MOUNT A WORKER VIEW ON THE OPEN KIT (FR-90), AS A PLACE WITH A MANIFEST
 * (FR-91).
 *
 * The view runs in a classic, hardened worker (FR-68–FR-71) and draws
 * plain HTML, SVG and one stylesheet; the host draws them into a shadow
 * root inside a region of its own — contained (`contain: layout paint
 * style`), isolated, clipped — keeping only what the open kit allows. What
 * could fetch or escape is not drawn, and is written down in `refused`.
 * What it is handed is the viewer's sight cut to its manifest, with the
 * app's look, pushed again when the app's scheme changes. A manifest that
 * names what the app does not declare is refused before a worker starts.
 * The sanitiser is fetched the first time a view draws, so a page that
 * mounts none loads none of it.
 */
export function mountWorkerView<S extends AnySchema>(element: HTMLElement, options: MountWorkerViewOptions<S>): WorkerView {
  const document = element.ownerDocument;
  const window = document.defaultView! as Window & typeof globalThis;
  const { manifest } = options;
  const region = document.createElement("div");
  region.className = "graview-worker-view";
  region.setAttribute("role", "region");
  region.setAttribute("aria-label", manifest.title ?? manifest.name);
  region.setAttribute("data-worker-view", manifest.name);
  /* Contained, isolated, clipped: nothing the view draws paints outside the region or stacks above the app (FR-90). */
  region.style.cssText = "display:block;position:relative;contain:layout paint style;isolation:isolate;overflow:clip;min-width:0";
  element.appendChild(region);
  const shadow = region.attachShadow({ mode: "open" });
  const author = options.author ? document.createElement("p") : undefined;
  if (author) {
    author.className = "graview-worker-view-author";
    author.setAttribute("data-worker-view-author", manifest.name);
    author.style.cssText = "margin:4px 0 0;font-size:0.75rem;color:var(--graview-ink-muted, inherit)";
    author.textContent = options.author!;
    element.appendChild(author);
  }

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
  let unwatch = () => {};
  const stop = () => {
    tally();
    session?.dispose();
    session = undefined;
    started?.stop();
    unwatch();
  };
  const fail = (reason: WorkerViewFailure, detail?: string) => {
    if (failed) return;
    failed = true;
    stop();
    drawing?.dispose();
    options.onFailure?.(reason, detail);
  };

  const findings = checkManifest(manifest, options.store);
  if (findings.length > 0) {
    queueMicrotask(() => fail("manifest", findings.join(" ")));
    return handle();
  }

  /*
   * THE APP'S LOOK, KEPT UP. The tokens reach the view's stylesheet by
   * inheritance, so its CSS restyles itself; what the view computes from
   * `props.theme` needs a push, so the host watches for the app's toggle
   * (the embed stamps `data-graview-scheme`, a page `data-theme`) and the
   * system's preference, and pushes when the look it reads has changed.
   */
  const theme = () => options.theme?.() ?? readTheme(region);
  let pushed = "";
  const push = () => {
    pushed = JSON.stringify(theme());
    session?.push();
  };
  const looked = () => {
    if (session && JSON.stringify(theme()) !== pushed) push();
  };
  if (typeof window.MutationObserver === "function") {
    const watch = new window.MutationObserver(looked);
    watch.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["data-graview-scheme", "data-theme"] });
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", looked);
    unwatch = () => {
      watch.disconnect();
      media?.removeEventListener?.("change", looked);
    };
  }

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
    name: manifest.name,
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
        view: manifest.name,
        nonce,
        send: (message) => given.postMessage(message),
        props: () => workerViewProps(options.store, options.principal, { manifest, ...(options.input ? { input: options.input() } : {}), theme: theme() }),
        onRender: (records) => draw(["render", records]),
        onStyle: (css) => draw(["style", css]),
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
      push();
    },
  });

  return handle();

  function handle(): WorkerView {
    return {
      element: region,
      shadow,
      get worker() {
        return started?.worker;
      },
      update: () => {
        if (session) push();
      },
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
        author?.remove();
      },
    };
  }
}
