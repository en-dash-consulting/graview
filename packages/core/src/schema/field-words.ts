import { localeFor, numberAsRead } from "../days.js";
import { typedFieldOf } from "./typed-field-of.js";
import type { TypedField } from "./typed-fields.js";

/*
 * A PHONE NUMBER, A PLACE AND A DURATION, SAID AND LINKED (`typed-fields.ts`
 * holds what they are). On `@graview/core/words`: a face says them as it
 * draws a record, a form reads a duration as it sends one and an import as
 * it reads a cell — none of it before a reader opens a record.
 */

/** Minutes in a day, an hour and a minute, by the letter their unit starts with. */
const PER: Readonly<Record<string, number>> = { d: 1440, h: 60, m: 1 };

/**
 * A LENGTH OF TIME AS IT IS TYPED, IN MINUTES: "90", "1:30", "1h 30m",
 * "1 h 30 min", "1.5 h", "2 hours and 15 minutes", "1d", "1:30:00". A bare number is
 * minutes. Anything else is undefined; a part of a minute is rounded.
 */
export function parseDuration(input: unknown): number | undefined {
  if (typeof input === "number") return Number.isFinite(input) && input >= 0 ? Math.round(input) : undefined;
  if (typeof input !== "string") return undefined;
  const text = input.trim().toLowerCase();
  if (/^\d+$/.test(text)) return Number(text);
  // Hours and minutes, and the seconds a spreadsheet's time keeps: "1:30", "1:30:00".
  const clock = /^(\d+):([0-5]\d)(?::([0-5]\d))?$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]) + Math.round(Number(clock[3] ?? 0) / 60);
  let total = 0;
  let found = false;
  const rest = text.replace(/(\d*[.,]?\d+) *(days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m)(?![a-z])/g, (_, amount: string, unit: string) => {
    found = true;
    total += Number(amount.replace(",", ".")) * PER[unit[0]!]!;
    return " ";
  });
  return found && /^[\s,+]*(?:and[\s,+]*)*$/.test(rest) ? Math.round(total) : undefined;
}

/**
 * A DURATION AS IT IS READ: "1 h 30 min", "45 min", "2 h". The numbers are
 * the locale's (`Intl`, through the app's or the reader's locale), the units
 * short and the same everywhere: `Intl`'s own short units say "1 hr" in
 * en-US, where the field promises "1 h".
 */
export function sayDuration(minutes: number, locale?: string): string {
  if (!Number.isFinite(minutes)) return String(minutes);
  const whole = Math.round(Math.abs(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  const said = [hours ? `${numberAsRead(hours, locale)} h` : "", rest || !hours ? `${numberAsRead(rest, locale)} min` : ""].filter(Boolean).join(" ");
  return minutes < 0 ? `−${said}` : said;
}

/** A North American number: an optional +1, its area code, exchange and line, and an extension. */
const NANP = /^(\+?1[ .-]?)?\(?([2-9]\d\d)\)?[ .-]?(\d{3})[ .-]?(\d{4})(?: *(?:ext\.?|x|#) *(\d+))?$/i;

/**
 * A PHONE NUMBER AS IT IS READ: grouped as "(555) 123-4567" for a reader in
 * the United States or Canada where it is a North American number, and as
 * it was entered everywhere else — a format nobody chose is worse than the
 * one the person typed.
 */
export function sayPhone(phone: string, locale?: string): string {
  const entered = phone.trim();
  const nanp = /[-_](US|CA)\b/i.test(localeFor(locale)) ? NANP.exec(entered) : null;
  if (!nanp) return entered;
  const [, country, area, exchange, line, ext] = nanp;
  return `${country?.startsWith("+") ? "+1 " : ""}(${area}) ${exchange}-${line}${ext ? ` ext. ${ext}` : ""}`;
}

/** A phone number as a `tel:` link: its `+` and digits, and its extension; undefined for fewer than three digits. */
export function telHref(phone: string): string | undefined {
  const [, main = "", ext] = /^(.*?)(?: *(?:ext\.?|x|#) *(\d+))?$/i.exec(phone.trim()) ?? [];
  const digits = main.replace(/\D/g, "");
  return digits.length < 3 ? undefined : `tel:${main.startsWith("+") ? "+" : ""}${digits}${ext ? `;ext=${ext}` : ""}`;
}

/** Whether this page is read on a Mac, an iPhone or an iPad, whose Maps app opens maps.apple.com. */
const onApple = (): boolean => /Mac|iPhone|iPad|iPod/.test(globalThis.navigator?.userAgent ?? "");

/**
 * A PLACE AS A LINK TO THE READER'S MAPS APP. No one address opens every
 * reader's own: `geo:` does nothing in a desktop browser, and an address on
 * one maker's maps opens the other's website. So on Apple's platforms
 * maps.apple.com, which opens Maps; everywhere else Google's universal Maps
 * address, which opens the Google Maps app on Android and the map in the
 * browser elsewhere. Neither needs a key; nothing is fetched until it is
 * followed.
 */
export function mapsHref(place: string, apple: boolean = onApple()): string {
  const query = encodeURIComponent(place.trim());
  return apple ? `https://maps.apple.com/?q=${query}` : `https://www.google.com/maps/search/?api=1&query=${query}`;
}

type Readable = { readonly fields?: unknown; readonly computed?: unknown };
const shapeOf = (definition: Readable | undefined): Record<string, unknown> => (definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
const ownField = (definition: Readable | undefined, key: string): TypedField | undefined => {
  const shape = shapeOf(definition);
  return Object.hasOwn(shape, key) ? typedFieldOf(shape[key]) : undefined;
};

/*
 * A COMPUTED FIELD THAT WORKS OUT A LENGTH OF TIME says so: `as:
 * "duration"` on its declaration, which a document's compile writes for each
 * one it reads as a sum of durations from the parsed expression
 * (`document/durations.ts`) and a TypeScript declaration says itself. A face
 * reads that and nothing of the expression's words.
 */
const workedOutAs = (definition: Readable, key: string): unknown => {
  const computed = definition.computed as Record<string, string | { readonly as?: string }> | undefined;
  const entry = computed && Object.hasOwn(computed, key) ? computed[key] : undefined;
  return typeof entry === "object" ? entry.as : undefined;
};

/** What a kind's field holds where it is a phone, a place or a duration: a stored field's mark, or a computed field that works out a length of time. */
export function fieldSays(definition: Readable | undefined, key: string): TypedField | undefined {
  return ownField(definition, key) ?? (definition && workedOutAs(definition, key) === "duration" ? "duration" : undefined);
}

/** A phone, a place or a duration in words; undefined for a value that is not one. */
export function typedWords(type: TypedField | undefined, value: unknown, locale?: string): string | undefined {
  if (type === "duration") return typeof value === "number" ? sayDuration(value, locale) : undefined;
  if (type === "phone") return typeof value === "string" ? sayPhone(value, locale) : undefined;
  return type === "place" && typeof value === "string" ? value.trim() : undefined;
}

/** Where a phone or a place takes its reader: a `tel:` link, or the maps app. */
export function typedHref(type: TypedField | undefined, value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return type === "phone" ? telHref(value) : type === "place" ? mapsHref(value) : undefined;
}
