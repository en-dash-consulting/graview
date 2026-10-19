---
"@graview/primitives": patch
---

A lens's width that did not change draws nothing inside the browser's resize reports. `useWidth` drew every report at once with `flushSync`, and the observer reports each box once, unchanged, as it is first watched; the flush rendered whatever else was waiting too, so on the org app's Pages home a board that had just measured its own room was redrawn inside the round of reports, the room it watches changed size there, and Firefox said "ResizeObserver loop completed with undelivered notifications". A report of the width already drawn now does nothing; a changed width is still drawn before the paint.

Compatibility: no surface changes.
