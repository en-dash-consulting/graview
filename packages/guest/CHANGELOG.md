# @graview/guest

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7
  - @graview/react@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/core@0.1.6
  - @graview/react@0.1.6

## 0.1.5

### Patch Changes

- 826e19b: A hosted page carries 536 KB up front, not 1,075 KB, and each face of the embed is fetched as it is first drawn (FR-57). Graview Cloud's shell — `openRemote` and the embed over a document compiled in the browser — loaded every face before the app drew: the scene, the companion, the inspector, the routed face and its router, the chat and the agent's tool surface, and every default view. The embed imported every face outright, and a bundler splits a page by which files its first chunk can reach: the frame took its provider from `@graview/react`, its theme from `@graview/primitives`, and the provider took the reader's rung from `@graview/tools`, and each of those reaches the rest of its package. Now the frame — the region, the theme, the strip, the provider — is what a page loads first, and the scene, the pages and the picture are each a chunk fetched as they are drawn, with the framework's own views beside them. The frame reaches only the narrow entries `@graview/react/provider` (the provider, hooks and view registry without the scene), `@graview/primitives/frame` (the theme, the strip's Profile and Standing, and the framework's views behind doors), `@graview/tools/frame` (the reader's rung, pins and editable fields without the agent) and `@graview/layout/view` (the view state without the city); the routed face reaches `@graview/primitives/pages` and fetches the companion when "Ask" is opened, and a district fetches its arrange row when it is opened full. `scripts/verify-hosted-page.mjs` (`pnpm hosted`, first in `pnpm verify`) builds Cloud's page the way Cloud does and holds it to 600 KB up front and 150 KB of zod; it also says what each face fetches as it draws, 770 KB in all before the scene draws and 729 KB before the pages do.
  
  CI's bundle budgets follow: the pages face alone is held to 530 KB (from 950 KB) and the embed without the studio to 780 KB first loaded (from 1.2 MB); every face, loaded whole, is 11 KB smaller minified and 2.5 KB larger gzipped, its chunks each gzipped alone, so its gzipped budget is raised from 373 KB to 380 KB.
  
  Compatibility: the embed — a change of shape. `mount` returns with the frame on the page and the face on its way: its box stands empty (`aria-busy`) until the face's chunk arrives, and `handle.drawn()` resolves once the face asked for is drawn, after `mount` and after `setFace`. `preload(...faces)`, a new export of `@graview/embed`, fetches faces before they are drawn, and an embed mounted once its face is here draws it in the first commit, as before; with no face named, every face. `onReady` is told when the first face is drawn, not at the frame's first commit, and the new `onDrawn` option each time a face is. The framework's own views in an embed's registry are doors that draw them once fetched (`frameworkViewDoors`, `registerFrameworkViews`, `fetchFrameworkViews`, new exports of `@graview/primitives`); a host's `views` function is handed them as before. `@graview/react/provider`, `@graview/primitives/frame`, `@graview/primitives/pages`, `@graview/tools/frame` and `@graview/layout/view` are new subpath exports — each also exported from its package's main entry — and a product that aliases the framework's packages (a linked project's vite config, which `graview create` writes) aliases them ahead of the bare names. `@graview/embed/pages` is unchanged and still draws in the first commit. Ops, stored formats, the wire, check codes and derived tool schemas are unchanged.
- Updated dependencies [f989024]
- Updated dependencies [97f2a0a]
- Updated dependencies [1e21d54]
- Updated dependencies [281761b]
- Updated dependencies [a83a311]
- Updated dependencies [f1fcf13]
- Updated dependencies [826e19b]
- Updated dependencies [e22a00d]
- Updated dependencies [5a2086e]
- Updated dependencies [76df9ba]
  - @graview/core@0.1.5
  - @graview/react@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [df9932a]
- Updated dependencies [9de42fe]
- Updated dependencies [a9c0f2d]
- Updated dependencies [75c1a26]
- Updated dependencies [e0f75bb]
- Updated dependencies [c5b36f7]
- Updated dependencies [53857e9]
- Updated dependencies [fdf82ed]
- Updated dependencies [f923330]
- Updated dependencies [936814b]
- Updated dependencies [98f0438]
- Updated dependencies [ba312af]
- Updated dependencies [d5a386e]
- Updated dependencies [a57ea5d]
- Updated dependencies [d5af759]
- Updated dependencies [d774558]
- Updated dependencies [0183340]
- Updated dependencies [cc889f4]
- Updated dependencies [5fd6380]
- Updated dependencies [dee1fb2]
- Updated dependencies [67fbb6f]
- Updated dependencies [180452e]
- Updated dependencies [1f260a7]
- Updated dependencies [062fe46]
- Updated dependencies [0497bbf]
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
