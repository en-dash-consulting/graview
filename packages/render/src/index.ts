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

// The plane model: discrete depths and their atmospheric treatment.
export { PLANES, PLANE_STYLES, mixStyles, styleFor, transformFor } from "./scene/plane.js";
export type { PlaneIndex, PlaneStyle } from "./scene/plane.js";

// The frame, as data: what captures, what draws, and where it lands.
export { planFrame } from "./scene/frame-plan.js";
export type {
  CaptureCommand,
  ConnectorDraw,
  FramePlan,
  GeometryReport,
  PlanOptions,
  PlannedConnector,
  PlannedView,
  ViewDraw,
} from "./scene/frame-plan.js";
export { fromLayout } from "./scene/from-layout.js";

// Connector treatment, derived per edge kind.
export { connectorStyle, distinguishable } from "./scene/connectors.js";
export type { ConnectorStyle, EndCap, StrokePattern } from "./scene/connectors.js";

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

// Pointer routing, until the platform redirects hit-testing itself.
export { PointerRouter, hitTest, invertPlaneTransform, toLocal } from "./interaction/pointer-router.js";
export type { LocalHit, Placement, PointerRouterOptions } from "./interaction/pointer-router.js";
