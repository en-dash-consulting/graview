export {
  BOARD_REQUIRED_ROLES,
  BoardBindingError,
  BoardView,
  buildBoard,
  createBoardLens,
} from "./lens/board.js";
export type { BoardLens, BoardOptions, BoardSlot, BoardState, BoardViewProps } from "./lens/board.js";
export {
  ActivityRail,
  StartFresh,
  AgentSeat,
  AnswerArgs,
  BackOut,
  Backtrack,
  Inspector,
  nameOf,
  OverviewButton,
  descentTarget,
  Standing,
  Trail,
  UndoTurn,
  useRecentChanges,
} from "./workbench/index.js";
export type { AgentSeatProps, Change } from "./workbench/index.js";
export {
  buildCoverage,
  capCoverage,
  CoverageBindingError,
  COVERAGE_MAX_COLUMNS,
  COVERAGE_MAX_ROWS,
  COVERAGE_REQUIRED_ROLES,
  CoverageView,
  createCoverageLens,
} from "./lens/coverage.js";
export type {
  CappedCoverage,
  CoverageCell,
  CoverageGrid,
  CoverageLens,
  CoverageOptions,
  CoverageRoles,
  CoverageViewProps,
} from "./lens/coverage.js";
export { ArrangeBar, arrangementCaption, arrangementOf, roundSteps, sayCondition, withArrangement } from "./arrange-bar.js";
export { useArranging } from "./lens/arranging.js";
export type { Arranging, ArrangingOptions } from "./lens/arranging.js";
export type { ArrangeBarProps } from "./arrange-bar.js";
export { Connections } from "./connections.js";
export type { ConnectionsProps } from "./connections.js";
export { EditableTitle, EditableValue, Fields, humanise } from "./editable.js";
export { Companion, useSubject } from "./companion.js";
export type { CompanionProps, Subject } from "./companion.js";
export { RelationKey, RelationMark, relationWords } from "./relation-key.js";
export { QuickRelations, handles } from "./quick-relations.js";
export { rosterOf } from "./default-views.js";
export { ChatPanel } from "./chat.js";
export { LadderSetting } from "./ladder.js";
export type { ChatPanelProps } from "./chat.js";
export {
  describeSource,
  proposalKey,
  SeatComposer,
  SeatHeader,
  SeatSettings,
  SeatThread,
  Settled,
  splitAside,
  useSeatConversation,
} from "./seat.js";
export type { SeatAnswer, SeatOutcome, SeatTurn } from "./seat.js";
export { Wordmark } from "./wordmark.js";
export { Places } from "./places.js";
export { FindBox } from "./find.js";
export { ShowInstallation } from "./installation.js";
export { Seats } from "./seats.js";
export { Profile } from "./profile.js";
export { buildReach, ReachView, reachLens } from "./lens/reach.js";
export type { Reach, ReachCell } from "./lens/reach.js";
export { Shell } from "./shell.js";
export type { ShellProps } from "./shell.js";
// The primitive set: enough for a new kind to render before anyone writes a view.
export {
  Aggregate,
  Axis,
  Chip,
  Connector,
  FAINT_TEXT,
  Grid,
  MUTED_TEXT,
  Panel,
  Prose,
  VISUALLY_HIDDEN,
  Roster,
  useWidth,
} from "./primitives/index.js";
export type {
  AggregateProps,
  AxisProps,
  ChipProps,
  ConnectorProps,
  GridProps,
  PanelProps,
  RosterProps,
} from "./primitives/index.js";

// The visual system: tokens, and the stylesheet an app drops in.
export { DARK, GRAVIEW_BRAND, LIGHT, SCHEMES, themeCss, themeVariables } from "./theme.js";
export type { Brand, Scheme, ThemeCssOptions, ThemeTokens } from "./theme.js";

// Generic views for every cell, derived from the declaration.
export { hueFor, registerDefaultViews } from "./default-views.js";
export { hasFigure, KindFigure } from "./figure.js";
export { useMarkup } from "./markup.js";

// The worked example: one fully-built lens, from public primitives only.
export {
  activeWindow,
  assignLanes,
  createTimelineLens,
  placeOnTimeline,
  TimelineBindingError,
  TimelineView,
  TIMELINE_REQUIRED_ROLES,
} from "./lens/timeline.js";
export type {
  LanedSpan,
  PlacedSpan,
  TimelineBindings,
  TimelineColumn,
  TimelineLens,
  TimelineOptions,
  TimelineRoles,
  TimelineViewProps,
} from "./lens/timeline.js";

// The calendar: day, week, month, quarter, year and a horizon the app names,
// over real dates. Bound by roles like every other starter, and it has never
// heard of a task, a shift or a planting.
export {
  actThatMoves,
  addDays,
  addMonths,
  CalendarBindingError,
  CALENDAR_RANGES,
  CALENDAR_REQUIRED_ROLES,
  createCalendarLens,
  dayOf,
  daysBetween,
  daysFrom,
  endOfMonth,
  entriesIn,
  entriesOn,
  finerThan,
  minutesOf,
  placeOnCalendar,
  rangesOf,
  spanOf,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  titleOf,
  weekdayOf,
} from "./lens/calendar.js";
export type {
  CalendarBindings,
  CalendarCell,
  CalendarGrain,
  CalendarHorizon,
  CalendarLens,
  CalendarOptions,
  CalendarRange,
  CalendarRoles,
  CalendarSpan,
  PlacedEntry,
} from "./lens/calendar.js";

// The surfaces a blank graph needs, derived from the chain the declaration
// already states: the way in, what a model proposes before it does it, and
// the doors it was declared to be reachable through.
export { Begin, Door, downscale, Intake, PlanReview, PHOTO_MAX_EDGE, PHOTO_QUALITY } from "./seeding.js";
export type { BeginProps, DoorProps, IntakeProps, PlanReviewProps } from "./seeding.js";
export {
  buildPlanLens,
  createPlanLens,
  PlanBindingError,
  PlanView,
  PLAN_REQUIRED_ROLES,
} from "./lens/plan.js";
export type { PlanLens, PlanLensOptions, PlanLensState, PlanViewProps } from "./lens/plan.js";
export { THUMBNAIL_BUDGET } from "./default-views.js";
export { withMore } from "./lens/more.js";
