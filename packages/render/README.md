# @graview/render

The spatial renderer: three planes, an affine transform per plane, and
connectors drawn in SVG over the scene.

## Two paths, and which one ships

**The DOM path is what ships.** Each view is an ordinary element with a CSS
`matrix3d` — the same affine transform the GPU path uses, applied by the
browser. It is fully interactive, fully accessible, and every claim this
project makes about the interface is verified against it.

**The GPU capture path is EXPERIMENTAL.** It rasterizes each view's DOM
subtree with `CanvasDrawElement` and composites the textures with per-plane
blur, which is the part a shader is genuinely better at. It needs Chrome Canary
with `--enable-blink-features=CanvasDrawElement`. Canary 158 respelled the API
(`content="drawable"` on the canvas, `drawable` on each view, a plain
`{ texture }` destination); both spellings are written.

It used to bring the renderer process down on a click. That is fixed. The cause
was not the click: a plain hover over a captured view killed it just as
reliably, and a keyboard selection of the same node did not. What is fatal is
the browser's own hit-test descending into a `layoutsubtree` canvas child, so on
this path the hosts carry `pointer-events: none` and `PointerRouter` answers
instead — which it had to anyway, because `updateElementGeometry` does not
redirect hit-testing in this build. `scripts/verify-capture.mjs` holds the
claim: the pointer survives, a click still reaches the node that was drawn, and
the keyboard still reaches the views.

Capture costs about 0.22 ms a view on Chromium 158, so retaking every live
view every frame holds sixty frames a second only below about 64 views (6 fps
at 512). `attachGpu()` — the capture path as a Scene's `attachRenderer` — keeps a
page under that: it retakes a view only when the browser's `paint` event says
it changed, skips what is off the canvas, spends at most `CAPTURE_BUDGET`
retakes a frame, and hands a view that keeps changing faster than that to the
DOM path, drawn at the same transform under the canvas. The discography holds
about 400 fps with 512 live views that way (`scripts/verify-scale.mjs`).

It stays experimental because it needs Canary and a flag, and every other
claim this project makes is verified against the DOM path.

It is published rather than withheld because `@graview/react` depends on this
package for the plane model, the transforms and the frame planner, all of which
both paths share. Opting into the capture path is an explicit
`attachRenderer` — nothing reaches it by accident.

## What is stable here

- `PLANE_STYLES`, `styleFor`, `mixStyles`, `transformFor` — the plane model.
- `planFrame` — what to capture, what to draw, where each view lands.
- `PointerRouter`, `hitTest` — hit-testing a click against drawn geometry.

The compositor, the WGSL and the `html-in-canvas` platform bindings move with
the browser feature they are built on.
