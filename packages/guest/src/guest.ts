import { openGuest, type Guest } from "./channel.js";

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

export type { Guest };

/**
 * Connect a guest view to its host: say it is ready, take the first hello
 * from the parent, and talk only over the port that came with it.
 */
export function connectGuest(options: ConnectGuestOptions = {}): Guest {
  const at = options.window ?? (globalThis as unknown as GuestWindow);
  return openGuest({
    listen(heard) {
      at.addEventListener("message", heard);
      return () => at.removeEventListener("message", heard);
    },
    fromHost: (event) => event.source === (at.parent as unknown) && (options.hostOrigin === undefined || event.origin === options.hostOrigin),
    ready: (message) => at.parent?.postMessage(message, "*"),
  }).guest;
}
