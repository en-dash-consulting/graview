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


/**
 * A sum of money in words: "$21,000", "21.000 €" — whole sums without
 * cents, others with two, and never ".00". The sum is rounded to the cent
 * before it is judged whole, so 11423.999999 worked out by a computed field
 * reads "$11,424", as 11424 does, and not "$11,424.00" beside "$7,840" in
 * one list (Roadmap f-lifelogics-findings). `places: 0` says it in whole
 * units, rounded: "$22,758" for 22758.40 — a field's `"places": 0`, a
 * template's `{total | money: 0}`.
 */
export function formatMoney(value: number, money: Money = {}, places?: 0): string {
  const sum = places === 0 ? Math.round(value) : Math.round(value * 100) / 100;
  const whole = Number.isInteger(sum);
  const digits = { maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2 };
  try {
    return numberAsRead(sum, money.locale, money.currency ? { style: "currency", currency: money.currency, ...digits } : digits);
  } catch {
    // A currency the runtime does not know is said as a plain number, never a thrown page.
    return numberAsRead(sum, money.locale, digits);
  }
}
