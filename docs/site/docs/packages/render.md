# @graview/render

`@graview/render` is one of the 14 npm packages of Graview, a TypeScript framework that derives an app’s interface, permissions and agent tools from one declaration. The spatial renderer: the GPU capture path where the browser can capture into WebGPU, the DOM path everywhere else, one picture and one accessibility tree on both.

```sh
pnpm add @graview/render
```

Entry points: `@graview/render`, `@graview/render/gpu`

## What it is

The spatial renderer: three planes, an affine transform per plane, and connectors drawn in SVG over the scene.

### Two paths, and which one draws

**A scene draws on the GPU where the browser can, and on the DOM path everywhere else — silently, per page.** `Scene` and the `Shell` default to `renderer="auto"`: `gpuCapturePresent()` asks, without a device, whether the page has WebGPU, an element-capture call on its queue, a canvas `paint` event, and hit-testing that follows the drawn geometry (below); where it does, `./gpu` is fetched and `attachGpu()` takes the canvas. Its first-frame check falls back for good if no adapter is given, no paint arrives within `FIRST_PAINT_WAIT_MS`, a frame is refused, the device is lost, or the middle of the first `FIRST_FRAMES` frames' work is over `FIRST_FRAME_BUDGET_MS`. A page without any of it — Firefox, Safari, Chromium before element capture — never fetches `./gpu` and says nothing. `?renderer=gpu|dom` on the address (or `graviewRenderer` set on the page before it loads) decides `auto` for an operator; `GRAVIEW_RENDERER` does the same for every page of a harness run.

Element capture (`CanvasDrawElement`) is on by default in Chromium 158 and behind `--enable-blink-features=CanvasDrawElement` before it. Canary 158 respelled the API (`content="drawable"` on the canvas, `drawable` on each view, a plain `{ texture }` destination); both spellings are written.

**The two paths draw one picture.** Each view is an ordinary element on both: on the DOM path it carries a CSS `matrix3d`, opacity and filter; on the GPU path it is a child of the canvas, captured, and the shader draws the same treatment from the same numbers (`treatmentOf`, `recededOpacity`). The accessibility tree is the same on both, and `scripts/verify-renderer.mjs` holds that, the picture, and the silence.

**Blur.** Receded planes are blurred, the focused plane always sharp. On the GPU the shader draws it at no measurable cost; the DOM path's CSS `filter: blur()` is dropped for the rest of the page if its frames run over a frame and a half while the picture moves. `blur={false}` on the Scene or the Shell turns it off, and so do `prefers-reduced-motion`, `prefers-reduced-transparency` and the reader's Motion setting (`planeBlurOn`).

Capture costs about 0.22 ms a view on Chromium 158, so retaking every live view every frame holds sixty frames a second only below about 64 views (6 fps at 512). `attachGpu()` keeps a page under that: it retakes a view only when the browser's `paint` event says it changed, skips what is off the canvas, spends at most `CAPTURE_BUDGET` retakes a frame, and hands a view that keeps changing faster than that to the DOM path, drawn at the same transform under the canvas. The discography holds about 500 fps with 512 live views that way (`scripts/verify-scale.mjs`).

**Hit-testing.** On Chromium 158 a view reported with `updateElementGeometry` is hit-tested where it was drawn — `elementsFromPoint`, hover and presses land on the drawn view — so the browser answers and the canvas says `data-graview-hit="platform"`, which lets the views' content take the pointer. Earlier builds (the `layoutSubtree` spelling, Chrome 155 with capture switched on among them) accept the geometry and ignore it: a view's box stays where it was laid out, so a press, a screen reader and an automation all land somewhere other than where the view was drawn. `gpuCapturePresent()` is false there and the page draws on the DOM path. `PointerRouter` (`data-graview-hit="router"`) remains for a host driving the `Compositor` itself on such a build. A pan moves the canvas by a transform, as it moves the DOM path's stage, and redraws nothing until it lands.

### What is stable here

- `PLANE_STYLES`, `styleFor`, `mixStyles`, `transformFor` — the plane model.
- `planFrame` — what to capture, what to draw, where each view lands.
- `PointerRouter`, `hitTest` — hit-testing a click against drawn geometry.

The compositor, the WGSL and the `html-in-canvas` platform bindings move with the browser feature they are built on.

## What it exports (34)

Read off the package's own barrel, so this is what is there today.

`CAPTURE_BUDGET`, `chooseRenderer`, `CONNECTOR_DASH`, `connectorStroke`, `connectorStyle`, `connectorWidth`, `distinguishable`, `FRAME_BUDGET_MS`, `framesHeld`, `fromLayout`, `gpuCapturePresent`, `hitTest`, `hueFor`, `IDENTITY`, `invertPlaneTransform`, `isAffine`, `LIGHT_PLANE_STYLES`, `mixStyles`, `perspectiveProbeMatrix`, `PLANE_STYLES`, `planeBlurOn`, `PLANES`, `planeTransform`, `planFrame`, `PointerRouter`, `PROVISIONAL_DASH`, `PROVISIONAL_OPACITY`, `recededOpacity`, `rendererAsked`, `styleFor`, `toDOMMatrix`, `toLocal`, `transformFor`, `treatmentOf`

---

The spatial renderer: the GPU capture path where the browser can capture into WebGPU, the DOM path everywhere else, one picture and one accessibility tree on both.

The page: https://graview.dev/docs/packages/render.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
