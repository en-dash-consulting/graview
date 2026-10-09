/*
 * A DAY AS A PERSON READS IT.
 *
 * A record keeps a day as `YYYY-MM-DD`, which sorts and compares and is
 * what an edit control holds. A person reads "28 Aug 2026". Every surface
 * that says a day in words — a card's glance, a record's facts, a rule's
 * sentence, a template's `{due}` — says it here, so one problem never reads
 * "was due 2026-08-28" on the bar while its card says "28 Aug 2026".
 */

const MONTH_WORDS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** A day as the record holds it: `YYYY-MM-DD`, nothing before or after. */
export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A `YYYY-MM-DD` day as a person reads it: "28 Aug 2026". Anything else is said as it is. */
export function dayAsRead(day: string): string {
  if (!ISO_DAY.test(day)) return day;
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  const word = MONTH_WORDS[month - 1];
  return word && date >= 1 && date <= 31 ? `${date} ${word} ${year}` : day;
}

/*
 * A day standing alone in a sentence: not part of an id ("task-2026-08-28"),
 * a longer number, or a moment ("2026-08-28T09:00").
 */
const DAY_IN_TEXT = /(?<![\w-])(\d{4}-\d{2}-\d{2})(?![\w-]|:)/g;

/**
 * Every day in a sentence as a person reads it: `"Pay the deposit" was due
 * 2026-08-28` is said `"Pay the deposit" was due 28 Aug 2026`. For the
 * sentences an app writes in code — a rule's message — which the framework
 * says to people without having written them.
 */
export function daysAsRead(text: string): string {
  return text.includes("-") ? text.replace(DAY_IN_TEXT, (day) => dayAsRead(day)) : text;
}
