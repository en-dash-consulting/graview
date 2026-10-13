import type { FieldSpec } from "../document/schema.js";
import { nameKey } from "../labels.js";
import { slug } from "../mutations/define-mutation.js";

/**
 * A CELL, READ AS THE FIELD IT GOES IN (FR-177). A spreadsheet holds what a
 * person typed: "Sep 10, 2023", "$1,200.50", "12 kg", "✓", "In progress".
 * A field holds what the declaration says it holds — an ISO day, a number,
 * a boolean, one of its options — so each cell is read by its field's type,
 * and a cell that cannot be read is said back in words rather than guessed.
 */
export type Coerced = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly why: string };

export interface CoerceOptions {
  /** `3/4/2024` is the 4th of March read day first, the 3rd of April otherwise (US). */
  readonly dayFirst?: boolean;
  /** How an option reads to a person, where it is not the option itself: the kind's `display.format`. */
  readonly optionWords?: (option: string) => string;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Whether a day is on the calendar: February has no 30th. */
function realDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || year < 1000 || year > 9999) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const fullYear = (year: string) => (year.length === 2 ? 2000 + Number(year) : Number(year));

function monthOf(word: string): number | undefined {
  const at = MONTHS.indexOf(word.toLowerCase().replace(/\.$/, "").slice(0, 3));
  return at < 0 ? undefined : at + 1;
}

/** A day, as `YYYY-MM-DD`: ISO, US `M/D/YYYY` (or day first), "Sep 10, 2023", "10 September 2023", a spreadsheet's serial day. */
export function readDay(input: unknown, options: CoerceOptions = {}): string | undefined {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return undefined;
    return `${input.getUTCFullYear()}-${pad(input.getUTCMonth() + 1)}-${pad(input.getUTCDate())}`;
  }
  if (typeof input === "number") return serialDay(input);
  const text = String(input).trim().replace(/,/g, " ").replace(/\s+/g, " ");
  const day = (year: number, month: number, date: number) => (realDay(year, month, date) ? `${year}-${pad(month)}-${pad(date)}` : undefined);
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  if (match) return day(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(text);
  if (match) return day(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?: .*)?$/.exec(text);
  if (match) {
    const [first, second] = [Number(match[1]), Number(match[2])];
    const year = fullYear(match[3]!);
    return options.dayFirst ? day(year, second, first) : day(year, first, second);
  }
  // "Sep 10 2023", "September 10th 2023", "Sept. 10 2023"
  match = /^([A-Za-z]+\.?) (\d{1,2})(?:st|nd|rd|th)? (\d{4})$/.exec(text);
  if (match) {
    const month = monthOf(match[1]!);
    return month ? day(Number(match[3]), month, Number(match[2])) : undefined;
  }
  // "10 Sep 2023", "10th of September 2023"
  match = /^(\d{1,2})(?:st|nd|rd|th)? (?:of )?([A-Za-z]+\.?) (\d{4})$/.exec(text);
  if (match) {
    const month = monthOf(match[2]!);
    return month ? day(Number(match[3]), month, Number(match[1])) : undefined;
  }
  if (/^\d{5}(\.\d+)?$/.test(text)) return serialDay(Number(text));
  return undefined;
}

/** A spreadsheet's serial day (days since 1899-12-30), in the years a sheet plausibly holds. */
function serialDay(serial: number): string | undefined {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return undefined;
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** A day and a time, as `YYYY-MM-DDTHH:MM`: the day as `readDay` reads it, then "14:30", "2:30 PM" or "2pm". */
export function readDateTime(input: unknown, options: CoerceOptions = {}): string | undefined {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return undefined;
    return `${readDay(input)}T${pad(input.getUTCHours())}:${pad(input.getUTCMinutes())}`;
  }
  const text = String(input).trim();
  const iso = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(text);
  if (iso) {
    const written = text.replace(" ", "T");
    // With a zone it is an instant, kept as written; without one, the day and the time of day.
    if (iso[4]) return Number.isNaN(Date.parse(written)) ? undefined : written;
    const [hour, minute] = [Number(iso[2]), Number(iso[3])];
    return readDay(iso[1]) && hour < 24 && minute < 60 ? `${iso[1]}T${pad(hour)}:${pad(minute)}` : undefined;
  }
  const timed = /^(.*?)[ T,]+(\d{1,2})(?::(\d{2}))?\s*([AaPp]\.?[Mm]\.?)?$/.exec(text);
  if (timed && (timed[3] !== undefined || timed[4] !== undefined)) {
    const day = readDay(timed[1], options);
    let hour = Number(timed[2]);
    const minute = Number(timed[3] ?? 0);
    const half = timed[4]?.toLowerCase().replace(/\./g, "");
    if (half) {
      if (hour < 1 || hour > 12) return undefined;
      hour = (hour % 12) + (half === "pm" ? 12 : 0);
    }
    if (!day || hour > 23 || minute > 59) return undefined;
    return `${day}T${pad(hour)}:${pad(minute)}`;
  }
  const day = readDay(text, options);
  return day ? `${day}T00:00` : undefined;
}

/**
 * A number, however a sheet wrote it: "$1,200.50", "USD 40", "12 kg",
 * "(300)" for a loss, "15%" for 0.15. One number per cell; text before or
 * after it — a currency, a unit — is set aside, text between two numbers
 * is not a number.
 */
