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
  CoverageBindingError,
  COVERAGE_REQUIRED_ROLES,
  CoverageView,
  createCoverageLens,
} from "./lens/coverage.js";
export type {
  CoverageCell,
  CoverageGrid,
  CoverageLens,
  CoverageOptions,
  CoverageRoles,
  CoverageViewProps,
} from "./lens/coverage.js";
export { Connections } from "./connections.js";
export type { ConnectionsProps } from "./connections.js";
export { EditableTitle, EditableValue, Fields, humanise } from "./editable.js";
export { RelationKey } from "./relation-key.js";
export { QuickRelations } from "./quick-relations.js";
export { ChatPanel, IntelligenceSettings } from "./chat.js";
export type { ChatPanelProps } from "./chat.js";
export { Wordmark } from "./wordmark.js";
export { Places } from "./places.js";
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
  VISUALLY_HIDDEN,
  Roster,
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
