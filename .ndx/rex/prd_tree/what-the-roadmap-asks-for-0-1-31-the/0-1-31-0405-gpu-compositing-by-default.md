---
id: "61161f4d-c45d-4b3e-801e-a133b5539d9f"
level: "task"
title: "0.1.31 · 04–05: GPU compositing by default, with per-plane blur riding on it"
status: "completed"
startedAt: "2026-10-16T10:00:20.000Z"
completedAt: "2026-10-16T14:05:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
source: "ndx-capture"
acceptanceCriteria:
  - "a Chromium or Safari 18+ page draws on the GPU by default, and a page without WebGPU looks the same and says nothing"
  - "every harness holds on both paths in the nightly, and the accessibility tree is identical on both"
  - "on the GPU path the focused plane is sharp and the others blurred at the same measured frame budget as without blur; the DOM path blurs within budget or not at all"
  - "the blur off switch and the reduced-transparency preference turn blur off"
description: "Roadmap f-gpu-default (04) and f-plane-blur (05, after 04). The WebGPU capture path in @graview/render draws correctly but is opt-in, Chromium-only and behind a flag; f-capture-budget (shipped) removed the 128-live-view cliff. 04: turn the GPU path on by default where WebGPU is present and holds the frame budget; fall back to the DOM renderer silently and per page where WebGPU is absent (Firefox, older Safari) or a short first-frame check fails; run the scale, panning, lines and a11y harnesses on both paths. 05: on the GPU path, blur unfocused planes in the compositor shader by depth/focus, the focused plane sharp; on the DOM path use CSS filter: blur() per plane only within the frame budget, otherwise no blur; an off switch, and prefers-reduced-motion / prefers-reduced-transparency honored. If blur cannot hold the budget, ship 04 alone and say so on f-plane-blur."
lastModified: "2026-10-16T14:05:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

2026-10-16 — Both 04 and 05 shipped; blur holds the budget, so it rides on 04.

