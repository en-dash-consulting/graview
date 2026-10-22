import { imageRefusedWords } from "./open-judge.js";
import { guestPlacesOf } from "./links-words.js";
import type { AnySchema, FileValue, HostFiles, Principal, Store } from "@graview/core";
import { storedFilesOf } from "./marks.js";
import { retryingImport } from "@graview/core/retry";
import type { GuestDomEvent, GuestPlace, GuestProps, GuestTheme } from "../protocol.js";
import { checkManifest, workerViewProps, type WorkerViewManifest } from "./manifest.js";
import type { OpenDrawing, ViewRefusal } from "./open-draw.js";
import { createGuestHost, createGuestLimiter, type GuestHost, type GuestLimits, type GuestStats, type GuestViewInput } from "./session.js";
import { startWorker, type GuestWorkerSource, type StartedWorker } from "./worker-start.js";
import { judgeCodeAct } from "./writes.js";
import { createDrawBudget } from "./draw-budget.js";
import { checkViewSource } from "./view-source.js";
import { viewScript } from "./view-script.js";
import { createLinks, listsOf, type Arrival, type Destination } from "./links.js";
import { arriveAt } from "./arrive-at.js";
import type { GoTo } from "@graview/react/provider";
import type { GuestPictureHand } from "./pictures.js";
import type { GuestMedia } from "./media.js";
import type { GuestDrops } from "./drop.js";
import type { GuestGestures } from "./gestures.js";
import { createGuestLogo, readTheme, themeWithBrand, watchTheme, type GuestBrand } from "./theme.js";

import { codeOf, type WorkerViewCode, type WorkerViewLoad } from "./code-of.js";
export type { WorkerViewCode, WorkerViewLoad } from "./code-of.js";

/**
 * Why a worker view is not shown (FR-94). Past any limit the host stops
 * the worker, draws the plain face of what the view was shown in its place
 * (or the host's own `fallback`), and says why.
 */
