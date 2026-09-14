import { fieldWriters, labelOf, type AnySchema, type NodeOfSchema, type Store } from "@graview/core";
import { withWithin } from "@graview/layout";
import { useGraview, useNavigation, type ViewProps } from "@graview/react";
import { useState, type ReactElement } from "react";
import { hueFor } from "../default-views.js";
import { Chip, Panel, Roster } from "../primitives/index.js";

/**
 * THE CALENDAR LENS: day, week, month, quarter, year and a named horizon.
 *
 * The timeline binds a start and an end in minutes of a day and a named
 * column, which is a week grid and nothing more: it cannot show a due date
 * next month, a shift on the 14th, a planting sown in March and harvested
 * in July, or what is on today across every list. Scheduled things need a
 * calendar, and a calendar needs actual dates.
 *
 * Bound by ROLES, like every other starter. This lens has never heard of a
 * task, a shift or a planting; an app says which of its own fields is the
 * start, which the end, which says a thing takes the whole day and which
 * names it — and gets every range, spans drawn across the cells they cover,
 * overflow that opens the cell rather than hiding it, and every entry a real
 * node the scene can select and a rule can flag.
 *
 * THE CELL COARSENS WITH THE HORIZON. It topped out at a month, so anything
 * further out than four weeks was off the end of every picture the framework
 * could draw: a planting sown in March and lifted in July, a plot on a
 * rotation, a quarter's coverage, a lease, a review cycle. An app whose
 * subject is years had no lens at all — it had a month grid it could page
 * through twelve times. So a quarter draws a week per cell, a year and
 * anything beyond it a month per cell, and an entry that spans cells is
 * drawn across them exactly as a fortnight is already drawn across days.
 *
 * HOW FAR OUT IS THE APP'S TO SAY. Some domains think in three years and
 * some in ten; a framework shipping a "5yr" button has guessed. The horizon
 * is declared with its own span and its own name, or there is no horizon.
 *
 * Dates are ISO strings, because that is what an app's declaration holds and
 * what `isoDate` already validates. A date-time ("2026-09-14T09:30") places
 * the entry at a time within its day; a bare date is an all-day entry. The
 * lens does no timezone arithmetic and no recurrence: both belong to the app
 * that owns the domain, and a framework that guessed at either would be
 * wrong in a different way for every app.
 */

export interface CalendarRoles {
  /** Field holding the date (or date-time) the entry starts. */
  readonly start: string;
  /** Field holding the date it ends. Absent or equal to `start` is a single day. */
  readonly end?: string;
  /** Field that is true when the entry takes the whole day whatever its times say. */
  readonly allDay?: string;
  /** Field holding the entry's own name, where the kind's label is not it. */
  readonly label?: string;
  /** Field that is true when the entry is finished, so it can read as done. */
  readonly done?: string;
}

export const CALENDAR_REQUIRED_ROLES = ["start"] as const;

export type CalendarBindings = Readonly<Record<string, CalendarRoles>>;

/** Which stretch of time the calendar is showing. */
export type CalendarRange = "day" | "week" | "month" | "quarter" | "year" | "years" | "agenda";

/** How coarse one cell of the grid is. */
export type CalendarGrain = "day" | "week" | "month";

/**
 * A SPAN OF YEARS THE APP NAMES.
 *
 * Three years, five, ten — the number is a domain fact, and so is what to
 * call it on a button. A framework that picked either would be answering a
 * question it was never asked.
 */
export interface CalendarHorizon {
  readonly years: number;
  /** What the app calls it: "Five years", "The rotation", "The decade". */
  readonly title: string;
}

export const CALENDAR_RANGES: readonly CalendarRange[] = ["day", "week", "month", "quarter", "year", "agenda"];

/** The ranges this lens offers: every one, plus the horizon where the app named one. */
export function rangesOf(options: { readonly horizon?: CalendarHorizon }): readonly CalendarRange[] {
  return options.horizon ? ["day", "week", "month", "quarter", "year", "years", "agenda"] : CALENDAR_RANGES;
}

/** What a range is called where a person reads it — a button, a place, a title. */
export function titleOf(range: CalendarRange, horizon?: CalendarHorizon): string {
  return range === "years" ? (horizon?.title ?? "Years") : `The ${range}`;
}

