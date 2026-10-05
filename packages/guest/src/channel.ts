import {
  GUEST_PROTOCOL,
  isHostHello,
  type GuestAnswer,
  type GuestEvent,
  type GuestProps,
  type GuestRequest,
  type HostMessage,
} from "./protocol.js";

/**
 * A GUEST'S ONE CHANNEL to the host that started it. It can read what the
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
  /** Ask for the height of an element whenever it changes. Returns the stop. In a worker, where nothing is laid out, it does nothing. */
  autoSize(element?: Element): () => void;
  close(): void;
}

/** A request before the nonce is put on it. */
export type Unsent = GuestRequest extends infer R ? (R extends GuestRequest ? Omit<R, "nonce"> : never) : never;

/**
 * Where a guest's hello comes from, and where it says it is ready: the
 * parent window for a frame, the worker's owner for a worker. Everything
 * after the hello is the port's, and the same for both.
 */
export interface GuestLink {
  /** Start hearing messages that might be the hello. Returns the stop. */
  listen(heard: (event: MessageEvent) => void): () => void;
  /** Whether a message came from where a hello may come from. */
  fromHost(event: MessageEvent): boolean;
  /** Say ready. */
  ready(message: { readonly graview: "guest-ready"; readonly protocol: number }): void;
}

/**
 * The guest's half of the protocol, whatever it runs in: say ready, take
 * the first hello from the host, and talk only over the port that came
 * with it, every request carrying the hello's nonce.
 */
export function openGuest(link: GuestLink, hooks: { readonly onEvent?: (event: GuestEvent) => void } = {}): { readonly guest: Guest; send(request: Unsent): void } {
  let port: MessagePort | undefined;
  let nonce = "";
  let props: GuestProps | undefined;
  let next = 0;
  const listeners = new Set<(props: GuestProps) => void>();
  const waiting = new Map<string | number, (answer: GuestAnswer) => void>();
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
    } else if (message.type === "event" && typeof message.listener === "number") {
      hooks.onEvent?.(message);
    } else if (message.type === "heartbeat" && typeof message.beat === "number") {
      /* The runtime answers, so only a blocked event loop goes quiet. */
      send({ type: "heartbeat", beat: message.beat });
    }
  };

  let stop = () => {};
  const hello = (event: MessageEvent) => {
    if (port) return;
    if (!link.fromHost(event)) return;
    if (!isHostHello(event.data) || event.data.protocol !== GUEST_PROTOCOL) return;
    const given = event.ports[0];
    if (!given) return;
    port = given;
    nonce = event.data.nonce;
    port.onmessage = fromHost;
    port.start?.();
    stop();
    for (const request of queued.splice(0)) send(request);
  };
  stop = link.listen(hello);
  link.ready({ graview: "guest-ready", protocol: GUEST_PROTOCOL });

  let observer: { disconnect(): void } | undefined;
  const guest: Guest = {
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
      if (!target || !Observer || typeof target.getBoundingClientRect !== "function") return () => {};
      observer?.disconnect();
      const watching = new Observer(() => guest.size(Math.ceil(target.getBoundingClientRect().height)));
      watching.observe(target);
      observer = watching;
      return () => watching.disconnect();
    },
    close() {
      observer?.disconnect();
      stop();
      port?.close();
      listeners.clear();
    },
  };
  return { guest, send };
}
