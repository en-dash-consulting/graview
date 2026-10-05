# @graview/guest

## 0.1.8

### Patch Changes

- afd37a3: A worker guest is built as one classic script by the framework's own tooling (FR-71). Claude runs a widget in an opaque origin, and Chromium refuses a module worker from a `blob:` URL there. So a guest has to start with `new Worker(blobUrl)` and no `type: "module"`, and nothing in it may load at run time. `@graview/guest/build` is a new entry, Node's, with esbuild as an optional peer. `buildGuestBundle({ entry })` bundles the worker entry first and the guest's entry after it, as one strict IIFE: `"use strict";` covers the whole script, so no frame of the runtime hands its `this` or itself to a stack trace's reader. The guest's own import of `@graview/guest/worker` is the same module, so there is one runtime and one connection. The bundle carries Remote DOM's MIT notice, since it carries Remote DOM. It answers `{ script, bytes, sha256 }`. Dynamic `import()` is not supported in the build, so an import the guest writes is never kept. A guest that writes `import()`, with a literal or a computed address, or `importScripts`, is refused with a `GuestBundleError` naming what was found. `checkGuestBundle(script)` says the same of a script built elsewhere. It compiles the script as a classic `Script`, which refuses `import`, `export` and `import.meta`. Then it reads the script with its comments taken out for `import()`, for what esbuild leaves of an import it could not resolve, and for `importScripts`, and it asks for `"use strict";` first. Hardening (FR-70) holds only for a bundle whose first module is the worker entry. A host that runs guests it did not build should check them, or better, build them itself.
  
  `guest-sandbox`'s card and hostile guest are now written as a guest author writes one and built by `buildGuestBundle`. A claim holds that both are classic scripts with nothing to load at run time. Under Claude's policy in Chromium, the widget also tries a module worker from a `blob:` URL, and the harness holds that it is refused while the classic guests start. It records the same attempt as a finding under ChatGPT's policy and in WebKit, where it runs. Unit tests build a two-module guest and find it strict, classic, carrying the notice and passing the check. They run it in a realm of its own and find the runtime evaluated before the guest, with one ready said. They refuse guests with a literal `import()`, a computed one and `importScripts`, and check hand-written scripts past their comments. `capabilities().shipped` names FR-71 (FR-71).
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-71`. `@graview/guest/build` is a new entry, with esbuild as an optional peer dependency, and `graview create` writes its alias into linked projects. The guest-view protocol, ops, stored formats, check codes and tool schemas are unchanged.
- 0e6cccd: A guest's worker is hardened before guest code runs (FR-70). On ChatGPT every widget an app's connector shows shares one origin. Graview Cloud's spike watched one view's worker plant IndexedDB and Cache Storage data that a second view's worker read, and ChatGPT's `connect-src` always names a list of public CDNs. In WebKit under Claude's policy, a worker could fetch any https origin. So the worker entry now removes every name outside an allowlist (`GUEST_GLOBALS`), from the global and from every prototype on its chain up to `Object.prototype`, after Remote DOM's polyfill and the kit are in place and before the guest runs. The polyfill's own `window`, which had taken the platform's `navigator` and `location`, loses them too.
  
  What stays is the language (`LANGUAGE`), the polyfilled DOM (`POLYFILLED_DOM`), and a few platform names (`PLATFORM`): `self`, `postMessage` (it reaches only the host, which drops all but one ready), the timers, `queueMicrotask`, `structuredClone`, `console` (which reaches only the developer's tools), `DOMException`, and `crypto` as an object holding `getRandomValues` alone. `setTimeout` and `setInterval` refuse a string. `eval` goes, and `Function` stays as a name for `instanceof` but makes nothing, nor do the async and generator function constructors. Code from text could write `import()`, which no removal can take away and which reaches every origin `script-src` allows. Chromium's `TEMPORARY` and `PERSISTENT` cannot be deleted. They are numbers, so they may stay (`INERT`), and only while they are non-writable numbers. Then every prototype on the chain is frozen, what is left on the global is made non-configurable and read-only, and the global is made inextensible. A name outside the allowlist that will not go stops the runtime with an error, so no guest code runs unhardened, and the host hears `refused`. `hardening` says what was removed.
  
  `guest-sandbox`'s worker transport adds a prober guest. In Chromium and WebKit, under Claude's and ChatGPT's policies, it finds `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `WebTransport`, `importScripts`, `indexedDB`, `caches`, `navigator.storage`, `BroadcastChannel`, `Worker` and `SharedWorker` absent (`!(name in self)`). It enumerates the global, own and inherited names with symbols included, and finds nothing outside the allowlist. Then it tries the ways back, and each is a claim. It looks for them on `self.constructor.prototype`, along `Object.getPrototypeOf`, and on `globalThis`. It tries `Function('return this')()` and every function constructor, `eval` by name and indirectly, and a string to `setTimeout` and `setInterval`. It looks for `navigator` and `location` on the global and the polyfill's window, and for a nested context to post to. It walks six steps from the global, the polyfilled DOM, a kit element and the guest's own API, looking for any value the platform had before the runtime ran. It reads V8's `prepareStackTrace` frames from inside a call the runtime made, looks for `onerror`, and checks for a `Blob` to make a script of. It tries to add a name back to the global or a prototype, and to replace or delete a kept one. In each engine and policy it finds nothing. A unit test runs `harden()` in a realm of its own, against a stand-in worker global with an API nobody has heard of, and that API goes too. `capabilities().shipped` names FR-70 (FR-70).
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-70`. A worker guest cannot use `fetch`, storage, `eval`, `new Function` or a string timer, and cannot add a global. The guest-view protocol is unchanged. Ops, stored formats, check codes and tool schemas are unchanged.
- 67bda8a: A host can say where a worker guest's links may go. `mountGuestWorker` takes `links: { origins }`, and so does `guestView` for a worker view. Given it, the kit's renderer draws a link only when its address is on a listed origin. Any other `https:` address is drawn with no `href` and written down as refused (`url`), as a `javascript:` or `http:` one already was. The list is read as the URL parser reads it: `https://example.org/any/path` names `https://example.org`, an entry that is not an `https:` URL is ignored, and an empty list draws no link at all. A lookalike host, another port, a subdomain or userinfo in front of the host is another origin, and is not drawn. Without `links`, any `https:` address is drawn, as before. A frame guest draws its own links in its own document, so `mountGuestView` has no such option.
  
  Every link is still drawn with `rel="noopener noreferrer"` and `referrerpolicy="no-referrer"`. It opens in a new tab unless its component says otherwise: a kit component drawn as `a` may declare `target`, from `KIT_LINK_TARGETS` (`_blank` or `_self`), never `_top` or `_parent`. A kit is held to that as it is held to its other closed lists. A component that declares any other target, or declares a `target` or a `url` property on anything but a link, draws nothing, so a `url` is never drawn where it could be navigable without that `rel`.
  
  The generated test over the kit (`the-host-draws-only-the-kit.test.ts`) gains two cases for every component. A link opens apart from the host, with the `rel`, no referrer and the kit's target, and a component that is not a link has no `url`. Given origins, each `url` property draws `https://example.org/a?b#c`, `https://recipes.example/card` and `HTTPS://EXAMPLE.ORG/upper`. Six addresses elsewhere are drawn with no `href`, each taking a good one away. Two more tests hold a kit's targets and an origins list with no `https:` entries. In `guest-sandbox`'s worker transport, the card draws a link to the one origin its host lists and one elsewhere, under Claude's and ChatGPT's policies in Chromium and WebKit. A claim holds that both carry the `rel`, no referrer and `_blank`. Another holds that the listed one keeps its `href` and the other has none.
  
  Compatibility: the wire — unchanged; `links` is a new host option and `target` a new optional kit field. The guest-view protocol, ops, stored formats, check codes and tool schemas are unchanged.
