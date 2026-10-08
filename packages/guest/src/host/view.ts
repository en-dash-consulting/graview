import { retryingImport, type AnySchema, type Principal, type Store } from "@graview/core";
import type { GuestDomEvent, GuestPlace, GuestProps, GuestTheme } from "../protocol.js";
import { checkManifest, workerViewProps, type WorkerViewManifest } from "./manifest.js";
import type { OpenDrawing, ViewRefusal } from "./open-draw.js";
import { createGuestHost, createGuestLimiter, type GuestHost, type GuestLimits, type GuestStats, type GuestViewInput } from "./session.js";
import { startWorker, type GuestWorkerSource, type StartedWorker } from "./worker-start.js";
import { judgeCodeAct } from "./writes.js";
import { createDrawBudget } from "./draw-budget.js";
import { checkViewSource } from "./view-source.js";
import { viewScript } from "./view-script.js";
import { createLinks, type Destination } from "./links.js";
import { createGuestLogo, readTheme, themeWithBrand, watchTheme, type GuestBrand } from "./theme.js";

/** A worker view's code: its own source, which the host makes a worker of, or a whole worker script. */
export type WorkerViewCode = GuestWorkerSource | { readonly source: string };

/**
 * Why a worker view is not shown (FR-94). Past any limit the host stops
 * the worker, draws the plain face of what the view was shown in its place
 * (or the host's own `fallback`), and says why.
 */
/* The host's drawing and press reader, asked for again with URLs of their own when they did not arrive (FR-139). */
const openDrawChunk = retryingImport(() => import("./open-draw.js"));
const pressChunk = retryingImport(() => import("./press.js"));

export type WorkerViewFailure =
  /** Its manifest names a kind, an edge or an act the app does not declare (FR-91): it was never started. */
  | "manifest"
  /** Its code is longer than `maxSourceBytes`: it was never started. */
  | "source"
  /**
   * It never started (FR-102): the page's policy refused the worker (its
   * Content-Security-Policy needs `worker-src blob:`), it failed before it
   * said ready, or it did not say ready in `readyMs`. The sentence says which.
   */
  | "start"
  /** It threw, once started, before it drew anything. */
  | "error"
  /** It said ready, then its runtime went `silentMs` without answering the host's heartbeat. */
  | "silent"
  /** It drew more than `maxNodes`. */
  | "nodes"
  /** It sent more than `messages` messages in `messageWindowMs`. */
  | "flood"
  /** It took longer than `pushMs` to draw what it was shown. */
  | "slow";

export interface WorkerViewLimits extends GuestLimits {
  /** The longest a view's code may be, in bytes as UTF-8. 256 000 by default. */
  readonly maxSourceBytes?: number;
  /** The most nodes the view may draw at once. 5 000 by default. */
  readonly maxNodes?: number;
  /** How long it has to say ready, in milliseconds. 5 000 by default. */
  readonly readyMs?: number;
  /** How long its runtime may go without answering the host's heartbeat, once ready. 5 000 by default. */
  readonly silentMs?: number;
  /**
   * How long the view may take over one push of what it is shown — its
   * listeners' own time, as its runtime measures it, and the time until the
   * runtime says it has drawn, as the host measures it — in milliseconds.
   * 1 000 by default. Time the host's own page was held up is not counted.
   */
  readonly pushMs?: number;
  /**
   * The most of any one second the host's page may spend drawing what the
   * view sent, in milliseconds: past it the batch is left undrawn and the
   * view is stopped as slow. 100 by default.
   */
  readonly drawMs?: number;
}

/** What each limit is, said to a person. */
function why(reason: WorkerViewFailure, limits: Required<Pick<WorkerViewLimits, "maxSourceBytes" | "maxNodes" | "messages" | "messageWindowMs" | "pushMs" | "silentMs">>, detail?: string): string {
  switch (reason) {
    case "manifest":
      return detail ?? "Its manifest names something this app does not have.";
    case "source":
      return detail ?? `Its code is longer than the ${limits.maxSourceBytes.toLocaleString("en-US")} bytes a view may be.`;
    case "start":
      return `It could not start${detail ? `: ${detail}.` : "."}`;
    case "error":
      return `It failed before it drew anything${detail ? `: ${detail}` : "."}`;
    case "silent":
      return `It stopped answering for ${limits.silentMs.toLocaleString("en-US")} ms.`;
    case "nodes":
      return `It drew more than the ${limits.maxNodes.toLocaleString("en-US")} things a view may draw.`;
    case "flood":
      return `It sent more than ${limits.messages} messages in ${limits.messageWindowMs.toLocaleString("en-US")} ms.`;
    case "slow":
      return `It took longer than ${limits.pushMs.toLocaleString("en-US")} ms to draw what it was shown.`;
  }
}

