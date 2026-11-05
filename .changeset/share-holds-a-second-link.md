---
"@graview/primitives": patch
"@graview/embed": patch
---

A host's Share holds a second link beside the first. Share's popover held one link — Graview Cloud's Copy link, with nowhere for "Sharing settings" — so `BarShare` takes `secondLink`, the same shape as `link` (`label`, and `href` and `target` or `onSelect`), drawn beside it in one row; either closes the popover. Both are now the type `BarShareLink`, from `@graview/primitives`, `/frame` and `@graview/embed`. Unsaid, Share draws as it did.

The unit test `the-app-bar-is-calm` holds the second link beside the first, its press closing the popover, and none drawn when the host gives none; verify-chrome holds `aHostsShareSaysInASentenceWhoCanOpenTheApp` as before. Every face spends 856 bytes more minified, none gzipped.

Compatibility: the look — Share's links stand in a row (`.graview-bar-share-links`); new `app-share-second-link`. The JavaScript API — new, optional: `BarShare.secondLink` and the type `BarShareLink`. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: give Share `link: { label: "Copy link", onSelect }` and `secondLink: { label: "Sharing settings", href }`.
