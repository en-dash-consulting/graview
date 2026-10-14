import { numberAsRead } from "../days.js";
import type { AmountMark } from "../schema/amount-mark.js";
import { formatMoney } from "./money.js";

/*
 * A NUMBER SAID AS ITS FIELD DECLARES IT: money in the app's currency, a
 * fraction as a percent, a duration in hours and minutes, a measure with its
 * unit. A field marked `"format": "money"` read as a bare 10000 on the
 * record page, the list, the table and the form — only a `{price | money}`
 * template and a lens block said it as money. The field's schema carries
 * what it is said as (`markAmount`), and every face that reads a record
 * says it here, in the app's currency and the reader's locale (FR-178).
 * Small, because a change's line says it as a hosted page applies the change.
 */

/** What a duration's number counts, in seconds: minutes unless its unit says seconds, hours or days. */
export const durationScale = (unit = ""): number => ({ s: 1, h: 3600, d: 86_400 })[unit.toLowerCase()[0] as "s"] ?? 60;

/** A number in the words its field declares: "$10,000", "12.5%", "1 h 30 min", "12 kg". A unit that is a currency ("EUR") makes it money in that currency. */
export function sayAmount(value: number, { format, unit, currency, locale }: AmountMark): string {
  const code = /^[A-Z]{3}$/.test(unit ?? "");
  if (format === "money" || (!format && code)) return formatMoney(value, { ...(locale ? { locale } : {}), ...((code ? unit : currency) ? { currency: code ? unit! : currency! } : {}) });
  if (format === "percent") return numberAsRead(value, locale, { style: "percent", maximumFractionDigits: 0 });
  if (format === "duration") {
    let left = Math.round(Math.abs(value) * durationScale(unit));
    const parts = [86_400, 3600, 60, 1].flatMap((size, i) => {
      const count = Math.floor(left / size);
      left -= count * size;
      return count > 0 ? [`${numberAsRead(count, locale)} ${["d", "h", "min", "s"][i]}`] : [];
    });
    return (value < 0 ? "−" : "") + (parts.slice(0, 2).join(" ") || "0");
  }
  return numberAsRead(value, locale) + (unit ? ` ${unit}` : "");
}
