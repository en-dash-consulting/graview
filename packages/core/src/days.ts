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
 *
 * WHICH ZONE (Roadmap f-app-time-zone). A moment kept as an instant
 * ("…Z", "…-04:00") is said on a clock: the person's, when the host that
 * mounted the app passed their zone (`timeZone` on the provider, the embed,
 * the pages face); else the app's, `brand.timeZone`, so a practice in New
 * York says "10:47 AM" to its staff and from a server on UTC alike; else
 * the runtime's own clock. A wall time kept without a zone is said as it
 * was written, whatever the zone.
 */

/** What days, times and numbers are said in when neither the reader nor the app says. */
export const DEFAULT_LOCALE = "en-US";

/** A day as the record holds it: `YYYY-MM-DD`, nothing before or after. */
export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A DATE THAT KNOWS ONLY ITS YEAR OR ITS MONTH (Roadmap f-partial-dates):
 * `2006`, `2016-05`. History often knows no more, and `2006-01-01` would
 * claim a day nobody knows. Sorted as written, a year comes before the
 * months and days within it, and a month before its days.
 */
export const PARTIAL_DAY = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/;

/** What a document's date holds: a day, a month (`2016-05`) or a year (`2006`) alone. */
export const DATE_VALUE = /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-\d{2})?)?$/;

/**
 * THE DAYS A DATE COVERS (Roadmap f-partial-dates-arithmetic): a day is
 * itself; a month alone (`2016-05`) runs from its first day to its last; a
 * year alone (`2006`) from January 1 to December 31. Undefined for anything
 * that is not a day, a month or a year. A rule compares a date that knows
 * only its year or its month by this span — before or after only when the
 * whole span is, equal when the spans are — and the calendar draws a month
 * alone across it.
 */
export function daySpanOf(value: string): { readonly from: string; readonly to: string } | undefined {
  if (ISO_DAY.test(value)) return { from: value, to: value };
  if (!PARTIAL_DAY.test(value)) return undefined;
  if (value.length === 4) return { from: `${value}-01-01`, to: `${value}-12-31` };
  const last = new Date(Date.UTC(+value.slice(0, 4), +value.slice(5, 7), 0)).getUTCDate();
  return { from: `${value}-01`, to: `${value}-${String(last).padStart(2, "0")}` };
}

/** A moment as the record holds it: a day, a `T` or a space, and a time of day, with or without seconds and a zone. */
export const ISO_MOMENT = /^\d{4}(-\d\d){2}[T ]\d\d:\d\d(:[\d.]+)?(Z|[+-][\d:]+)?$/;

/**
 * A document's date and time: any moment `Date` reads. A compiled field
 * checks with this one function, so it reads back as a `datetime` where a
 * face asks which fields are dates (`fieldOf`): a kind's stop, its calendar.
 */
export const isMoment = (s: string): boolean => !Number.isNaN(Date.parse(s));

/**
 * TODAY AS A RECORD KEEPS A DAY: what a rule, a computed field, a template
 * and a label read as today() (Roadmap f-app-time-zone). The date in the
 * app's zone — `timeZone`, the app's `brand.timeZone` where the caller
 * holds it, else the zone of the app this page draws (`sayIn`'s
 * `appTimeZone`) — else the UTC date, as before an app could say one.
 * Never the reader's zone and never the runtime's: a server and a page
 * read the same day for the same app, and it turns at the app's midnight.
 * `at` is the instant asked about; now when unsaid.
 */
export const isoToday = (timeZone?: string, at: number = Date.now()): string => {
  const zone = dayZoneFor(timeZone);
  return zone ? wallIn(at, zone).day : new Date(at).toISOString().slice(0, 10);
};

/** The zone today() turns in: the app's (`app`, else the page's), never the reader's. Undefined is UTC. */
export const dayZoneFor = (app?: string): string | undefined => usableZone(app) ?? drawnZone;

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
let readersZone: string | undefined;
let drawnZone: string | undefined;

/** What a page says days, times and numbers in: a reader's locale and zone, and an app's. */
export interface Saying {
  readonly reader?: string | undefined;
  readonly app?: string | undefined;
  /** The person's time zone, which a host passed: wins over the app's. */
  readonly readerTimeZone?: string | undefined;
  /** The app's time zone, `brand.timeZone`. */
  readonly appTimeZone?: string | undefined;
}

