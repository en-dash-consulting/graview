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
          const inColumn = spans.filter((span) => span.columnIds.includes(column.id));
          return inColumn.map((span) => {
            const top = (span.start / options.extent) * 100;
            const height = Math.max(
              2,
              ((span.end - span.start) / options.extent) * 100,
            );
            return (
              <div
                key={`${column.id}:${span.id}`}
                data-graview-span={span.id}
                title={`${span.label} ${format(span.start)}–${format(span.end)}`}
                style={{
                  position: "absolute",
                  top: `${top}%`,
                  height: `${height}%`,
                  left: `${(columnIndex / options.columns.length) * 100}%`,
                  width: `${(1 / options.columns.length) * 100}%`,
                  padding: 2,
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    minHeight: 14,
                    borderRadius: 6,
                    padding: "2px 6px",
                    fontSize: 11,
                    lineHeight: 1.3,
                    overflow: "hidden",
                    border: selectedIds.includes(span.id)
                      ? "2px solid var(--graview-accent, #2f6f5e)"
                      : "1px solid var(--graview-edge, #e4e0d8)",
                    background: `hsl(${Math.round(hueFor(span.kind) * 360)} 55% 95%)`,
                    color: `hsl(${Math.round(hueFor(span.kind) * 360)} 45% 28%)`,
                  }}
                >
                  {span.label}
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
