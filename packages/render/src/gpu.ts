/*
 * The capture path: rasterize a DOM subtree into a texture and composite the
 * textures with per-plane blur.
 *
 * A separate entry because its declarations name WebGPU globals, which are
 * ambient rather than importable — a consumer reaching this needs
 * `@webgpu/types` in their own compilation, and a consumer who never touches
 * it should not. It is fetched only where a page can draw on it: `Scene`'s
 * `auto` asks `gpuCapturePresent()` from the main entry first, and a page
 * without WebGPU and element capture never loads this file. Element capture
 * is on by default in Chromium 158 and behind
 * `--enable-blink-features=CanvasDrawElement` before it. Capture costs
 * ~0.22 ms a view, so the path retakes only what is in view and changed,
 * within a budget a frame (`CAPTURE_BUDGET`), and hands the rest to the DOM
 * path (`attachGpu`), whose first-frame check falls back to the DOM path for
 * good where the GPU cannot keep up.
 *
 * On 158 the browser's hit-test follows reported geometry and the router
 * stands down; on earlier builds the hosts are out of hit-testing, because
 * the browser's hit-test descending into a `layoutsubtree` child was fatal.
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
export { attachGpu, FIRST_FRAMES, FIRST_FRAME_BUDGET_MS, FIRST_PAINT_WAIT_MS } from "./scene/attach-gpu.js";
export type { AttachGpuOptions, GpuScene } from "./scene/attach-gpu.js";

