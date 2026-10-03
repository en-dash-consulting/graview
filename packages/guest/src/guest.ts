import {
  GUEST_PROTOCOL,
  isHostHello,
  type GuestAnswer,
  type GuestProps,
  type GuestRequest,
  type HostMessage,
} from "./protocol.js";

/** The window a guest runs in, as far as the SDK reads it. */
interface GuestWindow {
  readonly parent: { postMessage(message: unknown, targetOrigin: string): void } | null;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
}

export interface ConnectGuestOptions {
  /**
   * The host's origin, when the guest knows it: a hello from any other
   * origin is ignored. Without it the hello is still taken only from the
   * parent window, which is the frame's host by construction.
   */
  readonly hostOrigin?: string;
  /** The window to connect from. The global one by default. */
  readonly window?: GuestWindow;
}

/**
 * A GUEST'S ONE CHANNEL to the page that framed it. It can read what the
 * host pushed and ask; it cannot reach the store, and an act it asks for
 * is the viewer's to be refused.
 */
export interface Guest {
  /** What the host last pushed, or undefined until the first push. */
  readonly props: GuestProps | undefined;
  /** Called with every push. Returns the unsubscribe. */
  subscribe(listener: (props: GuestProps) => void): () => void;
  /** Ask for an act by name. Resolves with the host's answer; never rejects for a refusal. */
  act(name: string, args?: Readonly<Record<string, unknown>>): Promise<GuestAnswer>;
  /** Ask the host to go to a record. A record the viewer may not see goes nowhere. */
  navigate(to: string): void;
  /** Ask for a height, in CSS pixels. */
  size(height: number): void;
  /** Ask for the height of an element whenever it changes. Returns the stop. */
  autoSize(element?: Element): () => void;
  close(): void;
}

/**
 * Connect a guest view to its host: say it is ready, take the first hello
 * from the parent, and talk only over the port that came with it.
 */
export function connectGuest(options: ConnectGuestOptions = {}): Guest {
  const at = options.window ?? (globalThis as unknown as GuestWindow);
  let port: MessagePort | undefined;
  let nonce = "";
  let props: GuestProps | undefined;
  let next = 0;
  const listeners = new Set<(props: GuestProps) => void>();
  const waiting = new Map<string | number, (answer: GuestAnswer) => void>();
  type Unsent = GuestRequest extends infer R ? (R extends GuestRequest ? Omit<R, "nonce"> : never) : never;
  const queued: Unsent[] = [];

  const send = (request: Unsent) => {
    if (!port) queued.push(request);
    else port.postMessage({ ...request, nonce });
  };

  const fromHost = (event: MessageEvent) => {
    const message = event.data as HostMessage;
    if (!message || typeof message !== "object") return;
    if (message.type === "props") {
      props = message.props;
      for (const listener of listeners) listener(message.props);
    } else if (message.type === "answer") {
      waiting.get(message.id)?.(message);
      waiting.delete(message.id);
    }
  };

  const hello = (event: MessageEvent) => {
    if (port) return;
    if (event.source !== (at.parent as unknown)) return;
    if (options.hostOrigin !== undefined && event.origin !== options.hostOrigin) return;
    if (!isHostHello(event.data) || event.data.protocol !== GUEST_PROTOCOL) return;
    const given = event.ports[0];
    if (!given) return;
    port = given;
    nonce = event.data.nonce;
    port.onmessage = fromHost;
    port.start?.();
    at.removeEventListener("message", hello);
    for (const request of queued.splice(0)) send(request);
  };
  at.addEventListener("message", hello);
  at.parent?.postMessage({ graview: "guest-ready", protocol: GUEST_PROTOCOL }, "*");

  let observer: { disconnect(): void } | undefined;
  return {
    get props() {
      return props;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    act(name, args = {}) {
      const id = (next += 1);
      return new Promise<GuestAnswer>((resolve) => {
        waiting.set(id, resolve);
        send({ type: "act", id, name, args });
      });
    },
    navigate(to) {
      send({ type: "navigate", to });
    },
    size(height) {
      send({ type: "size", height });
    },
    autoSize(element) {
      const target = element ?? (globalThis as { document?: Document }).document?.documentElement;
      const Observer = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
      if (!target || !Observer) return () => {};
      observer?.disconnect();
      const watching = new Observer(() => this.size(Math.ceil(target.getBoundingClientRect().height)));
      watching.observe(target);
      observer = watching;
      return () => watching.disconnect();
    },
    close() {
      observer?.disconnect();
      at.removeEventListener("message", hello);
      port?.close();
      listeners.clear();
    },
  };
}
