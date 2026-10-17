

import { minutesAsRead, weekdayAsRead, weekdayName } from "@graview/core";
import { namesInstant, wallOfStored } from "@graview/core/words";

/*
 * DATE ARITHMETIC ON STRINGS, in UTC, and nowhere near a local `Date`.
 *
 * `new Date("2026-09-14")` is midnight UTC and `new Date(2026, 8, 14)` is
 * midnight wherever the reader is; mixing them puts an entry on the 13th for
 * half the world. Every date here is `YYYY-MM-DD` and every step goes
 * through `Date.UTC`, so the picture is the same in Auckland and in Lima.
 */

export const DAY = 86_400_000;

/*
 * AN INSTANT IS ON THE READER'S CLOCK. A moment kept with its zone
 * ("2026-10-17T19:00:00Z") is a meeting at 3 PM in New York: its day and
 * time are where the reader is, not the day and hour of UTC, which put an
 * evening's meeting on the next day (Roadmap f-date-inputs). This is the one
 * place here a local clock is read, and only for such a moment.
 */

/** The ISO day a value names, or null when it names no date at all. */
export function dayOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (namesInstant(value)) return wallOfStored(value)?.day ?? null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1]! : null;
}

/** Minutes from midnight where a value names a time, else null. */
export function minutesOf(value: unknown): number | null {
  if (typeof value !== "string") return null;
  if (namesInstant(value)) return wallOfStored(value)?.minutes ?? null;
  const match = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

const utc = (day: string): number => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
export const iso = (stamp: number): string => new Date(stamp).toISOString().slice(0, 10);

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

/*
 * IN WORDS, in the page's locale (FR-178): the reader's a host passed, else
 * the app's, else en-US — "Mon, Mar 3" and "3:30 PM" in the United States,
 * "Mon 3 Mar" and "15:30" in Britain.
 */

/** A weekday's short name, from 0 for Sunday: "Mon". */
export const weekdayShort = (weekday: number): string => weekdayName(weekday, "short");

/** "Mon, Mar 3": a day in words, the way the calendar titles and labels it. */
export const longDay = (day: string): string => weekdayAsRead(day, { weekday: "short" });

/** A time of day from minutes after midnight: "9:30 AM". */
export const clock = (minutes: number): string => minutesAsRead(minutes);
