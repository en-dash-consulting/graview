/*
 * THE FRAME GUEST'S CLIENT, AS TEXT A HOST CAN INLINE (FR-88):
 * `@graview/guest/client`.
 *
 * `@graview/guest/client.js` is the client as a file, for a host that
 * serves it at a path of its own. Where a frame's policy allows inline
 * script alone (`script-src 'unsafe-inline'`, as Graview Cloud serves an
 * uploaded view), a host puts this text in a `<script>` of the frame's page
 * instead, or names its hash in the policy (`script-src 'sha256-…'`).
 */
export { GUEST_CLIENT, GUEST_CLIENT_SHA256 } from "./client.generated.js";
