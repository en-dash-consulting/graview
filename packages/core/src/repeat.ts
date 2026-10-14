import * as z from "./schema/zod.js";
import { defOf } from "./schema/zod.js";

/*
 * A DATE THAT REPEATS: a weekly practice, a monthly bill, a yearly renewal.
 *
 * A date field declared to repeat (`{"type": "date", "repeats": true}`, or
 * `startsAtRepeat: repeatField()` beside `startsAt` in a declaration) keeps
 * two values on a record: the date, which is the series' FIRST occurrence,
 * and beside it, under the date's name and `Repeat`, the rule —
 *
 *   { "startsAt": "2026-10-20T18:00",
 *     "startsAtRepeat": { "every": "week", "on": ["tue"], "until": "2026-12-15" } }
 *
 * Occurrences are worked out, never stored. What reads the date — a rule,
 * `today()`, a sort, a list's "due in the next 7 days" — reads the NEXT
 * occurrence (on or after the day it is judged on), and the calendar draws
 * every one in the days it shows. An occurrence a person acts on becomes a
 * record of its own (`detach-<kind>`), with an exception on the series; a
 * skipped one is an exception; a change "from here" ends the series and
 * starts another (`skip-`, `split-`).
 *
 * THE DAYS ARE THE RECORD'S OWN. A day is `YYYY-MM-DD`; a moment's time of
 * day rides along unchanged, so `…T18:00`, written without a zone, is six
 * in the evening on the wall in every week, across a clock change; one
 * written with a zone (`Z`, `-04:00`) keeps that offset. A month whose day
 * the series falls on is short (a bill on the 31st, a birthday on Feb 29)
 * falls on its last day. `count` counts every occurrence from the first,
 * skipped ones too; `until` is the last day one may fall on. The rest of
 * RFC 5545 (by-week-number, by-set-position, hourly) is not here.
 *
 * A hosted page loads this up front — a rule judges the next occurrence as
 * the store loads — so it holds the rule's shape and its days, and no
 * words: what says a repeat ("Every Tuesday, next Oct 21") is
 * `repeat-words.ts`, fetched with the face that says it.
 */

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const EVERY = ["day", "week", "month", "year"] as const;

/** How a date repeats, as a record keeps it beside the date. */
export interface Repeat {
  readonly every: (typeof EVERY)[number];
  /** Every how many: 2 with `week` is every other week. 1 when absent. */
  readonly interval?: number;
  /** Which days: weekdays (`"tue"`) for `week`; days of the month (1–31, -1 the last) for `month`. The first date's when absent. */
  readonly on?: readonly (Weekday | number)[];
  /** The last day an occurrence may fall on (`YYYY-MM-DD`). */
  readonly until?: string;
  /** How many occurrences in all, from the first. */
  readonly count?: number;
  /** The days skipped (`YYYY-MM-DD`): a skipped one, or one made a record of its own. */
  readonly except?: readonly string[];
  /** The record whose series this one continues ("Change from here"). */
  readonly continues?: string;
}

/** Where a date field's repeat is kept: beside it, under its name and `Repeat`. */
export const repeatKey = (field: string): string => `${field}Repeat`;

/** The date field a repeat's key repeats: `startsAtRepeat` → `startsAt`. */
export const repeatedBy = (key: string): string | undefined => (key.endsWith("Repeat") && key.length > 6 ? key.slice(0, -6) : undefined);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/*
 * WHICH FIELDS HOLD A REPEAT: a mark on the schema's def, as an app-link is
 * marked (`schema/app-link.ts`), so it survives `optional()` and a clone.
 */
const MARK = Symbol.for("@graview/core:repeat");

/** Whether a field holds a date's repeat — under optional, default and nullable. */
export function isRepeatField(schema: unknown): boolean {
  const def = defOf(schema) as { [MARK]?: 1; innerType?: unknown } | undefined;
  return !!def && (def[MARK] === 1 || isRepeatField(def.innerType));
}

/** Marks a schema as holding a date's repeat. */
export const markRepeat = <T extends object>(schema: T): T => (Object.defineProperty(defOf(schema)!, MARK, { value: 1, enumerable: true }), schema);

const whole = (n: unknown, min: number, max: number) => n === undefined || (Number.isInteger(n) && (n as number) >= min && (n as number) <= max);
const days = (list: unknown, max: number) => list === undefined || (Array.isArray(list) && list.length <= max && list.every((one) => typeof one === "string" && DAY.test(one)));
const KEYS = ["every", "interval", "on", "until", "count", "except", "continues"];

/**
 * Whether a value is a repeat as a record keeps one: its unit; an interval of
 * 1–99; weekdays for a week or days of the month (1–31, -1 the last) for a
 * month, and nothing else; an until day; a count of 1–1000; at most 500
 * skipped days; nothing more.
 */