export interface MountWorkerViewOptions<S extends AnySchema> {
  /** What the view is and may touch (FR-91): its name, title, what it attaches to, what it reads, what it may ask. */
  readonly manifest: WorkerViewManifest;
  /**
   * The view's code. `{ source }` is a plain script against the `graview`
   * global, with no imports and no build (FR-96): the host puts the runtime
   * in front of it. `{ script }` or `{ url }` is a whole worker script
   * already, its runtime first (`@graview/guest/worker/view`).
   */
  readonly worker: WorkerViewCode;
  readonly store: Store<S>;
  /** The viewer: what is pushed is what they may see, and what is asked for is applied as them. */
  readonly principal: Principal;
  /** Where the view is drawn: the record, or the members, the face hands it. */
  readonly input?: () => GuestViewInput;
  /**
   * The view asked to go to a record or a named place of this app — by a
   * link it drew (`<a data-record>`, `<a data-place>`) or from its code.
   * Only a record the viewer may see and a place `places` lists get here;
   * a worker view has no way to an address outside the app (FR-93).
   */
  readonly onNavigate?: (to: Destination) => void;
  /** The app's named places: what the view is told of, and may link to by slug. None by default. */
  readonly places?: () => readonly GuestPlace[];
  /**
   * The app's look now. Read off the region by default: the `--graview-*`
   * tokens it inherits, and the scheme of the nearest `data-graview-scheme`
   * (the embed's), else its `color-scheme`.
   */
  readonly theme?: () => GuestTheme;
  /**
   * The app's brand (FR-127): its name, and its logo as a `blob:` URL of
   * this page the host made — from an inline SVG, or an address on the
   * page's own origin it fetched — or a `data:` image where the page's
   * policy refuses `blob:` images. Pushed again when it changes (`update`).
   */
  readonly brand?: () => GuestBrand | undefined;
  readonly limits?: WorkerViewLimits;
  /** The view is not going to be shown, and why: the reason, and a sentence saying it. */
  readonly onFailure?: (reason: WorkerViewFailure, detail?: string) => void;
  /**
   * What is drawn in the view's place when it fails. By default the host
   * draws the plain face of what the view was shown — its title, each
   * record's label, and why the view was stopped — in the region; `false`
   * leaves the region empty for a host that draws its own (the React
   * registrations draw the kind's own face).
   */
  readonly fallback?: false | ((region: HTMLElement, reason: WorkerViewFailure, detail: string) => void);
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

export { readTheme };

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
 * The sanitizer is fetched the first time a view draws, so a page that
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
  const limits = {
    maxSourceBytes: options.limits?.maxSourceBytes ?? 256_000,
    maxNodes: options.limits?.maxNodes ?? 5_000,
    messages: options.limits?.messages ?? 120,
    messageWindowMs: options.limits?.messageWindowMs ?? 1_000,
    pushMs: options.limits?.pushMs ?? 1_000,
    silentMs: options.limits?.silentMs ?? 5_000,
    drawMs: options.limits?.drawMs ?? 100,
  };
  /* What the view was last shown: the plain face drawn in its place, if it fails. */
  let lastProps: GuestProps | undefined;
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
  /* The interval that times each push (FR-94), once the view is ready. */
  let timing = 0;
  const stop = () => {
    tally();
    session?.dispose();
    session = undefined;
    started?.stop();
    unwatch();
    window.clearInterval(timing);
  };
  const fail = (reason: WorkerViewFailure, detail?: string) => {
    if (failed) return;
    failed = true;
    stop();
    drawing?.dispose();
    const said = why(reason, limits, detail);
    region.setAttribute("data-worker-view-failed", reason);
    if (options.fallback !== false) (options.fallback ?? plainFace)(region, reason, said);
    options.onFailure?.(reason, said);
  };
  /**
   * THE PLAIN FACE, drawn by the host from what the view was shown and
   * nothing of the view's: its title, each record by its label, and why it
   * was stopped. What a reader sees in place of a view that went past its
   * limits.
   */
  const plainFace = (_: HTMLElement, reason: WorkerViewFailure, said: string) => {
    const props = lastProps ?? (() => {
      try {
        return workerViewProps(options.store, options.principal, { manifest, ...(options.input ? { input: options.input() } : {}) });
      } catch {
        return undefined;
      }
    })();
    const face = document.createElement("div");
    face.setAttribute("data-graview-fallback", reason);
    face.style.cssText = "padding:12px;display:grid;gap:6px;color:var(--graview-ink, inherit);font-family:var(--graview-font-body, inherit)";
    const title = document.createElement("strong");
    title.textContent = manifest.title ?? manifest.name;
    const list = document.createElement("ul");
    list.style.cssText = "margin:0;padding-left:1.2em";
    for (const node of [...(props?.node ? [props.node] : []), ...(props?.nodes ?? [])]) {
      const item = document.createElement("li");
      item.textContent = node.label ?? node.id;
      list.appendChild(item);
    }
    const note = document.createElement("p");
    note.style.cssText = "margin:0;font-size:0.8125rem;color:var(--graview-ink-muted, inherit)";
    note.textContent = `This view was stopped. ${said}`;
    face.append(title, list, note);
    shadow.replaceChildren(face);
  };

