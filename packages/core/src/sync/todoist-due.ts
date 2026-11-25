import { instantIn, wallIn } from "../days.js";
import { WEEKDAYS, isRepeat, type Repeat, type Weekday } from "../repeat.js";
import { hhmm, isoInstant } from "./recurrence.js";

/*
 * A TODOIST DUE DATE, AS A RECORD KEEPS ONE. Todoist has three sorts
 * (developer.todoist.com/api/v1/due-dates.md): a full day (`2016-12-01`), a
 * floating time on the account's wall (`2016-12-01T12:00:00.000000`), and a
 * fixed one (`…Z`, with its time zone). Any may repeat, and a repeat is only
 * ever its words (`string`), read by Todoist in the language of `lang`; the
 * date is then the current occurrence.
 *
 * A repeat is read here only where it can be said back with the same
 * meaning: every day, week, month or year, every so many of them, named
 * weekdays, and days of the month every month has. Everything else Todoist
 * understands — counted from completion (`every!`), hours, workdays counted
 * from a month's end, start and end dates, holidays, the second Friday — has
 * no repeat here and reads as none; the connection then never writes that
 * due date. What a repeat here holds and Todoist's words do not — days set
 * apart, an until day, a count — is not sent either.
 */

const UNIT: Readonly<Record<string, Repeat["every"]>> = { day: "day", days: "day", week: "week", weeks: "week", month: "month", months: "month", year: "year", years: "year" };
const ALONE: Readonly<Record<string, Repeat["every"]>> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
const WORKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri"];
const WEEKDAY = /^(sun(?:day)?|mon(?:day)?|tues?(?:day)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)$/;
/** The time a repeat says after itself, which the due date holds already: "at 18:00", "at 9am", "9:30 pm". */
const TIME = /\s+(?:(?:at\s+)?(?:\d{1,2}:\d{2}(?:\s*[ap]m)?|\d{1,2}\s*[ap]m)|at\s+\d{1,2})$/;
/** The last day of a month every month has: how the two systems fill a shorter one in is not the same thing to say. */
const LAST_SAFE_DAY = 28;

/** The repeat Todoist's words say, or undefined where they say what a repeat cannot hold. */
export function readRepeat(words: string): Repeat | undefined {
  let said = words.trim().toLowerCase().replace(/\s+/g, " ").replace(TIME, "");
  const alone = ALONE[said];
  if (alone) return { every: alone };
  const opened = /^(?:every|ev) (.+)$/.exec(said);
  if (!opened) return undefined;
  said = opened[1]!;
  if (said === "weekday" || said === "workday") return { every: "week", on: WORKDAYS };
  const other = /^(?:(\d{1,2}|other) )?([a-z]+)$/.exec(said);
  if (other && UNIT[other[2]!]) {
    const interval = other[1] === undefined ? 1 : other[1] === "other" ? 2 : Number(other[1]);
    return interval < 1 ? undefined : { every: UNIT[other[2]!]!, ...(interval > 1 ? { interval } : {}) };
  }
  const parts = said.split(/\s*,\s*/);
  if (parts.every((part) => WEEKDAY.test(part))) {
    const named = parts.map((part) => part.slice(0, 3) as Weekday);
    return { every: "week", on: WEEKDAYS.filter((day) => named.includes(day)) };
  }
  if (parts.every((part) => /^\d{1,2}(?:st|nd|rd|th)?$/.test(part))) {
    const days = [...new Set(parts.map((part) => parseInt(part, 10)))].sort((a, b) => a - b);
    return days.every((day) => day >= 1 && day <= LAST_SAFE_DAY) ? { every: "month", on: days } : undefined;
  }
  return undefined;
}

/** A repeat as both sides compare it: its keys in one order, an interval of one and an empty list left out, its days in order. */
export function plainRepeat(value: unknown): Repeat | null {
  if (!isRepeat(value)) return null;
  const on = value.on?.length ? (value.every === "week" ? WEEKDAYS.filter((day) => value.on!.includes(day)) : [...new Set(value.on as number[])].sort((a, b) => a - b)) : undefined;
  return {
    every: value.every,
    ...(value.interval && value.interval > 1 ? { interval: value.interval } : {}),
    ...(on ? { on } : {}),
    ...(value.until ? { until: value.until } : {}),
    ...(value.count ? { count: value.count } : {}),
    ...(value.except?.length ? { except: [...value.except].sort() } : {}),
  };
}

