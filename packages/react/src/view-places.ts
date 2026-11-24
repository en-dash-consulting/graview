import { RECORD_BOXES_ATTRIBUTE, recordBoxAt, recordBoxesOf } from "@graview/core/record-boxes";

/*
 * A SECTION OF A VIEW, UNDER THE CURSOR (Roadmap f-make-this-section-better).
 *
 * A worker view draws in a shadow root of its own, so a face's menu sees
 * only the view's region under a right-click. What it was on inside is
 * found here: the nearest part a person would call a section — an element
 * the view marked `data-section`, a `<section>` or another landmark (drawn
 * by the host as a `<div data-graview-as>`), a `role="region"`, else the
 * block a heading begins — named the way `sectionsOfDrawing`
 * (`@graview/core/revisions`) names one, so the menu says "This week".
 *
 * And the view's place lends what revising it needs, as a handle the
 * worker view's host sets on the element it is drawn in
 * (`data-worker-view-place`): its code, its look, what it drew, a draft
 * drawn in its place, and the code it draws from now on. Faces and the
 * section's card reach it by the element alone, never by importing the
 * worker view's host.
 */

/** A section of a view, as a menu is opened on it. */
export interface MenuViewSection {
  /** What a person would call it: its `data-section`, its label, its heading's words. */
  readonly name: string;
  /** The view it is in, by its manifest name. */
  readonly view: string;
  /** The elements it is drawn as: the section's own, or a heading and the siblings it heads. */
  readonly elements: readonly Element[];
}

/** What a view drew: its root, the stylesheet it drew with, and how tall it stands. */
export interface ViewPlaceDrawing {
  readonly root: Element | undefined;
  readonly css: string;
  readonly height: number | undefined;
}

/** What pressing every control a view drew came to: each control by its name, what it does, and whether it worked, in a sentence. */
export interface ViewPresses {
  readonly ok: boolean;
  readonly controls: readonly { readonly control: string; readonly element: string; readonly does: string; readonly ok: boolean; readonly says: string }[];
  readonly problems: readonly { readonly control: string; readonly element: string; readonly does: string; readonly ok: boolean; readonly says: string }[];
}

/** A draft drawn in the view's place: drawn (or why not), what it drew, and put away. */
export interface ViewPlaceDraft {
  /** Resolves once the draft drew, or failed, or was given up on: `failed` says why, in a sentence. */
  readonly drawn: Promise<{ readonly failed?: string }>;
  drawing(): ViewPlaceDrawing;
  /** What of the draft's drawing and stylesheet the host refused, in sentences. */
  refused(): readonly string[];
  dispose(): void;
}

/**
 * WHAT A VIEW'S PLACE LENDS ITS REVISION: set by the worker view's host on
 * the element the view is drawn in.
 */
export interface ViewPlaceHandle {
  /** The manifest's name, and its title. */
  readonly name: string;
  readonly title: string;
  /** The view's plain script (`{ source }`), as it draws now; undefined for a whole worker script, which is not revised here. */
  source(): Promise<string | undefined>;
  /** The app's look the view is drawn with: its scheme and its `--graview-*` tokens' values. */
  theme(): Promise<Readonly<Record<string, string>>>;
  /** What the view drew, as it stands. */
  drawing(): ViewPlaceDrawing;
  /** What of its drawing and stylesheet the host refused, in sentences. */
  refused(): readonly string[];
  /** What in this code keeps the host from running it, in sentences: empty when it may run. */
  check(source: string): Promise<readonly string[]>;
  /**
   * EVERY CONTROL IT WOULD DRAW, PRESSED (Roadmap f-views-work-end-to-end):
   * this code run headless for this seat, each bound act rehearsed with
   * nothing applied, each link followed, each control its own code hears
   * pressed in a run of its own — what each does, and which fail. Optional:
   * a host that cannot run a view headless lends none.
   */
  presses?(source: string): Promise<ViewPresses>;
  /** Draws this code in the view's place over the view, which is hidden until the draft is put away. */
  draft(source: string): ViewPlaceDraft;
  /** Draws this code from now on in this page (a revision kept); undefined goes back to the view's own. */
  draw(source: string | undefined): void;
}

const PLACES = /* @__PURE__ */ new WeakMap<Element, ViewPlaceHandle>();

/** Sets (or, with null, takes away) what a view's place lends. */
export function setViewPlace(element: Element, handle: ViewPlaceHandle | null): void {
  if (handle) PLACES.set(element, handle);
  else PLACES.delete(element);
}

/** What the view drawn in this element (`data-worker-view-place`) lends, if any. */
export function viewPlaceOf(element: Element | null | undefined): ViewPlaceHandle | undefined {
  return element ? PLACES.get(element) : undefined;
}


/*
 * FINDING THE SECTION IS FETCHED ON THE FIRST RIGHT-CLICK INSIDE A VIEW
 * (`view-sections.ts`): a page that never right-clicks a view carries none
 * of it. A face asks `sectionUnderNow` and, inside a view before it has
 * arrived, waits for `sectionsArrive()` and opens the menu then.
 */
let finding: ((element: Element) => MenuViewSection | undefined) | undefined;
let arriving: Promise<unknown> | undefined;
const besides = /* @__PURE__ */ new Set<() => Promise<unknown>>();

/** Something else to fetch with the finder: what a face offers on a section ("Make this better"), so its menu opens whole. */
export function alsoWhenSectionsArrive(load: () => Promise<unknown>): void {
  besides.add(load);
}