  const findings = checkManifest(manifest, options.store);
  if (findings.length > 0) {
    queueMicrotask(() => fail("manifest", findings.join(" ")));
    return handle();
  }
  const code = options.worker;
  const bytes = "source" in code ? new TextEncoder().encode(code.source).length : "script" in code ? new TextEncoder().encode(code.script).length : 0;
  if (bytes > limits.maxSourceBytes) {
    queueMicrotask(() => fail("source"));
    return handle();
  }
  /* A view's own source may load nothing (FR-96): refused before it runs, with why. */
  const unloadable = "source" in code ? checkViewSource(code.source) : [];
  if (unloadable.length > 0) {
    queueMicrotask(() => fail("source", unloadable.join(" ")));
    return handle();
  }

  /*
   * THE APP'S LOOK, KEPT UP. The tokens reach the view's stylesheet by
   * inheritance, so its CSS restyles itself; what the view computes from
   * `props.theme` needs a push, so the host watches for the app's toggle
   * (the embed stamps `data-graview-scheme`, a page `data-theme`) and the
   * system's preference, and pushes when the look it reads has changed.
   */
  const logo = createGuestLogo(window, () => looked(), "blob");
  const theme = () => themeWithBrand(() => options.theme?.() ?? readTheme(region), options.brand, logo);
  let pushed = "";
  const push = () => {
    pushed = JSON.stringify(theme());
    session?.push();
  };
  const looked = () => {
    if (session && JSON.stringify(theme()) !== pushed) push();
  };
  const unwatchTheme = watchTheme(document, looked);
  unwatch = () => {
    unwatchTheme();
    logo.dispose();
  };

  let port: MessagePort | undefined;
  const send = (message: GuestDomEvent) => port?.postMessage(message);
  /* Anything drawn yet: a view that throws after it drew goes on; one that throws before has failed. */
  let drew = false;

  /*
   * TIME PER PUSH (FR-94). Each push of what the view is shown is timed
   * from when the host sends it to when the runtime says it has drawn it,
   * and the runtime says how long the view's own listeners took. Past
   * `pushMs` either way, the view is stopped as slow. A view that spins in
   * its listener never says it has drawn; the host's own page being held
   * up is not the view's time.
   */
  const clock = window.performance;
  const pending = new Map<number, number>();
  let ticked = clock.now();
  const every = Math.max(10, Math.min(250, Math.floor(limits.pushMs / 4)));
  const startTiming = () => {
    if (timing) return;
    ticked = clock.now();
    timing = window.setInterval(() => {
      const at = clock.now();
      const held = at - ticked > every * 2 ? at - ticked - every : 0;
      ticked = at;
      for (const [push, sent] of pending) {
        const since = sent + held;
        pending.set(push, since);
        if (at - since >= limits.pushMs) return fail("slow");
      }
    }, every);
  };
  /* The host's own time drawing the view, at most `drawMs` of any second (draw-budget.ts): past it, the view is slow. */
  const budget = createDrawBudget(limits.drawMs, () => clock.now());
  const draw = (one: ["render", unknown] | ["style", string]) => {
    if (failed) return;
    if (!drawing) return void waiting.push(one);
    const live = drawing;
    const within = budget.draw((spent) => (one[0] === "render" ? live.apply(one[1], spent) : (live.style(one[1]), true)));
    if (!within) fail("slow");
  };
  /* Links stay in the app (FR-93): a record the viewer may see, or a place the app has. */
  const links = createLinks({
    sees: (id) => options.store.seenBy(options.principal).graph.has(id),
    places: () => options.places?.() ?? [],
    ...(options.onNavigate ? { onNavigate: options.onNavigate } : {}),
  });

