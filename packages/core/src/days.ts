/*
 * A DAY, A TIME AND A NUMBER AS A PERSON READS THEM (FR-178).
 *
 * A record keeps a day as `YYYY-MM-DD` and a moment as `YYYY-MM-DDTHH:MM`,
 * which sort and compare and are what an edit control holds. A person reads
 * them the way their own country writes them: in the United States "Sep 10,
 * 2023", "3:30 PM" and "1,250"; in Britain "10 Sep 2023", "15:30" and
 * "1,250"; in Germany "10. Sept. 2023", "15:30" and "1.250". Every surface
 * that says a day, a time or a number in words — a card's glance, a record's
 * facts, a rule's sentence, a template's `{due}`, the calendar, the seat —
 * says it here, through `Intl` with the locale it is said for, so one problem
 * never reads "was due 2026-08-28" on the bar while its card says "Aug 28,
 * 2026", and no surface puts the day first in an app written for the US.
 *
 * WHICH LOCALE. The reader's, when the host that mounted the app passed one
 * (`locale` on the provider, the embed, the pages face); else the app's own,
 * `brand.locale` beside the currency its sums are said in; else "en-US".
 * The framework's own words are English whatever the locale: what changes
 * is the order and the punctuation of days, times and figures, not the
 * sentences around them.
 */

/** What days, times and numbers are said in when neither the reader nor the app says. */
export const DEFAULT_LOCALE = "en-US";

/** A day as the record holds it: `YYYY-MM-DD`, nothing before or after. */
export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A moment as the record holds it: a day, a `T` or a space, and a time of day, with or without seconds and a zone. */
export const ISO_MOMENT = /^\d{4}(-\d\d){2}[T ]\d\d:\d\d(:[\d.]+)?(Z|[+-][\d:]+)?$/;

/**
 * A document's date and time: any moment `Date` reads. A compiled field
 * checks with this one function, so it reads back as a `datetime` where a
 * face asks which fields are dates (`fieldOf`): a kind's stop, its calendar.
 */
export const isMoment = (s: string): boolean => !Number.isNaN(Date.parse(s));

/** Today as a record keeps a day, by the clock's UTC date: what a rule, a template and a label read as today(). */
export const isoToday = (): string => new Date().toISOString().slice(0, 10);

/*
 * THE PAGE'S LOCALES. A label is a function of a node and nothing else, and
 * the Scene, a glance and an invariant's message are said far from any
 * context a locale could ride on, so the two locales a page draws in are
 * held here: the reader's, which a host passes and which wins, and the
 * app's, which the provider sets from the brand it draws. A function handed
 * a locale of its own (a compiled document's labels, a block, a template)
 * passes it as the app's: the reader's still wins over it.
 */
let readers: string | undefined;
let drawn: string | undefined;

/**
 * Say days, times and numbers on this page in a reader's locale and an
 * app's (FR-178). Either may be left out. Every provider says it as it
 * draws, before anything under it does, so the page says what the app
 * drawn last says.
 */
export function sayIn(locales: { readonly reader?: string | undefined; readonly app?: string | undefined }): void {
  readers = usable(locales.reader);
  drawn = usable(locales.app);
}

/** The locale a value is said in: the reader's when a host passed one, else the app's (`app`, else the page's), else en-US. */
export const localeFor = (app?: string): string => readers ?? usable(app) ?? drawn ?? DEFAULT_LOCALE;

/*
 * A formatter is costly to make and cheap to use, and a page says thousands
 * of days: each is made once per locale and shape, and whether the runtime
 * can say anything in a locale is asked once — a tag `Intl` refuses is said
 * in en-US, never a thrown page.
 */
const made = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | boolean>();

function usable(locale: string | undefined): string | undefined {
  if (locale && !made.has(locale)) {
    let ok = false;
    try {
      ok = Intl.DateTimeFormat.supportedLocalesOf(locale).length > 0;
    } catch {}
    made.set(locale, ok);
  }
  return locale && made.get(locale) ? locale : undefined;
}

/*
 * Said through `Intl`. Some runtimes' ICU put a narrow no-break space before
 * "PM" and others a plain one; the words are the same in every browser, in
 * Node and to a model, so the space is a space.
 */
function said(at: number, options: Intl.DateTimeFormatOptions & Intl.NumberFormatOptions, locale: string | undefined, number?: boolean): string {
  const key = `${(locale = localeFor(locale))}${number ? "#" : "@"}${JSON.stringify(options)}`;
  let format = made.get(key) as Intl.DateTimeFormat | Intl.NumberFormat | undefined;
  if (!format) made.set(key, (format = number ? new Intl.NumberFormat(locale, options) : new Intl.DateTimeFormat(locale, options)));
  return format.format(at).replace(/ /g, " ");
}

const UTC = "UTC";
const stampOf = (day: string): number => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));

/** A `YYYY-MM-DD` day as a person reads it: "Aug 28, 2026" in en-US, "28 Aug 2026" in en-GB. Anything else is said as it is. */
export function dayAsRead(day: string, locale?: string): string {
  return ISO_DAY.test(day) ? said(stampOf(day), { year: "numeric", month: "short", day: "numeric", timeZone: UTC }, locale) : day;
}

