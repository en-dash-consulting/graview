/*
 * The MAIN entry carries no WebGPU types.
 *
 * The plane model, the frame planner, the connector treatment and the pointer
 * router are what every app uses, and they are pure geometry. The capture path
 * is a different thing: it names `GPUDevice`, `GPUQueue` and `GPUTexture` in
 * its declarations, and those are ambient globals from `@webgpu/types` rather
 * than importable ones — so a `.d.ts` mentioning them makes every consumer
 * install that package to typecheck an import they may never reach.
 *
 * Splitting it out is not a workaround. It matches what this package already
 * says about itself: the DOM path is what ships and the capture path is
 * experimental, and now the type surface says so too. Reach it explicitly:
 *
 *   import { Compositor } from "@graview/render/gpu";
 *
 * Found by typechecking a scratch project against the packed tarballs, which
 * is the only place a public surface's ambient requirements show up.
 */

// Affine geometry: pure, and free of any ambient global.
export {
  IDENTITY,
  isAffine,
  perspectiveProbeMatrix,
  planeTransform,
  toDOMMatrix,
} from "./platform/matrix.js";
export type { Matrix4 } from "./platform/matrix.js";

// The plane model: discrete depths and their atmospheric treatment.
export {
  LIGHT_PLANE_STYLES,
  PLANES,
  PLANE_STYLES,
  mixStyles,
  styleFor,
  transformFor,
} from "./scene/plane.js";
export type { PlaneIndex, PlaneStyle, Scheme } from "./scene/plane.js";

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

// Pointer routing, until the platform redirects hit-testing itself.
export { PointerRouter, hitTest, invertPlaneTransform, toLocal } from "./interaction/pointer-router.js";
export type { LocalHit, Placement, PointerRouterOptions } from "./interaction/pointer-router.js";