  /* The records the view was last shown: a press may be bound to one of these, and to nothing else (FR-92). */
  let shown: ReadonlySet<string> = new Set();
  void Promise.all([openDrawChunk(), pressChunk()]).then(([{ createOpenDrawing }, { createPressReader, judgePress }]) => {
    if (failed) return;
    const reader = createPressReader();
    drawing = createOpenDrawing(shadow, {
      origin: options.origin ?? window.location.origin,
      ...(options.limits?.maxNodes !== undefined ? { maxNodes: options.limits.maxNodes } : {}),
      onOverBudget: () => fail("nodes"),
      send,
      onFieldSet: (field) => reader.filled(field),
      onAttribute: (element, name) => {
        if (element.localName === "a" && (name === "data-record" || name === "data-place")) links.link(element);
      },
      decorate: (element) => {
        if (element.localName === "a") links.link(element);
      },
      /*
       * THE VIEWER'S PRESS, IN ITS OWN HANDLER (FR-92). A trusted click on
       * an element bound to an act is judged and applied here, before the
       * view hears of it; the view is told what became of it.
       */
      before: (event, at, root) => {
        reader.heard(event, at);
        /* A link the view drew goes where it says, if that is a record or a place of this app. */
        const anchor = at.closest("a[data-graview-link]");
        if (anchor && root.contains(anchor) && (event.type === "click" || (event.type === "keydown" && (event as KeyboardEvent).key === "Enter"))) {
          /* Followed here, and nowhere else: the face around the view does not also take the press for a press on the card. */
          event.preventDefault();
          event.stopPropagation();
          links.follow(anchor);
        }
        const press = reader.press(event, at, root);
        if (!press || !session) return;
        event.stopPropagation();
        const outcome = session.pressed(judgePress(options.store, manifest, shown, press));
        tally();
        return { pressed: { as: press.as, ...outcome } };
      },
    });
    for (const one of waiting.splice(0)) draw(one);
  },
  // The drawing did not arrive (the network away as it was drawn): the plain face says so, and it is asked for again as the view is drawn again (FR-139).
  () => fail("start", "the view's drawing could not be loaded"));

  const begin = (source: GuestWorkerSource) => (started = startWorker(window, {
    source,
    name: manifest.name,
    limiter,
    readyMs: options.limits?.readyMs ?? 5_000,
    silentMs: options.limits?.silentMs ?? 5_000,
    onDropped: () => (stats.dropped += 1),
    onStop: (reason, detail) => fail(reason, detail),
    onError: (detail) => {
      if (!drew) fail("error", detail);
    },
    onReady: (nonce, given) => {
      port = given;
      startTiming();
      const live = createGuestHost({
        store: options.store,
        principal: options.principal,
        view: manifest.name,
        nonce,
        send: (message) => {
          if (message.type === "props" && typeof message.push === "number") pending.set(message.push, clock.now());
          given.postMessage(message);
        },
        props: () => {
          const props = workerViewProps(options.store, options.principal, { manifest, ...(options.input ? { input: options.input() } : {}), theme: theme(), ...(options.places ? { places: options.places() } : {}) });
          shown = new Set([...(props.node ? [props.node.id] : []), ...(props.nodes ?? []).map((node) => node.id)]);
          lastProps = props;
          return props;
        },
        judgeAct: (name, args) => judgeCodeAct(options.store, manifest, name, args),
        onRender: (records) => {
          drew = true;
          draw(["render", records]);
        },
        onPushed: (push, ms) => {
          pending.delete(push);
          if (ms >= limits.pushMs) fail("slow");
        },
        /* Past the message allowance, a view is stopped, not read on (FR-94). */
        onFlood: () => fail("flood"),
        onStyle: (css) => draw(["style", css]),
        onNavigate: (record) => void links.go({ record }),
        onNavigatePlace: (place) => void links.go({ place }),
        places: () => (options.places?.() ?? []).map((place) => place.as),
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
  }));
  if ("source" in code) {
    void viewScript(code.source).then(
      (script) => {
        if (!failed) begin({ script });
      },
      () => fail("start", "the view's runtime could not be loaded"),
    );
  } else begin(code);

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
