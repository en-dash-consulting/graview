/**
 * The headers a request carries its seat in — what the framework's own
 * clients send, and what `serveStore` reads ONLY when the host says it
 * trusts them (`trustSeatHeaders`). A header is a claim anybody who can
 * reach the server can make, so a store open to a network asks its own
 * `seatOf` instead (FR-06).
 */
export const SEAT_HEADERS = {
  seat: "x-graview-seat",
  roles: "x-graview-roles",
  /** `agent`, `system`, `rule`; absent is a person. */
  kind: "x-graview-kind",
  /** The seat's own name, URI-encoded. */
  name: "x-graview-name",
  /** The person an agent acts for, their roles, and their name. */
  for: "x-graview-for",
  forRoles: "x-graview-for-roles",
  forName: "x-graview-for-name",
  /**
   * What the calls come through — `web`, `mcp:Claude` — believed exactly
   * when the seat is, and otherwise ignored: the channel is the host's
   * word, never the client's (FR-52).
   */
  via: "x-graview-via",
} as const;

/**
 * THE RUN'S KEY (`graview serve` on loopback). Loopback is this machine, but
 * this machine is not one person: another account on it, or any program
 * that is no browser, reaches 127.0.0.1 and says no `Origin`. So `graview
 * serve` mints a secret each time it starts and believes a seat only from a
 * request that carries it — in `x-graview-key`, in the `graview_key` query
 * parameter (a page's WebSocket, which cannot set a header), or in the
 * `graview_key_<port>` cookie a page is given for opening the printed address
 * (named for the port: a browser sends a cookie to every port of a host).
 */
export const SERVE_KEY = {
  header: "x-graview-key",
  param: "graview_key",
  cookie: "graview_key",
} as const;

/**
 * An address `graview serve` printed, taken apart: where the store is (no
 * trailing slash), the key its `graview_key` parameter carries, and the
 * headers to send there — a host's own, with the key as `x-graview-key`
 * unless they say one already.
 */
export function servedAddress(address: string, headers: Readonly<Record<string, string>> = {}): { readonly url: string; readonly key?: string; readonly headers: Readonly<Record<string, string>> } {
  try {
    const url = new URL(address);
    const key = url.searchParams.get(SERVE_KEY.param);
    if (key) {
      url.searchParams.delete(SERVE_KEY.param);
      return { url: url.origin + url.pathname.replace(/\/$/, "") + url.search, key, headers: { [SERVE_KEY.header]: key, ...headers } };
    }
  } catch {
    // Not an address of its own (a path on the page's server): it carries no key.
  }
  return { url: address.replace(/\/$/, ""), headers };
}
