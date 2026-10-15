import type { AnySchema, Principal, Store } from "@graview/core";
import { GUEST_PROTOCOL, GUEST_SANDBOX, OPAQUE_ORIGIN, isGuestReady, type GuestPlace, type GuestTheme, type HostHello } from "../protocol.js";
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

/*
 * A FRAME GUEST'S HOST: `@graview/guest/host/frame`. Mounting a frame into
 * any element, the host without the DOM, and the theme read off the page —
 * apart from `@graview/guest/host`, so a page that registers a `guestView`
 * fetches this as the view is first drawn rather than up front (FR-179).
 */
export { createGuestHost, createGuestLimiter, readAcross } from "./session.js";
export { readTheme } from "./theme.js";
export { GUEST_PROTOCOL, GUEST_SANDBOX, OPAQUE_ORIGIN } from "../protocol.js";

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
  /** The app's named places: what the guest is told of (`props.places`), and may ask to go to by slug. None by default. */
  readonly places?: () => readonly GuestPlace[];
  readonly onNavigate?: (id: string) => void;
  /** The guest asked to go to one of `places`, by its slug. */
  readonly onNavigatePlace?: (as: string) => void;
  /** Where the guest asked to go, judged — a record, a place or a kind's list, narrowed and to a section — in place of `onNavigate` and `onNavigatePlace` (`GuestHostOptions.onArrive`). */
  readonly onArrive?: (to: Arrival) => void;
  /** A navigate went nowhere: the sentence saying why. */
  readonly onLost?: (said: string) => void;
  /** The face's own way of going (`useGoTo`), read when the guest goes: where `onArrive` is not given, the arrival is gone to by it. */
  readonly goTo?: () => GoTo | undefined;
  /** The guest asked for a height. By default the frame takes it. */
  readonly onSize?: (height: number) => void;
  readonly limits?: GuestLimits;
  /** The frame's accessible name. The view's name by default. */
  readonly title?: string;
}

export interface GuestFrame {
  readonly iframe: HTMLIFrameElement;
  /** Push again: the view's input moved. */
  update(): void;
  /** What this frame has been refused or had dropped, across every document it has loaded. */
  readonly stats: Readonly<GuestStats>;
  dispose(): void;
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
  iframe.style.border = "0";
  iframe.style.width = "100%";
  iframe.style.display = "block";
  iframe.src = options.url;

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
  const theme = () => themeWithBrand(() => options.theme?.() ?? readTheme(element), options.brand, logo);
  let pushed = "";
  const push = () => {
    if (!session) return;
    pushed = JSON.stringify(theme());
    session.push();
  };
  const unwatch = watchTheme(document, () => {
    if (session && JSON.stringify(theme()) !== pushed) push();
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
        pictures = createGuestPictures(window as Window & typeof globalThis, { as: "data", view: `"${options.title ?? options.view}"`, pictures: options.pictures!, ...(options.limits ? { limits: options.limits } : {}), moved: () => session?.push() });
        if (waiting) greet();
      })
    : () => {};

  const end = () => {
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
      ...(options.onLost ? { onLost: options.onLost } : {}),
      onSize: options.onSize ?? ((height) => (iframe.style.height = `${height}px`)),
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
  };
  window.addEventListener("message", onMessage);
  element.appendChild(iframe);

  return {
    iframe,
    update: push,
    get stats() {
      tally();
      return stats;
    },
    dispose() {
      end();
      unwatch();
      logo.dispose();
      stopPictures();
      pictures?.dispose();
      window.removeEventListener("message", onMessage);
      iframe.remove();
    },
  };
}
