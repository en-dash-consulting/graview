import { kindPath, type AnySchema } from "@graview/core";
import { sectionSlug } from "@graview/core/navigate";
import { filterOfWhere } from "./where.js";
import type { GuestPlace } from "../protocol.js";
import { nowhere, placeNamed, quoted, whereOfWords } from "./links-words.js";
import { carriesItsLink, isEntry, linkPressed, opensOnPress, takesRole } from "./pressable.js";

export { nowhere, placesSaid, quoted, whereOfWords } from "./links-words.js";

/*
 * LINKS STAY IN THE APP (FR-93).
 *
 * A worker view's link has no address of the page's: the open kit draws an
 * `href` only out of the app, to an address the view was handed (2026-10-21,
 * host/external-links.ts), and never one of the app's. What a view may
 * link to is a record, a named place or a kind's list of this app —
 * `<a data-record="id">`, `<a data-place="slug">` — and the host makes that
 * a link: focusable, a link to assistive technology, and followed by the
 * host when the viewer presses it or presses Enter on it, to a record the
 * viewer may see, a place the app has, or a list of a kind the viewer sees.
 *
 * ANY ELEMENT, NOT ONLY AN `<a>` (0.1.45): a card `<div data-record>` with
 * a heading and badges inside is a link the same way, followed on a click,
 * a phone's tap and Enter — a tap on its heading as much as on its edge —
 * unless the press lands on something inside with a press of its own, or
 * the element is a press scope (a fieldset, an element bound to an act, a
 * form). pressable.ts says which, and how a tap reaches it.
 *
 * A REAL LINK, WITH AN ADDRESS (0.1.47): on a face whose places are
 * addresses (the routed pages), an `<a data-record>` or `<a data-place>`
 * carries the address the host would go to as its `href`, which the view
 * never writes. A plain click, a tap and Enter are still followed in the
 * app; a press with Ctrl, Cmd, Shift or Alt, or a middle click, is the
 * browser's — a new tab, a new window. Where there is no address (the
 * scene), the link is given the keyboard and a link's role instead. A
 * `<button data-record>` is followed the same way; a button bound to an
 * act (`data-act`) is that act's press, and its `data-record` the act's
 * record. A table's row keeps its role: its first cell takes the keyboard,
 * and Enter there follows the row. An `<a>` in the view's SVG is a link
 * the same way (2026-10-23), with its address and the keyboard. A card
 * that carries its own link on its heading takes no role and no tab stop
 * (pressable.ts, `carriesItsLink`): a press on it is still followed.
 *
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
  /**
   * The address going there arrives at, as the face writes it (`GoTo.href`):
   * what an `<a data-record>` or `<a data-place>` carries as its `href`.
   * None where the face's places are no addresses (the scene).
   */
  readonly hrefOf?: (to: Arrival) => string | undefined;
  /** It went nowhere: the sentence saying why. */
  readonly onLost?: (said: string) => void;
}

