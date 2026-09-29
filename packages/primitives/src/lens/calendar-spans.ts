import { MONTHS, addDays, addMonths, daysBetween, daysFrom, iso, startOfMonth, startOfWeek } from "./calendar-dates.js";
import { longDay } from "./calendar-drawing.js";
import type { CalendarGrain, CalendarHorizon, CalendarRange, PlacedEntry } from "./calendar-options.js";

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
    /*
     * PAST A DECADE, A YEAR PER CELL. Thirty years of months is 360 cells,
     * most of them empty, scrolled through to find the busy ones — a career
     * read as a column of blanks. A year per cell is the whole horizon on
     * one screen, each saying how many and the first of them; pressing one
     * opens its months.
     */
    if (span > YEARS_BY_THE_MONTH) {
      return {
        title: `${options.horizon?.title ?? "Years"} · ${years[0]}–${years[years.length - 1]}`,
        grain: "year",
        columns: 5,
        years,
        cells: years.map((year) => ({ from: `${year}-01-01`, to: `${year}-12-31`, label: year })),
      };
    }
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

/** The longest horizon still drawn a month to a cell. */
export const YEARS_BY_THE_MONTH = 10;

/** The range one level finer than a cell of this grain, and what a press on it opens. */
export function finerThan(grain: CalendarGrain): CalendarRange {
  return grain === "year" ? "year" : grain === "month" ? "month" : grain === "week" ? "week" : "day";
}
