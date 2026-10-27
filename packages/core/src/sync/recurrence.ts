import { instantIn, wallIn } from "../days.js";
import { WEEKDAYS, isRepeat, type Repeat, type Weekday } from "../repeat.js";
import { addDays, pad, weekdayOf as weekdayIndexOf } from "../wall-time.js";

/*
 * A RECORD THAT RECURS, AS ONE GOOGLE EVENT (Roadmap
 * f-connection-weekly-records-recur, FR-230). Two shapes of record say a
 * week: a weekday set and two times of day ("mon, wed", "09:00"–"10:30"),
 * and a date that repeats (`repeat.ts`: the first occurrence and the rule
 * beside it). Either is one event with a rule — `RRULE:FREQ=WEEKLY;BYDAY=MO,WE`
 * — in the app's time zone, and a day set apart is an `EXDATE` on it. This
 * is the arithmetic between the two, apart from the mapping that uses it:
 * the rule written and read, a time of day and a wall time turned into the
 * instant Google wants and back, the first day a weekly series falls on.
 */

const BYDAY: Readonly<Record<Weekday, string>> = { sun: "SU", mon: "MO", tue: "TU", wed: "WE", thu: "TH", fri: "FR", sat: "SA" };
const WEEKDAY_OF: Readonly<Record<string, Weekday>> = Object.fromEntries(Object.entries(BYDAY).map(([day, code]) => [code, day as Weekday]));
const FREQ: Readonly<Record<Repeat["every"], string>> = { day: "DAILY", week: "WEEKLY", month: "MONTHLY", year: "YEARLY" };
const EVERY_OF: Readonly<Record<string, Repeat["every"]>> = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The weekday a value names, read loosely: "mon", "Monday", "MO", "tues". */
export function weekdayOf(value: unknown): Weekday | undefined {
  if (typeof value !== "string") return undefined;
  const word = value.trim().toLowerCase();
  if (word.length === 2) return WEEKDAY_OF[word.toUpperCase()];
  return WEEKDAYS.find((day) => word.startsWith(day));
}

/** The weekdays a record's value names — one, or a list of them — in the week's order, each once. */
export function weekdaysOf(value: unknown): Weekday[] {
  const named = (Array.isArray(value) ? value : [value]).map(weekdayOf).filter((day): day is Weekday => day !== undefined);
  return WEEKDAYS.filter((day) => named.includes(day));
}

/** The first day on or after `from` that is one of the weekdays; `from` itself when it is. */
export function firstWeekday(from: string, days: readonly Weekday[]): string | undefined {
  if (days.length === 0) return undefined;
  for (let n = 0; n < 7; n += 1) {
    const day = addDays(from, n);
    if (days.includes(WEEKDAYS[weekdayIndexOf(day)]!)) return day;
  }
  return undefined;
}

