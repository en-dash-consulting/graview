/*
 * A LONG TEXT'S START, for a card, a row or a glance: what `{summary|excerpt}`
 * says. The record's page says it whole. A page's first load carries this
 * (a template may ask for it), so it takes out only Markdown's commonest
 * marks; a glance reads prose through `excerptOf` (excerpt-of.ts), fetched
 * with what reads a record, which takes out the rest (FR-180).
 */

/**
 * A stop that ends an abbreviation, not a sentence: "e.g.", "U.S.", "Ph.D.",
 * "Dr." — short letters between stops, or a title. A word with a stop
 * inside it that is not that ("capabilities().shipped.", "graview.dev.")
 * ends its sentence.
 */
const ABBREVIATION = /^[("'“‘]*(?:(?:[a-z]{1,3}\.){2,}|(?:dr|mr|mrs|ms|mx|st|mt|vs|jr|sr|prof|no|fig|approx)\.)$/i;

/** The first sentence: up to the first stop that ends one — not an abbreviation's, and not before three words. */
export function firstSentence(flat: string): string | undefined {
  for (const stop of flat.matchAll(/[.!?](?=\s|$)/g)) {
    const sentence = flat.slice(0, stop.index + 1);
    const word = /\S+$/.exec(sentence)?.[0] ?? "";
    if (stop[0] === "." && ABBREVIATION.test(word)) continue;
    if (sentence.split(" ").length < 3 && stop.index + 1 < flat.length) continue;
    return sentence;
  }
  return undefined;
}

/**
 * A long text's start: its first sentence when that is short enough, else its
 * words up to `most` characters and an ellipsis — a line's heading or quote
 * mark, bold and code ticks, and a link's address left out (FR-180).
 */
export function excerpt(text: string, most = 140): string {
  const flat = text.replace(/^[#>\s]+|\*\*|`|\](\([^)\s]*\))?|\[/gm, "").replace(/\s+/g, " ").trim();
  const sentence = firstSentence(flat);
  if (sentence && sentence.length <= most) return sentence;
  if (flat.length <= most) return flat;
  const cut = flat.slice(0, most + 1).replace(/\s+\S*$/, "");
  return `${(cut || flat.slice(0, most)).replace(/[\s,;:.—-]+$/, "")}…`;
}
