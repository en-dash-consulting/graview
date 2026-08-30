export {
  ActivityRail,
  AnswerArgs,
  BackOut,
  Inspector,
  nameOf,
  Standing,
  Trail,
  UndoTurn,
  useRecentChanges,
} from "./workbench/index.js";
export type { Change } from "./workbench/index.js";
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
export { DARK, LIGHT, SCHEMES, themeCss, themeVariables } from "./theme.js";
export type { Scheme, ThemeTokens } from "./theme.js";

// Generic views for every cell, derived from the declaration.
export { hueFor, registerDefaultViews } from "./default-views.js";

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