- 1c2f221: A worker guest lets go of a listener when what it was on leaves the tree. A listener crosses to the host as an id, and Remote DOM makes one function per element and event, so a view that kept adding and removing elements held every one of those functions, and every element they closed over, for as long as its worker lived. A press already in flight when an element went, or a host naming an old id, still reached the removed element's listener. The runtime now keeps the outline of what the host has drawn beside the records it sends (`src/worker/listeners.ts`): each node's children and the listener ids on it. A node that is removed, sits inside a removed subtree or is replaced gives its ids back, and so does a listener taken away or changed. An id given back reaches nothing, and ids only count up, so one never names a second listener. A function anywhere but a listener's place goes as nothing rather than as an id nobody would let go. The host's renderer already took its DOM listeners off with their nodes; `KitRenderer.listening` now says how many are attached.
  
  A unit test drives Remote DOM's own records through the runtime's ledger into the host's renderer. It adds and removes 10,000 buttons with listeners, by removal, inside a removed group, by `replaceChildren` and by taking the listener off first. Afterwards both sides hold what they held before: the ids, the outline, the drawn nodes and the attached listeners. A button added afterwards, and one that stayed throughout, are each pressed and reach their own listener. Every id sent was new when first sent, and none of the 10,000 let go names a listener. A second test joins the real runtime to a host over a `MessageChannel`. Fifty buttons come and go, the host then names every id it was ever sent, and no listener of a removed button runs. The next button's press reaches its own.
  
  Compatibility: the wire — unchanged. A listener still crosses as `{ listener: id }`, and the guest-view protocol, ops, stored formats, check codes and tool schemas are unchanged.
