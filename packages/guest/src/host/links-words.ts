/*
 * THE WORDS A LINK THAT GOES NOWHERE IS SAID IN — a file of its own, with
 * nothing imported, because a headless run's isolate says them too and
 * carries no schema (headless/judge.ts); the judging is `./links.ts`'s.
 */

/** Where a view asked to go. */
export type Destination =
  | { readonly record: string; readonly where?: unknown; readonly section?: unknown }
  | { readonly place: string; readonly where?: unknown; readonly section?: unknown };

/** The app's places, as a sentence ends with them. */
export const placesSaid = (slugs: readonly string[]) => ` Its places: ${slugs.map((slug) => `"${slug}"`).join(", ") || "none"}.`;

/** At most 80 characters of what a view asked for, ending "…" where it was cut: the sentence reaches the host's problems, and a view may ask for anything. */
export const quoted = (asked: string) => `"${asked.length > 80 ? `${asked.slice(0, 79)}…` : asked}"`;

/** Why a destination goes nowhere, naming where it could go. */
export const nowhere = (to: Destination, slugs: readonly string[]) =>
  `${"place" in to ? `The place ${quoted(to.place)}` : `${quoted(to.record)} is no record this viewer may see and`} is no place of this app: it goes nowhere.${placesSaid(slugs)}`;

/** A link's `data-filter`, in the address's words (`stage:building,owner:user:ada`), as the `where` it says. */
export function whereOfWords(words: string): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const part of words.split(",")) {
    const colon = part.indexOf(":");
    if (colon > 0) out[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
  }
  return out;
}

