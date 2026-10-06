/*
 * THE FRAME GUEST'S CLIENT, AS ONE CLASSIC SCRIPT (FR-88).
 *
 * `connectGuest` is a module, so every frame guest bundled or inlined its
 * own copy. This is the entry `scripts/guest-view-runtime.mjs` bundles into
 * `client.js` at the package's root — `@graview/guest/client.js`, an IIFE
 * that leaves one global, `GraviewGuest`:
 *
 *   const guest = GraviewGuest.connect();
 *   guest.subscribe((props) => draw(props));       // nodes, edges, acts, theme, places
 *   guest.act("add-note", { label: "…" });         // the viewer's act, answered
 *   guest.navigate("offer:7");                     // or { place: "the-packages" }
 *   guest.autoSize();                              // or guest.size(px)
 *
 * A host serves it at a fixed path of its own, or inlines its text
 * (`GUEST_CLIENT`, from `@graview/guest/client`) where a frame's policy
 * allows inline script alone.
 */
export { connectGuest as connect } from "./guest.js";
export { GUEST_PROTOCOL as protocol } from "./protocol.js";
