import { labelOf, type AnySchema, type NodeOfSchema } from "@graview/core";
import { useGraview, type ViewProps } from "@graview/react";
import type { CSSProperties, ReactElement } from "react";
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
  /**
   * The narrowest axis the lens will draw, in the app's own units.
   *
   * A household week wants eight hours whatever happens, or a single
   * afternoon fills the screen and reads as more than it is. Two hour-long
   * training sessions want about two and a half, or they shrink to slivers in
   * a wall of empty evening. The right answer is the app's, not the lens's.
   */
  readonly minWindow?: number;
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
  /*
   * Whole units, always.
   *
   * Centring a short window halves an odd number and hands the app's own
   * formatter a fraction, which then renders "14:7.5". The household example never saw it
   * because its formatter happened to floor; a third app's did not, and the
   * fix belongs here rather than in every formatter that will ever exist.
   */
  return { start: Math.floor(start), end: Math.ceil(end) };
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

  /*
   * A BINDING error and a MISSING VALUE are different things.
   *
   * Checking `roles[role] in record` conflated them: an app that never bound
   * `start` and a node that simply has no start both looked the same, so one
   * unplanned task threw for the whole view and took the week with it. A field
   * that is optional in the schema is absent on ordinary nodes all the time,
   * and that is data rather than a mistake.
   *
   * So the binding is checked against the BINDING — did the app name a field
   * for each required role — and a node with no value for a bound field is
   * simply not placeable, which is what `null` already means here.
   */
  const record = node as unknown as Record<string, unknown>;
  /*
   * Three cases, and the old check collapsed two of them.
   *
   *   1. The role was never bound          — a mistake in the declaration.
   *   2. It was bound to a field the kind does not declare — also a mistake,
   *      and the one `graview check` reports as `lens-binding-missing-field`.
   *   3. It was bound to a field this NODE happens not to have — ordinary
   *      data, because optional fields are absent all the time.
   *
   * Only the first two are errors. Treating the third as one meant a single
   * unplanned task threw and took the whole week down with it. The schema is
   * what separates 2 from 3; without one, the presence of the key is the best
   * available guess and the old behaviour stands.
   */
  const declared = schema?.tryDefinition(node.kind)?.fields.shape as
    | Record<string, unknown>
    | undefined;
  const missing = TIMELINE_REQUIRED_ROLES.filter((role) => {
    const field = roles[role];
    if (!field) return true;
    return declared ? !(field in declared) : !(field in record);
  });
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
 * How a span relates to what is selected elsewhere in the scene.
 *
 * Three states rather than two: with nothing selected every span is `plain`
 * and the week reads normally; once something is, the spans it reaches are
 * `lit` and the rest are `dimmed`. Selecting a person and having the
 * calendar sit there unchanged was the complaint — the graph knows which
 * five of these eighteen events they are in.
 */
type Emphasis = "plain" | "lit" | "dimmed";

/**
 * A span's colour, given how it relates to the selection.
 *
 * Recession here is DESATURATION and a quieter edge, never text opacity: a
 * dimmed span still has to be readable, and dropping opacity on small text
 * composites it against whatever is behind and fails contrast silently. The
 * label keeps its ink in all three states.
 */
