import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * A MONTH TO PICK A DAY FROM (Roadmap f-date-inputs), opened beside a date's
 * box (`when-input.tsx`). A grid of the month's days, laid out by weeks, with
 * the keyboard a calendar grid is expected to take: the arrows move a day or
 * a week, Page Up and Page Down a month (with Shift, a year), Home and End
 * the week's ends, Enter or Space picks, Escape closes. One day holds the
 * keyboard at a time (a roving tab stop), so Tab leaves the grid in one
 * press. Each day is named in full for a screen reader — "Saturday, October
 * 17, 2026" — and the selected one and today are said as such. It sits in
 * the flow under the box rather than floating over the page, so on a phone
 * it is never off the side of the screen.
 */

export interface WhenMonthProps {
  readonly id: string;
  /** What the date is called: "Starts". */
  readonly label: string;
  /** The day the field holds, `YYYY-MM-DD`, if any. */
  readonly selected?: string | undefined;
  /** The reader's today, `YYYY-MM-DD`. */
  readonly today: string;
  readonly locale?: string | undefined;
  readonly onPick: (day: string) => void;
  readonly onClose: () => void;
}

const DAY = 86_400_000;
const utcOf = (day: string): number => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const dayOf = (stamp: number): string => new Date(stamp).toISOString().slice(0, 10);
const addDays = (day: string, days: number): string => dayOf(utcOf(day) + days * DAY);
const addMonths = (day: string, months: number): string => {
  const at = new Date(utcOf(day));
  const wanted = at.getUTCMonth() + months;
  const first = Date.UTC(at.getUTCFullYear(), wanted, 1);
  const last = new Date(Date.UTC(at.getUTCFullYear(), wanted + 1, 0)).getUTCDate();
  return dayOf(first + (Math.min(at.getUTCDate(), last) - 1) * DAY);
};

function say(locale: string | undefined, options: Intl.DateTimeFormatOptions, stamp: number): string {
  try {
    return new Intl.DateTimeFormat(locale ?? "en-US", { ...options, timeZone: "UTC" }).format(stamp);
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(stamp);
  }
}

/** The first day of the week where the reader is: Monday nearly everywhere, Sunday in the US and a few others. */
function weekStart(locale: string | undefined): number {
  try {
    const info = (new Intl.Locale(locale ?? "en-US") as unknown as { weekInfo?: { firstDay: number }; getWeekInfo?: () => { firstDay: number } });
    const first = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    if (first !== undefined) return first % 7;
  } catch {
    return 0;
  }
  return /^en-US|^en$|-(US|CA|JP|BR|IL|MX|PH)$/.test(locale ?? "en-US") ? 0 : 1;
}

export function WhenMonth({ id, label, selected, today, locale, onPick, onClose }: WhenMonthProps): ReactNode {
  const [focused, setFocused] = useState(selected ?? today);
  const grid = useRef<HTMLTableElement | null>(null);
  const first = weekStart(locale);
  const monthStart = `${focused.slice(0, 7)}-01`;
  const lead = (new Date(utcOf(monthStart)).getUTCDay() - first + 7) % 7;
  const gridStart = addDays(monthStart, -lead);
  const weeks = Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(gridStart, week * 7 + day)));
  const title = say(locale, { month: "long", year: "numeric" }, utcOf(monthStart));

  // The day that holds the keyboard has it: on opening, and after every move made in the grid (a month's button keeps it).
  // A key pressed in the grid moves the keyboard even when the day it was on is gone with its month.
  const keyed = useRef(true);
  useEffect(() => {
    if (keyed.current) grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
    keyed.current = false;
  }, [focused]);

  const key = (event: KeyboardEvent<HTMLTableElement>) => {
    const step: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, event.shiftKey ? 12 : 1),
      Home: () => addDays(focused, -((new Date(utcOf(focused)).getUTCDay() - first + 7) % 7)),
      End: () => addDays(focused, 6 - ((new Date(utcOf(focused)).getUTCDay() - first + 7) % 7)),
    };
    if (step[event.key]) {
      event.preventDefault();
      keyed.current = true;
      setFocused(step[event.key]!());
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  const headers = Array.from({ length: 7 }, (_, index) => utcOf("1970-01-04") + ((first + index) % 7) * DAY);
  const button = { minWidth: 32, minHeight: 32, padding: "0 8px", borderRadius: 6 } as const;
  return (
    <div
      id={id}
      role="group"
      aria-label={`Pick a date for ${label}`}
      data-graview-part="when-month"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      style={{
        flexBasis: "100%",
        width: "min(100%, 20rem)",
        boxSizing: "border-box",
        padding: 8,
        border: "1px solid var(--graview-edge)",
        borderRadius: 8,
        background: "var(--graview-panel)",
        color: "var(--graview-ink)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
        <button type="button" aria-label="Previous month" onClick={() => setFocused(addMonths(focused, -1))} style={button}>
          ‹
        </button>
        <span id={`${id}-title`} aria-live="polite" style={{ fontWeight: 600, fontSize: "0.875rem" }}>
          {title}
        </span>
        <button type="button" aria-label="Next month" onClick={() => setFocused(addMonths(focused, 1))} style={button}>
          ›
        </button>
      </div>
      <table ref={grid} role="grid" aria-labelledby={`${id}-title`} onKeyDown={key} style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: "0.8125rem" }}>
        <thead>
          <tr>
            {headers.map((stamp) => (
              <th key={stamp} scope="col" abbr={say(locale, { weekday: "long" }, stamp)} style={{ fontWeight: 500, color: "var(--graview-ink-faint)", padding: "2px 0" }}>
                {say(locale, { weekday: "narrow" }, stamp)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const inMonth = day.slice(0, 7) === monthStart.slice(0, 7);
                const isSelected = day === selected;
                const isToday = day === today;
                return (
                  <td key={day} role="gridcell" aria-selected={isSelected || undefined} style={{ padding: 1, textAlign: "center" }}>
                    <button
                      type="button"
                      data-day={day}
                      tabIndex={day === focused ? 0 : -1}
                      aria-label={`${say(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" }, utcOf(day))}${isToday ? ", today" : ""}${isSelected ? ", selected" : ""}`}
                      {...(isToday ? { "aria-current": "date" as const } : {})}
                      onClick={() => onPick(day)}
                      onFocus={() => day !== focused && setFocused(day)}
                      style={{
                        width: "100%",
                        minHeight: 36,
                        padding: 0,
                        borderRadius: 6,
                        border: isToday ? "1px solid var(--graview-accent)" : "1px solid transparent",
                        background: isSelected ? "var(--graview-accent)" : "transparent",
                        color: isSelected ? "var(--graview-accent-ink)" : inMonth ? "var(--graview-ink)" : "var(--graview-ink-faint)",
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {Number(day.slice(8, 10))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