/**
 * Say days, times and numbers on this page in a reader's locale and zone
 * and an app's (FR-178, Roadmap f-app-time-zone). Any may be left out.
 * Every provider says it as it draws, before anything under it does, so
 * the page says what the app drawn last says.
 */
export function sayIn(saying: Saying): void {
  readers = usable(saying.reader);
  drawn = usable(saying.app);
  readersZone = usableZone(saying.readerTimeZone);
  drawnZone = usableZone(saying.appTimeZone);
}

/**
 * Say what `run` says in an app's locale and zone, and give the page's back
 * after: for a host that answers for an app away from any page — an agent's
 * act, a server's reply — where no provider drew. What the call leaves out
 * stays as the page had it, and a reader's a host passed still wins.
 */
export function sayingIn<T>(saying: Saying, run: () => T): T {
  const was = [readers, drawn, readersZone, drawnZone] as const;
  if (saying.reader !== undefined) readers = usable(saying.reader);
  if (saying.app !== undefined) drawn = usable(saying.app);
  if (saying.readerTimeZone !== undefined) readersZone = usableZone(saying.readerTimeZone);
  if (saying.appTimeZone !== undefined) drawnZone = usableZone(saying.appTimeZone);
  try {
    return run();
  } finally {
    [readers, drawn, readersZone, drawnZone] = was;
  }
}

/** The locale a value is said in: the reader's when a host passed one, else the app's (`app`, else the page's), else en-US. */
export const localeFor = (app?: string): string => readers ?? usable(app) ?? drawn ?? DEFAULT_LOCALE;

/** The zone an instant is said in, when somebody said one: the person's, else the app's (`app`, else the page's). Undefined is the runtime's clock. */
export const zoneFor = (app?: string): string | undefined => readersZone ?? usableZone(app) ?? drawnZone;

/** The zone an instant is said in, by name: as `zoneFor`, else the runtime's own ("America/New_York"). What a view is handed. */
export const timeZoneFor = (app?: string): string => zoneFor(app) ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

/** An offset written where a zone was asked for: "+05:00", "-4". */
const OFFSET = /^\s*([+\-−]|\d)/;

/**
 * Why a time zone cannot be said in, as a sentence, or undefined when it
 * can: an IANA name the runtime knows ("America/New_York", "Europe/London",
 * "UTC"). An offset ("+05:00") is refused too, since it keeps no summer
 * time. What `graview check`, a document's checker and `set-brand` say.
 */
export function timeZoneProblem(zone: string): string | undefined {
  if (OFFSET.test(zone)) return `"${zone}" is an offset, not a time zone, so its clock would not change for summer time.`;
  return usableZone(zone) ? undefined : `"${zone}" is not a time zone, so its times could not be said on its clock.`;
}

/** The fix said beside a time zone refused. */
export const TIME_ZONE_FIX = 'Use an IANA time zone, like "America/New_York", "Europe/London" or "UTC".';

const zones = new Map<string, boolean>();

/* A zone `Intl` refuses, or an offset, is said on the runtime's clock: never a thrown page. */
function usableZone(zone: string | undefined): string | undefined {
  if (zone && !zones.has(zone)) {
    let ok = false;
    try {
      new Intl.DateTimeFormat(DEFAULT_LOCALE, { timeZone: zone });
      ok = !OFFSET.test(zone);
    } catch {}
    zones.set(zone, ok);
  }
  return zone && zones.get(zone) ? zone : undefined;
}

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

/**
 * A `YYYY-MM-DD` day as a person reads it: "Aug 28, 2026" in en-US, "28 Aug
 * 2026" in en-GB; a month alone (`2016-05`) as "May 2016", a year alone as
 * itself. Anything else is said as it is.
 */
export function dayAsRead(day: string, locale?: string): string {
  if (PARTIAL_DAY.test(day)) return day.length === 4 ? day : monthAsRead(day, {}, locale);
  return ISO_DAY.test(day) ? said(stampOf(day), { year: "numeric", month: "short", day: "numeric", timeZone: UTC }, locale) : day;
}

/**
 * An instant as a wall time in a zone (the runtime's clock when none): its
 * day and the minutes after midnight there. What the date editor, the day
 * of an instant and the calendar read an instant as.
 */