function spanEmphasis(emphasis: Emphasis, hue: number): CSSProperties {
  const tint = Math.round(hue * 360);
  // Opaque, over a hue wash, with both drawn from the theme: a cascaded bar
  // has to OCCLUDE the one behind it, and the same wash has to read on paper
  // and in the dark.
  const wash = (alpha: string) =>
    `linear-gradient(hsl(${tint} 55% var(--graview-tint-lightness) / ${alpha}), hsl(${tint} 55% var(--graview-tint-lightness) / ${alpha})), var(--graview-panel)`;

  if (emphasis === "lit") {
    return {
      border: "1px solid var(--graview-accent)",
      background: wash("calc(var(--graview-tint-alpha) * 1.15)"),
      color: "var(--graview-ink)",
      boxShadow: "0 0 16px -4px var(--graview-accent)",
    };
  }
  if (emphasis === "dimmed") {
    return {
      border: "1px solid var(--graview-edge)",
      background: wash("calc(var(--graview-tint-alpha) * 0.25)"),
      color: "var(--graview-ink-muted)",
    };
  }
  return {
    border: `1px solid hsl(${tint} 50% var(--graview-tint-lightness) / 0.42)`,
    background: wash("var(--graview-tint-alpha)"),
    color: "var(--graview-ink)",
  };
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
  mode,
  options,
  schema,
  selectedIds = [],
  implicated = [],
  flagged = [],
}: TimelineViewProps<S>) {
  // The selection reaches these; anything else in the week recedes while it
  // stands. `selectedIds` stays supported for a host driving the lens
  // directly, outside a scene.
  const highlit = new Set([...implicated, ...selectedIds]);
  const emphasisOf = (id: string): Emphasis =>
    highlit.size === 0 ? "plain" : highlit.has(id) ? "lit" : "dimmed";
  // Something broken is marked where it IS. A problem you can only find
  // through a list is a problem you have to go looking for.
  const broken = new Set(flagged);
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
  const window = activeWindow(spans, options.extent, {
    ...(options.minWindow === undefined ? {} : { minimum: options.minWindow }),
  });
  const range = window.end - window.start;
  const pct = (at: number) => ((at - window.start) / range) * 100;

  // Rules snapped to round numbers, so the labels read as times rather than
  // as wherever the window happened to begin.
  const tick = options.tick ?? Math.max(60, Math.round(range / 8 / 60) * 60);
  const ticks: number[] = [];
  for (let at = Math.ceil(window.start / tick) * tick; at <= window.end; at += tick) {
    ticks.push(at);
  }

  // Lifted out, the week is the PAGE, not a card sitting on one.
  const page = mode === "fullscreen";

  return (
    <Panel
      title={label ?? "Timeline"}
      meta={`${format(window.start)} – ${format(window.end)}`}
      style={{ gap: 12, ...(page ? { flex: "1 1 auto", minHeight: 0, height: "100%" } : {}) }}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", paddingLeft: GUTTER, paddingBottom: 10 }}>
          {options.columns.map((column) => (
            <div
              key={column.id}
              style={{
                flex: 1,
                fontSize: "0.65625rem",
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
          {ticks.map((at, index) => (
            <div
              key={at}
              style={{
                position: "absolute",
                left: GUTTER - 8,
                right: 0,
                // The closing rule is drawn just INSIDE the grid: at a flat
                // 100% its own single pixel sits below the box, which is
                // still content the panel cannot show.
                top: index === ticks.length - 1 ? "calc(100% - 1px)" : `${pct(at)}%`,
                height: 1,
                background: "var(--graview-edge)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: -(GUTTER - 8),
                  /*
                   * Every label is centred on its rule except the last, which
                   * SITS ON TOP of it.
                   *
                   * The final rule is at 100%, so a centred label hangs eight
                   * pixels below the grid — enough to make the panel's
                   * scroller report content it cannot show, which puts a
                   * scroll region on a calendar that fits. It also reads
                   * better: the last label is the end of the axis rather than
                   * something below it.
                   */
                  ...(index === ticks.length - 1 ? { bottom: 2 } : { top: -7 }),
                  width: GUTTER - 16,
                  textAlign: "right",
                  fontSize: "0.625rem",
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
                emphasisOf={emphasisOf}
                brokenIds={broken}
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
  emphasisOf,
  brokenIds,
}: {
  spans: readonly PlacedSpan[];
  window: { start: number; end: number };
  format: (at: number) => string;
  hue: (span: PlacedSpan) => number;
  emphasisOf: (id: string) => Emphasis;
  brokenIds: ReadonlySet<string>;
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
            // Every span is a real node, so it is a real target: the scene
            // routes a click on it to that node rather than to the calendar
            // drawing it.
            data-graview-pick={span.id}
            /*
             * Emphasis in the DOM as well as in the paint.
             *
             * "Selecting a rule lights what it judges" is a claim about the
             * picture, and a claim about a picture that exists only as a
             * colour cannot be checked by anything — not a test, not a person
             * reading the tree. The attribute costs nothing and makes it a
             * fact.
             */
            data-graview-emphasis={emphasisOf(span.id)}
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
                fontSize: "0.65625rem",
                lineHeight: 1.25,
                overflow: "hidden",
                // Two lines beats one truncated one at these widths.
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                ...spanEmphasis(emphasisOf(span.id), hue(span)),
                ...(brokenIds.has(span.id)
                  ? {
                      // A warn-coloured spine down the leading edge: visible
                      // at a glance across a whole week, and it does not
                      // touch the label's contrast.
                      borderLeft: "3px solid var(--graview-warn)",
                      paddingLeft: 4,
                    }
                  : {}),
              }}
            >
              {/* A bar too short to hold a line of text keeps its name in the
                  tooltip rather than spilling it across its neighbours. */}
              {height >= 3.4 ? span.label : null}
            </div>
          </div>
        );
      })}

      {moments.map((span) => {
        const emphasis = emphasisOf(span.id);
        return (
        <div
          key={span.id}
          data-graview-span={span.id}
          data-graview-pick={span.id}
          data-graview-emphasis={emphasis}
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
            // A real target: this is a node, and clicking it is the primary
            // way to reach one. At 17 pixels tall it was under every
            // guideline there is, and felt like it.
            minHeight: 24,
            padding: "0 4px 0 8px",
            borderRadius: 999,
            // A small plate so the marker stays readable over whatever block
            // it happens to sit on.
            background: "linear-gradient(90deg, transparent, var(--graview-ground) 35%)",
          }}
        >
          <span
            style={{
              fontSize: "0.59375rem",
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
              color:
                emphasis === "lit" ? "var(--graview-accent)" : "var(--graview-ink-faint)",
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
              background: brokenIds.has(span.id)
                ? "var(--graview-warn)"
                : emphasis === "dimmed"
                  ? "var(--graview-edge)"
                  : `hsl(${Math.round(hue(span) * 360)} 60% var(--graview-tint-lightness))`,
              boxShadow: brokenIds.has(span.id)
                ? "0 0 0 3px var(--graview-warn)"
                : emphasis === "lit"
                  ? "0 0 0 3px var(--graview-accent-dim)"
                  : emphasis === "dimmed"
                    ? undefined
                    : `0 0 8px hsl(${Math.round(hue(span) * 360)} 60% var(--graview-tint-lightness) / 0.45)`,
            }}
          />
        </div>
        );
      })}
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
  /*
   * A real COMPONENT, not a method that happens to call hooks.
   *
   * `View` is rendered as `<lens.View />`, so it is a component — but written
   * as a method on an object literal it looked like one to the hooks lint rule
   * and needed a disable in three files. A disable repeated three times is a
   * rule telling you something, and what it was telling us is that this wanted
   * to be a component.
   */
  function Bound(props: ViewProps<S>) {
    // The SCHEMA comes from the provider: `ViewProps` carries none, so a lens
    // rendered through the registry ran without it and every schema-aware
    // decision inside quietly took its fallback path.
    const { store } = useGraview<S>();
    return <TimelineView<S> schema={store.schema} {...props} options={options} />;
  }

  return {
    name: "timeline",
    requiredRoles: [...TIMELINE_REQUIRED_ROLES],
    bindings: options.bindings,
    options,
    /*
     * The SCHEMA comes from the provider, not from the caller.
     *
     * `ViewProps` carries no schema — the registry never passes one — so a
     * lens rendered through the registry ran without it and every
     * schema-aware decision inside quietly took its fallback path. In the
     * timeline that meant an optional field absent on one node looked exactly
     * like a role nobody bound, and a single unplanned task threw for the
     * whole view.
     */
    View: Bound,
    place(nodes, schema) {
      return nodes
        .map((node) => placeOnTimeline<S>(node, options.bindings, schema))
        .filter((span): span is PlacedSpan => span !== null);
    },
  };
}
