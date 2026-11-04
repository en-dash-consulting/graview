/*
 * HOW FAR A DAY IS FROM TODAY, AS A VIEW SAYS IT (Roadmap f-views-know-today).
 *
 * A chat's home view hard-coded `TODAY = "2026-11-01"` and "Tomorrow · Mon 2
 * Nov", so the day after it was written it said tomorrow was today, and
 * nothing told the agent that added records. A view is now handed the app's
 * today (`props.today`, `graview.today`), and says a day against it in the
 * framework's words: "today", "tomorrow", "yesterday", "in 3 days", "2 weeks
 * ago" — the words a record's page says a day in — and, for a day something
 * is due, "overdue" once it has passed.
 *
 * Written here, without the framework, because it goes into the worker's
 * runtime, which carries nothing of `@graview/core`.
 */

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The whole days from `today` to `day`, both `YYYY-MM-DD`: negative when `day` is past. Undefined for anything else. */
export function daysFromToday(day: string, today: string): number | undefined {
  if (typeof day !== "string" || typeof today !== "string" || !ISO_DAY.test(day) || !ISO_DAY.test(today)) return undefined;
  const days = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  return Number.isFinite(days) ? days : undefined;
}

/**
 * A day said against today: "today", "tomorrow", "yesterday", "in 3 days",
 * "in 2 weeks", "3 days ago". With `due`, a day already past is "overdue".
 * Empty for anything that names no day.
 */
export function fromToday(day: string, today: string, options: { readonly due?: boolean } = {}): string {
  const days = daysFromToday(day, today);
  if (days === undefined) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 0 && options.due === true) return "overdue";
  if (days === -1) return "yesterday";
  const far = Math.abs(days);
  const [count, unit] = far < 14 ? [far, "day"] : far < 60 ? [Math.round(far / 7), "week"] : far < 730 ? [Math.round(far / 30.44), "month"] : [Math.round(far / 365.25), "year"];
  const said = `${count} ${unit}${count === 1 ? "" : "s"}`;
  return days > 0 ? `in ${said}` : `${said} ago`;
}

/** The day a stored day or moment falls on in `timeZone`: a day as it is, an instant on the app's clock. */
export function dayIn(stored: string, timeZone?: string): string | undefined {
  if (typeof stored !== "string") return undefined;
  if (ISO_DAY.test(stored)) return stored;
  const at = Date.parse(stored);
  if (!Number.isFinite(at)) return undefined;
  /* A wall time kept without a zone is said as it was written. */
  if (!/(Z|[+-]\d\d:?\d\d)$/.test(stored)) return ISO_DAY.test(stored.slice(0, 10)) ? stored.slice(0, 10) : undefined;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
    const part = (type: string) => parts.find((one) => one.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
}
