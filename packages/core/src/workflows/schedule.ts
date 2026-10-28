import { instantIn, wallIn } from "../days.js";

/*
 * WHEN A WORKFLOW RUNS ON A CLOCK (Roadmap f-jobs-declared): words a person
 * writes — "day 03:00", "weekday 09:00", "sunday 18:00", "month 1 09:00",
 * "hour" — or five-field cron, both read as the same table of minutes,
 * hours, days of the month, months and weekdays, and both on the wall clock
 * of the app's time zone (the brand's `timeZone`). DST is the wall clock's:
 * "sunday 18:00" is 6 PM on the Sunday the clocks spring forward too. A time
 * the clock skips that day (02:30, the night it springs forward) runs the
 * moment the clock jumps past it (03:00); a time it says twice (01:30, the
 * night it falls back) runs once.
 */

/** A schedule as a table: which minutes, hours, days of the month, months (1–12) and weekdays (0 Sunday – 6). */
export interface Schedule {
  readonly minutes: ReadonlySet<number>;
  readonly hours: ReadonlySet<number>;
  readonly days: ReadonlySet<number>;
  readonly months: ReadonlySet<number>;
  readonly weekdays: ReadonlySet<number>;
  /** Whether days and weekdays were each narrowed: cron runs on either, when both are. */
  readonly daysSaid: boolean;
  readonly weekdaysSaid: boolean;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const range = (from: number, to: number): Set<number> => new Set(Array.from({ length: to - from + 1 }, (_, i) => from + i));

/** What the words a schedule takes are, said when one cannot be read. */
export const SCHEDULE_WORDS = '"hour", "day", "day 03:00", "weekday 09:00", "sunday 18:00" (any weekday), "month 1 09:00", or five-field cron like "0 18 * * 0"';

/** A time of day: "18:00", "6:30", "6pm", "6:30 pm"; minutes after midnight, or undefined. */
function timeOf(said: string): number | undefined {
  const found = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(said.trim().toLowerCase());
  if (!found) return undefined;
  let hour = Number(found[1]);
  const minute = found[2] === undefined ? 0 : Number(found[2]);
  if (found[3]) {
    if (hour < 1 || hour > 12) return undefined;
    hour = (hour % 12) + (found[3] === "pm" ? 12 : 0);
  } else if (found[2] === undefined) return undefined;
  return hour > 23 || minute > 59 ? undefined : hour * 60 + minute;
}

/** A schedule in words, or a sentence saying what could not be read. */
export function scheduleOfWords(words: string): Schedule | string {
  const said = words.trim().toLowerCase().replace(/^every\s+/, "").replace(/\s+at\s+/, " ");
  const all = { minutes: new Set([0]), hours: range(0, 23), days: range(1, 31), months: range(1, 12), weekdays: range(0, 6), daysSaid: false, weekdaysSaid: false };
  if (said === "hour") return all;
  const [first = "", ...rest] = said.split(/\s+/);
  const at = (tail: readonly string[]): number | undefined | string => {
    if (tail.length === 0) return 0;
    const time = timeOf(tail.join(" "));
    return time === undefined ? `"${tail.join(" ")}" is not a time of day; write it as "18:00" or "6 pm"` : time;
  };
  const daily = (time: number) => ({ ...all, minutes: new Set([time % 60]), hours: new Set([Math.floor(time / 60)]) });
  if (first === "day") {
    const time = at(rest);
    return typeof time === "string" ? time : daily(time!);
  }
  if (first === "weekday") {
    const time = at(rest);
    return typeof time === "string" ? time : { ...daily(time!), weekdays: range(1, 5), weekdaysSaid: true };
  }
  const weekday = WEEKDAYS.findIndex((day) => first === day || first === `${day}s` || (first.length >= 3 && day.startsWith(first)));
  if (weekday >= 0) {
    const time = at(rest);
    return typeof time === "string" ? time : { ...daily(time!), weekdays: new Set([weekday]), weekdaysSaid: true };
  }
  if (first === "month") {
    const day = Number(/^(\d{1,2})(?:st|nd|rd|th)?$/.exec(rest[0] ?? "")?.[1]);
    if (!(day >= 1 && day <= 31)) return `"month" takes the day of the month it runs on, 1 to 31, like "month 1 09:00"`;
    const time = at(rest.slice(1));
    return typeof time === "string" ? time : { ...daily(time!), days: new Set([day]), daysSaid: true };
  }
  return `"${words}" is not a schedule Graview reads; it reads ${SCHEDULE_WORDS}`;
}

/** One cron field, or a sentence. */
function cronField(field: string, min: number, max: number, names: readonly string[] = [], what = "field"): Set<number> | string {
  const out = new Set<number>();
  const valueOf = (said: string): number | undefined => {
    const named = names.findIndex((name) => said.toLowerCase().startsWith(name.slice(0, 3)) && said.length >= 3);
    if (named >= 0) return named + (min === 1 ? 1 : 0);
    return /^\d+$/.test(said) ? Number(said) : undefined;
  };
  for (const part of field.split(",")) {
    const [span = "", stepSaid] = part.split("/");
    const step = stepSaid === undefined ? 1 : Number(stepSaid);
    if (!Number.isInteger(step) || step < 1) return `the ${what} "${field}" has a step that is not a whole number`;
    let from: number | undefined;
    let to: number | undefined;
    if (span === "*") (from = min), (to = max);
    else if (span.includes("-")) {
      const [a = "", b = ""] = span.split("-");
      (from = valueOf(a)), (to = valueOf(b));
    } else {
      from = valueOf(span);
      to = stepSaid === undefined ? from : max;
    }
    // Sunday as 7, as cron lets it be said.
    const top = what === "weekday" ? 7 : max;
    if (from === undefined || to === undefined || from < min || to > top || from > to) return `the ${what} "${field}" is not ${min}–${max}`;
    for (let value = from; value <= to; value += step) out.add(what === "weekday" ? value % 7 : value);
  }
  return out;
}

/** A schedule in five-field cron, or a sentence saying what could not be read. */
export function scheduleOfCron(cron: string): Schedule | string {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return `"${cron}" has ${fields.length} field${fields.length === 1 ? "" : "s"}; cron here is five: minute, hour, day of the month, month, weekday ("0 18 * * 0")`;
  const minutes = cronField(fields[0]!, 0, 59, [], "minute");
  const hours = cronField(fields[1]!, 0, 23, [], "hour");
  const days = cronField(fields[2]!, 1, 31, [], "day of the month");
  const months = cronField(fields[3]!, 1, 12, MONTHS, "month");
  const weekdays = cronField(fields[4]!, 0, 6, WEEKDAYS, "weekday");
  for (const one of [minutes, hours, days, months, weekdays]) if (typeof one === "string") return `"${cron}" does not read: ${one}`;
  return { minutes: minutes as Set<number>, hours: hours as Set<number>, days: days as Set<number>, months: months as Set<number>, weekdays: weekdays as Set<number>, daysSaid: fields[2] !== "*", weekdaysSaid: fields[4] !== "*" };
}

/** A clock trigger's schedule, or a sentence; undefined for a trigger that is no clock. */
export function scheduleOf(trigger: { readonly every?: string; readonly cron?: string }): Schedule | string | undefined {
  if (typeof trigger.every === "string") return scheduleOfWords(trigger.every);
  if (typeof trigger.cron === "string") return scheduleOfCron(trigger.cron);
  return undefined;
}

const nextDay = (day: string): string => new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + 1)).toISOString().slice(0, 10);
const weekdayOf = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay();

