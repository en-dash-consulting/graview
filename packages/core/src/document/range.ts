/*
 * A NUMBER'S RANGE (FR-114), in one place: what `min`, `max` and `step` on
 * a number or integer field allow, and how they are said. The field's
 * schema enforces it at apply (compile.ts), the check judges a default
 * against it, an edit and a diff say it, and a migration clears what a
 * narrowed one no longer takes.
 */

export interface Range {
  readonly type?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

/** Whether a number is a whole multiple of a step, forgiving the float error of 0.1 + 0.2. */
export function onStep(value: number, step: number): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < 1e-9 * Math.max(1, Math.abs(ratio));
}

/** "1 to 5", "at least 1", "at most 5", "any number" — and ", in steps of 0.5". */
export function rangeWords(range: Range): string {
  const span =
    range.min !== undefined && range.max !== undefined
      ? `${range.min} to ${range.max}`
      : range.min !== undefined
        ? `at least ${range.min}`
        : range.max !== undefined
          ? `at most ${range.max}`
          : `any ${range.type === "integer" ? "whole number" : "number"}`;
  return range.step !== undefined ? `${span}, in steps of ${range.step}` : span;
}

/** Why a value is outside a field's range, or undefined when it is inside. */
export function outsideRange(value: unknown, range: Range, field: string): string | undefined {
  if (typeof value !== "number") return undefined;
  if ((range.min !== undefined && value < range.min) || (range.max !== undefined && value > range.max)) return `${value} is outside ${field}'s range, ${rangeWords({ min: range.min, max: range.max, type: range.type })}`;
  if (range.step !== undefined && !onStep(value, range.step)) return `${value} is not a whole multiple of ${range.step}, as ${field}'s values are`;
  return undefined;
}

/** Whether a range declares anything. */
export const hasRange = (range: Range): boolean => range.min !== undefined || range.max !== undefined || range.step !== undefined;

/** Whether `after` takes a value `before` took that it does not: a minimum raised, a maximum lowered, a step added or changed. */
export function narrows(before: Range, after: Range): boolean {
  if (after.min !== undefined && (before.min === undefined || after.min > before.min)) return true;
  if (after.max !== undefined && (before.max === undefined || after.max < before.max)) return true;
  if (after.step !== undefined && (before.step === undefined || !onStep(before.step, after.step))) return true;
  return false;
}
