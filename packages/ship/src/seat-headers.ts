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
