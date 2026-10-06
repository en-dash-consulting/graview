import type { AnySchema, Principal, Store } from "@graview/core";
import { GUEST_PROTOCOL, GUEST_SANDBOX, OPAQUE_ORIGIN, isGuestReady, type HostHello } from "../protocol.js";
import { mintNonce } from "./nonce.js";
import { createGuestHost, createGuestLimiter, type GuestHost, type GuestLimits, type GuestReads, type GuestStats, type GuestViewInput } from "./session.js";

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
  readonly onNavigate?: (id: string) => void;
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
      ...(options.onNavigate ? { onNavigate: options.onNavigate } : {}),
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
    live.push();
  };
  window.addEventListener("message", onMessage);
  element.appendChild(iframe);

  return {
    iframe,
    update: () => session?.push(),
    get stats() {
      tally();
      return stats;
    },
    dispose() {
      end();
      window.removeEventListener("message", onMessage);
      iframe.remove();
    },
  };
}