export interface CalendarOptions {
  readonly bindings: CalendarBindings;
  /**
   * The day the calendar opens on and calls "today", as `YYYY-MM-DD`.
   *
   * The app's, never the clock's — the same discipline the invariants keep.
   * A lens that read `new Date()` would draw a different picture every
   * morning, and no harness could photograph it twice.
   */
  readonly today: string;
  /** Which range it opens in. Month, unless an app knows better. */
  readonly range?: CalendarRange;
  /**
   * How far out this app ever looks, and what it calls that. Absent means
   * the lens stops at a year, which is the honest answer for an app whose
   * subject never runs longer than one.
   */
  readonly horizon?: CalendarHorizon;
  /** The day a week starts on, 0 = Sunday. Monday, unless an app says otherwise. */
  readonly weekStartsOn?: number;
  /** Hue for an entry, in degrees. Defaults to the node's kind. */
  readonly hueOf?: (entry: PlacedEntry) => number;
  /** How many entries a cell shows before the rest become a count. Per grain, by default. */
  readonly perCell?: number;
}

export interface PlacedEntry {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  /** `YYYY-MM-DD`, the first day it occupies. */
  readonly from: string;
  /** `YYYY-MM-DD`, the last day it occupies. Equal to `from` for one day. */
  readonly to: string;
  /** Minutes from midnight, where the start named a time. */
  readonly at: number | null;
  readonly allDay: boolean;
  readonly done: boolean;
}

/* --------------------------------------------------------------- dates */

/*
 * DATE ARITHMETIC ON STRINGS, in UTC, and nowhere near a local `Date`.
 *
 * `new Date("2026-09-14")` is midnight UTC and `new Date(2026, 8, 14)` is
 * midnight wherever the reader is; mixing them puts an entry on the 13th for
 * half the world. Every date here is `YYYY-MM-DD` and every step goes
 * through `Date.UTC`, so the picture is the same in Auckland and in Lima.
 */

const DAY = 86_400_000;

/** The ISO day a value names, or null when it names no date at all. */
export function dayOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1]! : null;
}

/** Minutes from midnight where a value names a time, else null. */
export function minutesOf(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

const utc = (day: string): number => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const iso = (stamp: number): string => new Date(stamp).toISOString().slice(0, 10);

export function addDays(day: string, count: number): string {
  return iso(utc(day) + count * DAY);
}

export function addMonths(day: string, count: number): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7)) - 1 + count;
  const wanted = Number(day.slice(8, 10));
  // The last day of the target month, so 31 January + 1 month is 28 February
  // rather than 3 March — which is what a naive setMonth gives you.
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return iso(Date.UTC(year, month, Math.min(wanted, last)));
}

/** 0 = Sunday, the way `getUTCDay` counts. */
export const weekdayOf = (day: string): number => new Date(utc(day)).getUTCDay();

export function startOfWeek(day: string, weekStartsOn = 1): string {
  const back = (weekdayOf(day) - weekStartsOn + 7) % 7;
  return addDays(day, -back);
}

export const startOfMonth = (day: string): string => `${day.slice(0, 7)}-01`;

export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY);
}

/** Every day from `from` to `to` inclusive. */
export function daysFrom(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, at) => addDays(from, at));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const clock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/* -------------------------------------------------------------- placing */

export class CalendarBindingError extends Error {
  constructor(
    readonly kind: string,
    readonly missing: readonly string[],
  ) {
    super(
      `The calendar lens has no binding for ${missing.map((role) => `"${role}"`).join(", ")} on "${kind}". ` +
        `Bind them in the lens declaration: bindings: { ${kind}: { start: "<field>" } }.`,
    );
    this.name = "CalendarBindingError";
  }
}

/**
 * One node as an entry, or null when it simply has no date.
 *
 * A binding error and a missing value are different things, the same way
 * they are in the timeline: an app that never bound `start` has made a
 * mistake, and a task with no due date is ordinary data. Only the first
 * throws.
 */
