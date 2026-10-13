/*
 * A LONG TEXT'S START, for a card, a row or a glance: what `{summary|excerpt}`
 * says, and what a list's glance says of a record's prose. The record's page
 * says it whole.
 */

/** A stop that ends an abbreviation, not a sentence: "e.g.", "U.S.", "Dr.". */
const ABBREVIATION = /(?:\.\S|^(?:dr|mr|mrs|ms|mx|st|mt|vs|jr|sr|prof|no|fig|approx)\.$)/i;

/** The first sentence: up to the first stop that ends one — not an abbreviation's, and not before three words. */
function firstSentence(flat: string): string | undefined {
  for (const stop of flat.matchAll(/[.!?](?=\s|$)/g)) {
    const sentence = flat.slice(0, stop.index + 1);
    const word = /\S+$/.exec(sentence)?.[0] ?? "";
    if (stop[0] === "." && ABBREVIATION.test(word)) continue;
    if (sentence.split(" ").length < 3 && stop.index + 1 < flat.length) continue;
    return sentence;
  }
  return undefined;
}

/** A long text's start: its first sentence when that is short enough, else its words up to `most` characters and an ellipsis. */
export function excerpt(text: string, most = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const sentence = firstSentence(flat);
  if (sentence && sentence.length <= most) return sentence;
  if (flat.length <= most) return flat;
  const cut = flat.slice(0, most + 1).replace(/\s+\S*$/, "");
  return `${(cut || flat.slice(0, most)).replace(/[\s,;:.—-]+$/, "")}…`;
}
