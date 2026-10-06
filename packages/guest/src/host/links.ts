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
 */

export type Destination = { readonly record: string } | { readonly place: string };

export interface LinksOptions {
  /** Whether the viewer may see a record. */
  readonly sees: (id: string) => boolean;
  /** The app's named places. */
  readonly places: () => readonly GuestPlace[];
  /** Go: the face's own way to a record or a place. */
  readonly onNavigate?: (to: Destination) => void;
}

export interface Links {
  /** An `<a>` the view drew, or changed: a link if it names a record or a place, text if not. */
  link(anchor: Element): void;
  /** The viewer followed a link the host made. */
  follow(anchor: Element): void;
  /** Go somewhere, if it is a record the viewer may see or a place of the app. Whether it went. */
  go(to: Destination): boolean;
}

export function createLinks(options: LinksOptions): Links {
  const go = (to: Destination) => {
    const ok = "record" in to ? typeof to.record === "string" && options.sees(to.record) : options.places().some((place) => place.as === to.place);
    if (ok) options.onNavigate?.(to);
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