export function placeOnCalendar<S extends AnySchema>(
  node: NodeOfSchema<S>,
  bindings: CalendarBindings,
  schema?: S,
): PlacedEntry | null {
  const roles = bindings[node.kind];
  if (!roles) return null;
  const record = node as unknown as Record<string, unknown>;
  const declared = schema?.tryDefinition(node.kind)?.fields.shape as Record<string, unknown> | undefined;
  const missing = CALENDAR_REQUIRED_ROLES.filter((role) => {
    const field = roles[role];
    if (!field) return true;
    return declared ? !(field in declared) : !(field in record);
  });
  if (missing.length > 0) throw new CalendarBindingError(node.kind, missing);

  const from = dayOf(record[roles.start]);
  if (from === null) return null;
  const to = (roles.end ? dayOf(record[roles.end]) : null) ?? from;
  const at = minutesOf(record[roles.start]);
  const named = roles.label ? record[roles.label] : undefined;
  return {
    id: node.id,
    kind: node.kind as string,
    label:
      typeof named === "string" && named.length > 0
        ? named
        : labelOf(schema?.tryDefinition(node.kind), node as never),
    from,
    // An end before its start is a typo in the data, not a span that runs
    // backwards: the entry occupies the day it starts and says no more.
    to: daysBetween(from, to) < 0 ? from : to,
    at: roles.allDay && record[roles.allDay] === true ? null : at,
    allDay: roles.allDay ? record[roles.allDay] === true || at === null : at === null,
    done: roles.done ? record[roles.done] === true : false,
  };
}

/** The entries touching a day, in the order a person reads them. */
export function entriesOn(entries: readonly PlacedEntry[], day: string): PlacedEntry[] {
  return entries
    .filter((entry) => daysBetween(entry.from, day) >= 0 && daysBetween(day, entry.to) >= 0)
    .sort((a, b) => {
      // All-day first — they are the frame the timed ones sit inside — then
      // by time, then by name so the order never wobbles between renders.
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      if (a.at !== b.at) return (a.at ?? 0) - (b.at ?? 0);
      return a.label.localeCompare(b.label);
    });
}

/* ------------------------------------------------------- moving a date */

/**
 * THE ACT THAT WRITES THE DATE, found in the declaration rather than named
 * in the lens.
 *
 * A calendar you cannot drag in is a picture of a schedule rather than a
 * schedule. But the lens must not invent an edit: it looks for a declared
 * act whose subject accepts this kind and that SAYS it writes the field the
 * start role is bound to, and falls back to the derived edit of the kind,
 * which every kind has. Either way the store judges it, the log records it
 * with an author, and undo takes it back — exactly as if the same act had
 * been pressed in the strip.
 */
export function actThatMoves<S extends AnySchema>(
  store: Store<S>,
  kind: string,
  field: string,
): { readonly name: string; readonly arg: string } | null {
  /*
   * Which acts write this field, asked of the framework's own answer
   * (`fieldWriters`) rather than of `mutation.writes` alone. That is the
   * function the checker uses for `field-without-writer`, and it also reads
   * an act that patches a field it happens to be named for — so a
   * `reschedule` whose declaration forgot `writes: ["due"]` is still found,
   * and the lens does not disagree with the checker about who writes what.
   */
  const writers = fieldWriters(store.schema, store.allMutations()).get(kind)?.get(field) ?? [];
  const declared = new Map(store.allMutations().map((mutation) => [mutation.name, mutation]));
  for (const name of writers) {
    const mutation = declared.get(name);
    const subject = mutation?.subject;
    if (!mutation || !subject) continue;
    // It must also be able to be TOLD the new date, or it writes its own —
    // "finish it" writes `done` and has no opinion you can hand it.
    const shape = (mutation.input as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
    if (!(field in shape)) continue;
    return { name: mutation.name, arg: subject.arg };
  }
  // Every kind has a derived edit; it is the honest fallback, and the policy
  // reads it through whatever declared acts it rides.
  const edit = store.allMutations().find((mutation) => mutation.derived?.edit === kind);
  return edit?.subject ? { name: edit.name, arg: edit.subject.arg } : null;
}

/* ----------------------------------------------------------------- view */

type Emphasis = "plain" | "lit" | "dimmed";

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
    const was = (node as unknown as Record<string, unknown>)[roles.start];
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

/**
 * ONE CELL OF THE GRID — a day, a week or a month, whichever the range's
 * grain is, with what to write in its corner.
 */
export interface CalendarCell {
  readonly from: string;
  /** The last day the cell covers. Equal to `from` for a day cell. */
  readonly to: string;
  /** What the cell says in its corner: "14", "6 Apr", "Jan", "Jan 27". */
  readonly label: string;
  /** Outside the stretch the range is about — a day of the next month in a month grid. */
  readonly outside?: boolean;
}

export interface CalendarSpan {
  readonly title: string;
  readonly grain: CalendarGrain;
  readonly cells: readonly CalendarCell[];
  readonly columns: number;
  /**
   * The years a multi-year horizon covers, each somewhere to go. A grid of
   * thirty-six month cells is a picture; the way DOWN from it to one year
   * is a button, not a guess about which cell you meant.
   */
  readonly years?: readonly string[];
}

const monthCell = (day: string, withYear: boolean): CalendarCell => ({
  from: startOfMonth(day),
  to: endOfMonth(day),
  label: `${MONTHS[Number(day.slice(5, 7)) - 1]!.slice(0, 3)}${withYear ? ` ${day.slice(2, 4)}` : ""}`,
});

/** The last day of the month a day falls in. */
export function endOfMonth(day: string): string {
  return iso(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0));
}

