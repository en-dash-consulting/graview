/*
 * WORDS A PERSON WROTE, QUOTED IN A SENTENCE (FR-125). An app's name, the
 * line under it, a logo's alt text: said in quotes, and in curly ones when
 * the words carry straight quotes of their own, so a sentence never reads
 * `reads "Say "hi""`; and at the end of a sentence the words' own stop
 * ends it, as American English puts it inside the quotes, so a line that
 * ends with a period is never said with two.
 */

/** The words in quotes. */
export function quoted(text: string): string {
  return text.includes('"') ? `“${text}”` : `"${text}"`;
}

/** The words in quotes, ending a sentence. */
export function quotedAtTheEnd(text: string): string {
  return /[.!?]$/.test(text) ? quoted(text) : `${quoted(text)}.`;
}
