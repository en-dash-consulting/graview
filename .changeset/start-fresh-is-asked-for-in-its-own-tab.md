---
"@graview/core": patch
"@graview/ship": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/skills": patch
---

Starting fresh is asked for in the tab that does it, never by a link from somewhere else. Every app `graview create` writes opens its store with `fresh: browserStartsFresh()`, which read `?fresh=1` in the address as asking — so any site, or a message, that sent a person to `https://<app>/?fresh=1` erased their records, their history and their undo with nothing to take back, and `forgetFreshParam` then tidied the flag away. Now the Start fresh controls (the workbench's and the routed face's, and the seedbed's "Load the example garden") keep a one-time value in this tab's `sessionStorage` and go to `?fresh=<that value>` (`freshAddress` and `FRESH_KEY` on `@graview/core`; `freshHref` in `@graview/ship/browser` makes the same address), and `browserStartsFresh` honors the address only when it carries the value the tab kept, forgetting it as it reads it. A `?fresh=1` from elsewhere, a guessed value, or the same address loaded twice discards nothing, and `forgetFreshParam` drops `fresh` from the address whatever it says. A driven browser is unchanged: it starts fresh unless it says `?remember=1`, and takes `?fresh=1` as asking, so every harness and `graview create`'s scaffold work as they did. Ship's browser-adapter test holds that a store opened under `?fresh=1`, `?utm=x&fresh=1&remember=1` or a value the tab did not keep still holds what a person made, and that the control's own address starts fresh once. The graview-ship and graview-seed skills say Start fresh rather than `?fresh=1`.

The one-time value costs a hosted page 0.3 KB more up front (286 bytes minified, 189 gzipped), and a page handed a compiled app 0.3 KB (286, 117), under raises naming this changeset; the pages face alone 239 / 96, a visitor's form handed a compiled app 286 / 133, every face 175 / 123 and the guest host registering a worker view 4 gzipped, each under a raise of its own, and the scene before it draws 230 bytes more, under 1023 KB.

Compatibility: ops and primitives, the wire, the declaration and derived tool names and input schemas — unchanged. Stored formats — unchanged: what the browser adapter keeps is read and written as before; only what asks for it to be discarded changed. A host whose own control navigates to `?fresh=1` in a person's browser goes through `freshAddress` (or `freshHref`) now, or the address is not honored.
