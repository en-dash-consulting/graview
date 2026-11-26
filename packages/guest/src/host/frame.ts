import type { ViewProblemSaid } from "./problems.js";
import type { AnySchema, AppVideo, Principal, Store } from "@graview/core";
import { holdRecordBoxes, judgeRecordBoxes, judgeRecordIds, MOST_RECORD_BOXES, recordBoxesMoved } from "@graview/core/record-boxes";
import { GUEST_PROTOCOL, GUEST_SANDBOX, OPAQUE_ORIGIN, isGuestReady, type GuestFont, type GuestPlace, type GuestTheme, type HostHello, type HostMessage } from "../protocol.js";
import { mintNonce } from "./nonce.js";
import { createGuestHost, createGuestLimiter, type GuestHost, type GuestLimits, type GuestReads, type GuestStats, type GuestViewInput } from "./session.js";
import { retryingImport } from "@graview/core/retry";
import { untilItArrives } from "./arrive.js";
import type { GuestPictureHand, GuestPictures } from "./pictures.js";
import type { Arrival } from "./links.js";
import { arriveAt } from "./arrive-at.js";
import type { GoTo } from "@graview/react/provider";
import { createGuestLogo, readTheme, themeWithBrand, watchTheme, type GuestBrand } from "./theme.js";

/* The pictures' host, fetched only for a frame that asks for them (FR-175): a page of frames that do not carries none of it. */
const picturesChunk = retryingImport(() => import("./pictures.js"));
/* The faces' reader, fetched only for a frame whose brand lends faces (Roadmap f-faces-lent-to-frames). */
const fontsChunk = retryingImport(() => import("./fonts.js"));
/** The longest a frame waits for the faces it is lent before it says it has drawn: as long as a picture is given to load. */
export const FACES_WAIT_MS = 2_000;

/*
 * A FRAME GUEST'S HOST: `@graview/guest/host/frame`. Mounting a frame into
 * any element, the host without the DOM, and the theme read off the page —
 * apart from `@graview/guest/host`, so a page that registers a `guestView`
 * fetches this as the view is first drawn rather than up front (FR-179).
 */
export { createGuestHost, createGuestLimiter, readAcross } from "./session.js";
export { readTheme } from "./theme.js";
export { GUEST_PROTOCOL, GUEST_SANDBOX, OPAQUE_ORIGIN } from "../protocol.js";
/* What a view's host says went wrong, by a code that stays when the words change (HQ f-view-problem-codes). */
export { VIEW_PROBLEM_CODES } from "./problems.js";
export type { ViewProblem, ViewProblemCode, ViewProblemSaid } from "./problems.js";

