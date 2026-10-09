# @graview/render

`@graview/render` is one of the 14 npm packages of Graview, a TypeScript framework for agent-native apps built as isometric scenes. The spatial renderer. The DOM path is what ships; the GPU capture path is EXPERIMENTAL — see README.

```sh
pnpm add @graview/render
```

Entry points: `@graview/render`, `@graview/render/gpu`

## What it is

The spatial renderer: three planes, an affine transform per plane, and connectors drawn in SVG over the scene.

### Two paths, and which one ships

**The DOM path is what ships.** Each view is an ordinary element with a CSS `matrix3d` — the same affine transform the GPU path uses, applied by the browser. It is fully interactive, fully accessible, and every claim this project makes about the interface is verified against it.

**The GPU capture path is EXPERIMENTAL.** It rasterizes each view's DOM subtree with `CanvasDrawElement` and composites the textures with per-plane blur, which is the part a shader is genuinely better at. It needs Chrome Canary with `--enable-blink-features=CanvasDrawElement`.

It used to bring the renderer process down on a click. That is fixed. The cause was not the click: a plain hover over a captured view killed it just as reliably, and a keyboard selection of the same node did not. What is fatal is the browser's own hit-test descending into a `layoutsubtree` canvas child, so on this path the hosts carry `pointer-events: none` and `PointerRouter` answers instead — which it had to anyway, because `updateElementGeometry` does not redirect hit-testing in this build. `scripts/verify-capture.mjs` holds the claim: the pointer survives, a click still reaches the node that was drawn, and the keyboard still reaches the views.

It stays experimental for a different reason: capture falls off a cliff past ~128 live captures a frame, and every other claim this project makes is verified against the DOM path.

It is published rather than withheld because `@graview/react` depends on this package for the plane model, the transforms and the frame planner, all of which both paths share. Opting into the capture path is an explicit `attachRenderer` — nothing reaches it by accident.

### What is stable here

- `PLANE_STYLES`, `styleFor`, `mixStyles`, `transformFor` — the plane model.
- `planFrame` — what to capture, what to draw, where each view lands.
- `PointerRouter`, `hitTest` — hit-testing a click against drawn geometry.

The compositor, the WGSL and the `html-in-canvas` platform bindings move with the browser feature they are built on.

## What it exports (23)

Read off the package's own barrel, so this is what is there today.

`CONNECTOR_DASH`, `connectorStroke`, `connectorStyle`, `connectorWidth`, `distinguishable`, `fromLayout`, `hitTest`, `hueFor`, `IDENTITY`, `invertPlaneTransform`, `isAffine`, `LIGHT_PLANE_STYLES`, `mixStyles`, `perspectiveProbeMatrix`, `PLANE_STYLES`, `PLANES`, `planeTransform`, `planFrame`, `PointerRouter`, `styleFor`, `toDOMMatrix`, `toLocal`, `transformFor`

---

The spatial renderer. The DOM path is what ships; the GPU capture path is EXPERIMENTAL — see README.

The page: https://graview.dev/docs/packages/render.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
