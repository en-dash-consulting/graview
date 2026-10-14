import type { AmountMark } from "./amount-mark.js";

/*
 * WHAT AN AMOUNT IS, for what asks for one or tells of one — a form, a
 * tool's schema, `describeApp`, an edit's sentence — and never for what a
 * page draws first, which says the value (`sayAmount`) and no more.
 */

/** Whether a unit names a currency: three capital letters, "USD", "EUR". */
export const isCurrencyCode = (unit: string | undefined): unit is string => /^[A-Z]{3}$/.test(unit ?? "");

/**
 * A field's mark as its readers take it: a unit that is a currency ("EUR")
 * makes the number money in that currency; money names its currency (the
 * field's own, else the app's) and no unit beside it.
 */
export function amountMark(mark: AmountMark): AmountMark {
  const { format, unit, currency, locale } = mark;
  const code = isCurrencyCode(unit);
  const money = format === "money" || (!format && code);
  const named = money ? (code ? unit : currency) : undefined;
  return { ...(money ? { format: "money" as const } : format ? { format } : {}), ...(unit && !(money && code) ? { unit } : {}), ...(named ? { currency: named } : {}), ...(locale ? { locale } : {}) };
}

/** What an amount is, in a sentence a model or a reader of the declaration can act on: "An amount of money in USD: a plain number, 1250.5 for 1,250.50 USD." */
export function amountSentence(mark: AmountMark): string {
  switch (mark.format) {
    case "money":
      return mark.currency ? `An amount of money in ${mark.currency}: a plain number, 1250.5 for 1,250.50 ${mark.currency}.` : "An amount of money, in no named currency: a plain number.";
    case "percent":
      return "A fraction said as a percent: 0.15 is 15%.";
    default:
      return mark.unit ? `A number of ${mark.unit}.` : "A number.";
  }
}
