import { appLocaleFor, dayZoneFor, instantIn, ISO_DAY, ISO_MOMENT, PARTIAL_DAY, wallIn } from "../../days.js";

/*
 * The day arithmetic `wall-time.ts` has, said again here on purpose: the
 * evaluator is in every hosted page's first load, and reaching that module
 * from it would carry the date editor's helpers up front with it.
 */
const DAY_MS = 86_400_000;
const pad = (n: number): string => String(n).padStart(2, "0");
const dayOfUtc = (stamp: number): string => new Date(stamp).toISOString().slice(0, 10);
const utcOf = (day: string): number => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const addDays = (day: string, days: number): string => dayOfUtc(utcOf(day) + days * DAY_MS);
const weekdayOf = (day: string): number => new Date(utcOf(day)).getUTCDay();
/** Whether a stored moment names an instant: it carries a `Z` or an offset after its time. */
const namesInstant = (value: string): boolean => /T\d\d:\d\d(:[\d.]+)?(Z|[+-]\d\d:?\d\d)$/.test(value);

/*
 * A DATE-TIME BUILT AND SAID BY THE RULE LANGUAGE (Roadmap
 * f-formula-text-datetime). A computed title or an act's value could add
 * words and count days, and could not say "Mon, Oct 27 · 9:30 AM" or make
 * the moment a plan item's event starts at. The arithmetic is here, on
 * what a record keeps: a day (`2026-10-27`), a month or a year alone, a
 * wall time written without a zone (`2026-10-27T09:30`), or an instant
 * (`2026-10-27T13:30:00Z`). Every answer is on the APP'S clock — its
 * `brand.timeZone`, else the zone of the app the page draws, else UTC —
 * and in the app's locale, never the reader's: a value the language builds
 * may be kept on a record, and a server and a page keep the same one.
 */

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** A moment as the language holds one: its day on the app's wall, the minutes after midnight where it has a time, and the instant where it names one. */
export interface When {
  readonly day: string;
  readonly minutes?: number;
  /** The instant, where the value named one (`…Z`, an offset): what minutes are added to. */
  readonly stamp?: number;
}

/** The zone the language reads and builds moments in: the app's, else the page's app's, else UTC. */
export const zoneOf = (timeZone: string | undefined): string => dayZoneFor(timeZone) ?? "UTC";

/**
 * A stored value as a moment, or undefined for anything that is not one. A
 * month or a year alone reads as its first day; an instant is read on the
 * app's wall; a wall time written without a zone is the time written.
 */
export function whenOf(value: string, zone: string): When | undefined {
  if (ISO_DAY.test(value)) return dayOfUtc(utcOf(value)) === value ? { day: value } : undefined;
  if (PARTIAL_DAY.test(value)) return { day: value.length === 4 ? `${value}-01-01` : `${value}-01` };
  if (ISO_MOMENT.test(value) && !namesInstant(value)) {
    const day = value.slice(0, 10);
    if (dayOfUtc(utcOf(day)) !== day) return undefined;
    return { day, minutes: Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16)) };
  }
  const stamp = Date.parse(value);
  if (Number.isNaN(stamp)) return undefined;
  return { ...wallIn(stamp, zone), stamp };
}

/* THE PATTERN `format(when, pattern)` TAKES: a closed vocabulary, so a token it does not know is a finding, never a letter said as itself. */
const TOKENS = ["EEEE", "EEE", "MMMM", "MMM", "yyyy", "HH", "mm", "h", "a", "d"] as const;
type Token = (typeof TOKENS)[number];
const LETTERS = /[A-Za-z]+/y;

/** The pattern, read: each piece a token, or words to say as they are. */
function pieces(pattern: string): (Token | { readonly text: string })[] | string {
  const out: (Token | { readonly text: string })[] = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i]!;
    if (c === "'") {
      let text = "";
      let j = i + 1;
      for (; j < pattern.length; j++) {
        if (pattern[j] === "'") {
          // Two quotes inside a quoted piece say one.
          if (pattern[j + 1] === "'") {
            text += "'";
            j++;
            continue;
          }
          break;
        }
        text += pattern[j];
      }
      if (j >= pattern.length) return `the quoted words in "${pattern}" are never closed`;
      out.push({ text });
      i = j + 1;
      continue;
    }
    LETTERS.lastIndex = i;
    const run = LETTERS.exec(pattern);
    if (run) {
      let rest = run[0];
      while (rest.length > 0) {
        const token = TOKENS.find((t) => rest.startsWith(t));
        if (!token) return `"${rest}" is not a piece of a date pattern; the pieces are ${TOKENS.map((t) => `${t}`).join(", ")}, and other words go in single quotes`;
        out.push(token);
        rest = rest.slice(token.length);
      }
      i += run[0].length;
      continue;
    }
    out.push({ text: c });
    i++;
  }
  return out;
}

