import type { AnySchema, NodeOfSchema } from "@graview/core";
import { withWithin } from "@graview/layout";
import { useGraview, useNavigation, type ViewProps } from "@graview/react";
import { useState, type ReactElement } from "react";
import { hueFor } from "../default-views.js";
import { Chip, Panel, Roster } from "../primitives/index.js";
import { addDays, addMonths, daysBetween, minutesOf } from "./calendar-dates.js";
import { Agenda, Grid, PER_CELL, Step, longDay, stepStyle } from "./calendar-drawing.js";
import {
  CALENDAR_REQUIRED_ROLES,
  type CalendarBindings,
  type CalendarGrain,
  type CalendarOptions,
  type CalendarRange,
  type PlacedEntry,
  rangesOf,
  titleOf,
} from "./calendar-options.js";
import { actThatMoves } from "./calendar-placing.js";
import { entriesOn, placeOnCalendar } from "./calendar-placing.js";
import { type CalendarCell, finerThan, spanOf } from "./calendar-spans.js";


export type Emphasis = "plain" | "lit" | "dimmed";

export interface CalendarLens<S extends AnySchema> {
  readonly name: "calendar";
  readonly requiredRoles: readonly string[];
  readonly bindings: CalendarBindings;
  readonly options: CalendarOptions;
  View(props: ViewProps<S>): ReactElement | null;
  /** Which of these nodes the lens can place. */
  place(nodes: readonly NodeOfSchema<S>[], schema?: S): PlacedEntry[];
  /**
   * THE SAME LENS, OPENING AT ONE RANGE — a titled place of its own.
   *
   * One binding and one declaration still: the horizons are not separate
   * lenses, they are the same picture at a different grain. Registering
   * them gives each its own `as` slug, so `places()` lists them, the URL
   * names which one you are in, and Back returns to the year you left.
   *
   * The range is the DEFAULT rather than a pin: drilling from a year into
   * a month is an ordinary stop that the address carries, and a place that
   * refused to be navigated within would be a dead end with a name.
   */
  at(range: CalendarRange): (props: ViewProps<S>) => ReactElement | null;
  /** The ranges it offers, each with the title its place takes. */
  ranges(): readonly { readonly range: CalendarRange; readonly title: string }[];
}

export function createCalendarLens<S extends AnySchema>(options: CalendarOptions): CalendarLens<S> {
  const bound = (opening?: CalendarRange) =>
    function Bound(props: ViewProps<S>) {
      const { store } = useGraview<S>();
      return (
        <CalendarView<S>
          schema={store.schema}
          {...props}
          options={opening ? { ...options, range: opening } : options}
        />
      );
    };
  return {
    name: "calendar",
    requiredRoles: [...CALENDAR_REQUIRED_ROLES],
    bindings: options.bindings,
    options,
    View: bound(),
    at: (range) => bound(range),
    ranges: () =>
      rangesOf(options).map((range) => ({ range, title: titleOf(range, options.horizon) })),
    place: (nodes, schema) =>
      nodes
        .map((node) => placeOnCalendar<S>(node, options.bindings, schema))
        .filter((entry): entry is PlacedEntry => entry !== null),
  };
}

interface CalendarViewProps<S extends AnySchema> extends ViewProps<S> {
  readonly options: CalendarOptions;
  readonly schema?: S;
  /** Kept for a host driving the lens directly, outside a scene. */
  readonly selectedIds?: readonly string[];
}

