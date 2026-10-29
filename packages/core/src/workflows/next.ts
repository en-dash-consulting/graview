import { instantIn, wallIn } from "../days.js";
import { scheduleOf, type Schedule } from "./schedule.js";

/*
 * WHEN A SCHEDULE NEXT RUNS, as arithmetic on the wall clock: apart from
 * reading one (`./schedule.ts`), which the checker needs, so `graview
 * check` and a host's worker carry none of this. On `@graview/core/workflows`.
 */

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
