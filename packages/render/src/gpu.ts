/*
 * The capture path: rasterize a DOM subtree into a texture and composite the
 * textures with per-plane blur.
 *
 * A separate entry because its declarations name WebGPU globals, which are
 * ambient rather than importable — a consumer reaching this needs
 * `@webgpu/types` in their own compilation, and a consumer who never touches
 * it should not. It is also the experimental half of this package: it needs
 * Chrome Canary with `--enable-blink-features=CanvasDrawElement`. Capture
 * costs ~0.22 ms a view on Chromium 158, so the path retakes only what is in
 * view and changed, within a budget a frame (`CAPTURE_BUDGET`), and hands
 * the rest to the DOM path (`attachGpu`).
 *
 * The renderer-process crash on pointer input is fixed — the hosts are out of
 * hit-testing on this path, because the browser's hit-test descending into a
 * `layoutsubtree` child is what was fatal, not the click. See
 * `scripts/verify-capture.mjs`.
 */

// The platform seam. Every HTML-in-Canvas call in the framework goes here.
export {
  captureElement,
  captureElementImage,
  changedElementsOf,
  clearElementGeometry,
  detectCapabilities,
  IDENTITY,
  isAffine,
  markDrawable,
  perspectiveProbeMatrix,
  planeTransform,
  PlatformUnavailableError,
  requestPaint,
  setLayoutSubtree,
  toDOMMatrix,
  updateElementGeometry,
} from "./platform/html-in-canvas.js";
export type {
  CaptureMethodName,
  CaptureSource,
  ElementImage,
  GeometryUpdate,
  Matrix4,
  PlatformCapabilities,
} from "./platform/html-in-canvas.js";

// Capture and composite.
export { Compositor, packUniform } from "./scene/compositor.js";
export type {
  CompositedFrame,
  CompositorDeps,
  CompositorOptions,
  SceneView,
  SurfaceLike,
  VgpuLike,
} from "./scene/compositor.js";
export { COMPOSITOR_WGSL } from "./scene/compositor.wgsl.js";

// The capture path as a Scene's `attachRenderer`.
export { attachGpu } from "./scene/attach-gpu.js";
export type { AttachGpuOptions, GpuScene } from "./scene/attach-gpu.js";