/** Why a pattern cannot be said, as a sentence, or undefined when it can. What `graview check` says of a `format(…)`. */
export function patternProblem(pattern: string): string | undefined {
  const read = pieces(pattern);
  return typeof read === "string" ? read : undefined;
}

const TIME_PIECES: ReadonlySet<string> = new Set(["HH", "mm", "h", "a"]);

/** Whether a pattern asks for a time of day — which a day alone has none of. */
export function patternHasTime(pattern: string): boolean {
  const read = pieces(pattern);
  return typeof read !== "string" && read.some((piece) => typeof piece === "string" && TIME_PIECES.has(piece));
}

const UTC = "UTC";
const formats = new Map<string, Intl.DateTimeFormat>();
function intl(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat(locale, { ...options, timeZone: UTC });
    } catch {
      format = new Intl.DateTimeFormat("en-US", { ...options, timeZone: UTC });
    }
    formats.set(key, format);
  }
  return format;
}
const part = (locale: string, options: Intl.DateTimeFormatOptions, stamp: number, type: string): string =>
  intl(locale, options).formatToParts(stamp).find((one) => one.type === type)?.value ?? "";

/**
 * A moment said by a pattern, in the app's locale: weekday and month
 * names as the locale says them, the rest in figures. A day with no time
 * says nothing for a time piece.
 */
export function formatWhen(when: When, pattern: string, locale: string | undefined): string | { readonly problem: string } {
  const read = pieces(pattern);
  if (typeof read === "string") return { problem: read };
  const said = appLocaleFor(locale);
  const dayStamp = utcOf(when.day);
  const minutes = when.minutes;
  const timeStamp = minutes === undefined ? undefined : dayStamp + minutes * 60_000;
  return read
    .map((piece) => {
      if (typeof piece !== "string") return piece.text;
      switch (piece) {
        case "EEEE":
          return part(said, { weekday: "long" }, dayStamp, "weekday");
        case "EEE":
          return part(said, { weekday: "short" }, dayStamp, "weekday");
        case "MMMM":
          return part(said, { month: "long" }, dayStamp, "month");
        case "MMM":
          return part(said, { month: "short" }, dayStamp, "month");
        case "yyyy":
          return when.day.slice(0, 4);
        case "d":
          return String(Number(when.day.slice(8, 10)));
        case "HH":
          return minutes === undefined ? "" : pad(Math.floor(minutes / 60));
        case "mm":
          return minutes === undefined ? "" : pad(minutes % 60);
        case "h":
          return minutes === undefined ? "" : String(((Math.floor(minutes / 60) + 11) % 12) + 1);
        case "a":
          return timeStamp === undefined ? "" : part(said, { hour: "numeric", hour12: true }, timeStamp, "dayPeriod");
      }
    })
    .join("");
}

const TIME_OF_DAY = /^(\d{1,2}):(\d{2})$/;

/** A time of day written `HH:MM` as minutes after midnight; undefined for anything else. */
export function minutesOfTime(time: string): number | undefined {
  const match = TIME_OF_DAY.exec(time.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : undefined;
}

/** An instant as a datetime field keeps one: in UTC, to the second. */
const instantSaid = (stamp: number): string => new Date(stamp).toISOString().replace(/\.\d{3}Z$/, "Z");

/** A moment on the app's wall, as the field keeps a wall time written without a zone. */
const wallSaid = (day: string, minutes: number): string => `${day}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/**
 * The moment a day reaches at a time on the app's wall — `datetime(due,
 * '09:30')` — as an instant: 9:30 in New York is 13:30Z in summer and
 * 14:30Z in winter, and the day the clock springs forward has no 02:30, so
 * the time written then lands on the clock's next reading of it.
 */
export function datetimeAt(when: When, minutes: number, zone: string): string {
  return instantSaid(instantIn(when.day, minutes, zone));
}

/**
 * A moment some minutes later (earlier, for a negative count). An instant
 * stays an instant, so ninety minutes across a change of the clock are
 * ninety minutes; a wall time stays a wall time; a day with no time becomes
 * the wall time that many minutes after its midnight.
 */
export function addMinutesTo(when: When, count: number): string {
  if (when.stamp !== undefined) return instantSaid(when.stamp + count * 60_000);
  const stamp = utcOf(when.day) + (when.minutes ?? 0) * 60_000 + count * 60_000;
  const day = dayOfUtc(stamp);
  return wallSaid(day, Math.round((stamp - utcOf(day)) / 60_000));
}

/** The day of the week a moment falls on, on the app's wall: `mon` to `sun`. */
export const weekdayOfWhen = (when: When): Weekday => WEEKDAYS[weekdayOf(when.day)]!;

/** The day a moment's week starts on — the last `first` (`mon` unless said) at or before it — as a day. */
export function startOfWeekOf(when: When, first: Weekday): string {
  const back = (weekdayOf(when.day) - WEEKDAYS.indexOf(first) + 7) % 7;
  return addDays(when.day, -back);
}

/** Whether a word names a weekday as the language says them. */
export const isWeekday = (value: unknown): value is Weekday => typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value);