export interface MountGuestViewOptions<S extends AnySchema> {
  /** Where the guest's code is served. Where that is, and its CSP, are the host's business. */
  readonly url: string;
  /** The view's registered name: what the rail says an act came through (`via: "view:<name>"`). */
  readonly view: string;
  readonly store: Store<S>;
  /** The viewer: what is pushed is what they may see, and what is asked for is applied as them. */
  readonly principal: Principal;
  /** What is drawn where the guest is. */
  readonly input?: () => GuestViewInput;
  /**
   * The other kinds and the edges the guest is shown, beyond what it is
   * drawn over (FR-85): `{ kinds: ["offer"], edges: ["includes"] }` hands a
   * guest over packages each package's offers, as the viewer sees them.
   */
  readonly reads?: GuestReads;
  /**
   * The app's look now (FR-86). Read off the element the frame is drawn in
   * by default — its `--graview-*` tokens, and the app's own scheme — and
   * pushed again when the app's toggle changes it, whatever the system
   * prefers.
   */
  readonly theme?: () => GuestTheme;
  /**
   * The app's brand (FR-127): its name, and its logo, handed as a `data:`
   * image the host made — an inline SVG, or an address on the page's own
   * origin the host fetched — since a frame is another origin. Pushed
   * again when it changes (`update`).
   */
  readonly brand?: () => GuestBrand | undefined;
  /**
   * THE APP'S OWN VIDEO (HQ f-reel-mount-tests-and-frames): the reel the
   * host keeps for the whole app, as a worker view is handed it. The frame
   * is pushed its facts in `props.theme.reel` — what it is, how long,
   * whether it has a poster and whether it plays — and never its address,
   * its poster's or its captions'; pushed again when it changes (`update`).
   */
  readonly reel?: () => AppVideo | undefined;
  /**
   * The pictures on the records the guest is handed (FR-175): `true`, or
   * `{ width }`, the widest it draws one in CSS pixels. Each file a record
   * holds is then handed as a `GuestFile` — a picture with `src`, a
   * `data:` image the host made from the bytes it fetched as the viewer
   * (a frame is another origin, where neither the host's path nor its
   * `blob:` loads); a document by its name, type and size. Within
   * `limits.pictureBytes` and `limits.picturesBytes`. Left out, a file is
   * handed as the record keeps it.
   */
  readonly pictures?: GuestPictures;
  /** Where a record's file (`FileValue.href`) is fetched for those pictures: a host serving the app under a base answers `base + href`. The href resolved against the page by default. */
  readonly file?: (href: string) => string | undefined;
  /**
   * Where a file the app holds (`/graview/assets/<sha256>.woff2`) is read
   * from for the faces its brand lends its views (`brand.views.fonts`,
   * Roadmap f-faces-lent-to-frames), as a worker view's `asset` says. Each
   * face is read by the host, at most 2 MB, and handed to the frame as a
   * `data:` font its client puts in the frame's document: the frame's policy
   * allows `font-src data:` and is asked for nothing more. Without it, a face
   * the app holds is not lent, and that is said (`onProblem`).
   */
  readonly asset?: (path: string) => string | undefined;
  /** The `https:` origins a lent face may be read from by address, as a worker view's `fonts` says: none by default. */
  readonly fonts?: { readonly origins: readonly string[] };
  /**
   * What the host could not do for the frame, in a sentence: a face it did
   * not lend, and why; the guest's height held (`onSize`). Beside it, what
   * it is: a code from `VIEW_PROBLEM_CODES` that stays when the words change.
   */
  readonly onProblem?: ViewProblemSaid;
  /** The app's named places: what the guest is told of (`props.places`), and may ask to go to by slug. None by default. */
  readonly places?: () => readonly GuestPlace[];
  readonly onNavigate?: (id: string) => void;
  /** The guest asked to go to one of `places`, by its slug. */
  readonly onNavigatePlace?: (as: string) => void;
  /** Where the guest asked to go, judged — a record, a place or a kind's list, narrowed and to a section — in place of `onNavigate` and `onNavigatePlace` (`GuestHostOptions.onArrive`). */
  readonly onArrive?: (to: Arrival) => void;
  /** A navigate went nowhere: the sentence saying why. `onProblem` is told it too, as `link-goes-nowhere`. */
  readonly onLost?: (said: string) => void;
  /** The face's own way of going (`useGoTo`), read when the guest goes: where `onArrive` is not given, the arrival is gone to by it. */
  readonly goTo?: () => GoTo | undefined;
  /**
   * The guest asked for a height. By default the frame takes it. Not told a
   * height the growth guard held (Roadmap f-guest-growth-guard): a guest
   * whose every height tracks the frame's own a few times running is held,
   * the frame wears `data-guest-view-held`, and `onProblem` is told why.
   */
  readonly onSize?: (height: number) => void;
  readonly limits?: GuestLimits;
  /** The frame's accessible name. The view's name by default. */
  readonly title?: string;
}

