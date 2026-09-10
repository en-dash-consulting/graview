---
id: "23d22798-65b2-4d59-80c7-8b82352aad16"
level: "feature"
title: "Platform capability validation"
status: "completed"
priority: "critical"
tags:
  - "spike"
  - "html-in-canvas"
  - "webgpu"
  - "blocking"
source: "Session planning — build sequence step 1"
startedAt: "2026-08-30T04:22:27.499Z"
completedAt: "2026-09-10T14:59:44.365Z"
endedAt: "2026-09-10T14:59:44.365Z"
acceptanceCriteria:
  - "Three DOM panels draw into a WebGPU texture at three plane depths through vgpu"
  - "Clicks land on the drawn pixels, not the source element's layout position"
  - "A screen reader reaches and reads all three panels at depth"
  - "Perspective vs affine support for canvasTransform is answered and written down"
  - "Per-frame capture cost is measured against node count"
  - "The exclusion list is verified — cross-origin, nested canvas, and whatever the SVG restriction actually covers"
description: "Establish that the HTML-in-Canvas + WebGPU render loop actually works before any framework code assumes it. This is throwaway-tolerant validation, but it is absorbed into the vertical slice rather than run as a separate spike.\n\nTHE BLOCKING QUESTION: does `canvasTransform` on `updateElementGeometry` accept a full perspective matrix, or affine only? If affine only, per-element perspective breaks hit-testing — clicks land where the element is not. The plane model is designed to survive this (depth = per-plane uniform scale + blur + shadow, which is affine), but layout must not assume perspective until this is answered.\n\nPlatform notes: available in Chrome Canary and Brave (Chromium 147+) behind the `canvas-draw-element` flag. WebGPU entry point is `drawElementImageToTexture` on GPUQueue (the WICG README also calls it `copyElementImageToTexture` — naming is still settling, so wrap every platform call behind one module). Source elements must be descendants of a `<canvas layoutsubtree>`. vgpu's `Texture` supports `ownership: \"external\"`, and `Device.gpu` / `Device.queue` expose the raw handles the capture needs."
lastModified: "2026-09-10T14:59:44.376Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [Capture and composite DOM panels at plane depth](./capture-and-composite-dom-panels-at.md) | completed |
| [Measure capture budget and verify platform restrictions](./measure-capture-budget-and-verify.md) | completed |
| [Settle geometry sync — hit-testing, focus, a11y, and the perspective question](./settle-geometry-sync-hit-testing-focus.md) | completed |
| [What the page taught the framework, folded back in](./what-the-page-taught-the-framework.md) | completed |
