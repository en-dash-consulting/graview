export { GraviewProvider, hasLanded, markLanded, matchWith, openingView, PLACE_MENU_EVENT, ROBOT_REST_MS, useFound, useGraph, useGraview, useGraviewIfAny, useNode, useRobots, useScenePointer, useTheWatchKnowsWhatIsUnseen, useViewMode, useWhereIs, ViewModeProvider } from "./context.js";
export { GoToContext, useGoTo } from "./go.js";
export { MenuSections, useMenuPrepare, useMenuSections } from "./menu-sections.js";
export type { MenuColumn, MenuItem, MenuPage, MenuSection, MenuSectionSource, MenuTarget } from "./menu-types.js";
export { alsoWhenSectionsArrive, partsWanted, sectionsArrive, sectionsWanted, sectionUnderNow, setViewPlace, viewPlaceOf } from "./view-places.js";
export type { MenuViewSection, ViewPlaceDraft, ViewPlaceDrawing, ViewPlaceHandle } from "./view-places.js";
export { BesideTheMap } from "./beside-the-map.js";
export { HostAssetsContext, HostFilesContext, useHostAssets, useHostFiles } from "./files.js";
export type { GoTo, GoToAlso, GoToTarget } from "./go.js";
export { Figure, Occupants, PersonFigure } from "./occupants.js";
export { TypingContext } from "./typing.js";
export type { FieldTyping, LiveTyping } from "./typing.js";
export { HEARTBEAT_MS, PRESENCE_SETTINGS, SHARE_OVER, SHARE_WHERE, tabSession, usePresenceState } from "./presence.js";
export type { PresenceInputs, PresenceState } from "./presence.js";
export { anchorOf, AUDIENCE_ROW, placeOthers } from "./placement.js";
export type { Placed } from "./placement.js";
export type { OccupantsProps } from "./occupants.js";
export { foldRobots, participantOf, standingFor, VISIT_EACH_UP_TO } from "./robot.js";
export type { RobotEvent, RobotMode, RobotState, SeatNote } from "./robot.js";
export type { ActsDoor, AdministeredModule, AwaySummary, DrawnBox, GraviewContextValue, GraviewProviderProps, OnExport, PointerMenu, SceneHandle, Scheme, Seat, ViewMode, WorkflowRuns } from "./context.js";
export { createPointerStore } from "./pointer.js";
export type { PointerStore, ScenePoint } from "./pointer.js";
export { applySettings, honorSetting, loadSetting, rememberSetting } from "./settings.js";
export type { ReaderMemory } from "./settings.js";

export { createViews, layerViews } from "./view-registry.js";
export { KeptViewsProvider, useTidiedViews } from "./tidied-views.js";
export { BLEEDS, bleeds, DEFAULT_VIEW, isDefaultView, markBleeds, markDefaultView, markPreviews, markReplacesPage, PREVIEWS, previewOf, REPLACES_PAGE, replacesPage, type ScenePreviewing } from "./view-marks.js";
export { DefaultDrawnElsewhere } from "./default-elsewhere.js";
export { PageDoorContext, ViewContentHeight, type PageDoor } from "./content-height.js";
export { ErrorReportContext } from "./error-report.js";
export type { ErrorReport } from "./error-report.js";
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
export { PanFree, usePanFreeContext } from "./pan-free.js";
export { SeatMarks } from "./seat-marks.js";
export type { SeatAct, SeatWork } from "./animation.js";
export type { TransitionOptions } from "./animation.js";
export { ACTIVITY_HOLD_MS, markActivity } from "./activity.js";
export { useActivity, useAttention } from "./attention.js";
export type { ActivityMark, Attention, Manner, ToolCallLike } from "./activity.js";
export type { ResolvedViewProps, SceneProps } from "./scene.js";


export { useViolations } from "./hooks.js";
export { NOTHING_FOUND, useFlagged, useImplicated, useReached } from "./emphasis.js";
export { useLocalIntelligence } from "./local-intelligence.js";
export type { Ask, LocalIntelligence } from "./local-intelligence.js";
export { kitConnector, useKit } from "./kit.js";
export { districtOf, mapChoice, ribbonsOf, ribbonSentence } from "./map-choice.js";
export { RIBBON_WIDTH, ribbonWidth } from "./ribbon-width.js";
export type { MapChoice, Ribbon } from "./map-choice.js";
export { pickedFrom } from "./picked.js";
export { clipPolyline, latticePoints, orthogonalPoints, polylineD, roundedPolylineD, routePoint, routedQuadratic } from "./routes.js";
export { bandRows, channelRoute } from "./channels.js";
export { adjustment, UrlSync, useUrlSync } from "./url-sync.js";
export {
  useBacktrack,
  useJackIn,
  useNavigation,
  useSelection,
} from "./hooks.js";
export { useEditableFields } from "./editable-fields.js";
export { useDrawnSize, useMarqueeRoom, useTextMeasure } from "./drawn.js";
export type { DrawnOptions, DrawnSize } from "./drawn.js";
export { createMotionStore, useSceneStill } from "./motion.js";
export type { MotionStore } from "./motion.js";
export { landingIn, useTheKeyboardLandsSomewhere } from "./keyboard.js";
export { inTopLayer, placePane, POPOVER_STYLE, POPOVERS, raiseOverPopovers, usePopover, useTopLayer } from "./popover.js";
export type { PlaceOptions, Popover, PopoverAnchor, PopoverName, PopoverOptions } from "./popover.js";
export { afterFirstDraw, createPartsWatch, firstDrawn, lazyModule, lazyPart, partArriving, partsArriving, partsWaiting, partsWatchMoved, PartsWatchContext, placeDrawn, placeWatched, retryLazyParts } from "./lazy-part.js";
// The conversation with the seat, held by the app so a face switch keeps it.
export { createSeatTalk, seatTalkKey, useSeatTalkState } from "./seat-talk.js";
// The inline AI's desk: the interactions Activity draws and the ghost waiting to be accepted, held by the app.
export { createAiDesk, useAiDeskState } from "./ai-desk.js";
export type { AiDesk, AiDeskState, HeldGhost } from "./ai-desk.js";
export type { KeepLensAnswer, KeepLensHost, LensEdit, ComposeChangeHost, DraftChangeHost, ProposeChangeAnswer, ProposeChangeHost, ReshapeProposal, SeatKept, SeatOutcome, SeatTalk, SeatTalkState, SeatTurn } from "./seat-talk.js";
export type { LazyModule, LazyPartOptions, PartsWatch } from "./lazy-part.js";
export { prepareAffordances, useAffordances, useApplyAffordance } from "./affordances.js";
export type { AffordancesAsked } from "./affordances.js";
// The app as it was (Roadmap f-playback): the moment a face draws instead of now, held by its outermost provider.
export { PlaybackContext, useLiveStore, useOwnPlayback, usePlayback, useReadersServed } from "./past.js";
export type { PastShown, Playback } from "./past.js";