export interface GuestFrame {
  readonly iframe: HTMLIFrameElement;
  /** Push again: the view's input moved. */
  update(): void;
  /**
   * OFF THE PAGE, TO BE GONE BACK TO (Graview HQ f-custom-pages-do-not-flash):
   * the frame is moved out of sight with its document as it is, still handed
   * what changes, an act it asks for refused, a navigate and a height
   * dropped. False where it has not drawn, or the browser cannot move a frame
   * without loading it again (`Element.moveBefore`): the host disposes of it
   * as ever. `gone` is called where it was handed a record its seat may no
   * longer see: the host disposes of it then.
   */
  rest(gone: () => void): boolean;
  /** Back on the page, in this element, as it stood. False where it cannot be: the host disposes of it and draws it anew. */
  wake(onto: HTMLElement): boolean;
  /** What this frame has been refused or had dropped, across every document it has loaded. */
  readonly stats: Readonly<GuestStats>;
  dispose(): void;
}

/*
 * What the page adds and takes away, watched once a document for every
 * frame drawn in it (LOADED AGAIN, DRAWN AGAIN, below): each frame is asked
 * whether its window is another. A frame in a shadow root is not seen
 * moved within it; none is drawn there.
 */
const reloadWatches = new WeakMap<Document, { readonly observer: MutationObserver; readonly frames: Set<() => void> }>();
function watchReloads(document: Document, look: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => undefined;
  let watch = reloadWatches.get(document);
  if (!watch) {
    const frames = new Set<() => void>();
    const observer = new MutationObserver(() => {
      for (const one of [...frames]) one();
    });
    observer.observe(document, { childList: true, subtree: true });
    watch = { observer, frames };
    reloadWatches.set(document, watch);
  }
  const { frames } = watch;
  frames.add(look);
  return () => {
    frames.delete(look);
    if (frames.size === 0 && reloadWatches.get(document)?.frames === frames) {
      reloadWatches.get(document)!.observer.disconnect();
      reloadWatches.delete(document);
    }
  };
}

/** An element that can be moved to without what is moved being taken down (Chrome 133, Firefox 144). */
interface Moves {
  moveBefore?(node: Node, child: Node | null): void;
}

/**
 * MOUNT A GUEST VIEW: an iframe sandboxed to scripts alone, so its origin
 * is opaque and nothing of the host's is reachable from it, and one
 * MessageChannel handed over when it says it is ready.
 *
 * A `guest-ready` is answered only when it comes from this frame's own
 * window and from the opaque origin — a frame that somehow had an origin of
 * its own is not a guest. Each one gets a fresh nonce and port, and the one
 * before is closed, so a document the frame navigated away from keeps
 * nothing. Requests ride the port with the nonce, and the host applies an
 * act as the viewer, never as the guest.
 */
