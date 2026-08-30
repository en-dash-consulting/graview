import { labelOf, type AnySchema, type NodeOfSchema } from "@graview/core";
import type { ViewProps } from "@graview/react";
import type { ReactElement } from "react";
import { hueFor } from "../default-views.js";
import { Chip, Panel, Roster } from "../primitives/index.js";

/**
 * The timeline/calendar lens.
 *
 * Built from the same public primitives an app has, so it doubles as the
 * worked example of the authoring API. Fork it and edit it; nothing is
 * sealed.
 *
 * Time is NOT a framework concern. This lens declares the field ROLES it
 * needs and an app maps its own fields onto them, which keeps recurrence and
 * calendar maths inside the app that already owns them.
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
  /** The full extent of the axis — 1440 for minutes in a day. */
  readonly extent: number;
  /** Formats a position on the axis. Defaults to the raw number. */
  readonly format?: (at: number) => string;
  /** Spacing of axis rules, in axis units. Derived from the window if absent. */
  readonly tick?: number;
  /**
   * Hue for a span, 0..1. Defaults to the node's KIND, which is right for a
   * graph and wrong for a calendar: every block is the same kind, so a week
   * of school, naps and shifts came out one shade of maroon. An app that has
   * a category of its own — the household example has `blockType` — says so here.
   */
  readonly hueOf?: (span: PlacedSpan) => number;
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
 * The slice of the axis worth drawing.
 *
 * A day runs 24 hours; a household's day happens between about seven and
 * eight. Drawing the full extent spends two thirds of the height on empty
 * night and squeezes everything legible into the middle — which is exactly
 * what it did. The window comes from the data, padded, and never narrower
 * than `minimum` so a sparse day does not zoom absurdly.
 */
export function activeWindow(
  spans: readonly PlacedSpan[],
  extent: number,
  { pad = 45, minimum = 480 }: { pad?: number; minimum?: number } = {},
): { start: number; end: number } {
  if (spans.length === 0) return { start: 0, end: extent };
  const earliest = Math.min(...spans.map((span) => span.start));
  const latest = Math.max(...spans.map((span) => span.end));
  let start = Math.max(0, earliest - pad);
  let end = Math.min(extent, latest + pad);
  const short = minimum - (end - start);
  if (short > 0) {
    start = Math.max(0, start - short / 2);
    end = Math.min(extent, start + minimum);
  }
  return { start, end };
}

/**
 * Assigns overlapping spans to side-by-side lanes.
 *
 * Greedy by start time, which is optimal for intervals and — more
 * importantly — STABLE: the same spans always land in the same lanes, so an
 * edit elsewhere does not reshuffle the column and destroy the picture you
 * remember.
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

/** Below this share of the window, a span is a moment rather than a duration. */
const MOMENT_RATIO = 0.045;
const GUTTER = 52;

/**
 * The lens's aggregate view.
 *
 * At `full` fidelity it draws the grid; at `summary` one chip per column with
 * its count; at `glyph` a single count. That is fidelity SWITCHING rather
 * than scaling, which is what keeps a receded calendar legible instead of
 * turning it into grey mush.
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
  const hue: (span: PlacedSpan) => number =
    options.hueOf ?? ((span) => hueFor(span.kind));

  if (fidelity === "glyph") {
    return <Chip label={`${label ?? "Timeline"} · ${spans.length}`} hue={hueFor("timeline")} />;
  }

  if (fidelity === "summary") {
    return (
      <Panel title={label ?? "Timeline"} meta={`${spans.length} items`} tone="muted">
        <Roster
          max={options.columns.length}
          items={options.columns.map((column) => ({
            id: column.id,
            label: `${column.label} ${spans.filter((s) => s.columnIds.includes(column.id)).length}`,
            hue: hueFor(column.id),
          }))}
        />
      </Panel>
    );
  }

  const format = options.format ?? String;
  const window = activeWindow(spans, options.extent);
  const range = window.end - window.start;
  const pct = (at: number) => ((at - window.start) / range) * 100;

  // Rules snapped to round numbers, so the labels read as times rather than
  // as wherever the window happened to begin.
  const tick = options.tick ?? Math.max(60, Math.round(range / 8 / 60) * 60);
  const ticks: number[] = [];
  for (let at = Math.ceil(window.start / tick) * tick; at <= window.end; at += tick) {
    ticks.push(at);
  }

  return (
    <Panel
      title={label ?? "Timeline"}
      meta={`${format(window.start)} – ${format(window.end)}`}
      style={{ gap: 12 }}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", paddingLeft: GUTTER, paddingBottom: 10 }}>
          {options.columns.map((column) => (
            <div
              key={column.id}
              style={{
                flex: 1,
                fontSize: 10.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                textAlign: "center",
                color: "var(--graview-ink-muted)",
              }}
            >
              {column.label}
            </div>
          ))}
        </div>

        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          {ticks.map((at) => (
            <div
              key={at}
              style={{
                position: "absolute",
                left: GUTTER - 8,
                right: 0,
                top: `${pct(at)}%`,
                height: 1,
                background: "var(--graview-edge)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: -(GUTTER - 8),
                  top: -7,
                  width: GUTTER - 16,
                  textAlign: "right",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  color: "var(--graview-ink-faint)",
                }}
              >
                {format(at)}
              </span>
            </div>
          ))}

          <div style={{ position: "absolute", inset: 0, left: GUTTER, display: "flex", gap: 4 }}>
            {options.columns.map((column) => (
              <Column
                key={column.id}
                spans={spans.filter((s) => s.columnIds.includes(column.id))}
                window={window}
                format={format}
                hue={hue}
                selectedIds={selectedIds}
              />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/**
 * One column of the grid.
 *
 * Durations and moments are laid out differently, on purpose. A twenty-minute
 * school run and an eight-hour shift are not the same kind of thing, and
 * giving them the same treatment is why this was unreadable: the run got a
 * two-pixel sliver with a truncated label, and stole width from the shift
 * while it was at it. Durations get the column; moments get a strip of their
 * own, as time-stamped markers.
 */