export function wallIn(stamp: number, zone?: string): { readonly day: string; readonly minutes: number } {
  const key = `wall@${zone ?? ""}`;
  let format = made.get(key) as Intl.DateTimeFormat | undefined;
  if (!format) made.set(key, (format = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...(zone ? { timeZone: zone } : {}) })));
  const part = Object.fromEntries(format.formatToParts(stamp).map((one) => [one.type, one.value]));
  return { day: `${part["year"]}-${part["month"]}-${part["day"]}`, minutes: (Number(part["hour"]) % 24) * 60 + Number(part["minute"]) };
}

/** The instant a wall time in a zone names (the runtime's clock when none), `wallIn` backwards. */
export function instantIn(day: string, minutes: number, zone?: string): number {
  const wall = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), 0, minutes);
  // How far the zone's clock is ahead of UTC at an instant; asked twice, so a wall time beside a change of the clock lands on the right side of it.
  const ahead = (stamp: number) => {
    const there = wallIn(stamp, zone);
    return utcStampOf(there.day, there.minutes) - Math.floor(stamp / 60_000) * 60_000;
  };
  return wall - ahead(wall - ahead(wall));
}

const utcStampOf = (day: string, minutes: number): number => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), 0, minutes);

/*
 * A moment written with a zone ("…Z", "…+02:00") names an instant, said on
 * the person's clock, else the app's, else the runtime's (`zoneFor`);
 * written without one, it is the time on the wall it was written for, said
 * as written.
 */
const namesZone = (at: string): boolean => /[Z+-][\d:]*$/.test(at.slice(16));

function moment(at: string, options: Intl.DateTimeFormatOptions, locale: string | undefined, timeZone: string | undefined, named = false): string {
  if (!ISO_MOMENT.test(at)) return at;
  const zoned = namesZone(at);
  const stamp = Date.parse(at.replace(" ", "T") + (zoned ? "" : "Z"));
  if (Number.isNaN(stamp)) return at;
  const zone = zoned ? zoneFor(timeZone) : UTC;
  return said(stamp, { ...options, hour: "numeric", minute: "2-digit", ...(zoned && named ? { timeZoneName: "short" } : {}), ...(zone ? { timeZone: zone } : {}) }, locale);
}

/**
 * A moment as a person reads it: "Sep 10, 2023, 3:30 PM" (en-US), "10 Sep
 * 2023, 15:30" (en-GB). An instant is said on the person's clock, else the
 * app's (`timeZone`, else the page's), with the zone it is said in — "Oct
 * 17, 2026, 3:00 PM EDT" — since the same words name another moment to a
 * reader elsewhere (Roadmap f-date-inputs, f-app-time-zone). Anything else
 * is said as it is.
 */
export const momentAsRead = (at: string, locale?: string, timeZone?: string): string => moment(at, { year: "numeric", month: "short", day: "numeric" }, locale, timeZone, true);

/** A moment's time of day: "3:30 PM" (en-US), "15:30" (en-GB), an instant on the clock `momentAsRead` says it on. Anything that is not a moment is said as it is. */
export const timeAsRead = (at: string, locale?: string, timeZone?: string): string => moment(at, {}, locale, timeZone);

/** The day a moment falls on: an instant's on the clock it is said on, a wall time's as written; a day is itself. Undefined for anything else. */
export function dayOfMoment(at: string, timeZone?: string): string | undefined {
  if (ISO_DAY.test(at)) return at;
  if (!ISO_MOMENT.test(at)) return undefined;
  if (!namesZone(at)) return at.slice(0, 10);
  const stamp = Date.parse(at.replace(" ", "T"));
  return Number.isNaN(stamp) ? undefined : wallIn(stamp, zoneFor(timeZone)).day;
}

/** A number as a person reads it: "1,250" (en-US), "1.250" (de-DE), at most two places after the point unless told. */
export function numberAsRead(value: number, locale?: string, options: Intl.NumberFormatOptions = { maximumFractionDigits: 2 }): string {
  return Number.isFinite(value) ? said(value, options, locale, true) : String(value);
}

/** A day or a moment as it is read; anything else as it is. */
export const whenAsRead = (value: string, locale?: string, timeZone?: string): string => (DATE_VALUE.test(value) ? dayAsRead(value, locale) : momentAsRead(value, locale, timeZone));

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
