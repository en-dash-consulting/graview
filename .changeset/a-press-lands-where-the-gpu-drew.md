---
"@graview/render": patch
---

A scene draws on the GPU only where the browser's own hit-testing follows what was drawn. Chrome 155 with element capture switched on — the nightly's GPU leg — still spells `layoutSubtree`, accepts `updateElementGeometry` and ignores it, so every view's box stayed where it was laid out: a press on a drawn district, renaming a record in place, an act's button and a screen reader's box all landed somewhere else, and `PointerRouter` covered a mouse and nothing more. `gpuCapturePresent()` now also asks for the paint-record build (`captureElementImage` on the canvas, no `layoutSubtree`), as on Chromium 158, where a reported geometry moves the box; elsewhere `auto` draws on the DOM path, silently, as it does without capture.

Compatibility: no surface changes; `gpuCapturePresent()` is false on the `layoutSubtree` builds of element capture.