/** The first day of the quarter a day falls in. */
export function startOfQuarter(day: string): string {
  const quarter = Math.floor((Number(day.slice(5, 7)) - 1) / 3);
  return `${day.slice(0, 4)}-${String(quarter * 3 + 1).padStart(2, "0")}-01`;
}

/**
 * The cells a range covers, how coarse they are, and what to call the whole.
 *
 * One function for every range, because the grid draws whatever it is given:
 * a day cell and a month cell differ in how much ground they cover and in
 * nothing else, which is why a span can be drawn across either.
 */
export function spanOf(
  range: CalendarRange,
  at: string,
  options: { readonly weekStartsOn?: number; readonly horizon?: CalendarHorizon } = {},
): CalendarSpan {
  const weekStartsOn = options.weekStartsOn ?? 1;
  const day = (one: string, outside?: boolean): CalendarCell => ({
    from: one,
    to: one,
    label: String(Number(one.slice(8, 10))),
    ...(outside ? { outside: true } : {}),
  });

  if (range === "day") return { title: longDay(at), grain: "day", columns: 1, cells: [day(at)] };

  if (range === "week") {
    const from = startOfWeek(at, weekStartsOn);
    return {
      title: `${longDay(from)} – ${longDay(addDays(from, 6))}`,
      grain: "day",
      columns: 7,
      cells: daysFrom(from, 7).map((one) => day(one)),
    };
  }

  if (range === "agenda") {
    // Six weeks forward, which is the horizon a person means by "what is
    // coming up" — and the same number of days a month grid draws, so the
    // two ranges cover comparable ground.
    return { title: `From ${longDay(at)}`, grain: "day", columns: 1, cells: daysFrom(at, 42).map((one) => day(one)) };
  }

  if (range === "quarter") {
    /*
     * A WEEK PER CELL. Thirteen of them, four to a row: a quarter drawn a
     * day at a time is ninety cells nobody can read, and drawn a month at a
     * time is three, which says less than the month grid it replaced.
     */
    const first = startOfQuarter(at);
    const last = endOfMonth(addMonths(first, 2));
    const cells: CalendarCell[] = [];
    for (let from = startOfWeek(first, weekStartsOn); daysBetween(from, last) >= 0; from = addDays(from, 7)) {
      cells.push({
        from,
        to: addDays(from, 6),
        label: `${Number(from.slice(8, 10))} ${MONTHS[Number(from.slice(5, 7)) - 1]!.slice(0, 3)}`,
        ...(daysBetween(from, first) > 0 && daysBetween(addDays(from, 6), first) > 0 ? { outside: true } : {}),
      });
    }
    return {
      title: `Q${Math.floor((Number(at.slice(5, 7)) - 1) / 3) + 1} ${at.slice(0, 4)}`,
      grain: "week",
      columns: 4,
      cells,
    };
  }

  if (range === "year") {
    const year = at.slice(0, 4);
    return {
      title: year,
      grain: "month",
      columns: 4,
      cells: Array.from({ length: 12 }, (_, month) => monthCell(`${year}-${String(month + 1).padStart(2, "0")}-01`, false)),
    };
  }

  if (range === "years") {
    /*
     * A MONTH PER CELL, for as many years as the app says it looks out —
     * and the years themselves listed as stops, because the way down from
     * thirty-six cells to one year must not be a guess about which cell was
     * meant.
     */
    const span = Math.max(1, options.horizon?.years ?? 1);
    const first = Number(at.slice(0, 4));
    const years = Array.from({ length: span }, (_, step) => String(first + step));
    return {
      title: `${options.horizon?.title ?? "Years"} · ${years[0]}–${years[years.length - 1]}`,
      grain: "month",
      columns: 4,
      years,
      cells: years.flatMap((year) =>
        Array.from({ length: 12 }, (_, month) => monthCell(`${year}-${String(month + 1).padStart(2, "0")}-01`, true)),
      ),
    };
  }

  const first = startOfMonth(at);
  const from = startOfWeek(first, weekStartsOn);
  const month = at.slice(0, 7);
  return {
    title: `${MONTHS[Number(at.slice(5, 7)) - 1]} ${at.slice(0, 4)}`,
    grain: "day",
    columns: 7,
    cells: daysFrom(from, 42).map((one) => day(one, one.slice(0, 7) !== month)),
  };
}

