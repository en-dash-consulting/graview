---
"@graview/primitives": patch
---

The arrange bar's selects keep their 32px floor in WebKit. WebKit ignores `min-height` on a native select, so at phone width every sort, group and filter select was 22 pixels tall there; they now drop the native appearance and draw their own chevron.
