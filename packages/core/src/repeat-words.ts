import { dayAsRead, dayOfMonthAsRead, ISO_MOMENT, isoToday, timeAsRead, weekdayName } from "./days.js";
import { isRepeat, nextOccurrence, WEEKDAYS, type Repeat } from "./repeat.js";

/*
 * A REPEAT AS A PERSON READS IT: "Every Tuesday, next Oct 27", "Every other
 * week on Monday and Thursday at 6:00 PM, until Dec 15, 2026, next Oct 22",
 * "Every month on the last day". Days, times and weekdays are said in the
 * locale (FR-178); the sentence around them is the framework's English.
 * Fetched with what says a record in words (`@graview/core/words`), never
 * with a page's first chunk.
 */

const ORDINAL = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const UNITS = { day: "day", week: "week", month: "month", year: "year" } as const;

/** And between the last two: "Monday, Wednesday and Friday". */
const listed = (words: readonly string[]) => (words.length < 2 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`);

/** How a date repeats, without the next one: "Every Tuesday", "Every 2 months on the 15th", "Every year on Feb 29". */
export function repeatAsRead(start: string, repeat: Repeat, locale?: string): string {
  const n = repeat.interval ?? 1;
  const unit = UNITS[repeat.every];
  const day = start.slice(0, 10);
  const every = n === 1 ? `Every ${unit}` : n === 2 ? `Every other ${unit}` : `Every ${n} ${unit}s`;
  let said: string;
  if (repeat.every === "week") {
    const days = (repeat.on?.length ? repeat.on : [WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]!]).map((on) => weekdayName(WEEKDAYS.indexOf(on as never), "long", locale));
    said = n === 1 ? `Every ${listed(days)}` : n === 2 ? `Every other ${listed(days)}` : `${every} on ${listed(days)}`;
  } else if (repeat.every === "month") {
    const days = (repeat.on?.length ? repeat.on : [+day.slice(8, 10)]).map((on) => (on === -1 ? "the last day" : `the ${ORDINAL(Number(on))}`));
    said = `${every} on ${listed(days)}`;
  } else if (repeat.every === "year") said = `${every} on ${dayOfMonthAsRead(day, locale)}`;
  else said = every;
  if (ISO_MOMENT.test(start)) said += ` at ${timeAsRead(start, locale)}`;
  if (repeat.until) said += `, until ${dayAsRead(repeat.until, locale)}`;
  if (repeat.count) said += `, ${repeat.count === 1 ? "once" : `${repeat.count} times`}`;
  return said;
}

/**
 * A repeating date as a record says it: how it repeats and the next one —
 * "Every Tuesday, next Oct 27" — or, once it has ended, its last. A date
 * that repeats nothing is said as `undefined`, for the caller to say its way.
 */
export function repeatingDateAsRead(start: string, repeat: unknown, options: { readonly today?: string; readonly locale?: string | undefined } = {}): string | undefined {
  if (!isRepeat(repeat) || typeof start !== "string") return undefined;
  const today = options.today ?? isoToday();
  const next = nextOccurrence(start, repeat, today);
  const how = repeatAsRead(start, repeat, options.locale);
  const when = next.slice(0, 4) === today.slice(0, 4) ? dayOfMonthAsRead(next.slice(0, 10), options.locale) : dayAsRead(next.slice(0, 10), options.locale);
  return next.slice(0, 10) < today ? `${how}, last ${when}` : `${how}, next ${when}`;
}
