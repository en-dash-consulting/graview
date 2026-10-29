import { numberAsRead } from "../days.js";
import type { AmountMark } from "../schema/amount-mark.js";
import { formatMoney } from "./money.js";

/*
 * A NUMBER SAID AS ITS FIELD DECLARES IT: money in the app's currency, a
 * fraction as a percent, a measure with its unit (a number shown as a
 * duration is the duration type's, `field-words.ts`). A field marked `"format": "money"` read as a bare 10000 on the
 * record page, the list, the table and the form — only a `{price | money}`
 * template and a lens block said it as money. The field's schema carries
 * what it is said as (`markAmount`), and every face that reads a record
 * says it here, in the app's currency and the reader's locale (FR-178).
 * Small, because a change's line says it as a hosted page applies the change.
 */

/** A number in the words its field declares: "$10,000", "13%", "12 kg". A unit that is a currency ("EUR") makes it money in that currency. */
export function sayAmount(value: number, { format, unit, currency, locale, places }: AmountMark): string {
  const code = /^[A-Z]{3}$/.test(unit ?? "");
  if (format === "money" || (!format && code)) return formatMoney(value, { ...(locale ? { locale } : {}), ...((code ? unit : currency) ? { currency: code ? unit! : currency! } : {}) }, places);
  if (format === "percent") return numberAsRead(value, locale, { style: "percent", maximumFractionDigits: 0 });
  return numberAsRead(value, locale) + (unit ? ` ${unit}` : "");
}
