import type { GuestPlace } from "../protocol.js";

/*
 * LINKS STAY IN THE APP (FR-93).
 *
 * A worker view's link has no address of the page's: the open kit draws no
 * `href` at all (FR-90), so `<a href="https://…">` is text. What a view may
 * link to is a record or a named place of this app — `<a data-record="id">`,
 * `<a data-place="slug">` — and the host makes that a link: focusable, a
 * link to assistive technology, and followed by the host when the viewer
 * presses it or presses Enter on it, to a record the viewer may see or a
 * place the app has. A view's code asks the same with `graview.navigate`,
 * and is held to the same.
 *
 * A bare string is a record's id first and a place's slug second, so
 * `graview.navigate("pricing")` goes to the place when no record the
 * viewer may see has that id. One that is neither goes nowhere, and says
 * why — in the view's console and to the host — naming the places there
 * are, rather than doing nothing.
 */

export type Destination = { readonly record: string } | { readonly place: string };

export interface LinksOptions {
  /** Whether the viewer may see a record. */
  readonly sees: (id: string) => boolean;
  /** The app's named places. */
  readonly places: () => readonly GuestPlace[];
  /** Go: the face's own way to a record or a place. */
  readonly onNavigate?: (to: Destination) => void;
  /** It went nowhere: the sentence saying why. */
  readonly onLost?: (said: string) => void;
}

export interface Links {
  /** An `<a>` the view drew, or changed: a link if it names a record or a place, text if not. */
  link(anchor: Element): void;
  /** The viewer followed a link the host made. */
  follow(anchor: Element): void;
  /** Go somewhere: a record the viewer may see, else a place by that slug. Whether it went; where it did not, `onLost` hears why. */
  go(to: Destination): boolean;
}

/** The app's places, as a sentence ends with them. */
export const placesSaid = (slugs: readonly string[]) => ` Its places: ${slugs.map((slug) => `"${slug}"`).join(", ") || "none"}.`;

/** At most 80 characters of what a view asked for, ending "…" where it was cut: the sentence reaches the host's problems, and a view may ask for anything. */
export const quoted = (asked: string) => `"${asked.length > 80 ? `${asked.slice(0, 79)}…` : asked}"`;

/** Why a destination goes nowhere, naming where it could go. */
export const nowhere = (to: Destination, slugs: readonly string[]) =>
  `${"place" in to ? `The place ${quoted(to.place)}` : `${quoted(to.record)} is no record this viewer may see and`} is no place of this app: it goes nowhere.${placesSaid(slugs)}`;

export function createLinks(options: LinksOptions): Links {
  const go = (to: Destination) => {
    const slugs = options.places().map((place) => place.as);
    /* A record the viewer may see first, then a place by that slug. */
    const place = "place" in to ? to.place : options.sees(to.record) ? undefined : to.record;
    const ok = place === undefined || slugs.includes(place);
    if (ok) options.onNavigate?.(place === undefined ? to : { place });
    else options.onLost?.(nowhere(to, slugs));
    return ok;
  };
  return {
    link(anchor) {
      const goes = anchor.hasAttribute("data-record") || anchor.hasAttribute("data-place");
      if (goes && !anchor.hasAttribute("data-graview-link")) {
        anchor.setAttribute("data-graview-link", "");
        if (!anchor.hasAttribute("role")) anchor.setAttribute("role", "link");
        if (!anchor.hasAttribute("tabindex")) anchor.setAttribute("tabindex", "0");
      } else if (!goes && anchor.hasAttribute("data-graview-link")) {
        anchor.removeAttribute("data-graview-link");
        if (anchor.getAttribute("role") === "link") anchor.removeAttribute("role");
      }
    },
    follow(anchor) {
      const record = anchor.getAttribute("data-record");
      const place = anchor.getAttribute("data-place");
      if (record) go({ record });
      else if (place) go({ place });
    },
    go,
  };
}
