/*
 * A VIEW THAT PINS TODAY (Roadmap f-views-know-today).
 *
 * A chat added records to a Cloud app, every act succeeded, and the app's
 * home went on saying the day before: its view held `TODAY = "2026-11-01"`,
 * "Tomorrow · Mon 2 Nov" and "due Fri 30 Oct" as written text. Nothing
 * told the agent its home was now wrong, so it said it was done. This
 * reads a view's source for what pins a day — a date given to a name that
 * means today, day words beside a written date, and a written date already
 * past — and says each in a sentence against the app's today, so a check,
 * an act's answer and a headless run can carry it.
 *
 * Read from the source's text alone: a date the view works out from
 * `graview.today` is never written in it, so it is never said.
 */
import { weekdayAsRead } from "../days.js";
import { addDays } from "../wall-time.js";

/** One thing in a view's source that pins a day, and the sentence that says so. */
export interface PinnedDate {
  /** Where in the source: `source line 12`. */
  readonly at: string;
  /** The words as the source writes them: `TODAY = "2026-11-01"`, `Tomorrow · Mon 2 Nov`, `due Fri 30 Oct`. */
  readonly phrase: string;
  /** `today`, a date given to a name that means today; `day-words`, today's words beside a written date; `past`, a written date already gone by. */
  readonly why: "today" | "day-words" | "past";
  /** "Home may be out of date: it says “Tomorrow · Mon 2 Nov” and today is Wed, Nov 4. Read today from graview instead." */
  readonly says: string;
}

export interface DatesPinnedOptions {
  /** The app's today, `YYYY-MM-DD` (`store.today() ?? isoToday()`). */
  readonly today: string;
  /** What the view is called in the sentence: its place's title ("Home"). "This view" when unsaid. */
  readonly title?: string;
  /** The locale today is said in. The app's when unsaid. */
  readonly locale?: string;
  /** How many days back a written date counts as pinning today: 31 by default, so a founding year or a launch long gone is not one. */
  readonly pastDays?: number;
}

