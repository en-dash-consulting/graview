# @graview/render

The spatial renderer: three planes, an affine transform per plane, and
connectors drawn in SVG over the scene.

## Two paths, and which one ships

**The DOM path is what ships.** Each view is an ordinary element with a CSS
`matrix3d` — the same affine transform the GPU path uses, applied by the
browser. It is fully interactive, fully accessible, and every claim this
project makes about the interface is verified against it.

**The GPU capture path is EXPERIMENTAL.** It rasterises each view's DOM
subtree with `CanvasDrawElement` and composites the textures with per-plane
blur, which is the part a shader is genuinely better at. It needs Chrome Canary
with `--enable-blink-features=CanvasDrawElement`, and it has a known defect:
**clicking inside a captured view crashes the renderer process.** The harness in
`the household example/scripts/run-acceptance.mjs` runs against the DOM path for exactly
that reason, and says so.

It is published rather than withheld because `@graview/react` depends on this
package for the plane model, the transforms and the frame planner, all of which
both paths share. Opting into the capture path is an explicit
`attachRenderer` — nothing reaches it by accident.

## What is stable here

- `PLANE_STYLES`, `styleFor`, `mixStyles`, `transformFor` — the plane model.
- `planFrame` — what to capture, what to draw, where each view lands.
- `routePointer` — hit-testing a click against drawn geometry.

The compositor, the WGSL and the `html-in-canvas` platform bindings move with
the browser feature they are built on.
