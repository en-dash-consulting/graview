import { durationScale, sayAmount } from "./amount.js";
import { amountMark } from "../schema/amount-words.js";
import type { AmountMark } from "../schema/amount-mark.js";

/*
 * WHAT A NUMBER IS SAID AS, IN WORDS, for an edit and a change's preview:
 * "money in USD — 10000 reads $10,000", "a percent, kept as a fraction —
 * 0.15 reads 15%". A format that was taken silently is said, so a person
 * approving a change reads what every face will show.
 */

/** A number field's format in words, with what a value reads as; `undefined` for a plain number. */
export function formatWords(f: { readonly format?: string | undefined; readonly unit?: string | undefined }, brand?: { readonly currency?: string | undefined; readonly locale?: string | undefined }): string | undefined {
  if (!f.format && !f.unit) return undefined;
  const mark = amountMark({ ...(brand?.currency ? { currency: brand.currency } : {}), ...(brand?.locale ? { locale: brand.locale } : {}), ...(f as AmountMark) });
  const scale = durationScale(mark.unit);
  const example = mark.format === "percent" ? 0.15 : mark.format === "duration" ? (scale === 60 ? 90 : 2) : mark.format === "money" ? 10000 : 12;
  const reads = ` — ${example} reads ${sayAmount(example, mark)}`;
  switch (mark.format) {
    case "money":
      return mark.currency ? `money in ${mark.currency}${reads}` : `money in no currency yet, so it reads ${sayAmount(example, mark)} — say the app's, { "brand": { "currency": "USD" } }`;
    case "percent":
      return `a percent, kept as a fraction${reads}`;
    case "duration":
      return `a duration in ${scale === 1 ? "seconds" : scale === 3600 ? "hours" : scale === 86_400 ? "days" : "minutes"}${reads}`;
    default:
      return `in ${mark.unit}${reads}`;
  }
}
