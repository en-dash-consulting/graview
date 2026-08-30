import { labelOf, type AnySchema, type NodeOfSchema } from "@graview/core";
import type { ViewProps } from "@graview/react";
import type { ReactElement } from "react";
import { hueFor } from "../default-views.js";
import { Axis, Chip, Grid, Panel, Roster } from "../primitives/index.js";

/**
 * The timeline/calendar lens.
 *
 * Built from the same public primitives an app has — Grid, Axis, Panel, Chip,
 * Roster and nothing else — so it doubles as the worked example of the
 * authoring API. Fork it and edit it; nothing here is sealed.
 *
 * Time is NOT a framework concern. This lens declares the field ROLES it
 * needs and an app maps its own fields onto them, which is what keeps
 * recurrence and calendar maths out of the core and inside the app that
 * already owns them.
 */

export interface TimelineRoles {
  /** Field holding the start of the span, in the lens's own units. */
  readonly start: string;
  /** Field holding the end. May equal `start` for a moment rather than a span. */
  readonly end: string;
  /** Field naming the column this belongs in — a weekday, a date, a lane. */
  readonly column?: string;
  /** Field holding several columns at once, e.g. a block's days. */
  readonly columns?: string;
}

export const TIMELINE_REQUIRED_ROLES = ["start", "end"] as const;

export type TimelineBindings = Readonly<Record<string, TimelineRoles>>;

export interface TimelineColumn {
  readonly id: string;
  readonly label: string;
}

export interface TimelineOptions {
  readonly bindings: TimelineBindings;
  readonly columns: readonly TimelineColumn[];
  /** The cross axis extent — 1440 for minutes in a day. */
  readonly extent: number;
  readonly ticks?: readonly { at: number; label: string }[];
  /** Formats a position on the cross axis. Defaults to the raw number. */
  readonly format?: (at: number) => string;
}

export interface PlacedSpan {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly columnIds: readonly string[];
  readonly start: number;
  readonly end: number;
}

/** A span placed in a column, with the lane it must occupy to avoid overlap. */
export interface LanedSpan extends PlacedSpan {
  readonly lane: number;
  readonly lanes: number;
}

/**
 * Assigns overlapping spans to side-by-side lanes.
 *
 * Without this every concurrent event draws on top of the others and the
 * column becomes an unreadable pile — which is exactly what a real week is
 * full of: a school run inside a school block inside a shift. Greedy by start
 * time, which is optimal for intervals and, more importantly, STABLE: the
 * same spans always land in the same lanes, so an edit somewhere else does
 * not reshuffle the column and destroy the picture you remember.
 */
export function assignLanes(spans: readonly PlacedSpan[]): LanedSpan[] {
  const ordered = [...spans].sort(
    (a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id),
  );
  const laneEnds: number[] = [];
  const placed = ordered.map((span) => {
    let lane = laneEnds.findIndex((end) => end <= span.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(span.end);
    } else {
      laneEnds[lane] = span.end;
    }
    return { ...span, lane, lanes: 1 };
  });
  const lanes = Math.max(1, laneEnds.length);
  return placed.map((span) => ({ ...span, lanes }));
}

export class TimelineBindingError extends Error {
  constructor(kind: string, missing: readonly string[]) {
    super(
      `The timeline lens needs ${missing.join(" and ")} for "${kind}". ` +
        `Add them to the lens bindings: { ${kind}: { ${missing
          .map((role) => `${role}: "<field name>"`)
          .join(", ")} } }.`,
    );
    this.name = "TimelineBindingError";
  }
}

/**
 * Reads one node's span through the app's own field names.
 *
 * Returns null for a kind the lens was not told about — a graph carries kinds
 * that are not on a timeline, and that is not an error.
 */
export function placeOnTimeline<S extends AnySchema>(
  node: NodeOfSchema<S>,
  bindings: TimelineBindings,
  schema?: S,
): PlacedSpan | null {
  const roles = bindings[node.kind];
  if (!roles) return null;

  const record = node as unknown as Record<string, unknown>;
  const missing = TIMELINE_REQUIRED_ROLES.filter((role) => !(roles[role] in record));
  if (missing.length > 0) throw new TimelineBindingError(node.kind, missing);

  const start = Number(record[roles.start] ?? Number.NaN);
  const end = Number(record[roles.end] ?? start);
  if (!Number.isFinite(start)) return null;

  const columnIds: string[] = [];
  if (roles.columns) {
    const value = record[roles.columns];
    if (Array.isArray(value)) columnIds.push(...value.map(String));
  }
  if (roles.column) {
    const value = record[roles.column];
    if (value !== undefined && value !== null) columnIds.push(String(value));
  }

  return {
    id: node.id,
    kind: node.kind,
    label: labelOf(schema?.tryDefinition(node.kind), node as never),
    columnIds,
    start,
    end: Number.isFinite(end) ? Math.max(end, start) : start,
  };
}

export interface TimelineViewProps<S extends AnySchema> extends ViewProps<S> {
  readonly options: TimelineOptions;
  readonly schema?: S;
  readonly selectedIds?: readonly string[];
}

/**
 * The lens's aggregate view: a set of nodes laid over columns and a cross
 * axis.
 *
 * At `full` fidelity it draws the grid; at `summary` it collapses to one
 * chip per column, and at `glyph` to a single count. That is fidelity
 * switching rather than scaling, which is what keeps a receded calendar
 * legible instead of turning it into grey mush.
 */