export function readNumber(input: unknown): number | undefined {
  if (typeof input === "number") return Number.isFinite(input) ? input : undefined;
  let text = String(input).trim().replace(/\u00a0/g, " ");
  if (text.length === 0) return undefined;
  let sign = 1;
  const parenthesized = /^\((.*)\)$/.exec(text);
  if (parenthesized) {
    sign = -1;
    text = parenthesized[1]!.trim();
  }
  const match = /^([^\d.+-]*?)\s*([+\-−]?)\s*([^\d.+-]*?)\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*(%?)\s*([^\d]*)$/.exec(text);
  if (!match) return undefined;
  const [, before, minus, between, digits, percent, after] = match;
  // What stands around a number is a currency or a unit, a word or a symbol; never a stray number or another sign.
  if (/[+-]/.test(after!) || (before && between)) return undefined;
  if (/,/.test(digits!) && !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(digits!)) return undefined;
  const value = Number(digits!.replace(/,/g, ""));
  if (!Number.isFinite(value)) return undefined;
  const signed = value * sign * (minus === "-" || minus === "−" ? -1 : 1);
  return percent ? signed / 100 : signed;
}

const YES = new Set(["yes", "y", "true", "t", "x", "1", "on", "checked", "done", "✓", "✔", "☑", "✅"]);
const NO = new Set(["no", "n", "false", "f", "0", "off", "unchecked", "-", "✗", "✘", "☐", "❌"]);

/** A yes or a no: yes/no, true/false, x, ✓, 1/0. */
export function readBoolean(input: unknown): boolean | undefined {
  if (typeof input === "boolean") return input;
  const text = String(input).trim().toLowerCase();
  if (YES.has(text)) return true;
  if (NO.has(text)) return false;
  return undefined;
}

/** One of a field's options, by the option itself or its words, case and spacing aside. */
export function readOption(input: unknown, options: readonly string[], words?: (option: string) => string): string | undefined {
  const text = String(input).trim();
  const key = nameKey(text);
  const keyed = slug(text);
  return (
    options.find((option) => option === text) ??
    options.find((option) => nameKey(option) === key) ??
    options.find((option) => words !== undefined && nameKey(words(option)) === key) ??
    options.find((option) => slug(option) === keyed)
  );
}

/** Several values in one cell: split on semicolons and line breaks, and on commas when there were none. */
export function splitCell(text: string): string[] {
  const parts = /[;\n]/.test(text) ? text.split(/[;\n]/) : text.split(",");
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/** A cell read as a field of this spec. Blank cells are not handed here. */
export function coerceCell(spec: FieldSpec, input: unknown, said: string, options: CoerceOptions = {}): Coerced {
  const quoted = `“${input instanceof Date ? input.toISOString().slice(0, 10) : String(input).trim()}”`;
  switch (spec.type) {
    case "string":
    case "text":
      return { ok: true, value: input instanceof Date ? readDay(input) : String(input).trim() };
    case "email":
      return { ok: true, value: String(input).trim() };
    case "url": {
      const text = String(input).trim();
      // "bloomandco.com" is an address a person would write; the field holds one a browser follows.
      return { ok: true, value: /^[a-z][a-z0-9+.-]*:/i.test(text) || !/^[^\s/]+\.[^\s]+$/.test(text) ? text : `https://${text}` };
    }
    case "number":
    case "integer": {
      const value = readNumber(input);
      if (value === undefined) return { ok: false, why: `${quoted} under ${said} is not a number` };
      if (spec.type === "integer" && !Number.isInteger(value)) return { ok: false, why: `${quoted} under ${said} is not a whole number` };
      return { ok: true, value };
    }
    case "boolean": {
      const value = readBoolean(input);
      return value === undefined ? { ok: false, why: `${quoted} under ${said} is not a yes or a no` } : { ok: true, value };
    }
    case "date": {
      const value = readDay(input, options);
      return value === undefined ? { ok: false, why: `${quoted} under ${said} is not a date` } : { ok: true, value };
    }
    case "datetime": {
      const value = readDateTime(input, options);
      return value === undefined ? { ok: false, why: `${quoted} under ${said} is not a date and time` } : { ok: true, value };
    }
    case "enum": {
      const choices = spec.options ?? [];
      const value = readOption(input, choices, options.optionWords);
      if (value !== undefined) return { ok: true, value };
      const listed = choices.map((option) => options.optionWords?.(option) ?? option);
      return { ok: false, why: `${quoted} under ${said} is none of ${listed.length <= 8 ? orList(listed) : `its ${listed.length} choices`}` };
    }
    case "list": {
      const items = Array.isArray(input) ? input : splitCell(String(input));
      const out: unknown[] = [];
      for (const item of items) {
        const one = coerceCell({ type: spec.of === "number" ? "number" : spec.of === "date" ? "date" : "string" }, item, said, options);
        if (!one.ok) return one;
        out.push(one.value);
      }
      return { ok: true, value: out };
    }
    case "image":
    case "file":
      return { ok: false, why: `${said} holds a file, which a cell cannot carry` };
  }
}

/** "a, b or c". */
export function orList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

/** "a, b and c". */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
