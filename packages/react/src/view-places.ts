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
