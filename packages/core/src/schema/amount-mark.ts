import { defOf } from "./zod.js";

/*
 * WHAT A NUMBER FIELD IS SAID AS, on its schema: money in a currency, a
 * fraction said as a percent, a measure in a unit. Every face
 * that reads a record says the value by it ("$10,000", never 10000), a form
 * asks for "$1,250.50" by it, a tool's schema tells a model the number is
 * money in USD. A mark on the schema's def, as a file field is marked
 * (`files.ts`), so a clone shares it, a refinement spreads it and a wrapper
 * holds it inside. A hosted page builds a document's fields up front, so
 * this holds the mark and no more; its words are `amount-words.ts`'s.
 */
const AMOUNT = Symbol.for("@graview/core:amount");

/** A number's declared format, and the currency and locale it is said in where it is money. A number shown as a duration is the duration type's (`markTyped`), never an amount. */
export interface AmountMark {
  readonly format?: "money" | "percent";
  /** A measure's unit ("kg"), or a currency of its own ("EUR"). */
  readonly unit?: string;
  readonly currency?: string;
  readonly locale?: string;
  /** `0`: money said in whole units, rounded ("$22,758"); otherwise with cents only where it has them, never ".00". */
  readonly places?: 0;
}

/** Marks a number schema with what it is said as. */
export const markAmount = <T extends object>(schema: T, mark: AmountMark): T => (Object.defineProperty(defOf(schema)!, AMOUNT, { value: mark, enumerable: true }), schema);

/** What a number field is said as — under optional, default and nullable (`deep`) — or nothing. */
export function amountOf(schema: unknown, deep = true): AmountMark | undefined {
  const def = defOf(schema) as { [AMOUNT]?: AmountMark; innerType?: unknown } | undefined;
  return def?.[AMOUNT] ?? (deep && def?.innerType ? amountOf(def.innerType) : undefined);
}
