/*
 * A DAY OR A MOMENT, TYPED AS PEOPLE SAY IT (Roadmap f-date-inputs).
 *
 * "tomorrow 3pm", "Fri 10:30", "17 Oct", "in 2 weeks", "10/17": every
 * surface that asks for a date — a record's value changed in place, a
 * card's, an act's form on either face — reads what was typed here, so the
 * same words mean the same day everywhere. What cannot be read is refused,
 * never guessed: "sometime soon" is no day, and "31 Feb" is none either.
 *
 * WALL TIME AND INSTANTS. What is typed is a time on the reader's wall
 * (`WallTime`: a day and, with a time, minutes after midnight). A field that
 * keeps an instant — a document's `datetime` — stores it in UTC with its
 * `Z`, so a meeting set in New York is the same moment read in London; a
 * field whose own pattern takes a bare `YYYY-MM-DDTHH:MM` keeps the wall
 * time as written. Reading back (`wallOfStored`) puts an instant on the
 * reader's clock and a wall time where it was written.
 */

import { DEFAULT_LOCALE } from "./days.js";
import { addDays, dayFrom, namesInstant, utcOf, wallOfStored, weekdayOf, DAY_MS, type WallTime } from "./wall-time.js";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTH_WORD = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const WEEKDAY_WORD = "(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)";
const monthOf = (word: string): number => MONTHS.indexOf(word.slice(0, 3)) + 1;
const fullYear = (year: string | undefined): number | undefined => (year === undefined ? undefined : year.length === 2 ? 2000 + Number(year) : Number(year));

/** Whether a locale writes the month before the day in digits: 10/17 in the US, 17/10 nearly everywhere else. */
function monthFirst(locale: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }).formatToParts(0).map((part) => part.type);
    return parts.indexOf("month") < parts.indexOf("day");
  } catch {
    return true;
  }
}

/*
 * A time of day, taken out of the words: "3pm", "3:30 p.m.", "15:30", "noon",
 * "at 3". What is left is the day. An hour past what a clock shows is no
 * time ("25pm"), and the whole reading fails rather than dropping it.
 */
function timeIn(text: string): { readonly minutes?: number; readonly rest: string; readonly bad?: true } {
  const take = (match: RegExpExecArray, minutes: number) => ({ minutes, rest: `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}` });
  let match = /\b(noon|midday)\b/.exec(text);
  if (match) return take(match, 12 * 60);
  match = /\bmidnight\b/.exec(text);
  if (match) return take(match, 0);
  match = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?(?=\s|$)/.exec(text);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2] ?? 0);
    if (hour < 1 || hour > 12 || minute > 59) return { rest: text, bad: true };
    return take(match, ((hour % 12) + (match[3] === "p" ? 12 : 0)) * 60 + minute);
  }
  match = /\b(\d{1,2}):(\d{2})\b/.exec(text);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return { rest: text, bad: true };
    return take(match, hour * 60 + minute);
  }
  // "at 3" is an hour of the working day: 1 to 7 are the afternoon's.
  match = /\bat\s+(\d{1,2})\b/.exec(text);
  if (match) {
    const hour = Number(match[1]);
    if (hour > 23) return { rest: text, bad: true };
    return take(match, (hour >= 1 && hour <= 7 ? hour + 12 : hour) * 60);
  }
  const part = /\b(morning|afternoon|evening|tonight)\b/.exec(text);
  if (part) {
    const minutes = { morning: 9, afternoon: 15, evening: 18, tonight: 20 }[part[1] as "morning"] * 60;
    // "tonight" is a day as well as a time: today's.
    return { minutes, rest: part[1] === "tonight" ? `${text.slice(0, part.index)} today ${text.slice(part.index + part[0].length)}` : `${text.slice(0, part.index)} ${text.slice(part.index + part[0].length)}` };
  }
  return { rest: text };
}