function dayRuns(schedule: Schedule, day: string): boolean {
  if (!schedule.months.has(+day.slice(5, 7))) return false;
  const onDay = schedule.days.has(+day.slice(8, 10));
  const onWeekday = schedule.weekdays.has(weekdayOf(day));
  // Cron's rule: narrowed both ways, either runs it.
  return schedule.daysSaid && schedule.weekdaysSaid ? onDay || onWeekday : onDay && onWeekday;
}

/** The instant a wall time on a day runs: a time the clock skips that day runs the moment the clock jumps past it. */
function runsAt(day: string, minutes: number, zone: string | undefined): number {
  const instant = instantIn(day, minutes, zone);
  const there = wallIn(instant, zone);
  if (there.day === day && there.minutes === minutes) return instant;
  // Skipped: the first instant on the wall at or after it.
  for (let later = minutes + 1; later < minutes + 180 && later < 24 * 60; later++) {
    const at = instantIn(day, later, zone);
    const wall = wallIn(at, zone);
    if (wall.day === day && wall.minutes === later) return at;
  }
  return instant;
}

/**
 * WHEN A SCHEDULE NEXT RUNS, after a moment: on the wall clock of `zone`
 * (the runtime's when unsaid), DST-correct. Undefined when it never does
 * in the next five years ("month 31" in a schedule that only says February).
 */