/** Fetches the section finder, once, and what is fetched beside it; resolves when `sectionUnderNow` can answer (or never will, should it not arrive). */
export function sectionsArrive(): Promise<unknown> {
  return (arriving ??= Promise.all([import("./view-sections.js"), ...[...besides].map((load) => load())]).then(([module]) => void (finding = module.sectionUnder)));
}

/** The section of a view under an element, once the finder has arrived (`sectionsArrive`); else undefined. */
export function sectionUnderNow(element: Element | null | undefined): MenuViewSection | undefined {
  return element && finding ? finding(element) : undefined;
}

/** Whether a right-click on a page's own parts, outside any view, must wait for what a face offers on them ("Make “Tasks” better") before the menu opens. */
export const partsWanted = (): boolean => finding === undefined && besides.size > 0;

/** Whether a right-click at this element must wait for the finder before the menu opens. */
export const sectionsWanted = (element: Element | null | undefined): boolean => finding === undefined && (element?.getRootNode() as { host?: Element } | undefined)?.host?.hasAttribute("data-worker-view") === true;

/*
 * THE RECORD UNDER THE POINTER, INSIDE A VIEW (Graview HQ
 * feature:f-view-menu-suggests-under-pointer). A press inside a worker view
 * reaches a face as a press on the view's region — its shadow root is
 * retargeted away — so the menu, its Suggested rows, its AI section and the
 * hover chip were about the whole view wherever in it the pointer was. The
 * record is found here from what the view's host already measured and
 * judged of it: the boxes it holds on the region (`@graview/core/record-boxes`),
 * each a record the view was handed that this seat may see. What the view
 * wrote is never taken on its word; a point on no such box is the view's
 * own ground, and the menu stays about the view's place.
 */

/** A record a view drew, under a press. */
export interface RecordInView {
  /** The record, as the view's host judged it. */
  readonly id: string;
  /** What it is drawn as under the press: the nearest element marked for it, else what was pressed. */
  readonly element: Element;
  /** The element the view is drawn in, which holds its records' boxes. */
  readonly view: Element;
}

/** An element's parent, out through a shadow root to its host. */
const upFrom = (element: Element): Element | null => element.parentElement ?? (element.getRootNode() as { host?: Element }).host ?? null;

/** The middle of an element, in the window's pixels. */
const middleOf = (element: Element) => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

/**
 * The record a view drew at a point (in the window's pixels), found from
 * `inner` — what was under the press, inside the view's shadow root — up to
 * the element that holds the view's record boxes. Without a point, the
 * middle of what is marked there (the keyboard's press, a resting pointer).
 */
export function recordInView(inner: Element | null | undefined, point?: { readonly x: number; readonly y: number }): RecordInView | undefined {
  if (!inner) return undefined;
  let marked: Element | null = null;
  for (let at: Element | null = inner; at; at = upFrom(at)) {
    if (at.hasAttribute(RECORD_BOXES_ATTRIBUTE)) {
      // A press on the region itself, not on what the view drew in it, is on none of its records.
      if (at === inner) return undefined;
      const held = recordBoxesOf(at);
      if (!held) return undefined;
      const box = at.getBoundingClientRect();
      const wide = (at as HTMLElement).offsetWidth;
      // The page may be scaled as it moves a level: the boxes are in the region's own pixels.
      const scale = wide > 0 && box.width > 0 ? box.width / wide : 1;
      const under = marked ?? inner;
      const boxes = held.boxes();
      // No point (the keyboard, a rest): the record marked there, where its host judged it drawn — else what is drawn at its middle.
      const own = point ? undefined : marked?.getAttribute("data-record");
      const named = own ? boxes.find((one) => one.id === own) : undefined;
      if (named) return { id: named.id, element: under, view: at };
      const from = point ?? middleOf(under);
      const found = recordBoxAt(boxes, (from.x - box.left) / scale, (from.y - box.top) / scale);
      return found ? { id: found.id, element: under, view: at } : undefined;
    }
    if (marked === null && at.hasAttribute("data-record")) marked = at;
  }
  return undefined;
}

/** A box in the window's pixels. */
export interface BoxOnPage {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * WHERE THE RECORDS A VIEW DREW STAND ON THE PAGE: the boxes its host
 * judged, found from `element` (inside the view's shadow root, or the
 * region itself) up to the element that holds them, each in the window's
 * pixels — the region's own pixels scaled as the page is and moved to where
 * the region stands now, so a scroll or a level's scale is allowed for.
 * Undefined outside a view.
 */
export function recordBoxesOnPage(element: Element): readonly (BoxOnPage & { readonly id: string })[] | undefined {
  for (let at: Element | null = element; at; at = upFrom(at)) {
    if (!at.hasAttribute(RECORD_BOXES_ATTRIBUTE)) continue;
    const held = recordBoxesOf(at);
    if (!held) return undefined;
    const box = at.getBoundingClientRect();
    const wide = (at as HTMLElement).offsetWidth;
    const scale = wide > 0 && box.width > 0 ? box.width / wide : 1;
    return held.boxes().map((one) => ({ id: one.id, left: box.left + one.x * scale, top: box.top + one.y * scale, width: one.width * scale, height: one.height * scale }));
  }
  return undefined;
}

/** The element a face's own reading sees for this one: itself, or the host of the shadow root it is drawn in (a worker view's region), outward. */
export function outOfViews(element: Element): Element {
  let at = element;
  for (let host = (at.getRootNode() as { host?: Element }).host; host; host = (at.getRootNode() as { host?: Element }).host) at = host;
  return at;
}
