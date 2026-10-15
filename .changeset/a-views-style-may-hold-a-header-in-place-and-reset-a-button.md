---
"@graview/guest": patch
"@graview/skills": patch
---

A view's style may hold a header in place and reset a button of its own. `graview.style` refused `position: sticky` and `all: unset`, so a view could not keep its header on screen as it scrolled, and the browser's button chrome leaked into the toggles it drew. Both are kept. `sticky` sticks within its own parent's box, and the region a view is drawn in is painted contained (`contain: layout paint style`, `overflow: clip`, a stacking context of its own), so a sticky header never paints past the view or over the app; `fixed`, which escapes to the page's viewport, is still refused. `all` takes only the four keywords every property takes (`unset`, `initial`, `inherit`, `revert`), which reset and load nothing. The graview-view-drawing skill says so, and the guest harness holds both in a browser.

Compatibility: ops, stored records, the declaration and the guest wire are unchanged. The open kit's CSS takes `all` (keywords alone) and `position: sticky`; a stylesheet that held them before had them dropped and listed in `refused`, and now draws them.
