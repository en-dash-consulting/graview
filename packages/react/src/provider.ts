/**
 * `@graview/react/provider` — THE PROVIDER, THE HOOKS AND THE VIEW
 * REGISTRY, WITHOUT THE SCENE (FR-57).
 *
 * Everything here is also exported from `@graview/react`. It is its own
 * entry because a bundler splits a page by which files its first chunk can
 * reach, and `@graview/react` reaches the scene: a frame that imported the
 * provider from it carried the map into a page that drew only the pages.
 * What the frame of every face needs — the embed's strip, the default
 * views, the routed face — imports from here, and the scene is fetched
 * with the face that draws it. Nothing in this module's files may import
 * the scene's, or `@graview/react`.
 */
export { GraviewProvider, openingView, ROBOT_REST_MS, useFound, useGraph, useGraview, useGraviewIfAny, useNode, useRobots, useScenePointer, useTheWatchKnowsWhatIsUnseen, useViewMode, useWhereIs, ViewModeProvider } from "./context.js";
export { GoToContext, useGoTo } from "./go.js";
export type { GoTo } from "./go.js";
export type { ActsDoor, AdministeredModule, DrawnBox, GraviewContextValue, GraviewProviderProps, PointerMenu, SceneHandle, Scheme, Seat, ViewMode } from "./context.js";
export { anchorOf, AUDIENCE_ROW, HEARTBEAT_MS, placeOthers, PRESENCE_SETTINGS, SHARE_OVER, SHARE_WHERE, tabSession, usePresenceState } from "./presence.js";
export type { Placed, PresenceInputs, PresenceState } from "./presence.js";
export { foldRobots, participantOf, standingFor, VISIT_EACH_UP_TO } from "./robot.js";
export type { RobotEvent, RobotMode, RobotState, SeatNote } from "./robot.js";
export { createPointerStore } from "./pointer.js";
export type { PointerStore, ScenePoint } from "./pointer.js";
export { applySettings, honourSetting, loadSetting, rememberSetting } from "./settings.js";
export type { ReaderMemory } from "./settings.js";
export { createViews, DEFAULT_VIEW, isDefaultView, layerViews, markDefaultView } from "./view-registry.js";
export type { Cardinality, Fidelity, ReactViewRegistry, ViewCell, ViewComponent, ViewProps } from "./view-registry.js";
export { ErrorReportContext, ViewBoundary } from "./view-boundary.js";
export type { ErrorReport, ViewBoundaryProps } from "./view-boundary.js";
export { ACTIVITY_HOLD_MS, markActivity, useActivity, useAttention } from "./activity.js";
export type { ActivityMark, Attention, Manner, ToolCallLike } from "./activity.js";
export {
  adjustment,
  NOTHING_FOUND,
  useBacktrack,
  useEditableFields,
  useFlagged,
  useImplicated,
  useJackIn,
  useNavigation,
  useReached,
  useSelection,
  UrlSync,
  useUrlSync,
  useViolations,
} from "./hooks.js";
export { useLocalIntelligence } from "./local-intelligence.js";
export type { Ask, LocalIntelligence } from "./local-intelligence.js";
export { kitConnector, useKit } from "./kit.js";
export { useDrawnSize, useTextMeasure } from "./drawn.js";
export type { DrawnOptions, DrawnSize } from "./drawn.js";
export { createMotionStore, useSceneStill } from "./motion.js";
export type { MotionStore } from "./motion.js";
export { landingIn, useTheKeyboardLandsSomewhere } from "./keyboard.js";
export { inTopLayer, placePane, POPOVER_STYLE, POPOVERS, raiseOverPopovers, usePopover, useTopLayer } from "./popover.js";
export type { PlaceOptions, Popover, PopoverAnchor, PopoverName, PopoverOptions } from "./popover.js";