- 9f5beca: A worker guest that stops answering is stopped. A guest whose code spins, a `while (true)` after it said ready, held a thread of the viewer's machine for as long as the page was open, and nothing in the protocol said so. Now, once a worker guest is ready, `mountGuestWorker` sends a heartbeat over the session's port. It sends one every quarter of `limits.silentMs`, and at least once a second. The worker's runtime answers each one with its beat and the session's nonce. It is the runtime that answers, not the guest's code, so a guest can stop the answers only by blocking its own event loop. A worker that goes `limits.silentMs` (new, 5 000 ms by default) without an answer is terminated, and `onFailure` hears `silent`. `silent` already meant a worker that never said ready in `readyMs`; it now also means one that went quiet after. A guest that is busy but yields answers late and is kept. Time the host's own page was held up, by a long task or a throttled background tab, is not counted against the guest. An answer is not a request, so it spends none of the guest's message allowance. An answer with any other nonce goes to the session, which drops it. A frame guest's host sends no heartbeat.
  
  A unit test drives the host's watchdog against a stand-in worker. It finds a runtime that never answers stopped as `silent` at the limit and not before. A runtime that answers at once, or after four tenths of the limit, is kept through five times the limit. One that answers after three times the limit is stopped, and so is one that answers with another nonce, whose answers are counted dropped. The heartbeat spends none of an allowance of one message a minute. A disposed guest is asked nothing more, and by default the host asks within a second. Another test finds the runtime answering a heartbeat over its port with the hello's nonce and the same beat, and ignoring one with no number. `guest-sandbox`'s worker transport adds two guests with `silentMs` at 1 500 ms. The first draws, then spins. A claim holds that it is stopped as `silent` within the limit and one interval of it. Another holds that the widget's own 50 ms timer never went more than 250 ms between ticks while it spun. The second works in 200 ms slices for three times the limit, yielding between them, and a claim holds that it is kept. Both hold under Claude's and ChatGPT's policies in Chromium and WebKit. The claims that one ready is answered and that forged messages are dropped hold as before.
  
  Compatibility: the wire — additive: the guest-view protocol gains `heartbeat`, host to guest with a `beat` and guest to host with the nonce and the same `beat`. `GUEST_PROTOCOL` stays 1. A frame host never sends it. A worker guest's runtime must answer it, so a worker guest bundled against a runtime from before this change is stopped as `silent` after `limits.silentMs`. No such runtime has been published. Ops, stored formats, check codes and tool schemas are unchanged.
- eed0b56: A guest view can run in a worker as well as a frame (FR-68). A chat's widget cannot nest a frame from another origin: Claude drops `frameDomains`, and ChatGPT would need one per origin. So a view somebody else wrote could not appear there. Graview Cloud's spike ran Remote DOM in a `blob:` worker inside both hosts' sandboxes, and this is the framework half of what it asked for. `@graview/guest/worker` is a new entry, the guest's whole runtime in a worker. It keeps for itself how to hear the host, boots Remote DOM's DOM polyfill (`@remote-dom/core` 1.12.0 and `@remote-dom/polyfill` 1.6.0, MIT, pinned exactly), and defines the component kit as remote elements. It offers `connectGuest()`, the frame guest's API (`props`, `subscribe`, `act`, `navigate`, `size`) with a `root` to draw the kit into.
  
  The host half is `mountGuestWorker(element, { worker, view, store, principal })` from `@graview/guest/host/worker`, a new entry kept apart from the frame's host. `worker` is `{ script }`, which the host makes into a `blob:` URL, or `{ url }`. It starts a classic worker, never `type: "module"`, since Chromium refuses a module `blob:` worker in an opaque origin, which is where Claude runs a widget. It speaks FR-04's protocol unchanged. The worker's one `guest-ready` gets a fresh nonce and a `MessageChannel`, and a second ready from the same worker is dropped, because a worker is one realm for its whole life. The props are read through `seenBy(principal)`. An act is applied as the viewer with `via: "view:<name>"`, under the same per-guest limits. The protocol gains two additive messages: `render`, the guest's Remote DOM mutation records with each listener sent as an id, and `event`, a kit event the viewer raised. `createGuestHost` takes `onRender`, and a host without it drops `render` unread. `createKitRenderer` draws the records into the host's own document from `GUEST_KIT` alone. It reads Remote DOM's record format without the library, so the host carries none of it. A refused node keeps its index as an empty comment. A guest that draws more than `maxNodes` (2 000) is stopped. `onFailure` says `refused`, `silent` or `budget`, so a host can show something else in its place. `guestView({ worker, name })` from `@graview/guest/host` registers a worker view and fetches the worker's half of the host only when it draws one.
  
  `scripts/guest-sandbox.mjs` is now one suite over two transports. Its protocol claims (what Bethan is shown, whose act an act is, the allowance, forged messages, navigation) hold by the same names in a frame (Chromium, WebKit, Firefox) and in a worker. The worker runs inside a widget framed the way Claude and ChatGPT frame one, under the policies the spike read on 2026-10-04 (`scripts/lib/widget-policies.mjs`), in Chromium and WebKit. There the viewer's real click on the button the guest drew is what asks for the act. The harness asks `scripts/lib/ports.mjs` for its ports, runs every transport, policy and engine with no arguments, and is in `pnpm verify` as `guest`. Its claim that a refusal names a record she may not see was stale on main: since FR-55 the policy refuses in words that name only what the reader may see. It now holds that.
  
  Bundle budgets (`scripts/lib/bundle-budget.mjs`, minified and gzipped): a frame guest stays at 1.6 kB and carries no Remote DOM. The worker entry, with the kit and the hardening (FR-69, FR-70), is 55.9 kB, 18.7 kB gzipped; Remote DOM's polyfill and elements are most of it. What a host page loads first to draw guest views is 6.5 kB, 3.1 kB gzipped. The worker's host and the kit's renderer are 13.6 kB, 5.1 kB gzipped, with no Remote DOM in either. `graview create` writes the `@graview/guest/worker` and `@graview/guest/host/worker` aliases into linked projects. `capabilities().shipped` names FR-68 (FR-68).
  
  Compatibility: the wire — additive: `GUEST_PROTOCOL` stays 1, and the guest-view protocol gains `render` (guest to host) and `event` (host to guest), which a frame guest never sends and a frame host drops unread. `capabilities().shipped` gains `FR-68`. Ops, stored formats, check codes and tool schemas are unchanged.
