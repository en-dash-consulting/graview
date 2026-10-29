/*
 * A GENERATE STEP'S WORDS, apart from what it wants (`generate.ts`): its
 * default key, the windows it reads, the `$` names its values give and its
 * limits — what the checker holds a step to without bringing the runner's
 * arithmetic onto every path `graview check` is on.
 */

/** A key when the step says none: one record per source and day. */
export const DEFAULT_GENERATE_KEY = "{source}:{date}";

/** The longest window a step makes records for, in days. */
export const MOST_WINDOW_DAYS = 366;

/** The most records one step wants in one run. */
export const MOST_GENERATED = 2000;

export const WINDOW_WORDS = /^(?:today|tomorrow|this week|next week|next (\d{1,3}) days?)$/;

/** What a window says in words, or why it cannot be read. */
export function windowWordsProblem(window: string): string | undefined {
  const found = WINDOW_WORDS.exec(window.trim().toLowerCase());
  if (!found) return `"${window}" is not a window it can read: say "today", "tomorrow", "this week", "next week" or "next 7 days", or give { "from": …, "to": … }`;
  if (found[1] !== undefined && (+found[1] < 1 || +found[1] > MOST_WINDOW_DAYS)) return `"${window}" is not between 1 and ${MOST_WINDOW_DAYS} days`;
  return undefined;
}

/** The `$` names a generate step's values may give. */
export const GENERATE_REFS = ["$date", "$source", "$subject", "$today", "$now"] as const;