/** The entries touching a stretch of days, in the order a person reads them. */
export function entriesIn(entries: readonly PlacedEntry[], from: string, to: string): PlacedEntry[] {
  return entries
    .filter((entry) => daysBetween(entry.from, to) >= 0 && daysBetween(from, entry.to) >= 0)
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      if (a.from !== b.from) return a.from.localeCompare(b.from);
      if (a.at !== b.at) return (a.at ?? 0) - (b.at ?? 0);
      return a.label.localeCompare(b.label);
    });
}

/** The range one level finer than a cell of this grain, and what a press on it opens. */
export function finerThan(grain: CalendarGrain): CalendarRange {
  return grain === "month" ? "month" : grain === "week" ? "week" : "day";
}

const longDay = (day: string): string =>
  `${WEEKDAYS[weekdayOf(day)]} ${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]!.slice(0, 3)}`;

function Step({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onPress} style={stepStyle}>
      {glyph}
    </button>
  );
}

const stepStyle = {
  minHeight: 24,
  minWidth: 24,
  padding: "2px 9px",
  borderRadius: 999,
  fontSize: "0.75rem",
  borderWidth: 1,
  borderStyle: "solid" as const,
  borderColor: "var(--graview-edge)",
  color: "var(--graview-ink-muted)",
  background: "transparent",
};

/**
 * WHATEVER THE RANGE IS, AS A GRID OF CELLS.
 *
 * A cell is a day, a week or a month — they differ in how much ground they
 * cover and in nothing else. AN ENTRY IS DRAWN ON EVERY CELL IT TOUCHES and
 * says which piece it is, so a planting sown in March and lifted in July is
 * one thing running across four cells of a year exactly as a fortnight runs
 * across four cells of a week.
 *
 * ABOVE A MONTH, LISTING EVERYTHING STOPS BEING A PICTURE. So the cell
 * carries what fits at full fidelity and the rest as a count, with the
 * rules' own flag on it where something in the remainder is broken — the
 * lens contract's two fidelities doing the work a scroll bar would not.
 */
const PER_CELL: Readonly<Record<CalendarGrain, number>> = { day: 12, week: 4, month: 3 };

