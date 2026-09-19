export { GraviewProvider, useGraph, useGraview, useGraviewIfAny, useNode, useScenePointer, useViewMode, useWhereIs, ViewModeProvider } from "./context.js";
export type { AdministeredModule, DrawnBox, GraviewContextValue, GraviewProviderProps, PointerMenu, SceneHandle, Scheme, Seat, ViewMode } from "./context.js";
export { createPointerStore } from "./pointer.js";
export type { PointerStore, ScenePoint } from "./pointer.js";
export { applySettings, honourSetting, loadSetting, rememberSetting } from "./settings.js";

export { createViews, DEFAULT_VIEW, isDefaultView, markDefaultView } from "./view-registry.js";
export { ViewBoundary } from "./view-boundary.js";
export type { ViewBoundaryProps } from "./view-boundary.js";
export type {
  Cardinality,
  Fidelity,
  ReactViewRegistry,
  ViewCell,
  ViewComponent,
  ViewProps,
} from "./view-registry.js";

export {
  clipQuadratic,
  connectorStrands,
  altitudeOpacity,
  onScreen,
  ResolvedView,
  Scene,
  selectionFor,
  tieRoute,
  whereIsIn,
} from "./scene.js";
export type { SceneNode, Strand } from "./scene.js";
export { useAnimatedLayout, useTouched } from "./animation.js";
export type { TransitionOptions } from "./animation.js";
export {
  ACTIVITY_HOLD_MS,
  markActivity,
  useActivity,
  useAttention,
  violationKey,
} from "./activity.js";
export type { ActivityMark, Attention, Manner, ToolCallLike } from "./activity.js";
export type { ResolvedViewProps, SceneProps } from "./scene.js";


export { useFlagged, useImplicated, useViolations } from "./hooks.js";
export { useLocalIntelligence } from "./local-intelligence.js";
export type { Ask, LocalIntelligence } from "./local-intelligence.js";
export { kitConnector, useKit } from "./kit.js";
export { clipPolyline, latticePoints, orthogonalPoints, polylineD, roundedPolylineD, routePoint, routedQuadratic } from "./routes.js";
export { bandRows, channelRoute } from "./channels.js";
export {
  useAffordances,
  useApplyAffordance,
  adjustment,
  useBacktrack,
  useEditableFields,
  useJackIn,
  useNavigation,
  useSelection,
  UrlSync,
  useUrlSync,
} from "./hooks.js";
export { useDrawnSize, useTextMeasure } from "./drawn.js";
export type { DrawnOptions, DrawnSize } from "./drawn.js";
