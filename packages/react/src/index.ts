export { GraviewProvider, useGraph, useGraview, useNode, useViewMode, ViewModeProvider } from "./context.js";
export type { GraviewContextValue, GraviewProviderProps, Scheme, ViewMode } from "./context.js";

export { createViews } from "./view-registry.js";
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
  onScreen,
  ResolvedView,
  Scene,
  selectionFor,
  tieRoute,
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
export {
  useAffordances,
  useApplyAffordance,
  useBacktrack,
  useEditableFields,
  useJackIn,
  useNavigation,
  useSelection,
  UrlSync,
  useUrlSync,
} from "./hooks.js";
