export { GraviewProvider, ROBOT_REST_MS, useFound, useGraph, useGraview, useGraviewIfAny, useNode, useRobots, useScenePointer, useTheWatchKnowsWhatIsUnseen, useViewMode, useWhereIs, ViewModeProvider } from "./context.js";
export { Figure, Occupants, PersonFigure } from "./occupants.js";
export { anchorOf, AUDIENCE_ROW, HEARTBEAT_MS, placeOthers, PRESENCE_SETTINGS, SHARE_OVER, SHARE_WHERE, tabSession, usePresenceState } from "./presence.js";
export type { Placed, PresenceInputs, PresenceState } from "./presence.js";
export type { OccupantsProps } from "./occupants.js";
export { foldRobots, participantOf, standingFor, VISIT_EACH_UP_TO } from "./robot.js";
export type { RobotEvent, RobotMode, RobotState, SeatNote } from "./robot.js";
export type { ActsDoor, AdministeredModule, DrawnBox, GraviewContextValue, GraviewProviderProps, PointerMenu, SceneHandle, Scheme, Seat, ViewMode } from "./context.js";
export { createPointerStore } from "./pointer.js";
export type { PointerStore, ScenePoint } from "./pointer.js";
export { applySettings, honourSetting, loadSetting, rememberSetting } from "./settings.js";
export type { ReaderMemory } from "./settings.js";

export { createViews, DEFAULT_VIEW, isDefaultView, layerViews, markDefaultView } from "./view-registry.js";
export { ErrorReportContext, ViewBoundary } from "./view-boundary.js";
export type { ErrorReport, ViewBoundaryProps } from "./view-boundary.js";
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
  stackOpacity,
  onScreen,
  ResolvedView,
  Scene,
  selectionFor,
  tieRoute,
  whereIsIn,
} from "./scene.js";
export type { SceneNode, Strand } from "./scene.js";
export { useAnimatedLayout, useSeatWork, useTouched } from "./animation.js";
export { SeatMarks } from "./seat-marks.js";
export type { SeatAct, SeatWork } from "./animation.js";
export type { TransitionOptions } from "./animation.js";
export {
  ACTIVITY_HOLD_MS,
  markActivity,
  useActivity,
  useAttention,
} from "./activity.js";
export type { ActivityMark, Attention, Manner, ToolCallLike } from "./activity.js";
export type { ResolvedViewProps, SceneProps } from "./scene.js";


export { NOTHING_FOUND, useFlagged, useImplicated, useReached, useViolations } from "./hooks.js";
export { useLocalIntelligence } from "./local-intelligence.js";
export type { Ask, LocalIntelligence } from "./local-intelligence.js";
export { kitConnector, useKit } from "./kit.js";
export { clipPolyline, latticePoints, orthogonalPoints, polylineD, roundedPolylineD, routePoint, routedQuadratic } from "./routes.js";
export { bandRows, channelRoute } from "./channels.js";
export {
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
export { createMotionStore, useSceneStill } from "./motion.js";
export type { MotionStore } from "./motion.js";
export { landingIn, useTheKeyboardLandsSomewhere } from "./keyboard.js";
export { inTopLayer, placePane, POPOVER_STYLE, POPOVERS, raiseOverPopovers, usePopover, useTopLayer } from "./popover.js";
export type { PlaceOptions, Popover, PopoverAnchor, PopoverName, PopoverOptions } from "./popover.js";
export { useAffordances, useApplyAffordance } from "./affordances.js";