function Column({
  spans,
  window,
  format,
  hue,
  selectedIds,
}: {
  spans: readonly PlacedSpan[];
  window: { start: number; end: number };
  format: (at: number) => string;
  hue: (span: PlacedSpan) => number;
  selectedIds: readonly string[];
}) {
  const range = window.end - window.start;
  const pct = (at: number) => ((at - window.start) / range) * 100;
  const isMoment = (span: PlacedSpan) => (span.end - span.start) / range < MOMENT_RATIO;

  const durations = assignLanes(spans.filter((span) => !isMoment(span)));
  const moments = [...spans.filter(isMoment)].sort((a, b) => a.start - b.start);
  const laneCount = Math.max(1, ...durations.map((span) => span.lanes));

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      {durations.map((span) => {
        // Durations get the WHOLE column. Reserving a third of it for the
        // moment strip left each of three concurrent lanes about forty pixels
        // wide, which is why every label read "caregiv…". Moments are a dot
        // and a time; they overlay at the right edge instead.
        const width = 100 / laneCount;
        const height = Math.max(1.6, pct(span.end) - pct(span.start));
        return (
          <div
            key={span.id}
            data-graview-span={span.id}
            title={`${span.label} · ${format(span.start)}–${format(span.end)}`}
            style={{
              position: "absolute",
              top: `${pct(span.start)}%`,
              height: `${height}%`,
              left: `${span.lane * width}%`,
              width: `${width}%`,
              padding: "0 2px 2px 0",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                height: "100%",
                minHeight: 15,
                borderRadius: 6,
                padding: "3px 6px",
                fontSize: 10.5,
                lineHeight: 1.25,
                overflow: "hidden",
                // Two lines beats one truncated one at these widths.
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                border: selectedIds.includes(span.id)
                  ? "1px solid var(--graview-accent)"
                  : `1px solid hsl(${Math.round(hue(span) * 360)} 55% 60% / 0.36)`,
                background: `linear-gradient(hsl(${Math.round(hue(span) * 360)} 55% 52% / 0.20), hsl(${Math.round(hue(span) * 360)} 55% 52% / 0.20)), var(--graview-panel)`,
                color: "var(--graview-ink)",
                boxShadow: selectedIds.includes(span.id)
                  ? "0 0 16px -4px var(--graview-accent)"
                  : undefined,
              }}
            >
              {/* A bar too short to hold a line of text keeps its name in the
                  tooltip rather than spilling it across its neighbours. */}
              {height >= 3.4 ? span.label : null}
            </div>
          </div>
        );
      })}

      {moments.map((span) => (
        <div
          key={span.id}
          data-graview-span={span.id}
          data-graview-moment=""
          title={`${span.label} · ${format(span.start)}`}
          style={{
            position: "absolute",
            top: `${pct(span.start)}%`,
            right: 0,
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 5,
            padding: "1px 3px 1px 6px",
            borderRadius: 999,
            // A small plate so the marker stays readable over whatever block
            // it happens to sit on.
            background: "linear-gradient(90deg, transparent, var(--graview-ground) 35%)",
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
              color: "var(--graview-ink-faint)",
            }}
          >
            {format(span.start)}
          </span>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              flex: "0 0 auto",
              background: `hsl(${Math.round(hue(span) * 360)} 65% 62%)`,
              boxShadow: selectedIds.includes(span.id)
                ? "0 0 0 3px var(--graview-accent-dim)"
                : `0 0 8px hsl(${Math.round(hue(span) * 360)} 65% 62% / 0.5)`,
            }}
          />
        </div>
      ))}
    </div>
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