- b12f49d: The component kit a worker guest draws with is declared once, and the host draws nothing it does not declare (FR-69). `GUEST_KIT` lists each component by element name: `gv-card`, `gv-group`, `gv-title`, `gv-text`, `gv-badge`, `gv-field`, `gv-progress` and `gv-divider` are Tier 1's blocks (FR-03), and `gv-link`, `gv-button` and `gv-input` serve a view that asks for acts. Each says the host element it is drawn as, its typed properties (`string`, `number`, `boolean`, `url`, or `oneOf` a list, with the tones held to FR-03's own), its events and the DOM event each comes from, and whether it holds other components, words or nothing. The worker defines one Remote DOM element per component from the declaration, with exactly those properties (each settable as an attribute too) and events, and never slotted. The host's renderer draws from the same declaration. A property is drawn as `data-gv-<name>`, as one of a closed list of host attributes (`value`, `max`, `aria-label`, `placeholder`, `disabled`), or, for a `url`, as the link's `href`. A link always opens a new tab with `noopener noreferrer` and no referrer.
  
  The renderer refuses, draws nothing of, and writes down in `refused` with a reason: an element outside the kit, and everything under it; a property or event the component does not declare, `__proto__` and `constructor` included; any raw attribute; a value not exactly of the declared type; a child the component may not hold; and a `url` that does not parse as an absolute `https:` URL with a host, said as `https://`. That last covers `javascript:` in any case or behind a space, `data:`, `http:`, `blob:`, relative and scheme-relative addresses. A bad value after a good one takes the good one away. A kit, not only a guest, is held to the closed lists of host elements, attributes and events, so a component declared to draw an `iframe` or an `onload` draws nothing. A test is generated over the kit, so a component added to it is covered with nothing written. For every component it checks a stray property in and as an update, a raw attribute, a declared property of the wrong type, a stray event raising nothing, a declared one raising its listener, an element outside the kit put in it, the children it may hold, and every non-`https:` address on every `url` and `string` property. Another test grows the badge by a `count` and finds it set on the worker's side, as a property and as an attribute, carried as a record and drawn by the host, with no other change. The same property is refused by a host holding the kit without it. `guest-sandbox`'s hostile worker guest draws links to `javascript:`, `http:` and `data:` addresses, in Chromium and WebKit under both chat policies, and they are drawn with no `href`. `capabilities().shipped` names FR-69 (FR-69).
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-69`. The guest-view protocol is unchanged; the kit is new. Ops, stored formats, check codes and tool schemas are unchanged.
- Updated dependencies [afd37a3]
- Updated dependencies [0e6cccd]
- Updated dependencies [eed0b56]
- Updated dependencies [b12f49d]
  - @graview/core@0.1.8
  - @graview/react@0.1.8

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