export function nextOf(schedule: Schedule, after: Date | number, zone?: string): Date | undefined {
  const from = typeof after === "number" ? after : after.getTime();
  const hours = [...schedule.hours].sort((a, b) => a - b);
  const minutes = [...schedule.minutes].sort((a, b) => a - b);
  let day = wallIn(from, zone).day;
  for (let i = 0; i < 366 * 5; i++, day = nextDay(day)) {
    if (!dayRuns(schedule, day)) continue;
    for (const hour of hours)
      for (const minute of minutes) {
        const at = runsAt(day, hour * 60 + minute, zone);
        if (at > from) return new Date(at);
      }
  }
  return undefined;
}

const twelve = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour % 12 === 0 ? 12 : hour % 12}${minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`} ${hour < 12 ? "AM" : "PM"}`;
};
const ordinal = (n: number): string => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const capital = (said: string): string => said.charAt(0).toUpperCase() + said.slice(1);

/** A clock trigger as a person reads it: "Every Sunday at 6 PM", "Every hour", "On the 1st of each month at 9 AM". */
export function scheduleWords(trigger: { readonly every?: string; readonly cron?: string }): string {
  const schedule = scheduleOf(trigger);
  const raw = trigger.every ?? trigger.cron ?? "";
  if (schedule === undefined || typeof schedule === "string") return `On the schedule “${raw}”`;
  const one = (set: ReadonlySet<number>) => (set.size === 1 ? [...set][0]! : undefined);
  const hour = one(schedule.hours);
  const minute = one(schedule.minutes);
  const allMonths = schedule.months.size === 12;
  if (hour === undefined || minute === undefined || !allMonths) {
    if (schedule.hours.size === 24 && minute !== undefined && !schedule.daysSaid && !schedule.weekdaysSaid && allMonths) return minute === 0 ? "Every hour" : `Every hour at ${minute} past`;
    return `On the schedule “${raw}”`;
  }
  const time = `at ${twelve(hour * 60 + minute)}`;
  if (!schedule.daysSaid && !schedule.weekdaysSaid) return `Every day ${time}`;
  if (!schedule.daysSaid && schedule.weekdays.size === 5 && [1, 2, 3, 4, 5].every((d) => schedule.weekdays.has(d))) return `Every weekday ${time}`;
  if (!schedule.daysSaid) return `Every ${[...schedule.weekdays].sort().map((d) => capital(WEEKDAYS[d]!)).join(" and ")} ${time}`;
  if (!schedule.weekdaysSaid && schedule.days.size === 1) return `On the ${ordinal([...schedule.days][0]!)} of each month ${time}`;
  return `On the schedule “${raw}”`;
}

/**
 * WHEN A WORKFLOW NEXT RUNS ON ITS CLOCK, after a moment: the earliest of
 * its `every` and `cron` triggers, on the wall clock of `zone` (the brand's
 * `timeZone`). Undefined for one that is paused, has no clock, or whose
 * schedules do not read.
 */
export function nextRunAt(workflow: { readonly when: readonly object[]; readonly status?: string }, after: Date | number, zone?: string): Date | undefined {
  if (workflow.status === "paused") return undefined;
  let soonest: Date | undefined;
  for (const trigger of workflow.when) {
    const schedule = scheduleOf(trigger as { every?: string; cron?: string });
    if (schedule === undefined || typeof schedule === "string") continue;
    const next = nextOf(schedule, after, zone);
    if (next && (!soonest || next < soonest)) soonest = next;
  }
  return soonest;
}
