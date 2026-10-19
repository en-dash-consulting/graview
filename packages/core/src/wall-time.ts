/*
 * A DAY AND A TIME ON THE READER'S WALL, AND AS A FIELD KEEPS THEM (Roadmap
 * f-date-inputs): an instant read back on the reader's clock, a wall time
 * kept as an instant in UTC or as written, the zone it is read in, and an
 * end that moves with its start. "The reader's clock" is the one a moment
 * is said on (`zoneFor`): the person's zone a host passed, else the app's
 * `brand.timeZone`, else the runtime's (Roadmap f-app-time-zone), so what
 * the editor reads back is what the record's page says. Apart from the
 * reading of what is typed (`when-typed.ts`), which only a date's editor
 * needs, so that what a record's value and the calendar draw with carries
 * none of it.
 */

import { DEFAULT_LOCALE, instantIn, timeZoneFor, wallIn, zoneFor } from "./days.js";

/** A day and, where it has one, a time of day in minutes after midnight, on the reader's wall. */
export interface WallTime {
  /** `YYYY-MM-DD`. */
  readonly day: string;
  readonly minutes?: number;
}

export const DAY_MS = 86_400_000;
const ISO_DAY_AT_START = /^(\d{4})-(\d{2})-(\d{2})/;

export const pad = (n: number): string => String(n).padStart(2, "0");
export const dayOfUtc = (stamp: number): string => new Date(stamp).toISOString().slice(0, 10);
export const utcOf = (day: string): number => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
export const addDays = (day: string, days: number): string => dayOfUtc(utcOf(day) + days * DAY_MS);
export const weekdayOf = (day: string): number => new Date(utcOf(day)).getUTCDay();

/** A real day of the calendar, or undefined: "2026-02-31" is none. */
export function dayFrom(year: number, month: number, date: number): string | undefined {
  if (!(month >= 1 && month <= 12 && date >= 1 && date <= 31)) return undefined;
  const day = `${String(year).padStart(4, "0")}-${pad(month)}-${pad(date)}`;
  return dayOfUtc(utcOf(day)) === day ? day : undefined;
}

/** The reader's wall time now (or at an instant): the day, and the minutes since midnight, on the clock a moment is said on. */
export function wallNow(at: Date = new Date()): WallTime & { readonly minutes: number } {
  const zone = zoneFor();
  if (zone) return wallIn(at.getTime(), zone);
  return { day: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`, minutes: at.getHours() * 60 + at.getMinutes() };
}

/** Whether a stored moment names an instant: it carries a `Z` or an offset after its time. */
export const namesInstant = (value: string): boolean => /T\d\d:\d\d(:[\d.]+)?(Z|[+-]\d\d:?\d\d)$/.test(value);

/**
 * A stored day or moment as a wall time: an instant on the reader's clock, a
 * wall time as it was written, a day as a day. Undefined for anything that
 * is not a date.
 */
export function wallOfStored(value: unknown): WallTime | undefined {
  if (typeof value !== "string") return undefined;
  if (namesInstant(value)) {
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? undefined : wallNow(at);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value);
  if (!match || !dayFrom(Number(match[1]), Number(match[2]), Number(match[3]))) return undefined;
  const day = value.slice(0, 10);
  return match[4] === undefined ? { day } : { day, minutes: Number(match[4]) * 60 + Number(match[5]) };
}

/**
 * A wall time as the field keeps it: a day as `YYYY-MM-DD`; a moment as an
 * instant in UTC (`2026-10-17T19:00:00Z`) where the field keeps instants, or
 * as the wall time written (`2026-10-17T15:00`) where it takes no zone.
 */
export function storedOfWall(wall: WallTime, options: { readonly time: boolean; readonly instant: boolean }): string {
  if (!options.time) return wall.day;
  const minutes = wall.minutes ?? 9 * 60;
  if (!options.instant) return `${wall.day}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  const zone = zoneFor();
  const [, year, month, date] = ISO_DAY_AT_START.exec(wall.day)!;
  const at = zone ? new Date(instantIn(wall.day, minutes, zone)) : new Date(Number(year), Number(month) - 1, Number(date), Math.floor(minutes / 60), minutes % 60);
  return at.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** The zone a moment is read and kept in, by name and as it is said short: "America/New_York", "EDT". */
export function zoneSaid(locale?: string, at: Date = new Date()): { readonly zone: string; readonly short: string } {
  const zone = timeZoneFor();
  let short = zone;
  try {
    short = new Intl.DateTimeFormat(locale ?? DEFAULT_LOCALE, { timeZoneName: "short", timeZone: zone }).formatToParts(at).find((part) => part.type === "timeZoneName")?.value ?? zone;

  } catch {
    short = zone;
  }
  return { zone, short };
}

/**
 * Where an end goes when its start moves: as far as the start moved, so a
 * meeting keeps its length. A start given for the first time puts an empty
 * end an hour after it, where the two hold times; a day's end is left for
 * the person to say. An end already given, with no start before, is kept.
 */
export function endAfterStartMoved(
  before: string | undefined,
  after: string,
  end: string | undefined,
  options: { readonly time: boolean; readonly instant: boolean },
): string | undefined {
  const moved = wallOfStored(after);
  if (!moved) return end;
  const was = before === undefined ? undefined : wallOfStored(before);
  const ending = end === undefined ? undefined : wallOfStored(end);
  const at = (wall: WallTime) => utcOf(wall.day) + (wall.minutes ?? 0) * 60_000;
  const shifted = (from: WallTime, by: number): WallTime => {
    const stamp = at(from) + by;
    return { day: dayOfUtc(stamp), ...(options.time ? { minutes: Math.round((stamp % DAY_MS) / 60_000) } : {}) };
  };
  if (was && ending) return storedOfWall(shifted(ending, at(moved) - at(was)), options);
  if (ending && at(ending) >= at(moved)) return end;
  return options.time ? storedOfWall(shifted(moved, 3_600_000), options) : end;
}

/** A field that says when something starts, and one that says when it ends. */
const STARTS = /^(start|starts|startsAt|startsOn|startAt|begins|from|opens|checkIn)$/i;
const ENDS = /^(end|ends|endsAt|endsOn|endAt|until|to|finish|finishes|closes|through|checkOut)$/i;

/**
 * Which of a kind's (or an act's) date fields is a start and which its end:
 * its `start` and `end` roles where it declares them, else the fields named
 * for them. Undefined unless both are there.
 */
export function startAndEndOf(fields: readonly string[], roles: Readonly<Record<string, string | undefined>> = {}): { readonly start: string; readonly end: string } | undefined {
  const start = (roles["start"] && fields.includes(roles["start"]) ? roles["start"] : undefined) ?? fields.find((field) => STARTS.test(field));
  const end = (roles["end"] && fields.includes(roles["end"]) ? roles["end"] : undefined) ?? fields.find((field) => field !== start && ENDS.test(field));
  return start && end ? { start, end } : undefined;
}