/** The day the rest of the words name, from `today`; undefined when they name none, or name it in words not read here. */
function dayIn(text: string, today: string, locale: string): string | undefined | null {
  const words = text.replace(/\b(on|at|the|of|this)\b/g, " ").replace(/\s+/g, " ").trim();
  if (words === "") return null;
  if (words === "today" || words === "now") return today;
  if (words === "tomorrow" || words === "tmrw" || words === "tmr") return addDays(today, 1);
  if (words === "yesterday") return addDays(today, -1);
  if (words === "next week") return addDays(today, 7);
  let match = /^in (\d{1,3}) (day|days|week|weeks)$/.exec(words);
  if (match) return addDays(today, Number(match[1]) * (match[2]!.startsWith("week") ? 7 : 1));
  match = new RegExp(`^(next )?${WEEKDAY_WORD}$`).exec(words);
  if (match) {
    const wanted = WEEKDAYS.indexOf(match[2]!.slice(0, 3));
    const ahead = (wanted - weekdayOf(today) + 7) % 7;
    return addDays(today, match[1] && ahead === 0 ? 7 : ahead);
  }
  match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(words);
  if (match) return dayFrom(Number(match[1]), Number(match[2]), Number(match[3]));
  // A month said in words: "17 Oct", "Oct 17", "October 17th 2027", with or without its weekday.
  const bare = words.replace(new RegExp(`^${WEEKDAY_WORD} `), "");
  match = new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)? ${MONTH_WORD}(?: (\\d{4}))?$`).exec(bare);
  const said = match ? { date: match[1]!, month: match[2]!, year: match[3] } : undefined;
  match = new RegExp(`^${MONTH_WORD} (\\d{1,2})(?:st|nd|rd|th)?(?: (\\d{4}))?$`).exec(bare);
  const named = said ?? (match ? { date: match[2]!, month: match[1]!, year: match[3] } : undefined);
  if (named) return near(today, fullYear(named.year), monthOf(named.month), Number(named.date));
  // Digits in the reader's order: 10/17 in the US, 17/10 in Britain.
  match = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(bare);
  if (match) {
    const [first, second] = [Number(match[1]), Number(match[2])];
    const [month, date] = monthFirst(locale) ? [first, second] : [second, first];
    return near(today, fullYear(match[3]), month, date);
  }
  return undefined;
}

/** A day of a month: in the year said, else this year — unless that is more than half a year gone, when it is next year's. */
function near(today: string, year: number | undefined, month: number, date: number): string | undefined {
  if (year !== undefined) return dayFrom(year, month, date);
  const thisYear = Number(today.slice(0, 4));
  const day = dayFrom(thisYear, month, date);
  if (day === undefined) return dayFrom(thisYear + 1, month, date);
  return utcOf(today) - utcOf(day) > 183 * DAY_MS ? dayFrom(thisYear + 1, month, date) : day;
}

/**
 * A YEAR OR A MONTH ALONE, as typed or written in a sheet (Roadmap
 * f-partial-dates): "2006" is `2006`; "2016-05", "5/2016", "May 2016" and
 * "May, 2016" are `2016-05`. For a date that may know no more; undefined
 * for anything else, a whole day among them.
 */
export function readPartialDay(input: unknown): string | undefined {
  if (typeof input === "number") return Number.isInteger(input) && input >= 1000 && input <= 9999 ? String(input) : undefined;
  const text = String(input).trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  if (/^\d{4}$/.test(text)) return Number(text) >= 1000 ? text : undefined;
  const month = (year: string, at: number) => (at >= 1 && at <= 12 && Number(year) >= 1000 ? `${year}-${String(at).padStart(2, "0")}` : undefined);
  let match = /^(\d{4})[-/](\d{1,2})$/.exec(text);
  if (match) return month(match[1]!, Number(match[2]));
  match = /^(\d{1,2})\/(\d{4})$/.exec(text);
  if (match) return month(match[2]!, Number(match[1]));
  match = new RegExp(`^${MONTH_WORD}\\.? (\\d{4})$`).exec(text);
  if (match) return month(match[2]!, monthOf(match[1]!));
  return undefined;
}

/**
 * What a person typed, read as a day and — for a field with a time — a time
 * of day on their wall. `today` is the reader's today; `base` is what the
 * field held, so a time typed alone keeps its day and a day typed alone keeps
 * its time (else 9 in the morning). A time typed for a field that holds only
 * a day is let go. Undefined when the words name no day this can read.
 */
export function readWhenTyped(
  text: string,
  options: { readonly today: string; readonly time: boolean; readonly base?: WallTime; readonly locale?: string },
): WallTime | undefined {
  /*
   * AN INSTANT AS A RECORD KEEPS ONE, pasted whole — "2026-10-20T15:00:00Z",
   * "…-05:00" — is read on the reader's clock, as the record's value is said
   * (the twelfth walk: a screening's own editor refused the value it kept).
   */
  const whole = text.trim();
  if (namesInstant(whole)) {
    const wall = wallOfStored(whole);
    if (wall) return options.time ? wall : { day: wall.day };
  }
  // A moment as a record keeps one, pasted or typed: "2026-10-17T15:00" (its seconds, if any) is a day and a time.
  const typed = text.toLowerCase().replace(/,/g, " ").replace(/(\d{4}-\d{2}-\d{2})t(\d\d:\d\d)(:\d\d(\.\d+)?)?/, "$1 $2").replace(/\s+/g, " ").trim();
  if (typed === "") return undefined;
  const time = timeIn(typed);
  if (time.bad) return undefined;
  const day = dayIn(time.rest, options.today, options.locale ?? DEFAULT_LOCALE);
  if (day === undefined) return undefined;
  if (day === null && time.minutes === undefined) return undefined;
  const on = day ?? options.base?.day ?? options.today;
  if (!options.time) return { day: on };
  return { day: on, minutes: time.minutes ?? options.base?.minutes ?? 9 * 60 };
}