/** "09:00" (or "9:00", "09:00:00") as minutes after midnight; undefined for anything else. */
export function minutesOf(value: unknown): number | undefined {
  const match = typeof value === "string" ? /^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(value) : null;
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

/** Minutes after midnight as "HH:MM". */
export const hhmm = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** An instant as Google writes one, to the second. */
export const isoInstant = (stamp: number): string => new Date(stamp).toISOString().replace(/\.\d{3}Z$/, "Z");

/** A day and, where it has one, the minutes after midnight a record's date or moment says, on the app's wall. */
export function wallOfMoment(value: unknown, zone: string): { readonly day: string; readonly minutes?: number } | undefined {
  if (typeof value !== "string") return undefined;
  if (DAY.test(value)) return { day: value };
  const written = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (written) return { day: written[1]!, minutes: Number(written[2]) * 60 + Number(written[3]) };
  const stamp = Date.parse(value);
  return Number.isNaN(stamp) ? undefined : wallIn(stamp, zone);
}

/** The instant a record's moment names: a wall time in the zone, or the instant it carries. Not a date. */
export function instantOfMoment(value: unknown, zone: string): string | undefined {
  const wall = wallOfMoment(value, zone);
  if (!wall || wall.minutes === undefined) return undefined;
  return isoInstant(instantIn(wall.day, wall.minutes, zone));
}

/** An instant as a record keeps a wall time in the zone: "2026-10-20T18:00". */
export function momentOfInstant(value: unknown, zone: string): unknown {
  if (typeof value !== "string") return value;
  const stamp = Date.parse(value);
  if (Number.isNaN(stamp)) return value;
  const wall = wallIn(stamp, zone);
  return `${wall.day}T${hhmm(wall.minutes)}`;
}

/** A weekly rule for a weekday set. */
export const weeklyRule = (days: readonly Weekday[]): string => `RRULE:FREQ=WEEKLY;BYDAY=${days.map((day) => BYDAY[day]).join(",")}`;

const compact = (day: string): string => day.replace(/-/g, "");
const stampOf = (day: string, minutes: number): string => `${compact(day)}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;

/**
 * The lines a repeat is as Google keeps a recurrence: its RRULE, and an
 * EXDATE for each day set apart — at the series' time of day in the app's
 * zone for a timed series, as a day for an all-day one. An until day ends
 * at midnight there, said as the instant it is.
 */
export function recurrenceOf(repeat: Repeat, start: { readonly day: string; readonly minutes?: number }, zone: string): string[] {
  const timed = start.minutes !== undefined;
  const parts = [`FREQ=${FREQ[repeat.every]}`];
  if (repeat.interval && repeat.interval > 1) parts.push(`INTERVAL=${repeat.interval}`);
  if (repeat.on && repeat.on.length > 0) {
    if (repeat.every === "week") parts.push(`BYDAY=${repeat.on.map((day) => BYDAY[day as Weekday]).join(",")}`);
    else if (repeat.every === "month") parts.push(`BYMONTHDAY=${repeat.on.join(",")}`);
  }
  if (repeat.until) parts.push(`UNTIL=${timed ? isoInstant(instantIn(addDays(repeat.until, 1), 0, zone) - 1000).replace(/[-:]/g, "") : compact(repeat.until)}`);
  if (repeat.count) parts.push(`COUNT=${repeat.count}`);
  return [`RRULE:${parts.join(";")}`, ...(repeat.except ?? []).map((day) => (timed ? `EXDATE;TZID=${zone}:${stampOf(day, start.minutes!)}` : `EXDATE;VALUE=DATE:${compact(day)}`))];
}

/** A day from the forms a recurrence writes one in: `20261121`, `20261121T100000`, `20261231T045959Z` (read in the zone). */
function dayOfStamp(value: string, zone: string): string | undefined {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value);
  if (!match) return undefined;
  const day = `${match[1]}-${match[2]}-${match[3]}`;
  if (match[7] !== "Z") return day;
  return wallIn(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])), zone).day;
}

/**
 * The repeat a recurrence says, read in the zone, or undefined where it says
 * what a repeat cannot hold (a monthly rule by weekday, a set position, an
 * RDATE): such an event is left as it is rather than kept wrongly.
 */
export function repeatOf(recurrence: unknown, zone: string): Repeat | undefined {
  if (!Array.isArray(recurrence) || recurrence.length === 0) return undefined;
  let rule: Repeat | undefined;
  const except: string[] = [];
  for (const line of recurrence) {
    if (typeof line !== "string") return undefined;
    const [head, body = ""] = line.split(/:(.*)/s) as [string, string?];
    const [name, ...params] = head.split(";");
    if (name === "RRULE") {
      if (rule) return undefined;
      const said = Object.fromEntries(body.split(";").map((part) => part.split("=") as [string, string]));
      const every = EVERY_OF[said["FREQ"] ?? ""];
      if (!every) return undefined;
      const keys = Object.keys(said).filter((key) => !["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "UNTIL", "COUNT", "WKST"].includes(key));
      if (keys.length > 0) return undefined;
      const read: { -readonly [K in keyof Repeat]?: Repeat[K] } = { every };
      if (said["INTERVAL"] && Number(said["INTERVAL"]) > 1) read.interval = Number(said["INTERVAL"]);
      if (said["BYDAY"]) {
        if (every !== "week") return undefined;
        const days = said["BYDAY"].split(",").map((code) => WEEKDAY_OF[code]);
        if (days.some((day) => day === undefined)) return undefined;
        read.on = WEEKDAYS.filter((day) => days.includes(day));
      }
      if (said["BYMONTHDAY"]) {
        if (every !== "month") return undefined;
        read.on = said["BYMONTHDAY"].split(",").map(Number);
      }
      if (said["UNTIL"]) {
        const until = dayOfStamp(said["UNTIL"], zone);
        if (!until) return undefined;
        read.until = until;
      }
      if (said["COUNT"]) read.count = Number(said["COUNT"]);
      rule = read as Repeat;
    } else if (name === "EXDATE") {
      for (const stamp of body.split(",")) {
        const day = dayOfStamp(stamp, zone);
        if (!day) return undefined;
        except.push(day);
      }
      void params;
    } else return undefined;
  }
  if (!rule) return undefined;
  const whole = except.length > 0 ? { ...rule, except: [...new Set(except)].sort() } : rule;
  return isRepeat(whole) ? whole : undefined;
}