export function TimelineView<S extends AnySchema>({
  nodes,
  label,
  fidelity,
  options,
  schema,
  selectedIds = [],
}: TimelineViewProps<S>) {
  const spans = (nodes ?? [])
    .map((node) => placeOnTimeline<S>(node, options.bindings, schema))
    .filter((span): span is PlacedSpan => span !== null);

  if (fidelity === "glyph") {
    return <Chip label={`${label ?? "Timeline"} (${spans.length})`} hue={hueFor("timeline")} />;
  }

  if (fidelity === "summary") {
    return (
      <Panel title={label ?? "Timeline"} meta={spans.length} tone="muted">
        <Roster
          max={options.columns.length}
          items={options.columns.map((column) => ({
            id: column.id,
            label: `${column.label} ${spans.filter((span) => span.columnIds.includes(column.id)).length}`,
            hue: hueFor(column.id),
          }))}
        />
      </Panel>
    );
  }

  const format = options.format ?? String;
  const ticks =
    options.ticks ??
    Array.from({ length: 5 }, (_, index) => {
      const at = (options.extent / 4) * index;
      return { at, label: format(at) };
    });

  return (
    <Panel title={label ?? "Timeline"} meta={spans.length}>
      <Grid columns={options.columns} extent={options.extent}>
        <div style={{ position: "absolute", inset: 0, left: -44, width: 44 }}>
          <Axis ticks={ticks} extent={options.extent} orientation="vertical" />
        </div>
        {options.columns.map((column, columnIndex) => {
          // Lanes are assigned per column: two events overlapping on Monday
          // say nothing about Tuesday.
          const inColumn = assignLanes(
            spans.filter((span) => span.columnIds.includes(column.id)),
          );
          const columnWidth = 100 / options.columns.length;
          return inColumn.map((span) => {
            const top = (span.start / options.extent) * 100;
            const height = Math.max(
              1.6,
              ((span.end - span.start) / options.extent) * 100,
            );
            // Cascade rather than split. Dividing a column evenly between
            // four concurrent events leaves each a quarter as wide and every
            // label truncated to a letter. Offsetting each lane by a fraction
            // and letting them overlap keeps the first one readable, which is
            // how a calendar you would actually use behaves.
            // Clamped. Unbounded, lane 5 is zero-width and lane 6 is
            // NEGATIVE — the browser drops the invalid width and the span
            // escapes into the next day. Six concurrent items in a column is
            // exactly the case this cascade exists for.
            const step = columnWidth * 0.2;
            const offset = Math.min(span.lane * step, columnWidth * 0.6);
            const laneWidth = Math.max(columnWidth * 0.4, columnWidth - offset);
            return (
              <div
                key={`${column.id}:${span.id}`}
                data-graview-span={span.id}
                data-graview-lane={span.lane}
                title={`${span.label} ${format(span.start)}–${format(span.end)}`}
                style={{
                  position: "absolute",
                  top: `${top}%`,
                  height: `${height}%`,
                  left: `${columnIndex * columnWidth + offset}%`,
                  width: `${laneWidth}%`,
                  padding: 1.5,
                  boxSizing: "border-box",
                  // Later lanes sit in front, so the cascade reads front-to-back.
                  zIndex: span.lane + 1,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    minHeight: 15,
                    borderRadius: 7,
                    padding: "3px 7px",
                    fontSize: 10.5,
                    lineHeight: 1.25,
                    overflow: "hidden",
                    // A short span has no room for a label; clipping quietly
                    // is better than spilling over its neighbours.
                    textOverflow: "ellipsis",
                    // Hue identifies the kind; the THEME supplies the text
                    // colour and the fill is a translucent tint over whatever
                    // is behind. A fixed light fill would glare on a dark
                    // ground, which is exactly what it did.
                    border: selectedIds.includes(span.id)
                      ? "1px solid var(--graview-accent)"
                      : `1px solid hsl(${Math.round(hueFor(span.kind) * 360)} 60% 62% / 0.42)`,
                    // Opaque, over a hue wash. A cascaded bar has to OCCLUDE
                    // the one behind it — a translucent fill lets the label
                    // underneath show through and both become unreadable.
                    background: `linear-gradient(hsl(${Math.round(hueFor(span.kind) * 360)} 60% 55% / 0.22), hsl(${Math.round(hueFor(span.kind) * 360)} 60% 55% / 0.22)), var(--graview-panel)`,
                    color: "var(--graview-ink)",
                    boxShadow: selectedIds.includes(span.id)
                      ? "0 0 16px -4px var(--graview-accent)"
                      : undefined,
                  }}
                >
                  {/* A twenty-minute run is a few pixels tall. Printing its
                      label there spills it across everything nearby, so short
                      spans carry their name in the tooltip instead. */}
                  {height >= 2.6 ? span.label : null}
                </div>
              </div>
            );
          });
        })}
      </Grid>
    </Panel>
  );
}

export interface TimelineLens<S extends AnySchema> {
  readonly name: "timeline";
  readonly requiredRoles: readonly string[];
  readonly bindings: TimelineBindings;
  readonly options: TimelineOptions;
  /** The lens's own view, ready to register for a kind or an aggregate. */
  View(props: ViewProps<S>): ReactElement | null;
  /** Which of these nodes the lens can place. */
  place(nodes: readonly NodeOfSchema<S>[], schema?: S): PlacedSpan[];
}

export function createTimelineLens<S extends AnySchema>(
  options: TimelineOptions,
): TimelineLens<S> {
  return {
    name: "timeline",
    requiredRoles: [...TIMELINE_REQUIRED_ROLES],
    bindings: options.bindings,
    options,
    View(props) {
      return <TimelineView<S> {...props} options={options} />;
    },
    place(nodes, schema) {
      return nodes
        .map((node) => placeOnTimeline<S>(node, options.bindings, schema))
        .filter((span): span is PlacedSpan => span !== null);
    },
  };
}