export const validRepeat = (r: unknown): r is Repeat =>
  isRepeat(r) &&
  Object.keys(r).every((key) => KEYS.includes(key)) &&
  whole(r.interval, 1, 99) &&
  whole(r.count, 1, 1000) &&
  days(r.until === undefined ? undefined : [r.until], 1) &&
  days(r.except, 500) &&
  (r.continues === undefined || (typeof r.continues === "string" && r.continues.length <= 200)) &&
  (r.on === undefined || (Array.isArray(r.on) && r.on.length > 0 && r.on.length <= 31 && r.on.every((on) => (r.every === "week" ? WEEKDAYS.includes(on as Weekday) : r.every === "month" && on !== 0 && whole(on, -1, 31)))));

/** A repeat, as a field's schema, or none (null) once the date no longer repeats: what the store refuses a record for when it is neither. */
export const repeatSchema = (): z.ZodMiniType<Repeat | null> => markRepeat(z.unknown().check(z.refine((r) => r === null || validRepeat(r), "how a date repeats, or null")) as never);

const stamp = (d: string): number => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const iso = (t: number): string => new Date(t).toISOString().slice(0, 10);
const plusDays = (d: string, n: number): string => iso(stamp(d) + n * 864e5);
/** A day of a month, the month's last when it has fewer: Feb 31 is Feb 28 or 29. */
const inMonth = (year: number, month: number, date: number): string => {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return iso(Date.UTC(year, month, date < 0 || date > last ? last : date));
};

/** Whether a value is a repeat a record could keep (its shape, not every check). */
export const isRepeat = (value: unknown): value is Repeat => typeof value === "object" && value !== null && EVERY.includes((value as Repeat).every);

/**
 * THE DAYS A SERIES FALLS ON, from its first (`start`, a day or a moment),
 * on or after `from` and up to `to`, at most `limit` of them; each said as
 * the record says its date (a moment keeps its time of day). Skipped days
 * are not among them.
 */
export function occurrences(start: string, repeat: Repeat, options: { readonly from?: string; readonly to?: string; readonly limit?: number } = {}): string[] {
  const first = start.slice(0, 10);
  const time = start.slice(10);
  const out: string[] = [];
  if (!DAY.test(first)) return out;
  const n = Math.max(1, repeat.interval ?? 1);
  const every = repeat.every;
  const from = options.from && options.from > first ? options.from.slice(0, 10) : first;
  const until = [repeat.until, options.to?.slice(0, 10)].filter(Boolean).sort()[0];
  const limit = options.limit ?? 1000;
  const skip = new Set(repeat.except ?? []);
  const y = +first.slice(0, 4);
  const m = +first.slice(5, 7) - 1;
  const date = +first.slice(8, 10);
  const weekStart = plusDays(first, -new Date(stamp(first)).getUTCDay());
  const days = (repeat.on?.length ? repeat.on : [every === "week" ? WEEKDAYS[new Date(stamp(first)).getUTCDay()]! : date]).map((on) => (typeof on === "string" ? WEEKDAYS.indexOf(on as Weekday) : on));
  // Without a count, start near `from`: a daily series begun years ago is not walked day by day.
  const span = every === "day" ? 1 : every === "week" ? 7 : 0;
  const months = (+from.slice(0, 4) - y) * 12 + (+from.slice(5, 7) - 1 - m);
  let period = repeat.count ? 0 : Math.max(0, Math.floor((span ? (stamp(from) - stamp(span === 7 ? weekStart : first)) / 864e5 / span : every === "month" ? months : months / 12) / n) - 1);
  let counted = 0;
  for (let guard = 0; guard < 50_000 && out.length < limit; guard++, period++) {
    const k = period * n;
    const candidates =
      every === "day"
        ? [plusDays(first, k)]
        : every === "week"
          ? days.map((d) => plusDays(weekStart, k * 7 + d))
          : every === "month"
            ? days.map((d) => inMonth(y, m + k, d))
            : [inMonth(y + k, m, date)];
    for (const at of [...new Set(candidates)].sort()) {
      if (at < first) continue;
      if ((until && at > until) || (repeat.count && counted >= repeat.count)) return out;
      counted++;
      if (at >= from && !skip.has(at)) out.push(at + time);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * THE OCCURRENCE A DATE READS AS on a day: the first on or after it; the
 * series' last when it has ended; the date itself when it repeats nothing.
 * What a rule, a sort, a list's dates and `today()`'s neighbors read.
 */
export function nextOccurrence(start: string, repeat: unknown, today: string): string {
  if (!isRepeat(repeat) || typeof start !== "string") return start;
  const next = occurrences(start, repeat, { from: today, limit: 1 })[0];
  if (next) return next;
  const all = repeat.until || repeat.count ? occurrences(start, repeat) : [];
  return all[all.length - 1] ?? start;
}

/** A record's date as it reads on a day: the next occurrence where it repeats, else as kept. */
export function dateOn(node: Readonly<Record<string, unknown>>, field: string, today: string): unknown {
  const value = node[field];
  const repeat = node[repeatKey(field)];
  return typeof value === "string" && isRepeat(repeat) ? nextOccurrence(value, repeat, today) : value;
}
