import type { GraviewApp } from "./app.js";
import { placesFrom, placesOf, type AppPlace } from "./app-places.js";
import { HOME_SLUG } from "./places.js";
import type { AnySchema } from "./schema/schema.js";
import type { HostView, PagesArrangement, Place } from "./views/types.js";

/*
 * THE NAMES A VIEW MAY SEND SOMEBODY TO (FR-235, Roadmap f-view-links-to-scene).
 *
 * A worker view's `<a data-place="overview">` passed the headless check —
 * Graview Cloud hands it the app's places as `placesOf` lists them, the
 * scene and the home among them — and did nothing on the page, where the
 * host judged the link against the registry's pictures alone and told the
 * owner the place "overview" was no place of this app. Two lists, two
 * answers. This is the one list: what a view may name by `data-place` or
 * `graview.navigate`, built the same way from the declaration
 * (`placeNamesOf`) and from what a face holds (`placeNamesFrom`), as
 * `placesOf` and `placesFrom` are one list for the bar and the connector.
 *
 * The vocabulary: `home` (the front page), `overview` (the Scene, under
 * whatever the declaration calls it), each kind's list by the slug its
 * address has, and each titled place — a declared lens, a view the host
 * keeps — by its slug. A kind the viewer is kept from, and every place
 * over it, is left out. Nothing else is a name.
 */

/** What one name a view may use is: the Scene, the home, a kind's list, or a titled place. */
export type PlaceNameIs = "overview" | "home" | "list" | "place";

/** One name a view may send somebody to: its slug, what a reader knows it as, the kind it is over, and what it is. */
export interface PlaceName {
  /** The word a link or `navigate` uses: `overview`, `home`, a kind's plural slug, a place's slug. */
  readonly as: string;
  /** What a reader knows it as: "Scene", "Home", "Features", "The board". */
  readonly title: string;
  /** The kind it is over; null for the Scene and the home. */
  readonly kind: string | null;
  readonly is: PlaceNameIs;
  /** Kept off the lists (`pages.hide`, a hidden lens); still a name a view may use. */
  readonly hidden?: boolean;
}

const nameOf = (place: AppPlace): PlaceName => ({
  as: place.slug,
  title: place.title,
  kind: place.kind,
  is: place.kind === null ? (place.slug === HOME_SLUG ? "home" : "overview") : place.address.startsWith("/places/") ? "place" : "list",
  ...(place.hidden ? { hidden: true } : {}),
});

/** Each name once, the first listed winning: a lens titled "Overview" does not take the Scene's word. */
function namesOf(listed: readonly AppPlace[], kept: ReadonlySet<string>): readonly PlaceName[] {
  const out: PlaceName[] = [];
  for (const place of listed) {
    if (place.kind !== null && kept.has(place.kind)) continue;
    if (place.over?.some((kind) => kept.has(kind))) continue;
    if (out.some((one) => one.as === place.slug)) continue;
    out.push(nameOf(place));
  }
  return out;
}

export interface PlaceNamesOptions {
  /** The views the host keeps, by their manifests: each titled view of many is a place a view may name. */
  readonly views?: readonly HostView[];
  /** The kinds the viewer is kept from: no list of theirs, and no place over them, is a name for this viewer. */
  readonly kept?: ReadonlySet<string>;
}

/**
 * THE NAMES A VIEW MAY USE, FROM THE DECLARATION: what the headless check
 * (`@graview/guest/headless`) and a host that describes a place hold a
 * link to. The same list `placeNamesFrom` builds from what a face holds.
 */
export function placeNamesOf<S extends AnySchema>(app: GraviewApp<S>, options: PlaceNamesOptions = {}): readonly PlaceName[] {
  return namesOf(placesOf(app, options.views ? { views: options.views } : {}), options.kept ?? new Set());
}

/**
 * THE SAME NAMES FROM WHAT A FACE HOLDS: the schema, the places its view
 * registry names (each declared lens, each registered picture, each titled
 * view the host keeps), and the arrangement — what the live host of a
 * worker view judges a link by (`@graview/guest`'s `createLinks`), and what
 * the routed face and the Scene go to. One builder with `placeNamesOf`, so
 * the check and the page can never disagree about which names exist.
 */
export function placeNamesFrom(schema: AnySchema, places: readonly Place[], options: { readonly pages?: PagesArrangement; readonly kept?: ReadonlySet<string> } = {}): readonly PlaceName[] {
  return namesOf(placesFrom(schema, places, options.pages ? { pages: options.pages } : {}), options.kept ?? new Set());
}
