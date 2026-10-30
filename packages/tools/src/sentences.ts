/**
 * WHAT THE CARD SAYS IS FOR THE PERSON (Roadmap f-menu-type-anything). A
 * model's note to the pipeline — "a way to close or archive tasks" — is
 * not an answer: every answer a quick ask's card shows is a whole sentence
 * written for the person who asked, or the plain one below.
 */

/** Said when nothing whole came back: never a fragment in its place. */
export const COULD_NOT_WORK_OUT = "I couldn't work out how to do that — try saying it another way.";

/** Whether words are a sentence for a person: begun as one, ended as one, and long enough to say something. */
export function forThePerson(text: string): boolean {
  const said = text.trim();
  if (said.length === 0) return false;
  // Begun as a sentence is: a capital, a digit or an opening quote.
  if (!/^[\p{Lu}\p{N}"“‘'(]/u.test(said)) return false;
  // Ended as one: a full stop, a question or an exclamation, perhaps inside a closing quote or bracket.
  if (!/[.!?…][”’"')]*$/u.test(said)) return false;
  // Something said: three words at least.
  if (said.split(/\s+/).filter(Boolean).length < 3) return false;
  // No JSON and no snake_case key: the pipeline's own shapes.
  return !/[{}[\]]|\b[a-z]+_[a-z_]+\b/.test(said);
}

/** The words if they are a sentence for the person, else the plain one. */
export function plainly(text: string | undefined, fallback: string = COULD_NOT_WORK_OUT): string {
  return text && forThePerson(text) ? text.trim() : fallback;
}
