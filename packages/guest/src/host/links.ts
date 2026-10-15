import { kindPath, type AnySchema } from "@graview/core";
import { sectionSlug } from "@graview/core/navigate";
import { filterOfWhere } from "./where.js";
import type { GuestPlace } from "../protocol.js";
import { nowhere, quoted, whereOfWords } from "./links-words.js";

export { nowhere, placesSaid, quoted, whereOfWords } from "./links-words.js";

/*
 * LINKS STAY IN THE APP (FR-93).
 *
 * A worker view's link has no address of the page's: the open kit draws no
 * `href` at all (FR-90), so `<a href="https://…">` is text. What a view may
 * link to is a record, a named place or a kind's list of this app —
 * `<a data-record="id">`, `<a data-place="slug">` — and the host makes that
 * a link: focusable, a link to assistive technology, and followed by the
 * host when the viewer presses it or presses Enter on it, to a record the
 * viewer may see, a place the app has, or a list of a kind the viewer sees.
 * A view's code asks the same with `graview.navigate`, and is held to the
 * same.
 *
 * A bare string is a record's id first and a place's slug second, so
 * `graview.navigate("pricing")` goes to the place when no record the
 * viewer may see has that id. A place's slug is a lens's first, then a
 * kind's list, by its plural (`features`) or its name (`feature`). One that
 * is neither goes nowhere, and says why — in the view's console and to the
 * host — naming the places there are, rather than doing nothing.
 *
 * NARROWED, AND TO A SECTION. A list or a place may be gone to narrowed —
 * `{ place: "features", where: { stage: "building" } }`, `data-filter=
 * "stage:building"` on a link — held to what the kind can be filtered by
 * (`filterOfWhere`), and any destination to a section of its page,
 * `section: "shipping-soon"` (`data-section`). A filter on a field the kind
 * does not have is refused in a sentence, as a place that is not there is.
 */

export type { Destination } from "./links-words.js";
import type { Destination } from "./links-words.js";

/** Where the host goes, judged: a record, a place, or a kind's list — narrowed and to a section, as asked. */
export type Arrival =
  | { readonly record: string; readonly section?: string }
  | { readonly place: string; readonly filter?: string; readonly section?: string }
  | { readonly list: string; readonly filter?: string; readonly section?: string };

/** A kind's list, as a view may name it: by its plural's slug (`features`) or the kind's name. */
export interface GuestList {
  readonly slug: string;
  readonly kind: string;
}

/** Every kind's list a viewer sees, by the address its list has (`/<plural>`). */
export function listsOf(schema: AnySchema, kept: ReadonlySet<string> = new Set()): readonly GuestList[] {
  return (schema.kinds as readonly string[]).filter((kind) => !kept.has(kind)).map((kind) => ({ slug: kindPath(schema, kind).slice(1), kind }));
}

export interface LinksOptions {
  /** Whether the viewer may see a record. */
  readonly sees: (id: string) => boolean;
  /** The app's named places. */
  readonly places: () => readonly GuestPlace[];
  /** The kinds' lists the viewer may go to; none unless given. */
  readonly lists?: () => readonly GuestList[];
  /** The schema a filter is held to; no filter is followed without it. */
  readonly schema?: AnySchema;
  /** Go: the face's own way to a record, a place or a list. */
  readonly onNavigate?: (to: Arrival) => void;
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

export interface JudgeDestinationInput {
  readonly sees: (id: string) => boolean;
  readonly places: readonly GuestPlace[];
  readonly lists: readonly GuestList[];
  readonly schema?: AnySchema;
}

/**
 * WHERE A VIEW ASKED TO GO, JUDGED — by the live host and by a headless run
 * alike: the arrival, or the sentence saying why it goes nowhere.
 */
export function judgeDestination(to: Destination, input: JudgeDestinationInput): { readonly ok: true; readonly arrival: Arrival } | { readonly ok: false; readonly says: string } {
  const placeSlugs = [...new Set(input.places.map((place) => place.as))];
  const listSlugs = input.lists.map((list) => list.slug).filter((slug) => !placeSlugs.includes(slug));
  /* A section is a heading's words or an element's id: some letters or digits, and not a paragraph. */
  let section: string | undefined;
  if (to.section !== undefined && to.section !== null) {
    if (typeof to.section !== "string" || sectionSlug(to.section).length === 0 || to.section.length > 120) {
      return { ok: false, says: `The section ${typeof to.section === "string" ? quoted(to.section) : "asked for"} names nothing on a page: a section is a heading's words or an element's id, like "shipping-soon". It goes nowhere.` };
    }
    section = to.section;
  }
  const also = section !== undefined ? { section } : {};
  /* A record the viewer may see first, then a place by that slug. */
  if ("record" in to && input.sees(to.record)) {
    if (to.where !== undefined && to.where !== null) return { ok: false, says: `${quoted(to.record)} is one record, and a filter narrows a list or a place: it goes nowhere. Go to { place, where } for a list narrowed.` };
    return { ok: true, arrival: { record: to.record, ...also } };
  }
  const asked = "place" in to ? to.place : to.record;
  const place = input.places.find((one) => one.as === asked);
  const list = place ? undefined : input.lists.find((one) => one.slug === asked || one.kind === asked);
  if (!place && !list) return { ok: false, says: `${nowhere(to, placeSlugs)}${listsSaid(listSlugs)}` };
  const kinds = place ? [place.kind] : [list!.kind];
  let filter: string | undefined;
  if (to.where !== undefined && to.where !== null) {
    if (!input.schema) return { ok: false, says: `The place ${quoted(asked)} cannot be narrowed here: it goes nowhere.` };
    const judged = filterOfWhere(input.schema, kinds, to.where, { through: list !== undefined });
    if (!judged.ok) return { ok: false, says: `The filter on ${quoted(asked)} goes nowhere: ${judged.says}` };
    filter = judged.filter;
  }
  const narrowed = filter ? { filter } : {};
  return { ok: true, arrival: place ? { place: place.as, ...narrowed, ...also } : { list: list!.kind, ...narrowed, ...also } };
}

/** The kinds' lists, as a sentence ends with them: the first eight, and how many more. */
const listsSaid = (slugs: readonly string[]) =>
  slugs.length === 0 ? "" : ` Its lists: ${slugs.slice(0, 8).map((slug) => `"${slug}"`).join(", ")}${slugs.length > 8 ? ` and ${slugs.length - 8} more` : ""}.`;

export function createLinks(options: LinksOptions): Links {
  const go = (to: Destination) => {
    const judged = judgeDestination(to, { sees: options.sees, places: options.places(), lists: options.lists?.() ?? [], ...(options.schema ? { schema: options.schema } : {}) });
    if (judged.ok) options.onNavigate?.(judged.arrival);
    else options.onLost?.(judged.says);
    return judged.ok;
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
      const filter = anchor.getAttribute("data-filter");
      const section = anchor.getAttribute("data-section");
      const also = { ...(filter ? { where: whereOfWords(filter) } : {}), ...(section ? { section } : {}) };
      if (record) go({ record, ...also });
      else if (place) go({ place, ...also });
    },
    go,
  };
}
