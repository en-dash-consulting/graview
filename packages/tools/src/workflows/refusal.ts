/*
 * A HOST'S REFUSAL, SAID AS A STEP'S REASON (Roadmap f-far-app-host-refusal).
 * A host answers `{ refused: sentence }` in its own words, which may run
 * over lines, run long, or end in its own mark. It is said on one line, at
 * most `MOST_REFUSAL` characters cut at a word with an ellipsis, and given a
 * full stop only where it ends in none of its own.
 */

/** The most characters of a host's sentence a run says. */
export const MOST_REFUSAL = 500;

/** A host's sentence on one line, cut whole at a word where it is long, its own full stops left to the step to write; "" where it says nothing. */
export function hostSentence(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const line = raw.replace(/\s+/g, " ").trim().replace(/\.+$/, "").trim();
  const characters = [...line];
  if (characters.length <= MOST_REFUSAL) return line;
  const cut = characters.slice(0, MOST_REFUSAL - 1).join("");
  const space = cut.lastIndexOf(" ");
  const whole = (space > 0 ? cut.slice(0, space) : cut).trim().replace(/[\s,;:.]+$/, "");
  return `${whole}…`;
}

/** Whether a sentence already ends as a sentence does: a question, an exclamation, an ellipsis. */
const ended = (words: string): boolean => /[?!…]$/.test(words);

/** A refusal as a step says it: with a full stop where it has no mark of its own. */
export const refusalSentence = (refused: string): string => (ended(refused) ? refused : `${refused}.`);

/** A refusal and what it stopped, in one sentence: "…, so the model's step did not run." or "…? The model's step did not run." */
export const refusalThen = (refused: string, then: string): string => (ended(refused) ? `${refused} ${then.charAt(0).toUpperCase()}${then.slice(1)}.` : `${refused}, so ${then}.`);