/* The host's drawing and press reader, asked for again with URLs of their own when they did not arrive (FR-139). */
const openDrawChunk = retryingImport(() => import("./open-draw.js"));
const pressChunk = retryingImport(() => import("./press.js"));
/* The pictures' host (FR-175), fetched only for a view whose manifest asks for pictures. */
const picturesChunk = retryingImport(() => import("./pictures.js"));
/* A record's video placed by a view, and the full-screen viewer (0.1.37), fetched with the first view that places one. */
const mediaChunk = retryingImport(() => import("./media.js"));
/* Files dropped on what the view drew (FR-193), fetched with the first `data-drop` a view whose manifest accepts files draws. */
const dropChunk = retryingImport(() => import("./drop.js"));
/* A wheel, a drag and a pinch over what the view drew (0.1.42), fetched only for a view whose manifest says gestures and that listens for one. */
const gesturesChunk = retryingImport(() => import("./gestures.js"));

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
  readonly worker: WorkerViewCode | WorkerViewLoad;
  readonly store: Store<S>;
  /** The viewer: what is pushed is what they may see, and what is asked for is applied as them. */
  readonly principal: Principal;
  /** Where the view is drawn: the record, or the members, the face hands it. */
  readonly input?: () => GuestViewInput;
  /**
   * The view asked to go to a record, a named place or a kind's list of
   * this app — by a link it drew (`<a data-record>`, `<a data-place>`) or
   * from its code — narrowed (`filter`, in the address's words) and to a
   * section, as it asked. Only a record the viewer may see, a place
   * `places` lists and a kind the viewer sees get here, with a filter held
   * to the kind's fields; a worker view has no way to an address outside
   * the app (FR-93).
   */
  readonly onNavigate?: (to: Arrival) => void;
  /** The face's own way of going (`useGoTo`), read when the view goes: where `onNavigate` is not given, the arrival is gone to by it. */
  readonly goTo?: () => GoTo | undefined;
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
   * Something the view did went nowhere, and why, as a sentence for the
   * host's problems: a link or `graview.navigate` to no record the viewer
   * may see and no place of the app, naming the places there are. The
   * view's console is told the same.
   */
  readonly onProblem?: (said: string) => void;
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
  /**
   * Where an image the app holds (`/graview/assets/<sha256>.<ext>`) is
   * loaded from, so a view may draw it by that path: a host serving the app
   * under a base answers `base + path`. Without it, such an image is refused.
   */
  readonly asset?: (path: string) => string | undefined;
  /**
   * Where the page fetches a record's file (`FileValue.href`) for the
   * pictures a view whose manifest asks for them is handed (FR-175): a host
   * serving the app under a base answers `base + href`. The href resolved
   * against the page by default — the page's own root for `/graview/files/…`.
   * A picture its host did not answer for says what it answered, and names
   * this option, in the view's console and to `onProblem`.
   */
  readonly file?: (href: string) => string | undefined;
  /**
   * WHERE A VIEW'S IMAGES MAY COME FROM BY ADDRESS (2026-10-15): the
   * `https:` origins the host lists (`["https://upload.wikimedia.org"]`).
   * An image on one of them is drawn as the view gave it, asked for with no
   * referrer; any other address is refused, and said once — in the view's
   * console and to `onProblem`. None by default: a view loads nothing.
   */
  readonly images?: { readonly origins: readonly string[] };
  /** Who made it, said under the region (ADR 0007: "Made by Claude for Nick"). Nothing by default. */
  readonly author?: string;
  /**
   * THE PAGE'S HOST'S FILES (FR-163), for a view whose manifest `accepts`
   * files (FR-193): what a file dropped on, or picked for, an element it
   * marked `data-drop` is stored through. Without it, no drop target is
   * offered: this host takes no files.
   */
  readonly files?: () => HostFiles | undefined;
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
  /* What the person typed into a field saved as it is typed and not yet saved (FR-191, press.ts): saved as the view goes. */
  let flushSaves = () => {};
  const stop = () => {
    flushSaves();
    flushSaves = () => {};
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
    region.removeAttribute("data-worker-view-drawn");
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
  /* Its code is longer than it may be, or its own source loads something (FR-96): refused before it runs, with why. */
  const refusedCode = (code: WorkerViewCode): [WorkerViewFailure, string?] | undefined => {
    const bytes = "source" in code ? new TextEncoder().encode(code.source).length : "script" in code ? new TextEncoder().encode(code.script).length : 0;
    if (bytes > limits.maxSourceBytes) return ["source"];
    const unloadable = "source" in code ? checkViewSource(code.source) : [];
    return unloadable.length > 0 ? ["source", unloadable.join(" ")] : undefined;
  };
  const given = options.worker;
  const refusedNow = typeof given === "function" ? undefined : refusedCode(given);
  if (refusedNow) {
    queueMicrotask(() => fail(...refusedNow));
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
  /*
   * THE PICTURES ON WHAT IT IS HANDED (FR-175), where its manifest asks:
   * fetched here as the reader, made into `blob:` URLs of this page, and
   * pushed again as each is ready. What is left out is said in its console
   * and to the host. The worker starts once their host has arrived, so the
   * view is never handed a record's path to a file.
   */
  let pictures: GuestPictureHand | undefined;
  /* What is dropped on what it draws (FR-193): below, with the drawing. */
  let drops: GuestDrops | undefined;
  const picturesReady: Promise<unknown> = manifest.pictures
    ? picturesChunk().then(({ createGuestPictures }) => {
        if (failed) return;
        pictures = createGuestPictures(window, {
          as: "blob",
          view: `"${manifest.title ?? manifest.name}"`,
          pictures: manifest.pictures!,
          ...(options.limits ? { limits: options.limits } : {}),
          ...(options.file ? { file: options.file } : {}),
          moved: () => session?.push(),
          onLeft: (said) => {
            port?.postMessage({ type: "notice", text: said });
            options.onProblem?.(said);
          },
        });
      })
    : Promise.resolve();
  unwatch = () => {
    unwatchTheme();
    logo.dispose();
    pictures?.dispose();
    media?.dispose();
    drops?.dispose();
    gestures?.dispose();
  };

  let port: MessagePort | undefined;
  const send = (message: GuestDomEvent) => port?.postMessage(message);
  /* Anything drawn yet: a view that throws after it drew goes on; one that throws before has failed. */
  let drew = false;
  /*
   * DRAWN, AND NOTHING ON ITS WAY (FR-188): the region says
   * `data-worker-view-drawn` once the view has answered what it was last
   * shown, the host has drawn all it sent, and no picture it was handed is
   * still being fetched — so a page that says it has drawn (the embed's
   * `data-graview-drawn`) can wait for it. A view that fails says
   * `data-worker-view-failed` instead, its plain face drawn.
   */
  let answered = false;
  const mark = () => region.toggleAttribute("data-worker-view-drawn", !failed && answered && drawing !== undefined && waiting.length === 0 && pending.size === 0 && !pictures?.waiting() && !(drops?.waiting ?? 0));

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
  /* The fields the view marked `data-prefill`, filled by the host from the record after each batch it draws (FR-150, press.ts). */
  let refill = () => {};
  const draw = (one: ["render", unknown] | ["style", string]) => {
    if (failed) return;
    if (!drawing) return void waiting.push(one);
    const live = drawing;
    const within = budget.draw((spent) => (one[0] === "render" ? live.apply(one[1], spent) : (live.style(one[1]), true)));
    if (!within) return fail("slow");
    if (one[0] === "render") refill();
  };
  /* Links stay in the app (FR-93): a record the viewer may see, or a place the app has. */
  const lists = () => listsOf(options.store.schema, new Set([...options.store.kindsKeptFrom(options.principal), ...options.store.modules.disabledKinds]));
  const links = createLinks({
    sees: (id) => options.store.seenBy(options.principal).graph.has(id),
    places: () => guestPlacesOf(options.places?.() ?? []),
    lists,
    schema: options.store.schema,
    ...(options.onNavigate ? { onNavigate: options.onNavigate } : options.goTo ? { onNavigate: (to: Arrival) => arriveAt(options.goTo!(), to) } : {}),
    /* Said in the view's console, and to the host. */
    onLost: (said) => {
      port?.postMessage({ type: "notice", text: said });
      options.onProblem?.(said);
    },
  });

  /* The records the view was last shown: a press may be bound to one of these, and to nothing else (FR-92). */
  let shown: ReadonlySet<string> = new Set();
  /* The image addresses already said to be refused: each is said once. */
  const toldImages = new Set<string>();
  /*
   * A RECORD'S VIDEO AND THE FULL-SCREEN VIEWER (0.1.37, media.ts): fetched
   * the first time the view places a `<graview-video>` or a `data-lightbox`,
   * drawn from what the view was last shown, and drawn again after each
   * batch it draws.
   */
  let media: GuestMedia | undefined;
  let mediaAsked = false;
  const wantMedia = () => {
    if (mediaAsked) return;
    mediaAsked = true;
    void mediaChunk().then(
      ({ createGuestMedia }) => {
        if (failed) return;
        media = createGuestMedia(window, {
          view: `"${manifest.title ?? manifest.name}"`,
          pictures: manifest.pictures !== undefined,
          shown: () => lastProps,
          ...(options.file ? { file: options.file } : {}),
          onProblem: (said) => {
            port?.postMessage({ type: "notice", text: said });
            options.onProblem?.(said);
          },
        });
        media.refresh(shadow);
      },
      () => options.onProblem?.(`The view "${manifest.title ?? manifest.name}" places a video or a full-screen viewer, and the host's player could not be loaded.`),
    );
  };
  /*
   * FILES DROPPED ON WHAT IT DREW (FR-193, drop.ts): fetched the first time
   * a view whose manifest accepts files draws a `data-drop`, and looked at
   * again after each batch it draws. What the host stores is handed to the
   * view, and may come back in an act's argument (writes.ts); a view that
   * hears `drop` is left the drop.
   */
  let dropsAsked = false;
  let hearsDrop = false;
  const handed = new Map<string, FileValue>();
  const wantDrops = () => {
    if (dropsAsked || !manifest.accepts?.length) return;
    dropsAsked = true;
    void dropChunk().then(
      ({ createGuestDrops }) => {
        if (failed) return;
        drops = createGuestDrops(window, {
          shadow,
          manifest,
          store: options.store,
          principal: options.principal,
          files: () => options.files?.(),
          shown: () => shown,
          hears: () => hearsDrop,
          idOf: (one) => drawing?.renderer.idOf(one),
          send,
          change: (calls, intent) => {
            if (!session) return { ok: false, reason: "refused", message: "The view has gone." };
            const outcome = session.change(calls, intent);
            tally();
            return outcome;
          },
          handed: (file) => handed.set(file.href, file),
          onProblem: (said) => {
            port?.postMessage({ type: "notice", text: said });
            options.onProblem?.(said);
          },
          onBusy: () => mark(),
        });
        drops.refresh();
      },
      () => options.onProblem?.(`The view "${manifest.title ?? manifest.name}" takes files, and the host's drop could not be loaded.`),
    );
  };
  /*
   * A WHEEL, A DRAG AND A PINCH (0.1.42, gestures.ts): fetched the first
   * time the view says it listens for one, and told again wherever it moves
   * where it listens. Only a view whose manifest says gestures hears one; any
   * other is told why, in its console and to the host. A host whose gestures
   * did not arrive forwards none, and the page scrolls as it would.
   */
  let gestures: GuestGestures | undefined;
  let gesturesBound: readonly unknown[] = [];
  let gesturesAsked = false;
  const bindGestures = (bound: readonly unknown[]) => {
    gesturesBound = bound;
    gestures?.bind(bound);
    if (gesturesAsked || bound.length === 0) return;
    gesturesAsked = true;
    void gesturesChunk().then(
      ({ createGuestGestures, unheardWords }) => {
        if (failed) return;
        if (manifest.gestures !== true) {
          const said = unheardWords(manifest.title ?? manifest.name);
          port?.postMessage({ type: "notice", text: said });
          return options.onProblem?.(said);
        }
        gestures = createGuestGestures(shadow, { root: () => shadow.querySelector("[data-graview-view-root]") ?? undefined, idOf: (one) => drawing?.renderer.idOf(one), send });
        gestures.bind(gesturesBound);
      },
      () => {},
    );
  };
  /* A file on a record the view was shown, as the record keeps it: one it may hand back to an act. */
  const fileOnShown = (href: string): FileValue | undefined => {
    const graph = options.store.seenBy(options.principal).graph;
    for (const id of shown) {
      const node = graph.getNode(id) as Record<string, unknown> | undefined;
      for (const value of Object.values(node ?? {})) for (const file of storedFilesOf(value)) if (file.href === href) return file;
    }
    return undefined;
  };
  const marksMedia = (element: Element) => {
    if (element.localName === "graview-video") return wantMedia();
    if (!element.hasAttribute("data-lightbox")) return;
    /* It opens the host's viewer: said so to assistive technology. */
    element.setAttribute("aria-haspopup", "dialog");
    wantMedia();
  };
  void Promise.all([openDrawChunk(), pressChunk()]).then(([{ createOpenDrawing }, { createPressReader, createSaver, fillPrefills, judgePress, markPresses, prefillOf }]) => {
    if (failed) return;
    const reader = createPressReader();
    /* The view hears what became of an act a press or a save asked for as `acted` on the element bound to it (FR-191). */
    const acted = (bound: Element, pressed: NonNullable<GuestDomEvent["pressed"]>) => {
      const target = drawing?.renderer.idOf(bound);
      if (target !== undefined) send({ type: "dom-event", target, event: "acted", pressed });
    };
    /* A field saved as the person types (FR-191): judged and applied as a press is. */
    const saver = createSaver({
      reader,
      save: (press, field) => {
        if (!session) return;
        const outcome = session.pressed(judgePress(options.store, manifest, shown, press));
        tally();
        acted(field, { as: press.as, ...outcome });
      },
    });
    const leaving = () => saver.flush();
    window.addEventListener("pagehide", leaving);
    flushSaves = () => {
      window.removeEventListener("pagehide", leaving);
      saver.flush();
    };
    const prefilled = new WeakSet<Element>();
    refill = () => {
      /* A card bound to a record is a link once it is drawn whole: whether it holds a field is known only then (pressable.ts). */
      links.refresh(shadow);
      markPresses(shadow);
      fillPrefills(shadow, reader, prefilled, (asked) => prefillOf(options.store, options.principal, manifest, shown, asked));
      media?.refresh(shadow);
      drops?.refresh();
    };
    drawing = createOpenDrawing(shadow, {
      origin: options.origin ?? window.location.origin,
      ...(options.asset ? { asset: options.asset } : {}),
      ...(options.images ? { imageOrigins: options.images.origins } : {}),
      /* A record's picture the host handed is drawn as handed, at any size (FR-192). */
      ...(manifest.pictures ? { picture: (value: string) => pictures?.drawn(value) } : {}),
      /* An image's address refused is said once, with why and what would do — not left to be found in `refused`. */
      onRefused: (refusal) => {
        if (refusal.reason !== "url" || refusal.element !== "img" || refusal.address === undefined || toldImages.has(refusal.address)) return;
        toldImages.add(refusal.address);
        const said = imageRefusedWords(refusal.address, { ...(options.images ? { origins: options.images.origins } : {}), assets: options.asset !== undefined }, refusal.length);
        port?.postMessage({ type: "notice", text: said });
        options.onProblem?.(said);
      },
      ...(options.limits?.maxNodes !== undefined ? { maxNodes: options.limits.maxNodes } : {}),
      onOverBudget: () => fail("nodes"),
      send,
      onFieldSet: (field) => reader.filled(field),
      onAttribute: (element, name) => {
        if (name === "data-record" || name === "data-place") links.link(element);
        if (name === "data-lightbox") marksMedia(element);
        if (name === "data-drop") wantDrops();
      },
      decorate: (element) => {
        if (element.hasAttribute("data-record") || element.hasAttribute("data-place")) links.link(element);
        marksMedia(element);
        if (element.hasAttribute("data-drop")) wantDrops();
      },
      /*
       * THE VIEWER'S PRESS, IN ITS OWN HANDLER (FR-92). A trusted click on
       * an element bound to an act is judged and applied here, before the
       * view hears of it; the view is told what became of it.
       */
      before: (event, at, root) => {
        reader.heard(event, at);
        saver.heard(event, at, root);
        /* A link the view drew — an <a>, a card, a row — goes where it says, if that is a record or a place of this app: on a click, a tap or Enter, from anywhere inside it but a press of its own. */
        links.pressed(event, at, root);
        /* The viewer's own press opens the host's full-screen viewer: a click, or Enter or Space on what is not a button (which clicks of itself). */
        const lightbox = at.closest("[data-lightbox]");
        const key = event.type === "keydown" ? (event as KeyboardEvent).key : undefined;
        if (lightbox && root.contains(lightbox) && event.isTrusted && (event.type === "click" || ((key === "Enter" || key === " ") && lightbox.localName !== "button"))) {
          event.preventDefault();
          event.stopPropagation();
          media?.open(lightbox);
        }
        /* A tap on a drop target on a phone, or Enter on one, opens the host's picker (FR-193): the host's, not the view's. */
        if (drops?.before(event, at, root)) return false;
        const press = reader.press(event, at, root);
        if (!press || !session) return;
        event.stopPropagation();
        /* Space on a press is the press, never the page scrolling under it. */
        if (event.type === "keydown") event.preventDefault();
        const outcome = session.pressed(judgePress(options.store, manifest, shown, press));
        tally();
        const pressed = { as: press.as, ...outcome };
        /* Told with the click, and then as `acted`, the one event a view hears every act's outcome by. */
        const bound = at.closest("[data-act]")!;
        queueMicrotask(() => acted(bound, pressed));
        return { pressed };
      },
    });
    for (const one of waiting.splice(0)) draw(one);
    mark();
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
          if (message.type === "props" && typeof message.push === "number") {
            pending.set(message.push, clock.now());
            mark();
          }
          given.postMessage(message);
        },
        props: () => {
          const props = workerViewProps(options.store, options.principal, { manifest, ...(options.input ? { input: options.input() } : {}), theme: theme(), ...(options.places ? { places: guestPlacesOf(options.places()) } : {}) });
          shown = new Set([...(props.node ? [props.node.id] : []), ...(props.nodes ?? []).map((node) => node.id)]);
          lastProps = props;
          return props;
        },
        ...(pictures ? { hand: pictures.hand } : {}),
        judgeAct: (name, args) => judgeCodeAct(options.store, manifest, name, args, { shown, file: (href) => handed.get(href) ?? fileOnShown(href), dropped: (href) => handed.has(href) }),
        /* A view that hears `drop` is left the drop (FR-193). */
        onHears: (events) => {
          if (events.includes("drop")) hearsDrop = true;
        },
        /* Where it listens for a gesture (0.1.42): heard only where its manifest says gestures. */
        onGestures: bindGestures,
        onRender: (records) => {
          drew = true;
          draw(["render", records]);
        },
        onPushed: (push, ms) => {
          pending.delete(push);
          if (ms >= limits.pushMs) return fail("slow");
          answered = true;
          mark();
        },
        /* Past the message allowance, a view is stopped, not read on (FR-94). */
        onFlood: () => fail("flood"),
        onStyle: (css) => draw(["style", css]),
        places: () => [...new Set([...guestPlacesOf(options.places?.() ?? []).map((place) => place.as), ...lists().map((list) => list.slug)])],
        ...(options.limits ? { limits: options.limits } : {}),
        limiter,
      });
      session = live;
      given.onmessage = ({ data }) => {
        if (started?.answer(data)) return;
        live.receive(data);
        tally();
        /* Where the view asked to go is the links' to judge, so one that goes nowhere says why (FR-93); one that names no string is refused unsaid. */
        if (!failed && data?.nonce === nonce && data.type === "navigate") {
          /* Narrowed and to a section, as it asked: the links hold the filter to the kind's fields. */
          const also = { ...(data.where !== undefined ? { where: data.where } : {}), ...(data.section !== undefined ? { section: data.section } : {}) };
          const to: Destination | false = typeof data.place === "string" ? { place: data.place, ...also } : typeof data.to === "string" && { record: data.to, ...also };
          if (to) links.go(to);
        }
      };
      push();
    },
  }));
  const run = (code: WorkerViewCode) => {
    if ("source" in code) {
      void (manifest.pictures ? Promise.all([viewScript(code.source), picturesReady]).then(([script]) => script) : viewScript(code.source)).then(
        (script) => {
          if (!failed) begin({ script });
        },
        () => fail("start", "the view's runtime could not be loaded"),
      );
    } else if (!manifest.pictures) begin(code);
    else
      void picturesReady.then(
        () => {
          if (!failed) begin(code);
        },
        () => fail("start", "the view's pictures could not be loaded"),
      );
  };
  /*
   * CODE FETCHED WHEN THE VIEW IS DRAWN (Roadmap f-heavy-apps-fast): a host
   * hands `worker` as a function, asked once per function however often the
   * view is drawn, and again after it rejected. Judged as handed code is
   * once it arrives; one that never does is refused `source` in words.
   */
  if (typeof given === "function")
    void codeOf(given).then(
      (code) => {
        if (failed) return;
        const refused = refusedCode(code);
        if (refused) fail(...refused);
        else run(code);
      },
      (error: unknown) => fail("source", `Its code did not arrive${error instanceof Error && error.message ? `: ${error.message}` : ""}.`),
    );
  else run(given);

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
