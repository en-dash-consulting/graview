/*
 * A LONG TEXT'S START, for a card, a row or a glance: what `{summary|excerpt}`
 * says, and what a list's glance says of a record's prose. The record's page
 * says it whole.
 */

/** A long text's start: its first sentence when that is short enough, else its words up to `most` characters and an ellipsis. */
export function excerpt(text: string, most = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const sentence = /^.+?[.!?](?=\s|$)/.exec(flat)?.[0];
  if (sentence && sentence.length <= most) return sentence;
  if (flat.length <= most) return flat;
  const cut = flat.slice(0, most + 1).replace(/\s+\S*$/, "");
  return `${(cut || flat.slice(0, most)).replace(/[\s,;:.\u2014-]+$/, "")}…`;
}