/*
 * A moment written with a zone ("…Z", "…+02:00") names an instant, said on
 * the reader's clock; written without one, it is the time on the wall it
 * was written for, said as written.
 */
function moment(at: string, options: Intl.DateTimeFormatOptions, locale: string | undefined, zone = false): string {
  if (!ISO_MOMENT.test(at)) return at;
  const zoned = /[Z+-][\d:]*$/.test(at.slice(16));
  const stamp = Date.parse(at.replace(" ", "T") + (zoned ? "" : "Z"));
  return Number.isNaN(stamp) ? at : said(stamp, { ...options, hour: "numeric", minute: "2-digit", ...(zoned ? (zone ? { timeZoneName: "short" } : {}) : { timeZone: UTC }) }, locale);
}

/**
 * A moment as a person reads it: "Sep 10, 2023, 3:30 PM" (en-US), "10 Sep
 * 2023, 15:30" (en-GB). An instant is said on the reader's clock with the
 * zone it is said in — "Oct 17, 2026, 3:00 PM EDT" — since the same words
 * name another moment to a reader elsewhere (Roadmap f-date-inputs).
 * Anything else is said as it is.
 */
export const momentAsRead = (at: string, locale?: string): string => moment(at, { year: "numeric", month: "short", day: "numeric" }, locale, true);

/** A moment's time of day: "3:30 PM" (en-US), "15:30" (en-GB). Anything that is not a moment is said as it is. */
export const timeAsRead = (at: string, locale?: string): string => moment(at, {}, locale);

/** A number as a person reads it: "1,250" (en-US), "1.250" (de-DE), at most two places after the point unless told. */
export function numberAsRead(value: number, locale?: string, options: Intl.NumberFormatOptions = { maximumFractionDigits: 2 }): string {
  return Number.isFinite(value) ? said(value, options, locale, true) : String(value);
}

/** A day or a moment as it is read; anything else as it is. */
export const whenAsRead = (value: string, locale?: string): string => (ISO_DAY.test(value) ? dayAsRead(value, locale) : momentAsRead(value, locale));

/**
 * A day with its weekday: "Thursday, Sep 17" (en-US), "Thursday 17 Sep"
 * (en-GB); with its year when asked, and the weekday short when asked.
 */
export function weekdayAsRead(day: string, options: { readonly year?: boolean; readonly weekday?: "long" | "short" } = {}, locale?: string): string {
  return ISO_DAY.test(day) ? said(stampOf(day), { weekday: options.weekday ?? "long", month: "short", day: "numeric", ...(options.year ? { year: "numeric" } : {}), timeZone: UTC }, locale) : day;
}

/** A day of a month without its year or weekday: "Sep 17" (en-US), "17 Sep" (en-GB). */
export function dayOfMonthAsRead(day: string, locale?: string): string {
  return ISO_DAY.test(day) ? said(stampOf(day), { month: "short", day: "numeric", timeZone: UTC }, locale) : day;
}

/** A month: "September 2026"; with `short`, "Sep" and, with `year`, "Sep 26". */
export function monthAsRead(day: string, options: { readonly short?: boolean; readonly year?: boolean } = {}, locale?: string): string {
  if (!/^\d{4}-\d{2}/.test(day)) return day;
  const year = options.year ?? !options.short;
  return said(stampOf(`${day.slice(0, 7)}-01`), { month: options.short ? "short" : "long", ...(year ? { year: options.short ? "2-digit" : "numeric" } : {}), timeZone: UTC }, locale);
}

/** A weekday alone, from 0 for Sunday: "Mon" short, "Monday" long. */
export const weekdayName = (weekday: number, width: "short" | "long" = "short", locale?: string): string =>
  // 4 January 1970 was a Sunday.
  said(Date.UTC(1970, 0, 4 + weekday), { weekday: width, timeZone: UTC }, locale);

/** A time of day from minutes after midnight: "3:30 PM" (en-US), "15:30" (en-GB). */
export const minutesAsRead = (minutes: number, locale?: string): string =>
  said(Date.UTC(1970, 0, 1, 0, Math.round(minutes)), { hour: "numeric", minute: "2-digit", timeZone: UTC }, locale);

/*
 * A day standing alone in a sentence: not part of an id ("task-2026-08-28"),
 * a longer number, or a moment ("2026-08-28T09:00").
 */
const DAY_IN_TEXT = /(?<![\w-])(\d{4}-\d{2}-\d{2})(?![\w-]|:)/g;

/**
 * Every day in a sentence as a person reads it: `"Pay the deposit" was due
 * 2026-08-28` is said `"Pay the deposit" was due Aug 28, 2026`. For the
 * sentences an app writes in code — a rule's message — which the framework
 * says to people without having written them.
 */
export function daysAsRead(text: string, locale?: string): string {
  return text.includes("-") ? text.replace(DAY_IN_TEXT, (day) => dayAsRead(day, locale)) : text;
}
