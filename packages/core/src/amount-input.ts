import { localeFor, numberAsRead } from "./days.js";
import type { AmountMark } from "./schema/amount-mark.js";

/*
 * AN AMOUNT, ASKED FOR AS IT IS SAID. A money field's form was a bare number
 * box: no currency beside it, and "$1,250.50" — what the record page says —
 * refused as not a number. A form, a record's edit and the strip's prompt
 * read here: what stands beside the box (the currency's symbol, "%", the
 * unit), what the empty box suggests, the text a held value is edited as,
 * and the number a person's text means, in the reader's locale (FR-178).
 * Fetched with the forms that ask (`@graview/core/words`), never up front.
 */

/** What a box for an amount shows: the symbol before it, the unit after it, and what the empty box suggests. */
export interface AmountBox {
  readonly prefix?: string;
  readonly suffix?: string;
  readonly placeholder: string;
  /** The amount in words, for a label a screen reader reads: "in US dollars", "as a percent". */
  readonly hint: string;
}

const currencyParts = (mark: AmountMark): { symbol?: string; before: boolean; name?: string } => {
  if (!mark.currency) return { before: true };
  try {
    const locale = localeFor(mark.locale);
    const parts = new Intl.NumberFormat(locale, { style: "currency", currency: mark.currency }).formatToParts(1);
    const at = parts.findIndex((part) => part.type === "currency");
    const integer = parts.findIndex((part) => part.type === "integer");
    let name: string | undefined;
    try {
      name = new Intl.DisplayNames([locale], { type: "currency" }).of(mark.currency);
    } catch {}
    return { ...(at >= 0 ? { symbol: parts[at]!.value } : {}), before: at < integer, ...(name ? { name } : {}) };
  } catch {
    return { symbol: mark.currency, before: true };
  }
};

/** The box an amount is typed into: "$" before "1,250.00", "%" after "15", "min" after "90". */
export function amountBox(mark: AmountMark): AmountBox {
  const locale = mark.locale;
  if (mark.format === "money") {
    const { symbol, before, name } = currencyParts(mark);
    const placeholder = numberAsRead(1250, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return { ...(symbol ? (before ? { prefix: symbol } : { suffix: symbol }) : {}), placeholder, hint: name ? `in ${name}` : mark.currency ? `in ${mark.currency}` : "an amount of money" };
  }
  if (mark.format === "percent") return { suffix: "%", placeholder: numberAsRead(15, locale), hint: "as a percent" };
  return { ...(mark.unit ? { suffix: mark.unit } : {}), placeholder: "", hint: mark.unit ? `in ${mark.unit}` : "a number" };
}

/** The text a held amount is edited as: "1,250.50" for $1,250.50, "15" for 15%, "1 h 30 min" for ninety minutes. */
export function amountInBox(value: number | undefined, mark: AmountMark): string {
  if (value === undefined || !Number.isFinite(value)) return "";
  if (mark.format === "money") return numberAsRead(value, mark.locale, Number.isInteger(value) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (mark.format === "percent") return numberAsRead(value * 100, mark.locale, { maximumFractionDigits: 4 });
  return numberAsRead(value, mark.locale, { maximumFractionDigits: 6 });
}

/** The separators a locale writes numbers with: "," and "." in en-US, "." and "," in de-DE. */
function separators(locale: string | undefined): { readonly group: string; readonly decimal: string } {
  try {
    const parts = new Intl.NumberFormat(localeFor(locale)).formatToParts(12345.6);
    return { group: parts.find((part) => part.type === "group")?.value ?? ",", decimal: parts.find((part) => part.type === "decimal")?.value ?? "." };
  } catch {
    return { group: ",", decimal: "." };
  }
}

/** A plain number in a person's writing, in a locale: "1,250.50", "1.250,50", "1 250,5", "-3". */
function plainNumber(text: string, locale: string | undefined): number | undefined {
  const { group, decimal } = separators(locale);
  let t = text.replace(/[\s  ']/g, "").replace(/[−–]/g, "-");
  // A decimal point where the locale writes a comma, typed as most keyboards do ("12.5" in de-DE), is read as a point.
  if (decimal !== "." && !t.includes(decimal) && /^-?\d+\.\d{1,2}$/.test(t)) return Number(t);
  if (group) t = t.split(group).join("");
  if (decimal !== ".") t = t.replace(decimal, ".");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * THE NUMBER A PERSON'S TEXT MEANS for an amount: "$1,250.50" is 1250.5;
 * "15%" of a percent is 0.15.
 * Its currency's symbol or code, spaces and group separators are let be;
 * `undefined` where it is no number at all, for the form to say so.
 */
export function readAmount(text: string, mark: AmountMark | undefined): number | undefined {
  const raw = text.trim();
  if (raw === "") return undefined;
  const symbol = mark?.format === "money" && mark.currency ? currencyParts(mark).symbol : undefined;
  let t = raw;
  if (symbol) t = t.split(symbol).join("");
  if (mark?.currency) t = t.replace(new RegExp(mark.currency, "gi"), "");
  t = t.replace(/^[$€£¥₹]|[$€£¥₹]$/g, "");
  const percent = /%\s*$/.test(t);
  if (percent) t = t.replace(/%\s*$/, "");
  if (mark?.unit && mark.format !== "money") t = t.replace(new RegExp(`\\s*${mark.unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "");
  const n = plainNumber(t, mark?.locale);
  if (n === undefined) return undefined;
  return mark?.format === "percent" ? n / 100 : n;
}
