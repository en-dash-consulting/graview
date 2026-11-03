import { dayOfMoment, isoToday, timeAsRead, weekdayAsRead, zoneFor } from "@graview/core";

/*
 * A DAY SAID BOTH WAYS (Roadmap f-facts-by-type): what it is and how far it
 * is — "Fri, Sep 4 · in 3 days". A record's page said a due date as "Sep 4,
 * 2026" and left the reader to work out that it was Friday and three days
 * off; a person deciding what to do next asks the second question first.
 */

const DAY_MS = 86_400_000;

/** How far a day is from today, as a person says it: "today", "tomorrow", "in 3 days", "2 weeks ago", "9 years ago". */
export function fromToday(day: string, today: string): string {
  const days = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (!Number.isFinite(days)) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  const far = Math.abs(days);
  const [count, unit] = far < 14 ? [far, "day"] : far < 60 ? [Math.round(far / 7), "week"] : far < 730 ? [Math.round(far / 30.44), "month"] : [Math.round(far / 365.25), "year"];
  const said = `${count} ${unit}${count === 1 ? "" : "s"}`;
  return days > 0 ? `in ${said}` : `${said} ago`;
}

/**
 * A stored day or moment said with its weekday and how far it is from
 * today: "Fri, Sep 4 · in 3 days", "Mon, Sep 25, 2017, 11:30 AM · 9 years
 * ago" — its year only when it is not this one. Undefined for anything that
 * names no whole day (a month alone, a year alone, words).
 */
export function whenSaid(stored: string, today: string, options: { readonly locale?: string; readonly timeZone?: string } = {}): { readonly words: string; readonly day: string; readonly past: boolean } | undefined {
  const day = dayOfMoment(stored, options.timeZone);
  if (day === undefined) return undefined;
  const date = weekdayAsRead(day, { weekday: "short", year: day.slice(0, 4) !== today.slice(0, 4) }, options.locale);
  const time = stored.length > 10 ? `, ${timeAsRead(stored, options.locale, options.timeZone)}` : "";
  return { words: `${date}${time} · ${fromToday(day, today)}`, day, past: day < today };
}

/** The day a store judges "late" against: its own (`?today=`, a pinned demo), else today on the app's clock. */
export function todayOf(store: { today?(): string | undefined }): string {
  return store.today?.() ?? isoToday(zoneFor());
}
