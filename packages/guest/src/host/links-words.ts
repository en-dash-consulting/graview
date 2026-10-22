/*
 * THE WORDS A LINK THAT GOES NOWHERE IS SAID IN — a file of its own, with
 * nothing imported, because a headless run's isolate says them too and
 * carries no schema (headless/judge.ts); the judging is `./links.ts`'s.
 */

/** Where a view asked to go. */
export type Destination =
  | { readonly record: string; readonly where?: unknown; readonly section?: unknown }
  | { readonly place: string; readonly where?: unknown; readonly section?: unknown };

/** A place as a link names it and a sentence says it: its slug, and the title a reader knows it by. */
export interface NamedPlace {
  readonly as: string;
  readonly title?: string;
}

/** A title as an address word: "Songs by writer" is `songs-by-writer`, as core's `placeSlug` makes it. */
const slugOf = (words: string) => words.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * THE PLACE A VIEW NAMES — by its slug, or by its title in any case, or by
 * the title's slug (2026-10-15): a home that links `data-place="Songs by
 * writer"` goes where `data-place="songs-by-writer"` does.
 */
export function placeNamed<P extends NamedPlace>(places: readonly P[], asked: string): P | undefined {
  const bySlug = places.find((place) => place.as === asked);
  if (bySlug) return bySlug;
  const lower = asked.trim().toLowerCase();
  const slug = slugOf(asked);
  return places.find((place) => place.title !== undefined && place.title.trim().toLowerCase() === lower) ?? (slug ? places.find((place) => place.as === slug || (place.title !== undefined && slugOf(place.title) === slug)) : undefined);
}

/**
 * THE PLACES A HOST HANDS, AS A GUEST READS THEM: a guest's place (`as`),
 * or a place as an app lists it (`placesOf`: `slug`), each with its title
 * and kind. One with no word to go to by is passed over, rather than said
 * as "undefined" (2026-10-15).
 */
export function guestPlacesOf(places: readonly unknown[]): { readonly as: string; readonly title: string; readonly kind: string }[] {
  const out: { as: string; title: string; kind: string }[] = [];
  for (const place of places) {
    if (typeof place !== "object" || place === null) continue;
    const { as, slug, title, kind } = place as { as?: unknown; slug?: unknown; title?: unknown; kind?: unknown };
    const word = typeof as === "string" && as.length > 0 ? as : typeof slug === "string" && slug.length > 0 ? slug : undefined;
    if (!word || out.some((one) => one.as === word)) continue;
    out.push({ as: word, title: typeof title === "string" ? title : word, kind: typeof kind === "string" ? kind : "" });
  }
  return out;
}

/** The app's places, as a sentence ends with them: each by its slug, and its title where that says more. */
export const placesSaid = (places: readonly (string | NamedPlace)[]) =>
  ` Its places: ${places.map((place) => (typeof place === "string" ? `"${place}"` : place.title && place.title !== place.as ? `"${place.as}" (${place.title})` : `"${place.as}"`)).join(", ") || "none"}.`;

/**
 * WHAT A HEADLESS RUN SAYS OF A PLACE IT CANNOT FIND, when its host did not
 * hand it the views it keeps (`runWorkerViewHeadless`'s `views`): a titled
 * view's place (`/places/<slug>`) is a place of the app the run was not
 * told of, so the run says what it does not know rather than that the
 * place is not there (Roadmap f-check-view-places).
 */
export const unsureOfViews = " This run was not handed the views the host keeps, so a titled view's place is not among these: if it names one, the link goes there.";

/** At most 80 characters of what a view asked for, ending "…" where it was cut: the sentence reaches the host's problems, and a view may ask for anything. */
export const quoted = (asked: string) => `"${asked.length > 80 ? `${asked.slice(0, 79)}…` : asked}"`;

/** Why a destination goes nowhere, naming where it could go. */
export const nowhere = (to: Destination, places: readonly (string | NamedPlace)[]) =>
  `${"place" in to ? `The place ${quoted(to.place)}` : `${quoted(to.record)} is no record this viewer may see and`} is no place of this app: it goes nowhere.${placesSaid(places)}`;

/** A link's `data-filter`, in the address's words (`stage:building,owner:user:ada`), as the `where` it says. */
export function whereOfWords(words: string): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const part of words.split(",")) {
    const colon = part.indexOf(":");
    if (colon > 0) out[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
  }
  return out;
}

