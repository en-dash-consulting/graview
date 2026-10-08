/**
 * `@graview/react/provider` — THE PROVIDER, THE HOOKS AND THE VIEW
 * REGISTRY, WITHOUT THE SCENE (FR-57).
 *
 * Everything here is also exported from `@graview/react`. It is its own
 * entry because a bundler splits a page by which files its first chunk can
 * reach, and `@graview/react` reaches the scene: a frame that imported the
 * provider from it carried the map into a page that drew only the pages.
 * What the frame of every face needs — the app bar, the default
 * views, the routed face — imports from here, and the scene is fetched
 * with the face that draws it. Nothing in this module's files may import
 * the scene's, or `@graview/react`.
 *
 * And no more than the frame draws with: a bundler places a whole file in
 * the first chunk when the first chunk can reach it and any chunk uses it,
 * so what only a drawn view uses — the measured text, the kit's connector,
 * the boundary, the emphasis sets, the editable fields, the others placed —
 * is `@graview/react/drawing`'s, fetched with the face that draws it.
 */
export { GraviewProvider, openingView, ROBOT_REST_MS, useFound, useGraph, useGraview, useGraviewIfAny, useNode, useRobots, useScenePointer, useTheWatchKnowsWhatIsUnseen, useViewMode, useWhereIs, ViewModeProvider } from "./context.js";
export { GoToContext, useGoTo } from "./go.js";
export type { GoTo } from "./go.js";
export type { ActsDoor, AdministeredModule, DrawnBox, GraviewContextValue, GraviewProviderProps, PointerMenu, SceneHandle, Scheme, Seat, ViewMode } from "./context.js";
export { HEARTBEAT_MS, PRESENCE_SETTINGS, SHARE_OVER, SHARE_WHERE, tabSession, usePresenceState } from "./presence.js";
export type { PresenceInputs, PresenceState } from "./presence.js";
export { foldRobots, participantOf, standingFor, VISIT_EACH_UP_TO } from "./robot.js";
export type { RobotEvent, RobotMode, RobotState, SeatNote } from "./robot.js";
export { createPointerStore } from "./pointer.js";
export type { PointerStore, ScenePoint } from "./pointer.js";
export { applySettings, honorSetting, loadSetting, rememberSetting } from "./settings.js";
export type { ReaderMemory } from "./settings.js";
export { createViews, DEFAULT_VIEW, isDefaultView, layerViews, markDefaultView } from "./view-registry.js";
export type { Cardinality, Fidelity, ReactViewRegistry, ViewCell, ViewComponent, ViewProps } from "./view-registry.js";
export { ErrorReportContext } from "./error-report.js";
export type { ErrorReport } from "./error-report.js";
export { ACTIVITY_HOLD_MS, markActivity } from "./activity.js";
export type { ActivityMark, Attention, Manner, ToolCallLike } from "./activity.js";
export { useBacktrack, useJackIn, useNavigation, useSelection, useViolations } from "./hooks.js";
export { useLocalIntelligence } from "./local-intelligence.js";
export type { Ask, LocalIntelligence } from "./local-intelligence.js";
export { createMotionStore, useSceneStill } from "./motion.js";
export type { MotionStore } from "./motion.js";
export { landingIn, useTheKeyboardLandsSomewhere } from "./keyboard.js";
export { inTopLayer, placePane, POPOVER_STYLE, POPOVERS, raiseOverPopovers, usePopover, useTopLayer } from "./popover.js";
export type { PlaceOptions, Popover, PopoverAnchor, PopoverName, PopoverOptions } from "./popover.js";