const WEEKDAY = String.raw`(?:Mon(?:day)?|Tue(?:s(?:day)?)?|Wed(?:nesday)?|Thu(?:r(?:s(?:day)?)?)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\.?`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?`;
const ORDINAL = String.raw`(?:st|nd|rd|th)?`;
/** A written date: `2026-11-01`, `Mon 2 Nov`, `2 November 2026`, `Fri, Oct 30`, `Nov 2, 2026`. */
const DATES: readonly RegExp[] = [
  /\b(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})\b/g,
  new RegExp(String.raw`\b(?:${WEEKDAY},?\s+)?(?<day>\d{1,2})${ORDINAL}\s+(?<name>${MONTH})(?![a-z])(?:,?\s+(?<year>\d{4})\b)?`, "g"),
  new RegExp(String.raw`\b(?:${WEEKDAY},?\s+)?(?<name>${MONTH})\s+(?<day>\d{1,2})${ORDINAL}(?!\d)\b(?:,?\s+(?<year>\d{4})\b)?`, "g"),
];
/** A name that means today: `TODAY`, `today`, `now`, `currentDay`, `CURRENT_DATE`. */
const TODAY_NAME = /^(?:.*today.*|now|current_?(?:day|date))$/i;
/** A date given to a name: `const TODAY = "2026-11-01"`, `today: "2026-11-01"`, `now = new Date("2026-11-01")`. */
const ASSIGNED = /\b([A-Za-z_$][\w$]*)\s*[:=]\s*(?:new\s+Date\(\s*)?(["'`])(\d{4}-\d{2}-\d{2})[^"'`\n]*\2/g;
const DAY_WORD = String.raw`(?:today|tomorrow|yesterday|tonight)`;
const BETWEEN = String.raw`[\s·•|,:()\-–—]{1,5}`;

interface Written {
  readonly from: number;
  readonly to: number;
  readonly day: string;
}

/** The day a written date names, its year the one nearest today where it says none. */
function dayOf(groups: Readonly<Record<string, string | undefined>>, today: string): string | undefined {
  const month = groups["month"] !== undefined ? Number(groups["month"]) : MONTHS.indexOf(groups["name"]!.slice(0, 3)) + 1;
  const date = Number(groups["day"]);
  if (!(month >= 1 && month <= 12 && date >= 1 && date <= 31)) return undefined;
  const at = (year: number) => `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
  if (groups["year"] !== undefined) return at(Number(groups["year"]));
  const year = Number(today.slice(0, 4));
  const away = (day: string) => Math.abs(Date.parse(day) - Date.parse(today));
  return [year - 1, year, year + 1].map(at).sort((a, b) => away(a) - away(b))[0];
}

function writtenDates(source: string, today: string): Written[] {
  const out: Written[] = [];
  for (const pattern of DATES) {
    for (const match of source.matchAll(pattern)) {
      const from = match.index;
      const to = from + match[0].length;
      if (out.some((one) => from < one.to && to > one.from)) continue;
      const day = dayOf(match.groups ?? {}, today);
      if (day !== undefined && !Number.isNaN(Date.parse(day))) out.push({ from, to, day });
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

const lineAt = (source: string, index: number) => `source line ${source.slice(0, index).split("\n").length}`;

/**
 * WHAT IN A VIEW'S SOURCE PINS A DAY, each said against the app's today:
 * a date given to a name that means today, today's words beside a written
 * date ("Tomorrow · Mon 2 Nov"), and a written date that has gone by in the
 * last month ("due Fri 30 Oct"). Empty for a view that reads today from
 * `graview`.
 */
export function datesPinned(source: string, options: DatesPinnedOptions): readonly PinnedDate[] {
  if (typeof source !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(options.today)) return [];
  const { today } = options;
  const title = options.title?.trim() || "This view";
  const todaySaid = weekdayAsRead(today, { weekday: "short", year: false }, options.locale);
  const say = (phrase: string) => `${title} may be out of date: it says “${phrase}” and today is ${todaySaid}. Read today from graview instead.`;
  const out: (PinnedDate & { readonly from: number; readonly to: number })[] = [];
  const taken = (from: number, to: number) => out.some((one) => from < one.to && to > one.from);

  for (const match of source.matchAll(ASSIGNED)) {
    if (!TODAY_NAME.test(match[1]!)) continue;
    const phrase = `${match[1]} = "${match[3]}"`;
    out.push({ at: lineAt(source, match.index), phrase, why: "today", says: say(phrase), from: match.index, to: match.index + match[0].length });
  }

  const before = new RegExp(String.raw`\b${DAY_WORD}${BETWEEN}$`, "i");
  const after = new RegExp(String.raw`^${BETWEEN}${DAY_WORD}\b`, "i");
  const leading = /\b(?:due|by|until|on)\s+$/i;
  const oldest = addDays(today, -(options.pastDays ?? 31));
  for (const date of writtenDates(source, today)) {
    if (taken(date.from, date.to)) continue;
    /* A day handed to graview.fromToday is said against today, whatever today is. */
    if (/fromToday\(\s*["'`]$/.test(source.slice(Math.max(0, date.from - 24), date.from))) continue;
    const ahead = source.slice(Math.max(0, date.from - 16), date.from);
    const behind = source.slice(date.to, date.to + 16);
    const word = before.exec(ahead);
    const wordAfter = after.exec(behind);
    if (word || wordAfter) {
      const from = word ? date.from - word[0].length : date.from;
      const to = wordAfter ? date.to + wordAfter[0].length : date.to;
      const phrase = source.slice(from, to).replace(/\s+/g, " ").trim();
      out.push({ at: lineAt(source, from), phrase, why: "day-words", says: say(phrase), from, to });
      continue;
    }
    if (date.day < today && date.day >= oldest) {
      const lead = leading.exec(ahead);
      const from = lead ? date.from - lead[0].length : date.from;
      const phrase = source.slice(from, date.to).replace(/\s+/g, " ").trim();
      out.push({ at: lineAt(source, from), phrase, why: "past", says: say(phrase), from, to: date.to });
    }
  }
  /* Each phrase once, in the order the source says them. */
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.from - b.from)
    .filter((one) => !seen.has(one.phrase) && seen.add(one.phrase))
    .map(({ at, phrase, why, says }) => ({ at, phrase, why, says }));
}