What was done:
- `@graview/render` main entry (pure, no WebGPU types): `gpuCapturePresent()` (WebGPU + an element-capture call on `GPUQueue` + canvas `requestPaint`, asked without a device), `rendererAsked()` (`?renderer=gpu|dom`, or `globalThis.graviewRenderer` set before load), `chooseRenderer()`, `planeBlurOn()`, `framesHeld()`, `FRAME_BUDGET_MS`, and `treatmentOf()`/`recededOpacity()` — the one treatment (plane style, snapped blur, fade) both paths draw.
- `Scene` (and `Shell`, embed, todo/rota/seedbed) default to `renderer="auto"`: where capture is present `./gpu` is fetched lazily (`retryingImport`) and `attachGpu()` takes the canvas; the page is drawn on the DOM path until it arrives. `attachGpu` has a first-frame check (no adapter, no paint within 1.5 s, a refused frame, a lost device, or a median of the first 4 frames' work over 0.75 of a frame) and calls the scene's new `fallBack()`; the Scene then draws on the DOM path for good, silently. The ground carries `data-graview-renderer` and `data-graview-blur` for harnesses.
- The shader now draws what the DOM path draws: no fixed-ground mix, no edge darkening, straight-alpha capture premultiplied once, blend `one/one-minus-src-alpha`, scheme-aware styles. Before this a light card on the GPU had gray bands down its sides.
- Blur: on by default, focused plane sharp; `blur={false}` on Scene/Shell, `prefers-reduced-motion`, `prefers-reduced-transparency` and the reader's Motion setting turn it off. DOM path: CSS blur dropped for the rest of the page once a 30-frame window in motion has p95 over 1.5 frames (25 ms).
- GPU-path gaps found by running the harnesses forced onto it, and fixed: on Chromium 158 the browser's hit-test follows reported geometry with no crash (tested hover/press/elementsFromPoint), so the compositor lets the platform hit-test (`data-graview-hit="platform"`, content takes the pointer via scene-css); 155 still lays children out at the origin, so the router stays there. Geometry is reported 64 a frame until all are; a culled view is reported off-canvas (`FramePlan.offCanvas`) instead of being left, invisible, at its last place. A drag/wheel moves the GPU stage by transform (`data-graview-world`) like the DOM stage — the GPU wheel at altitude had been 20–30 fps at 4× throttle.
- Harnesses: `GRAVIEW_RENDERER=gpu|dom` (scripts/lib/engine.mjs) tells every page of a run via an init script; `gpu` launches Canary (or `GRAVIEW_BROWSER`) with `GPU_ARGS` (Metal on macOS; SwiftShader Vulkan on Linux). New `pnpm verify renderer` (scripts/verify-renderer.mjs → docs/renderer.json). verify-panning reads a box after the move's frame. Nightly: every shard on `renderer: [dom, gpu]`, with Google Chrome stable for gpu; a11y and renderer added to a shard.

Browsers measured on this Mac (headless, served over localhost): bundled Chromium 131 — WebGPU yes, capture no → DOM. Chrome 155 — capture only with the flag; adapter only with GPU switches. Canary 158 — capture on by default; adapter needs `--enable-unsafe-webgpu --enable-gpu --ignore-gpu-blocklist --use-angle=metal` headless. WebKit 18.2 and Firefox 132 — no WebGPU → DOM.

Frame budgets (todo, 1440×900, vsync off, rAF intervals over the bar's stops, ms): GPU unblurred p50 0.4 / p95 3.5, GPU blurred p50 0.3 / p95 3.3; DOM blurred p50 0.4 / p95 3.6, DOM unblurred p50 0.3 / p95 3.5. Discography on the GPU with blur on: 512 live views 455 fps (p95 2.6 ms), 256 at 714 fps. GPU vs DOM picture: 0.85% of pixels differ by more than 24/255 (mean 0.63). Focused plane: 0 pixels change with blur off; receded plane: 15% change.

Harnesses (local, both paths): GRAVIEW_RENDERER=gpu — a11y, lines, panning, scale, renderer all hold. GRAVIEW_RENDERER=dom — a11y, lines, panning, renderer hold; scale fails `aTransitionHolds60` ("rise" worst frame 55 ms) — the same 55 ms at HEAD with these changes taken out, so it predates this task. renderer's claims: aChromiumThatCanCaptureDrawsOnTheGpuByDefault, theAccessibilityTreeIsTheSameOnBothPaths, theTwoPathsDrawTheSamePicture, onTheGpuTheFocusedPlaneIsSharp, onTheGpuTheRecededPlanesAreBlurred, onTheGpuBlurHoldsTheBudgetItHoldsWithout, theDomPathBlursWithinBudgetOrNotAtAll, reducedTransparencyTurnsBlurOffOnBothPaths, reducedMotionTurnsBlurOffOnBothPaths, aPageWithoutTheGpuPathDrawsOnTheDomPathAndSaysNothing.

Left open / honest caveats:
- The nightly's gpu leg (ubuntu, Chrome stable + CanvasDrawElement flag + SwiftShader) has not run yet; if the runner's Chrome makes no adapter, pages fall back to the DOM path and docs/renderer.json says `gpu.unavailable` rather than claiming the GPU held. Confirm on the first nightly.
- A Chromium with capture but no adapter (Canary headless without GPU switches) logs its own console warning "Failed to create WebGPU Context Provider" from `requestAdapter`; the page itself says nothing, and the harness reports that line separately as the browser's.
- Safari has no element capture, so "Safari 18+ draws on the GPU" is not possible today: Safari draws on the DOM path.
- The off switch is held by unit tests (packages/react/tests/unit/a-page-without-the-gpu-draws-on-the-dom-path.test.tsx); the harness covers reduced transparency and reduced motion.
- Budgets: scene face before drawn +7,690 B (literal 911 → 919 KB); embed raises in scripts/budget-raises/the-scene-draws-on-the-gpu-by-default-*.json. Nothing up front changed.