function CalendarView<S extends AnySchema>({
  nodes,
  label,
  fidelity,
  mode,
  options,
  schema,
  selectedIds = [],
  implicated = [],
  flagged = [],
}: CalendarViewProps<S>) {
  /*
   * WHERE THE CALENDAR IS, IN THE STOP.
   *
   * The month you are looking at is a place: a URL somebody can be sent,
   * a history entry Back returns to, a thing a harness can photograph
   * twice. Component state would have made it the one part of this
   * interface you could not link to.
   */
  const { view, go } = useNavigation();
  const { store, principal } = useGraview<S>();
  const at = view.within?.["at"] ?? options.today;
  const range = (view.within?.["range"] as CalendarRange | undefined) ?? options.range ?? "month";
  const weekStartsOn = options.weekStartsOn ?? 1;

  const highlit = new Set([...implicated, ...selectedIds]);
  const emphasisOf = (id: string): Emphasis =>
    highlit.size === 0 ? "plain" : highlit.has(id) ? "lit" : "dimmed";
  const broken = new Set(flagged);
  const entries = (nodes ?? [])
    .map((node) => placeOnCalendar<S>(node, options.bindings, schema))
    .filter((entry): entry is PlacedEntry => entry !== null);
  const hue = options.hueOf ?? ((entry: PlacedEntry) => hueFor(entry.kind));

  if (fidelity === "glyph") {
    return <Chip label={`${label ?? "Calendar"} · ${entries.length}`} hue={hueFor("calendar")} />;
  }

  if (fidelity === "summary") {
    const soon = entriesOn(entries, options.today);
    return (
      <Panel title={label ?? "Calendar"} meta={`${entries.length} dated`} tone="muted">
        <Roster
          max={6}
          items={
            soon.length > 0
              ? soon.map((entry) => ({ id: entry.id, label: entry.label, hue: hue(entry) }))
              : entries
                  .filter((entry) => daysBetween(options.today, entry.from) >= 0)
                  .sort((a, b) => a.from.localeCompare(b.from))
                  .slice(0, 6)
                  .map((entry) => ({ id: entry.id, label: `${entry.from.slice(5)} ${entry.label}`, hue: hue(entry) }))
          }
        />
      </Panel>
    );
  }

  const page = mode === "fullscreen";
  const span = spanOf(range, at, { weekStartsOn, ...(options.horizon ? { horizon: options.horizon } : {}) });

  /*
   * DRAGGING AN ENTRY TO A DAY IS AN ACT, not a special case.
   *
   * The declaration is asked which act writes the bound date; the store
   * judges whether this seat may run it; the log records it with an author
   * and an inverse, so one undo puts it back. A seat that may not is told
   * so in the policy's own words rather than finding the entry silently
   * snapping back — a drag that appears to work and does not is worse than
   * one that refuses.
   */
  const [said, setSaid] = useState<{ readonly text: string; readonly tone: "refused" | "rounded" } | null>(null);
  const moveTo = (id: string, cell: CalendarCell, grain: CalendarGrain) => {
    const node = store.graph.getNode(id);
    if (!node) return;
    const roles = options.bindings[node.kind as string];
    if (!roles) return;
    const act = actThatMoves(store, node.kind as string, roles.start);
    if (!act) {
      setSaid({ text: `Nothing declared writes ${roles.start}, so this cannot be moved from here.`, tone: "refused" });
      return;
    }
    const day = cell.from;
    // A date-time keeps its time: moving "Tuesday at 09:30" to Thursday
    // means Thursday at 09:30, not Thursday at midnight.
    const was = (node as Record<string, unknown>)[roles.start];
    const minutes = minutesOf(was);
    const value = minutes === null ? day : `${day}${String(was).slice(10)}`;
    const call = { name: act.name, args: { [act.arg]: id, [roles.start]: value } };
    const verdict = store.permits(call, principal);
    if (!verdict.ok) {
      setSaid({ text: verdict.refusal.message, tone: "refused" });
      return;
    }
    try {
      store.apply(call, { author: principal });
      /*
       * A COARSE CELL ROUNDS, AND SAYS SO.
       *
       * The act writes a DAY; a month cell is thirty of them. Dropping a
       * planting on "March" and silently writing the first was the lens
       * making a decision on the person's behalf and hiding it — so the
       * drop lands, the trail carries it, undo takes it back, and the lens
       * says exactly which date it wrote.
       */
      setSaid(
        grain === "day"
          ? null
          : {
              text: `Moved to ${longDay(day)} — a ${grain} is coarser than ${roles.start} holds, so it takes the first day of the cell. Undo puts it back.`,
              tone: "rounded",
            },
      );
    } catch (error) {
      setSaid({ text: error instanceof Error ? error.message : String(error), tone: "refused" });
    }
  };
  const move = (step: number) => {
    const next =
      range === "years"
        ? addMonths(at, step * 12 * Math.max(1, options.horizon?.years ?? 1))
        : range === "year"
          ? addMonths(at, step * 12)
          : range === "quarter"
            ? addMonths(at, step * 3)
            : range === "month"
              ? addMonths(at, step)
              : range === "week"
                ? addDays(at, step * 7)
                : addDays(at, step);
    go(withWithin(view, "at", next));
  };
  const show = (nextRange: CalendarRange, day?: string) => {
    let next = withWithin(view, "range", nextRange);
    if (day !== undefined) next = withWithin(next, "at", day);
    go(next);
  };

  return (
    <Panel
      title={label ?? "Calendar"}
      meta={span.title}
      style={{ gap: 10, ...(page ? { flex: "1 1 auto", minHeight: 0, height: "100%" } : {}) }}
    >
      <div
        data-testid="calendar"
        data-calendar-range={range}
        data-calendar-at={at}
        style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: 8 }}
      >
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <nav aria-label="When" style={{ display: "flex", gap: 4 }}>
            <Step label="Previous" glyph="‹" onPress={() => move(-1)} />
            <button
              type="button"
              data-testid="calendar-today"
              onClick={() => go(withWithin(view, "at", options.today))}
              style={stepStyle}
            >
              Today
            </button>
            <Step label="Next" glyph="›" onPress={() => move(1)} />
          </nav>
          <div role="group" aria-label="Range" data-testid="calendar-ranges" style={{ display: "flex", flexWrap: "wrap", gap: 4, marginLeft: "auto" }}>
            {rangesOf(options).map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={candidate === range}
                data-testid={`calendar-range-${candidate}`}
                onClick={() => show(candidate)}
                style={{
                  ...stepStyle,
                  // The range names are the framework's own words and read as
                  // buttons capitalised; the horizon's name is the APP's, and
                  // "The rotation" is not "The Rotation".
                  ...(candidate === "years" ? {} : { textTransform: "capitalize" as const }),
                  ...(candidate === range
                    ? { borderColor: "var(--graview-accent)", color: "var(--graview-accent)", background: "var(--graview-panel)" }
                    : {}),
                }}
              >
                {candidate === "years" ? (options.horizon?.title ?? "years") : candidate}
              </button>
            ))}
          </div>
        </div>

        {said ? (
          <p
            data-testid={said.tone === "refused" ? "calendar-refused" : "calendar-rounded"}
            role="status"
            style={{
              margin: 0,
              fontSize: "0.75rem",
              color: said.tone === "refused" ? "var(--graview-warn)" : "var(--graview-ink-muted)",
            }}
          >
            {said.text}
          </p>
        ) : null}

        {/*
          * THE WAY DOWN FROM A HORIZON, as ordinary stops. Each year is a
          * press that goes there, and Back returns to the span you left.
          */}
        {span.years ? (
          <nav aria-label="Years" data-testid="calendar-years" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {span.years.map((year) => (
              <button
                key={year}
                type="button"
                data-testid={`calendar-year-${year}`}
                onClick={() => show("year", `${year}-01-01`)}
                style={stepStyle}
              >
                {year}
              </button>
            ))}
          </nav>
        ) : null}

        {range === "agenda" ? (
          <Agenda
            days={span.cells.map((cell) => cell.from)}
            entries={entries}
            today={options.today}
            emphasisOf={emphasisOf}
            broken={broken}
            hue={hue}
            onMove={(id, day) => moveTo(id, { from: day, to: day, label: day }, "day")}
          />
        ) : (
          <Grid
            span={span}
            weekStartsOn={weekStartsOn}
            entries={entries}
            today={options.today}
            perCell={options.perCell ?? PER_CELL[span.grain]}
            emphasisOf={emphasisOf}
            broken={broken}
            hue={hue}
            /* A press on a cell is a stop one level finer: a month opens a
               month, a week opens a week, a day opens the day. */
            onOpen={(cell) => show(finerThan(span.grain), cell.from)}
            onMove={moveTo}
          />
        )}
      </div>
    </Panel>
  );
}
