// The primitive set: enough for a new kind to render before anyone writes a view.
export {
  Aggregate,
  Axis,
  Chip,
  Connector,
  Grid,
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

// Generic views for every cell, derived from the declaration.
export { hueFor, registerDefaultViews } from "./default-views.js";

// The worked example: one fully-built lens, from public primitives only.
export {
  createTimelineLens,
  placeOnTimeline,
  TimelineBindingError,
  TimelineView,
  TIMELINE_REQUIRED_ROLES,
} from "./lens/timeline.js";
export type {
  PlacedSpan,
  TimelineBindings,
  TimelineColumn,
  TimelineLens,
  TimelineOptions,
  TimelineRoles,
  TimelineViewProps,
} from "./lens/timeline.js";