function Grid({
  span,
  weekStartsOn,
  entries,
  today,
  perCell,
  emphasisOf,
  broken,
  hue,
  onOpen,
  onMove,
}: {
  span: CalendarSpan;
  weekStartsOn: number;
  entries: readonly PlacedEntry[];
  today: string;
  perCell: number;
  emphasisOf: (id: string) => Emphasis;
  broken: ReadonlySet<string>;
  hue: (entry: PlacedEntry) => number;
  onOpen: (cell: CalendarCell) => void;
  onMove: (id: string, cell: CalendarCell, grain: CalendarGrain) => void;
}) {
  // Weekday headings belong to a week of days and to nothing else: a row of
  // four week-cells under "Mon Tue Wed Thu" would be a caption for a
  // different picture.
  const headers =
    span.grain === "day" && span.columns === 7
      ? daysFrom(startOfWeek(span.cells[0]?.from ?? today, weekStartsOn), 7)
      : span.grain === "day" && span.columns === 1
        ? span.cells.map((cell) => cell.from)
        : null;
  return (
    <div style={{ display: "grid", gap: 4, gridTemplateRows: headers ? "auto 1fr" : "1fr", minHeight: 0, flex: 1 }}>
      {headers ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${span.columns}, minmax(0, 1fr))`, gap: 4 }}>
          {headers.map((day) => (
            <span
              key={day}
              style={{
                fontSize: "0.625rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--graview-ink-muted)",
                textAlign: "center",
              }}
            >
              {span.columns === 7 ? WEEKDAYS[weekdayOf(day)] : longDay(day)}
            </span>
          ))}
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${span.columns}, minmax(0, 1fr))`,
          gap: 4,
          minHeight: 0,
          overflow: "auto",
        }}
      >
        {span.cells.map((cell, at) => {
          const here = entriesIn(entries, cell.from, cell.to);
          const shown = here.slice(0, perCell);
          const hidden = here.slice(perCell);
          const flaggedHidden = hidden.filter((entry) => broken.has(entry.id)).length;
          const now = daysBetween(cell.from, today) >= 0 && daysBetween(today, cell.to) >= 0;
          return (
            <div
              key={cell.from}
              data-calendar-day={span.grain === "day" ? cell.from : undefined}
              data-calendar-cell={cell.from}
              data-calendar-grain={span.grain}
              data-calendar-count={here.length}
              data-calendar-outside={cell.outside || undefined}
              /*
               * A CELL IS SOMEWHERE TO DROP A THING.
               *
               * The browser's own drag rather than pointer events, because
               * the scene's card drag is on pointerdown and would otherwise
               * win — and because `draggable` gives the keyboard-free
               * gesture a native affordance instead of a hand-rolled one.
               */
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes("text/graview-node")) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                const id = event.dataTransfer.getData("text/graview-node");
                if (!id) return;
                event.preventDefault();
                event.stopPropagation();
                onMove(id, cell, span.grain);
              }}
              style={{
                minHeight: 62,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                padding: 4,
                borderRadius: 7,
                border: "1px solid var(--graview-edge)",
                background: now ? "var(--graview-panel)" : "transparent",
                opacity: cell.outside ? 0.45 : 1,
              }}
            >
              <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span
                  style={{
                    fontSize: "0.65625rem",
                    fontVariantNumeric: "tabular-nums",
                    color: now ? "var(--graview-accent)" : "var(--graview-ink-faint)",
                  }}
                >
                  {cell.label}
                </span>
                {/* The count is the coarse cell's summary — at a year it is
                    the only honest thing a cell that holds forty entries
                    can say about all of them. */}
                {span.grain !== "day" && here.length > 0 ? (
                  <span style={{ fontSize: "0.625rem", color: "var(--graview-ink-faint)", marginLeft: "auto" }}>
                    {here.length}
                  </span>
                ) : null}
              </span>
              {shown.map((entry) => (
                <Entry
                  key={`${entry.id}:${cell.from}`}
                  entry={entry}
                  cell={cell}
                  /* A span keeps its name where it begins and again wherever a
                     ROW does: a rotation running March to October covers two
                     rows of a year, and the second row was four nameless bars.
                     This is what a wall calendar does with a fortnight. */
                  rowStart={at % span.columns === 0}
                  emphasis={emphasisOf(entry.id)}
                  flagged={broken.has(entry.id)}
                  hue={hue(entry)}
                />
              ))}
              {hidden.length > 0 ? (
                <button
                  type="button"
                  data-testid={`calendar-more-${cell.from}`}
                  onClick={() => onOpen(cell)}
                  title={`Open ${cell.label}`}
                  style={{
                    minHeight: 24,
                    padding: "1px 5px",
                    fontSize: "0.625rem",
                    borderRadius: 5,
                    border: "1px dashed var(--graview-edge)",
                    background: "transparent",
                    color: flaggedHidden > 0 ? "var(--graview-warn)" : "var(--graview-ink-muted)",
                    textAlign: "left",
                  }}
                >
                  +{hidden.length} more{flaggedHidden > 0 ? ` · ${flaggedHidden} flagged` : ""}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The days with anything on them, in order, each with what is on it. */
function Agenda({
  days,
  entries,
  today,
  emphasisOf,
  broken,
  hue,
  onMove,
}: {
  days: readonly string[];
  entries: readonly PlacedEntry[];
  today: string;
  emphasisOf: (id: string) => Emphasis;
  broken: ReadonlySet<string>;
  hue: (entry: PlacedEntry) => number;
  onMove: (id: string, day: string) => void;
}) {
  const withSomething = days
    .map((day) => ({ day, here: entriesOn(entries, day) }))
    .filter(({ here }) => here.length > 0);
  if (withSomething.length === 0) {
    return (
      <p data-testid="calendar-empty" style={{ margin: 0, fontSize: "0.78125rem", color: "var(--graview-ink-muted)" }}>
        Nothing is scheduled in the next six weeks.
      </p>
    );
  }
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10, overflow: "auto", minHeight: 0 }}>
      {withSomething.map(({ day, here }) => (
        <li
          key={day}
          data-calendar-day={day}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("text/graview-node")) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            const id = event.dataTransfer.getData("text/graview-node");
            if (!id) return;
            event.preventDefault();
            event.stopPropagation();
            onMove(id, day);
          }}
          style={{ display: "grid", gap: 4 }}
        >
          <span
            style={{
              fontSize: "0.65625rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: day === today ? "var(--graview-accent)" : "var(--graview-ink-muted)",
            }}
          >
            {longDay(day)}
            {day === today ? " · today" : ""}
          </span>
          {here.map((entry) => (
            <Entry
              key={`${entry.id}:${day}`}
              entry={entry}
              cell={{ from: day, to: day, label: day }}
              emphasis={emphasisOf(entry.id)}
              flagged={broken.has(entry.id)}
              hue={hue(entry)}
            />
          ))}
        </li>
      ))}
    </ol>
  );
}

