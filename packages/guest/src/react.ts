import { useSyncExternalStore } from "react";
import { connectGuest, type ConnectGuestOptions, type Guest } from "./guest.js";
import type { GuestProps } from "./protocol.js";

let shared: Guest | undefined;

/** The one connection this frame has, made on first use. */
export function guest(options?: ConnectGuestOptions): Guest {
  return (shared ??= connectGuest(options));
}

/**
 * WHAT THE HOST PUSHED, in a React guest: undefined until the first push,
 * then every push re-renders. `act`, `navigate` and `size` are the
 * connection's own.
 */
export function useGuest(options?: ConnectGuestOptions): {
  readonly props: GuestProps | undefined;
  readonly act: Guest["act"];
  readonly navigate: Guest["navigate"];
  readonly size: Guest["size"];
} {
  const connection = guest(options);
  const props = useSyncExternalStore(
    (changed) => connection.subscribe(changed),
    () => connection.props,
    () => undefined,
  );
  return { props, act: connection.act, navigate: connection.navigate, size: connection.size };
}

export type { Guest, GuestProps };
