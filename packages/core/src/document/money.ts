import { numberAsRead } from "../days.js";

/**
 * HOW AN APP SAYS MONEY (FR-100): the currency a sum is in when a block
 * names none, and the locale its figures are written for — the app's
 * `brand.currency` and `brand.locale`. Without a currency a sum is a
 * number in figures, as it always was. The locale is the app's for its
 * days, times and numbers too (FR-178); a reader's a host passed wins.
 * The zone rides with them (`brand.timeZone`, Roadmap f-app-time-zone):
 * what a template, a block and a rule's sentence say an instant on, where
 * no person's zone was passed.
 */
export interface Money {
  readonly currency?: string;
  readonly locale?: string;
  readonly timeZone?: string;
}


/** A sum of money in words: "$21,000", "21.000 €" — whole sums without cents, others with two. */
export function formatMoney(value: number, money: Money = {}): string {
  const whole = Number.isInteger(value);
  const digits = { maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2 };
  try {
    return numberAsRead(value, money.locale, money.currency ? { style: "currency", currency: money.currency, ...digits } : digits);
  } catch {
    // A currency the runtime does not know is said as a plain number, never a thrown page.
    return numberAsRead(value, money.locale, digits);
  }
}
