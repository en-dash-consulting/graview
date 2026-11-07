---
id: "23d22798-65b2-4d59-80c7-8b82352aad16"
type: "capability"
title: "Platform capability validation"
slug: "platform-capability-validation"
statement: "The product validates that the HTML-in-Canvas and WebGPU render loop works in a real browser — drawing DOM panels at plane depths, keeping clicks, focus and assistive technology aligned with what is drawn, and recording the perspective-versus-affine answer, capture cost and platform exclusions."
criteria: [{"id":"c1","text":"The renderer shall draw three DOM panels into a WebGPU texture at three visibly distinct plane depths through vgpu, with per-plane scale and blur."},{"id":"c2","text":"The renderer shall wrap each captured texture as an external-ownership vgpu Texture without copying it."},{"id":"c3","text":"The renderer shall make every platform API call through a single wrapper module."},{"id":"c4","text":"When a person clicks a drawn panel at any plane depth, the browser shall deliver the click to the panel at the drawn pixels rather than at the source element's layout position."},{"id":"c5","text":"While panels are drawn at depth, keyboard focus and tab order shall follow the drawn arrangement."},{"id":"c6","text":"VoiceOver shall reach and read all panels, including those drawn at depth."},{"id":"c7","text":"The renderer shall draw focus rings and carets correctly through the canvas."},{"id":"c8","text":"The project shall record whether canvasTransform accepts a full perspective matrix or affine only, where the layout work will see it."},{"id":"c9","text":"The project shall record the measured per-frame capture cost across a range of node counts, and the live-capture node count that holds the target frame rate."},{"id":"c10","text":"The project shall record whether inline SVG can be captured at all and the scope of the SVG restriction."},{"id":"c11","text":"The project shall record the observed frame lag of DOM changes made during the paint event."},{"id":"c12","text":"The project shall record the observed failure modes of cross-origin content and nested canvas."}]
tags:
  - "spike"
  - "html-in-canvas"
  - "webgpu"
  - "blocking"
source: "Session planning — build sequence step 1"
priority: "critical"
---

Establish that the HTML-in-Canvas + WebGPU render loop actually works before any framework code assumes it. This is throwaway-tolerant validation, but it is absorbed into the vertical slice rather than run as a separate spike.

THE BLOCKING QUESTION: does `canvasTransform` on `updateElementGeometry` accept a full perspective matrix, or affine only? If affine only, per-element perspective breaks hit-testing — clicks land where the element is not. The plane model is designed to survive this (depth = per-plane uniform scale + blur + shadow, which is affine), but layout must not assume perspective until this is answered.

Platform notes: available in Chrome Canary and Brave (Chromium 147+) behind the `canvas-draw-element` flag. WebGPU entry point is `drawElementImageToTexture` on GPUQueue (the WICG README also calls it `copyElementImageToTexture` — naming is still settling, so wrap every platform call behind one module). Source elements must be descendants of a `<canvas layoutsubtree>`. vgpu's `Texture` supports `ownership: "external"`, and `Device.gpu` / `Device.queue` expose the raw handles the capture needs.
