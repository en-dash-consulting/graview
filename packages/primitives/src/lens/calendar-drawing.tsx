import { MONTHS, WEEKDAYS, clock, daysBetween, daysFrom, startOfWeek, weekdayOf } from "./calendar-dates.js";
import type { CalendarGrain, PlacedEntry } from "./calendar-options.js";
import { entriesOn } from "./calendar-placing.js";
import { type CalendarCell, type CalendarSpan, entriesIn } from "./calendar-spans.js";
import type { Emphasis } from "./calendar-view.js";
import { useRef } from "react";
import { useWidth } from "../primitives/index.js";

export const longDay = (day: string): string =>
  `${WEEKDAYS[weekdayOf(day)]} ${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]!.slice(0, 3)}`;

export function Step({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onPress} style={stepStyle}>
      {glyph}
    </button>
  );
}

export const stepStyle = {
  minHeight: 24,
  minWidth: 24,
  padding: "2px 9px",
  borderRadius: 999,
  fontSize: "0.8125rem",
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
export const PER_CELL: Readonly<Record<CalendarGrain, number>> = { day: 12, week: 4, month: 3 };

export function Grid({
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
  /*
   * THE ROOM DECIDES THE DRAWING. Seven day columns in a 300px box are
   * 40px cells with three letters of each name in them — a grid nobody
   * can read and nobody can drop onto. Below about 44px a column, a run
   * of days becomes the agenda (the day view's own drawing, one day under
   * the next), and a run of coarser cells — weeks, months — wraps into as
   * many columns as the width holds, since those carry their own labels.
   */
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const fits = width === null ? span.columns : Math.max(1, Math.floor(width / 44));
  const narrow = fits < span.columns;
  const columns = narrow ? fits : span.columns;
  const headers =
    !narrow && span.grain === "day" && span.columns === 7
      ? daysFrom(startOfWeek(span.cells[0]?.from ?? today, weekStartsOn), 7)
      : span.grain === "day" && span.columns === 1
        ? span.cells.map((cell) => cell.from)
        : null;
  if (narrow && span.grain === "day" && span.columns > 1) {
    return (
      <div ref={box} data-calendar-shape="agenda" style={{ display: "grid", minHeight: 0, flex: 1 }}>
        <Agenda
          days={span.cells.map((cell) => cell.from)}
          entries={entries}
          today={today}
          emphasisOf={emphasisOf}
          broken={broken}
          hue={hue}
          onMove={(id, day) => onMove(id, { from: day, to: day, label: day }, "day")}
        />
      </div>
    );
  }
  return (
    <div ref={box} data-calendar-shape={narrow ? "wrapped" : "grid"} style={{ display: "grid", gap: 4, gridTemplateRows: headers ? "auto 1fr" : "1fr", minHeight: 0, flex: 1 }}>
      {headers ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 4 }}>
          {headers.map((day) => (
            <span
              key={day}
              style={{
                fontSize: "0.75rem",
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
        /*
         * A REGION THAT SCROLLS IS A STOP FOR THE KEYBOARD. Given less height
         * than its rows — a month in a picture frame, a fortnight in a card —
         * this grid scrolls inside itself, and a region that scrolls with no
         * focusable element in it is one a keyboard cannot scroll at all
         * (axe: scrollable-region-focusable). A stop with the span's own name.
         */
        tabIndex={0}
        aria-label={`The days of ${span.title}`}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
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
                    fontSize: "0.75rem",
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
                  <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)", marginLeft: "auto" }}>
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
                  rowStart={at % columns === 0}
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
                    fontSize: "0.75rem",
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
export function Agenda({
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
      <p data-testid="calendar-empty" style={{ margin: 0, fontSize: "0.875rem", color: "var(--graview-ink-muted)" }}>
        Nothing is scheduled in the next six weeks.
      </p>
    );
  }
  return (
    <ol
      // The same stop the day grid has: an agenda longer than its frame scrolls, and the keyboard needs a way in.
      tabIndex={0}
      aria-label="What is scheduled"
      style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", alignContent: "start", gap: 10, overflow: "auto", minHeight: 0 }}
    >
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
              fontSize: "0.75rem",
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
        fontSize: "0.75rem",
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