export interface Links {
  /** An element the view drew, or changed: a link if it names a record or a place and is no press scope of its own (pressable.ts), not one if not. */
  link(element: Element): void;
  /** Every element under `root` that names a record or a place, or was a link, looked at again: what it holds may have changed. */
  refresh(root: ParentNode): void;
  /** A click, a tap or Enter on what the view drew: the link it lands in is followed, and the event kept from the face around it. Whether one was. */
  pressed(event: Event, at: Element, root: Element): boolean;
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
  const place = placeNamed(input.places, asked);
  const list = place ? undefined : input.lists.find((one) => one.slug === asked || one.kind === asked);
  if (!place && !list) return { ok: false, says: `${nowhere(to, input.places.filter((one, at, all) => all.findIndex((other) => other.as === one.as) === at))}${listsSaid(listSlugs)}` };
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

const HTML = "http://www.w3.org/1999/xhtml";
const SVG = "http://www.w3.org/2000/svg";
/** A modified press — a new tab, a new window, a download — or a button not the main one: the browser's to take, where the link has an address. */
const modified = (event: Event) => {
  const mouse = event as MouseEvent;
  return mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey || (event.type === "click" && typeof mouse.button === "number" && mouse.button !== 0);
};

export function createLinks(options: LinksOptions): Links {
  /* What the host gave the keyboard or a role, so it is taken back if the element stops being a link or is given an address. */
  const tabbed = new WeakSet<Element>();
  const roled = new WeakSet<Element>();
  /* The address the host gave an `<a>`, and the target the open kit had given it, so both are put back as they were. */
  const addressed = new WeakMap<Element, { readonly href: string; readonly target: string | null }>();
  /* A row keeps its own role, so its first cell takes the keyboard for it. */
  const rowCells = new WeakMap<Element, Element>();
  const judge = (to: Destination) => judgeDestination(to, { sees: options.sees, places: options.places(), lists: options.lists?.() ?? [], ...(options.schema ? { schema: options.schema } : {}) });
  const go = (to: Destination) => {
    const judged = judge(to);
    if (judged.ok) options.onNavigate?.(judged.arrival);
    else options.onLost?.(judged.says);
    return judged.ok;
  };
  /** Where an element the view drew says to go, in the words `go` takes; nothing where it names nowhere. */
  const destinationOf = (element: Element): Destination | undefined => {
    const record = element.getAttribute("data-record");
    const place = element.getAttribute("data-place");
    const filter = element.getAttribute("data-filter");
    const section = element.getAttribute("data-section");
    const also = { ...(filter ? { where: whereOfWords(filter) } : {}), ...(section ? { section } : {}) };
    if (record) return { record, ...also };
    if (place) return { place, ...also };
    return undefined;
  };
  /** The address a link goes to, as the face writes it: none where the face has no addresses, or the link goes nowhere. */
  const addressOf = (element: Element): string | undefined => {
    if (!options.hrefOf) return undefined;
    const to = destinationOf(element);
    const judged = to ? judge(to) : undefined;
    return judged?.ok ? options.hrefOf(judged.arrival) : undefined;
  };
  const tab = (element: Element) => {
    if (element.hasAttribute("tabindex")) return false;
    element.setAttribute("tabindex", "0");
    tabbed.add(element);
    return true;
  };
  const untab = (element: Element) => {
    if (tabbed.delete(element)) element.removeAttribute("tabindex");
  };
  const unrole = (element: Element) => {
    if (roled.delete(element) && element.getAttribute("role") === "link") element.removeAttribute("role");
  };
  const unaddress = (element: Element) => {
    const had = addressed.get(element);
    if (!had) return;
    addressed.delete(element);
    if (element.getAttribute("href") === had.href) element.removeAttribute("href");
    if (had.target !== null && !element.hasAttribute("target")) element.setAttribute("target", had.target);
  };
  const unrow = (row: Element) => {
    const cell = rowCells.get(row);
    if (!cell) return;
    rowCells.delete(row);
    untab(cell);
  };
  const links: Links = {
    link(element) {
      const goes = opensOnPress(element, [...element.querySelectorAll("input, select, textarea")].some(isEntry));
      if (!goes) {
        if (!element.hasAttribute("data-graview-link")) return;
        element.removeAttribute("data-graview-link");
        unrole(element);
        untab(element);
        unaddress(element);
        unrow(element);
        return;
      }
      if (!element.hasAttribute("data-graview-link")) element.setAttribute("data-graview-link", "");
      /*
       * A REAL LINK (0.1.47): an `<a>` bound to a record or a place carries
       * the address the face goes to, so it is a link to the browser as to a
       * person — opened in a new tab, copied, its address shown on hover. A
       * view never writes it: an `href` the view gave is a link out
       * (external-links.ts), left as the open kit drew it.
       */
      const anchor = element.localName === "a" && (element.namespaceURI === HTML || element.namespaceURI === SVG);
      const given = element.getAttribute("href");
      const own = addressed.get(element);
      const viewsOwn = given !== null && own?.href !== given;
      const address = anchor && !viewsOwn ? addressOf(element) : undefined;
      if (address !== undefined) {
        if (given !== address) element.setAttribute("href", address);
        addressed.set(element, { href: address, target: own ? own.target : element.getAttribute("target") });
        /* In this tab, as the app's own links go: the open kit opens a link out in a tab of its own. */
        element.removeAttribute("target");
        /* A link with an address is a link, and takes the keyboard, of itself: what the host gave it in their place is taken back. */
        unrole(element);
        untab(element);
        return;
      }
      if (viewsOwn) addressed.delete(element);
      else unaddress(element);
      /* A card whose heading carries its link: the `<a>` is the keyboard's and the screen reader's, the card a pointer's target only. */
      if (carriesItsLink(element, element.querySelectorAll("a"))) {
        unrole(element);
        untab(element);
        unrow(element);
        return;
      }
      if (!element.hasAttribute("role") && (anchor || takesRole(element))) {
        element.setAttribute("role", "link");
        roled.add(element);
      }
      /* A table's row keeps its role, so its first cell takes the keyboard, and Enter there follows the row. */
      if (element.localName === "tr" && element.namespaceURI === HTML) {
        untab(element);
        const cell = [...element.children].find((child) => child.localName === "td" || child.localName === "th");
        if (rowCells.get(element) !== cell) unrow(element);
        if (cell && !rowCells.has(element) && tab(cell)) rowCells.set(element, cell);
        return;
      }
      if (element.localName !== "button") tab(element);
    },
    refresh(root) {
      for (const element of root.querySelectorAll("[data-record], [data-place], [data-graview-link]")) links.link(element);
    },
    pressed(event, at, root) {
      if (event.type !== "click" && !(event.type === "keydown" && (event as KeyboardEvent).key === "Enter")) return false;
      const link = linkPressed(at, root, (on) => on.hasAttribute("data-graview-link"));
      if (!link) return false;
      /* Followed here, and nowhere else: the face around the view does not also take the press for a press on the card. */
      event.stopPropagation();
      /* A modified press on a link with an address — a new tab, a new window — is the browser's, as on any link. */
      if (addressed.has(link) && modified(event)) return true;
      event.preventDefault();
      links.follow(link);
      return true;
    },
    follow(anchor) {
      const to = destinationOf(anchor);
      if (to) go(to);
    },
    go,
  };
  return links;
}