/** A repeat in Todoist's words, or undefined where they cannot say it: only words that read back as the same repeat are said. */
export function sayRepeat(value: unknown): string | undefined {
  const repeat = plainRepeat(value);
  if (!repeat) return undefined;
  const n = repeat.interval ?? 1;
  const words = repeat.on ? `every ${repeat.on.join(", ")}` : n > 1 ? `every ${n} ${repeat.every}s` : `every ${repeat.every}`;
  return JSON.stringify(readRepeat(words) ?? null) === JSON.stringify(repeat) ? words : undefined;
}

/** A due date as Todoist holds it: what is read of one. */
export interface TodoistDue {
  readonly date: string;
  readonly timezone?: string | null;
  readonly string?: string;
  readonly lang?: string;
  readonly is_recurring?: boolean;
}

/** The day and, where it has one, the minutes after midnight a due date says, on the account's wall; `fixed` when it names its own zone. */
export function dueWall(due: TodoistDue, accountZone: string): { readonly day: string; readonly minutes?: number; readonly fixed: boolean } {
  if (due.date.length <= 10) return { day: due.date, fixed: false };
  if (due.date.endsWith("Z")) return { ...wallIn(Date.parse(due.date), accountZone), fixed: true };
  return { day: due.date.slice(0, 10), minutes: Number(due.date.slice(11, 13)) * 60 + Number(due.date.slice(14, 16)), fixed: false };
}

/** A due date as a `date` field keeps it: its day on the account's wall. */
export const dueDay = (due: TodoistDue, accountZone: string): string => dueWall(due, accountZone).day;

/** A due date as a `datetime` field keeps it: its instant; a full day's is its midnight on the account's wall. */
export function dueInstant(due: TodoistDue, accountZone: string): string {
  const wall = dueWall(due, accountZone);
  return wall.fixed ? isoInstant(Date.parse(due.date)) : isoInstant(instantIn(wall.day, wall.minutes ?? 0, accountZone));
}

/** The same zone, however it is named ("US/Eastern" is "America/New_York"). */
export function sameZone(a: string, b: string): boolean {
  const canonical = (zone: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
    } catch {
      return zone;
    }
  };
  return a === b || canonical(a) === canonical(b);
}

/**
 * A due date as Todoist takes one. A moment at midnight on the account's
 * wall is a full day, as one is read; a time stays floating, as Todoist
 * makes one unless a zone is named, or fixed where the task's is. With
 * `repeat`, the words it repeats in and the time of day it repeats at.
 */
export function dueToWrite(value: string, as: "day" | "moment", accountZone: string, was: TodoistDue | undefined, repeat: string | null): Record<string, unknown> {
  const before = was ? dueWall(was, accountZone) : undefined;
  let wall: { readonly day: string; readonly minutes?: number };
  // A day keeps the time of day the task has there: the field holds only the day.
  if (as === "day") wall = { day: value.slice(0, 10), ...(before?.minutes !== undefined ? { minutes: before.minutes } : {}) };
  else {
    const at = wallIn(Date.parse(value), accountZone);
    wall = at.minutes === 0 ? { day: at.day } : at;
  }
  const timed = wall.minutes !== undefined;
  const fixed = timed && before?.fixed === true && !!was?.timezone;
  const date = !timed ? wall.day : fixed ? isoInstant(instantIn(wall.day, wall.minutes!, accountZone)) : `${wall.day}T${hhmm(wall.minutes!)}:00`;
  return {
    date,
    ...(fixed ? { timezone: was!.timezone } : {}),
    ...(repeat ? { string: timed ? `${repeat} at ${hhmm(wall.minutes!)}` : repeat, lang: "en", is_recurring: true } : {}),
  };
}