/**
 * One entry on one day.
 *
 * A real node, so it is a real target: the scene routes a click on it to
 * that node rather than to the calendar drawing it, the selection lights it,
 * and a rule that flags it leaves its mark here rather than only in a list
 * somebody has to go looking for.
 *
 * A span that began before this day or runs past it SAYS SO, because "the
 * 14th" and "the 14th of a fortnight" are different facts and a bar that
 * looked identical on both would be lying about one of them.
 */
function Entry({
  entry,
  cell,
  emphasis,
  flagged,
  hue,
  rowStart = false,
}: {
  entry: PlacedEntry;
  cell: CalendarCell;
  emphasis: Emphasis;
  flagged: boolean;
  hue: number;
  /** This cell begins a row, so a span running through it says its name again. */
  rowStart?: boolean;
}) {
  /*
   * WHICH PIECE OF ITSELF THIS IS, read against the CELL rather than a day:
   * a planting sown in March and lifted in July opens in the March cell of
   * a year and closes in the July one, and the four between are the middle
   * of one thing rather than four things.
   */
  const opens = daysBetween(cell.from, entry.from) >= 0;
  const closes = daysBetween(entry.to, cell.to) >= 0;
  const spanning = !(opens && closes);
  const said = entry.at !== null && opens && entry.from === cell.from ? `${clock(entry.at)} ${entry.label}` : entry.label;
  return (
    <span
      data-graview-pick={entry.id}
      data-calendar-entry={entry.id}
      draggable
      onDragStart={(event) => {
        // A node, named in a type only this lens reads — so dragging an
        // entry onto somebody else's page drops nothing, and dropping a
        // file onto the calendar moves nothing.
        event.dataTransfer.setData("text/graview-node", entry.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      data-graview-emphasis={emphasis}
      data-calendar-part={spanning ? (opens ? "opens" : closes ? "closes" : "through") : undefined}
      data-calendar-in={cell.from}
      title={
        spanning
          ? `${entry.label} · ${entry.from} – ${entry.to}`
          : `${entry.label}${entry.at === null ? " · all day" : ` · ${clock(entry.at)}`}`
      }
      style={{
        display: "block",
        minHeight: 24,
        boxSizing: "border-box",
        padding: "3px 6px",
        fontSize: "0.65625rem",
        lineHeight: 1.35,
        borderRadius: spanning ? (opens ? "5px 0 0 5px" : closes ? "0 5px 5px 0" : 0) : 5,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        // Done reads as done: struck and receded, still there, still
        // selectable. Removing it would be answering a different question.
        textDecoration: entry.done ? "line-through" : "none",
        opacity: emphasis === "dimmed" ? 0.35 : entry.done ? 0.6 : 1,
        background: `color-mix(in oklab, hsl(${Math.round(hue)} 70% 55%) ${emphasis === "lit" ? 38 : 20}%, transparent)`,
        color: "var(--graview-ink)",
        ...(emphasis === "lit" ? { outline: "1px solid var(--graview-accent)" } : {}),
        ...(flagged ? { borderLeft: "3px solid var(--graview-warn)", paddingLeft: 4 } : {}),
      }}
    >
      {/* A cell in the middle of a span keeps the name once, at the start —
          repeating it on every cell of a fortnight is five lies about how
          many things are happening. */}
      {opens || rowStart ? said : " "}
    </span>
  );
}
