/*
 * The capture path: rasterise a DOM subtree into a texture and composite the
 * textures with per-plane blur.
 *
 * A separate entry because its declarations name WebGPU globals, which are
 * ambient rather than importable — a consumer reaching this needs
 * `@webgpu/types` in their own compilation, and a consumer who never touches
 * it should not. It is also the experimental half of this package: it needs
 * Chrome Canary with `--enable-blink-features=CanvasDrawElement`, and clicking
 * inside a captured view still crashes the renderer process.
 */

// The platform seam. Every HTML-in-Canvas call in the framework goes here.
// The platform seam. Every HTML-in-Canvas call in the framework goes here.
export {
  captureElement,
  captureElementImage,
  clearElementGeometry,
  detectCapabilities,
  IDENTITY,
  isAffine,
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
  CompositorDeps,
  CompositorOptions,
  SceneView,
  SurfaceLike,
  VgpuLike,
} from "./scene/compositor.js";
export { COMPOSITOR_WGSL } from "./scene/compositor.wgsl.js";

