---
"@graview/guest": patch
"@graview/core": patch
---

Guest views: a view somebody else wrote, in a sandboxed frame that can only ask. `@graview/guest` is a new package, the fourteenth.

The host half is `@graview/guest/host`. `guestView({ url, name })` registers like any other view. `mountGuestView(element, { url, view, store, principal })` does the same without React, and `createGuestHost` is the host without the DOM. The frame gets `sandbox="allow-scripts"` and never `allow-same-origin`, so its origin is opaque and nothing of the host's is reachable from it. The host answers a guest's `guest-ready` only from that frame's own window and only from the opaque origin. Each answer is a fresh nonce and a `MessageChannel`, and the port before is closed. Every request over the port carries the nonce, or it is dropped unread.

The host pushes `GuestProps`, the plain-data half of `ViewProps`: `node`, `nodes`, the `edges` among them, `implicated`, `flagged` and the rest, plus `acts`, the acts the viewer may run. All of it is read from `seenBy(principal)`, so a record the viewer may not see is in none of them. No principal, role or token is ever sent. The guest may ask for an act by name with its arguments, a navigation to a record, or a height. An act is applied through `store.apply` as the viewer, with `via: "view:<name>"`, so the policy refuses it in the same sentence it gives a click and the rail says "via <name>". A navigation goes only to a record the viewer may see, and a height is held to `maxHeight`. Acts are limited per frame (30 a minute by default) and messages too (120 a second), and saying ready again buys a new nonce, not a new allowance.

The guest half imports nothing of the framework. `connectGuest()` from `@graview/guest` takes the first hello from its parent, and from `hostOrigin` when it is given. It offers `props`, `subscribe`, `act`, `navigate`, `size` and `autoSize`. `useGuest()` from `@graview/guest/react` is the same connection as a hook. `scripts/guest-sandbox.mjs` holds the sandbox in a real browser against a hostile guest in Chromium, Firefox and WebKit. It also found that Firefox and WebKit send a host cookie without `SameSite` on a guest's credentialed fetch when the guest has no CSP. The README says to set `SameSite` or serve guests with `connect-src 'none'`.

`graview create` writes `@graview/guest` into a new project's dependencies and its linked dev aliases. `capabilities().shipped` names FR-04 (FR-04).

Compatibility: additive — a new package and protocol, `GUEST_PROTOCOL` 1, held to the wire's rules (docs/stability.md). `capabilities().shipped` gains FR-04. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
