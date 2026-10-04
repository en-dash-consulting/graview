# @graview/guest

## 0.1.4

### Patch Changes

- Updated dependencies [9de42fe]
- Updated dependencies [a9c0f2d]
- Updated dependencies [75c1a26]
- Updated dependencies [53857e9]
- Updated dependencies [fdf82ed]
- Updated dependencies [f923330]
- Updated dependencies [936814b]
- Updated dependencies [ba312af]
- Updated dependencies [a57ea5d]
- Updated dependencies [d5af759]
- Updated dependencies [0183340]
- Updated dependencies [dee1fb2]
- Updated dependencies [67fbb6f]
- Updated dependencies [180452e]
- Updated dependencies [1f260a7]
  - @graview/core@0.1.4
  - @graview/react@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [c3683bb]
- Updated dependencies [1ba2ab7]
- Updated dependencies [5ea9572]
- Updated dependencies [a65423f]
- Updated dependencies [8e76788]
- Updated dependencies [c2ed1f8]
- Updated dependencies [5ea9572]
- Updated dependencies [50beae9]
- Updated dependencies [625ac82]
- Updated dependencies [f4a1f72]
- Updated dependencies [ca3c327]
  - @graview/core@0.1.3
  - @graview/react@0.1.3

## 0.1.2

### Patch Changes

- d2683c5: Guest views: a view somebody else wrote, in a sandboxed frame that can only ask. `@graview/guest` is a new package, the fourteenth.
  
  The host half is `@graview/guest/host`. `guestView({ url, name })` registers like any other view. `mountGuestView(element, { url, view, store, principal })` does the same without React, and `createGuestHost` is the host without the DOM. The frame gets `sandbox="allow-scripts"` and never `allow-same-origin`, so its origin is opaque and nothing of the host's is reachable from it. The host answers a guest's `guest-ready` only from that frame's own window and only from the opaque origin. Each answer is a fresh nonce and a `MessageChannel`, and the port before is closed. Every request over the port carries the nonce, or it is dropped unread.
  
  The host pushes `GuestProps`, the plain-data half of `ViewProps`: `node`, `nodes`, the `edges` among them, `implicated`, `flagged` and the rest, plus `acts`, the acts the viewer may run. All of it is read from `seenBy(principal)`, so a record the viewer may not see is in none of them. No principal, role or token is ever sent. The guest may ask for an act by name with its arguments, a navigation to a record, or a height. An act is applied through `store.apply` as the viewer, with `via: "view:<name>"`, so the policy refuses it in the same sentence it gives a click and the rail says "via <name>". A navigation goes only to a record the viewer may see, and a height is held to `maxHeight`. Acts are limited per frame (30 a minute by default) and messages too (120 a second), and saying ready again buys a new nonce, not a new allowance.
  
  The guest half imports nothing of the framework. `connectGuest()` from `@graview/guest` takes the first hello from its parent, and from `hostOrigin` when it is given. It offers `props`, `subscribe`, `act`, `navigate`, `size` and `autoSize`. `useGuest()` from `@graview/guest/react` is the same connection as a hook. `scripts/guest-sandbox.mjs` holds the sandbox in a real browser against a hostile guest in Chromium, Firefox and WebKit. It also found that Firefox and WebKit send a host cookie without `SameSite` on a guest's credentialed fetch when the guest has no CSP. The README says to set `SameSite` or serve guests with `connect-src 'none'`.
  
  `graview create` writes `@graview/guest` into a new project's dependencies and its linked dev aliases. `capabilities().shipped` names FR-04 (FR-04).
  
  Compatibility: additive — a new package and protocol, `GUEST_PROTOCOL` 1, held to the wire's rules (docs/stability.md). `capabilities().shipped` gains FR-04. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
- Updated dependencies [3afdd09]
- Updated dependencies [b910210]
- Updated dependencies [7f354e0]
- Updated dependencies [74c9388]
- Updated dependencies [a7fc818]
- Updated dependencies [2820fd3]
- Updated dependencies [230d9b4]
- Updated dependencies [a163197]
- Updated dependencies [4a5dadd]
- Updated dependencies [7afb9ae]
- Updated dependencies [9b2c61b]
- Updated dependencies [8990aa9]
- Updated dependencies [539d0eb]
- Updated dependencies [33c3cbb]
- Updated dependencies [95444f1]
- Updated dependencies [55f8b27]
- Updated dependencies [6ea13f7]
- Updated dependencies [a634594]
- Updated dependencies [3b36d19]
- Updated dependencies [85888f1]
- Updated dependencies [d2683c5]
- Updated dependencies [5a6f262]
- Updated dependencies [c6bd456]
- Updated dependencies [6c54eb1]
- Updated dependencies [67a7d42]
- Updated dependencies [6c62ca6]
- Updated dependencies [5e85a39]
- Updated dependencies [b2f8c22]
- Updated dependencies [984c96f]
- Updated dependencies [b71e7c5]
- Updated dependencies [2493564]
- Updated dependencies [c5c1c91]
- Updated dependencies [346fbe3]
- Updated dependencies [b334c25]
- Updated dependencies [9680187]
- Updated dependencies [570f9e2]
- Updated dependencies [6460336]
  - @graview/core@0.1.2
  - @graview/react@0.1.2