export function mountGuestView<S extends AnySchema>(element: HTMLElement, options: MountGuestViewOptions<S>): GuestFrame {
  const document = element.ownerDocument;
  const window = document.defaultView!;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", GUEST_SANDBOX);
  iframe.setAttribute("referrerpolicy", "no-referrer");
  /* No camera, microphone, geolocation, payment or fullscreen: a guest asks the host, it does not get features. */
  iframe.setAttribute("allow", "");
  iframe.setAttribute("title", options.title ?? options.view);
  iframe.setAttribute("data-guest-view", options.view);
  // Busy until the guest has drawn, or its time is up (FR-188): what a page that says it has drawn waits for.
  iframe.setAttribute("aria-busy", "true");
  iframe.style.border = "0";
  iframe.style.width = "100%";
  iframe.style.display = "block";
  iframe.src = options.url;

  /* The element it is drawn in: where its look is read. */
  let holder = element;
  /* Off the page, out of sight, with the look it was last pushed. */
  let reloaded = false;
  let resting: { readonly shelf: HTMLElement; readonly theme: GuestTheme } | undefined;
  const stats: GuestStats = { applied: 0, refused: 0, dropped: 0 };
  /* The frame's, not a session's: saying "ready" again buys a new nonce, never a new allowance. */
  const limiter = createGuestLimiter(options.limits);
  let session: GuestHost | undefined;
  let port: MessagePort | undefined;
  let counted: GuestStats = { applied: 0, refused: 0, dropped: 0 };
  const tally = () => {
    if (!session) return;
    const now = session.stats;
    stats.applied += now.applied - counted.applied;
    stats.refused += now.refused - counted.refused;
    stats.dropped += now.dropped - counted.dropped;
    counted = { ...now };
  };

  /* The app's look, kept up (FR-86): pushed again when what the frame would be handed has changed. */
  const logo = createGuestLogo(window as Window & typeof globalThis, () => push(), "data");
  const theme = () => resting?.theme ?? themeWithBrand(() => options.theme?.() ?? readTheme(holder), options.brand, logo, options.reel);
  /*
   * THE FACES THE APP LENDS ITS VIEWS, LENT TO THE FRAME (Roadmap
   * f-faces-lent-to-frames): read by the host as the brand lends them, once a
   * page for every frame in the same brand (fonts.ts, `readFrameFonts`), and
   * handed over the port as `data:` fonts, again whenever the brand changes
   * them and to every document the frame loads. The frame waits for them
   * before it says it has drawn, for `FACES_WAIT_MS` at most: past it, it is
   * said which face has not come, and the frame is handed it when it does.
   */
  let fontsAsked = "[[],null]";
  let lentFonts: readonly GuestFont[] = [];
  let fontsReading: { stopped: boolean } | undefined;
  let fontsLate: ReturnType<typeof setTimeout> | undefined;
  const sendFonts = () => port?.postMessage({ type: "fonts", fonts: lentFonts } satisfies HostMessage);
  const lendFonts = () => {
    const given = options.brand?.();
    const fonts = given?.views?.fonts ?? [];
    const typography = given?.typography;
    const asked = JSON.stringify([fonts, typography ?? null]);
    if (asked === fontsAsked) return;
    fontsAsked = asked;
    if (fontsReading) fontsReading.stopped = true;
    fontsReading = undefined;
    clearTimeout(fontsLate);
    if (fonts.length === 0) {
      if (lentFonts.length > 0) {
        lentFonts = [];
        sendFonts();
      }
      return;
    }
    const reading = { stopped: false };
    fontsReading = reading;
    const done = () => {
      clearTimeout(fontsLate);
      if (fontsReading === reading) fontsReading = undefined;
      drew();
    };
    void fontsChunk()
      .then(({ readFrameFonts }) => {
        if (reading.stopped) return;
        const lending = readFrameFonts(window as Window & typeof globalThis, fonts, { ...(options.asset ? { asset: options.asset } : {}), ...(options.fonts ? { origins: options.fonts.origins } : {}), ...(typography ? { typography } : {}) });
        fontsLate = setTimeout(() => {
          if (reading.stopped || fontsReading !== reading) return;
          const late = lending.waiting();
          if (late.length > 0) options.onProblem?.(`The app's ${late.length === 1 ? "face" : "faces"} ${late.map((family) => `"${family}"`).join(", ")} for its views did not arrive in ${FACES_WAIT_MS / 1_000} seconds, so the frame is drawn without ${late.length === 1 ? "it" : "them"} and handed ${late.length === 1 ? "it" : "them"} once ${late.length === 1 ? "it arrives" : "they arrive"}.`, { code: "face-late" });
          fontsReading = undefined;
          drew();
        }, FACES_WAIT_MS);
        return lending.read.then(({ fonts: read, said }) => {
          if (reading.stopped) return;
          for (const [one, problem] of said) options.onProblem?.(one, problem);
          lentFonts = read;
          sendFonts();
          done();
        });
      })
      .catch(() => {
        if (!reading.stopped) done();
      });
  };
  let pushed = "";
  const push = () => {
    lendFonts();
    if (!session) return;
    pushed = JSON.stringify(theme());
    session.push();
  };
  const unwatch = watchTheme(document, () => {
    if (session && !resting && JSON.stringify(theme()) !== pushed) push();
  });

  /*
   * The pictures on what it is handed (FR-175), where its host asks:
   * `data:` images, pushed again as each is ready. A guest that says it is
   * ready before their host has arrived is answered once it has, so it is
   * never handed a record's path to a file.
   */
  let pictures: GuestPictureHand | undefined;
  let waiting = false;
  const stopPictures = options.pictures
    ? untilItArrives(picturesChunk, ({ createGuestPictures }) => {
        pictures = createGuestPictures(window as Window & typeof globalThis, { as: "data", view: `"${options.title ?? options.view}"`, pictures: options.pictures!, ...(options.limits ? { limits: options.limits } : {}), ...(options.file ? { file: options.file } : {}), moved: () => {
          session?.push();
          // The last picture handed: drawn once the guest has had a moment with it.
          if (handed) soon();
        } });
        if (waiting) greet();
      })
    : () => {};

  /*
   * DRAWN, OR NOT IN TIME (FR-188): the frame says `data-guest-view-drawn`
   * once the guest has said it is ready, been handed what it shows (its
   * pictures among it) and asked for its height — what the protocol says
   * once it has rendered — or, for a guest that never asks, stayed quiet
   * for a moment after; and `data-guest-view-failed="silent"` when it does
   * not say it is ready in `limits.readyMs`, so a page that says it has
   * drawn (the embed's `data-graview-drawn`) waits for neither longer. The
   * frame is `aria-busy` until one or the other, and the element it is
   * drawn in is not from the moment the frame is in it.
   */
  let handed = false;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  const drew = () => {
    if (!handed || pictures?.waiting() || fontsReading) return;
    clearTimeout(quiet);
    iframe.removeAttribute("data-guest-view-failed");
    iframe.removeAttribute("aria-busy");
    iframe.setAttribute("data-guest-view-drawn", "");
  };
  const soon = () => {
    clearTimeout(quiet);
    quiet = setTimeout(drew, 250);
  };
  const unready = () =>
    setTimeout(() => {
      if (session) return;
      iframe.removeAttribute("aria-busy");
      iframe.setAttribute("data-guest-view-failed", "silent");
    }, options.limits?.readyMs ?? 8_000);
  let silent = unready();

  /*
   * WHERE ITS RECORDS ARE (Graview HQ feature:f-one-face-lines-from-frame-views):
   * what the guest last said of its `data-record` elements, kept as said
   * and judged each time a page reads
   * it, against the frame and the records it was handed as its seat sees
   * them then: a record the seat comes to see has its line without the
   * guest saying it again. A page that draws lines to records (the one
   * face) reads it off the frame (`RECORD_BOXES`); the guest is told
   * nothing of it.
   */
  let saidBoxes: readonly unknown[] = [];
  let saidShows: readonly unknown[] = [];
  const mayName = () => {
    const graph = options.store.seenBy(options.principal).graph;
    const handed = session?.handed;
    return (id: string) => handed !== undefined && handed.has(id) && graph.has(id);
  };
  let showsSaid = "";
  const report = (boxes: unknown, shows: unknown) => {
    saidBoxes = Array.isArray(boxes) ? boxes.slice(0, MOST_RECORD_BOXES * 2) : [];
    saidShows = Array.isArray(shows) ? shows.slice(0, MOST_RECORD_BOXES * 2).filter((one): one is string => typeof one === "string" && one.length <= 200) : [];
    const now = (saidShows as string[]).join(" ");
    if (now !== showsSaid) {
      showsSaid = now;
      recordBoxesMoved(iframe);
    }
  };
  holdRecordBoxes(iframe, {
    boxes: () => (resting || saidBoxes.length === 0 ? [] : judgeRecordBoxes(saidBoxes, { width: iframe.clientWidth, height: iframe.clientHeight, sees: mayName() })),
    shows: () => (resting || saidShows.length === 0 ? [] : judgeRecordIds(saidShows, mayName())),
  });

  const end = () => {
    report([], []);
    tally();
    session?.dispose();
    port?.close();
    session = undefined;
    port = undefined;
    counted = { applied: 0, refused: 0, dropped: 0 };
  };

  const onMessage = (event: MessageEvent) => {
    /* Only this frame's window, and only the opaque origin: anything else is not this guest. */
    if (event.source === null || event.source !== iframe.contentWindow) return;
    if (event.origin !== OPAQUE_ORIGIN || !limiter.message()) {
      stats.dropped += 1;
      return;
    }
    if (!isGuestReady(event.data) || event.data.protocol !== GUEST_PROTOCOL) {
      stats.dropped += 1;
      return;
    }
    if (options.pictures && !pictures) {
      waiting = true;
      return;
    }
    greet();
  };

  /* Answer the guest's ready: a fresh nonce and port, the one before closed. */
  const greet = () => {
    /* Off the page it answers nobody new: a document it loaded meanwhile waits, unanswered, and is drawn anew. */
    if (resting) {
      reloaded = true;
      return;
    }
    waiting = false;
    end();
    const nonce = mintNonce();
    const channel = new MessageChannel();
    port = channel.port1;
    const live = createGuestHost({
      store: options.store,
      principal: options.principal,
      view: options.view,
      nonce,
      send: (message) => channel.port1.postMessage(message),
      ...(options.input ? { input: options.input } : {}),
      ...(options.reads ? { reads: options.reads } : {}),
      ...(pictures ? { hand: pictures.hand } : {}),
      theme,
      ...(options.places ? { places: () => [...new Set(options.places!().map((place) => place.as))], placesShown: options.places } : {}),
      ...(options.onNavigatePlace ? { onNavigatePlace: options.onNavigatePlace } : {}),
      ...(options.onNavigate ? { onNavigate: options.onNavigate } : {}),
      ...(options.onArrive ? { onArrive: options.onArrive } : options.goTo ? { onArrive: (to: Arrival) => arriveAt(options.goTo!(), to) } : {}),
      /* A navigate that went nowhere is the host's problem as well, with its code, as a worker view's is. */
      ...(options.onLost || options.onProblem
        ? {
            onLost: (said: string) => {
              options.onLost?.(said);
              options.onProblem?.(said, { code: "link-goes-nowhere" });
            },
          }
        : {}),
      onRecords: report,
      onSize: (height) => {
        if (options.onSize) options.onSize(height);
        else iframe.style.height = `${height}px`;
        drew();
      },
      /* Held, growing only with its own frame (Roadmap f-guest-growth-guard): said, and worn on the frame with the height it is held at. */
      onHeld: (said, height, problem) => {
        iframe.setAttribute("data-guest-view-held", `${height}px`);
        options.onProblem?.(said, problem);
        drew();
      },
      /* Taller than it may be (`limits.maxHeight`): given that height, and said. */
      ...(options.onProblem ? { onProblem: options.onProblem } : {}),
      ...(options.limits ? { limits: options.limits } : {}),
      limiter,
    });
    session = live;
    channel.port1.onmessage = (message) => {
      live.receive(message.data);
      tally();
    };
    const hello: HostHello = { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce, view: options.view };
    /*
     * "*" because an opaque origin cannot be named as a target. It goes to
     * this frame's window alone, and carries nothing but the port and the
     * nonce: what the viewer may see comes over the port.
     */
    iframe.contentWindow!.postMessage(hello, "*", [channel.port2]);
    push();
    if (lentFonts.length > 0) sendFonts();
    handed = true;
    soon();
  };
  window.addEventListener("message", onMessage);
  /* The faces are read as the frame is mounted, not once the guest is ready: the guest is handed them as soon after as they are read. */
  lendFonts();
  element.appendChild(iframe);
  element.removeAttribute("aria-busy");

  /*
   * LOADED AGAIN, DRAWN AGAIN (Graview HQ feature:f-frame-guest-mark-after-move).
   * Where the browser cannot move an element as it is (no `moveBefore`), a
   * frame taken out of the page and put back — the one face taking in the
   * page it is on — loads its page again from nothing, in a new window. Its
   * mark comes off then, the frame busy again and the guest's session let
   * go, and it is said again once the new page has drawn, or is silent past
   * its time. Seen from what the page adds and takes away, and only where
   * the frame's window is another.
   */
  let shown = iframe.contentWindow;
  const unwatchReloads = watchReloads(document, () => {
    const now = iframe.contentWindow;
    if (now === shown) return;
    shown = now;
    end();
    handed = false;
    waiting = false;
    clearTimeout(quiet);
    clearTimeout(silent);
    iframe.removeAttribute("data-guest-view-drawn");
    iframe.removeAttribute("data-guest-view-failed");
    // A page loaded again starts as tall as it asks: what was held of the one before is not.
    iframe.removeAttribute("data-guest-view-held");
    iframe.setAttribute("aria-busy", "true");
    silent = unready();
  });

  return {
    iframe,
    update: push,
    rest(gone) {
      const live = session;
      const body = document.body as (HTMLElement & Moves) | null;
      if (resting || !live || !body || typeof body.moveBefore !== "function" || !iframe.isConnected || !iframe.hasAttribute("data-guest-view-drawn") || iframe.hasAttribute("data-guest-view-held") || pictures?.waiting()) return false;
      const shelf = document.createElement("div") as HTMLDivElement & Moves;
      shelf.setAttribute("data-guest-view-kept", "");
      shelf.setAttribute("aria-hidden", "true");
      shelf.inert = true;
      /* As wide as it stood, so nothing in it lays out again; in sight of nobody, and nothing of the page's to press or scroll to. */
      shelf.style.cssText = `position:fixed;left:-100000px;top:0;width:${iframe.clientWidth}px;visibility:hidden;pointer-events:none`;
      const look = theme();
      body.appendChild(shelf);
      try {
        shelf.moveBefore!(iframe, null);
      } catch {
        shelf.remove();
        return false;
      }
      resting = { shelf, theme: look };
      /* Told it is off the page (HQ f-kept-frame-told-off-page): its client pauses what it plays, and its code hears it. */
      port?.postMessage({ type: "away", away: true } satisfies HostMessage);
      /* Nothing of it is in sight; what it said of its records stands for when it is. */
      recordBoxesMoved(iframe);
      live.rest({
        push: true,
        moved: () => {
          const sees = options.store.seenBy(options.principal).graph;
          if (session === live && [...live.handed].every((id) => sees.has(id))) return true;
          gone();
          return false;
        },
      });
      return true;
    },
    wake(onto) {
      const was = resting;
      if (!was || !session || reloaded) return false;
      try {
        (onto as HTMLElement & Moves).moveBefore!(iframe, null);
      } catch {
        return false;
      }
      holder = onto;
      resting = undefined;
      was.shelf.remove();
      onto.removeAttribute("aria-busy");
      session.rest(undefined);
      port?.postMessage({ type: "away", away: false } satisfies HostMessage);
      recordBoxesMoved(iframe);
      push();
      return true;
    },
    get stats() {
      tally();
      return stats;
    },
    dispose() {
      unwatchReloads();
      end();
      clearTimeout(silent);
      clearTimeout(quiet);
      unwatch();
      if (fontsReading) fontsReading.stopped = true;
      clearTimeout(fontsLate);
      logo.dispose();
      stopPictures();
      pictures?.dispose();
      window.removeEventListener("message", onMessage);
      holdRecordBoxes(iframe, undefined);
      iframe.remove();
      resting?.shelf.remove();
    },
  };
}
