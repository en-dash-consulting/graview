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

const LANDMARK = /* @__PURE__ */ new Set(["section", "article", "nav", "aside", "header", "footer", "main", "form", "region", "search"]);
const HEADING = /^h([1-6])$/;
const words = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
const tagOf = (element: Element) => (element.getAttribute("data-graview-as") ?? element.localName).toLowerCase();
const levelOf = (element: Element): number | undefined => {
  const tag = HEADING.exec(tagOf(element));
  if (tag) return Number(tag[1]);
  return element.getAttribute("role") === "heading" ? Number(element.getAttribute("aria-level") ?? 2) : undefined;
};

/** A landmark's name: its `data-section`, its `aria-label`, what labels it, else its first heading's words. */
function nameOf(element: Element): string {
  const marked = words(element.getAttribute("data-section"));
  if (marked) return marked;
  const label = words(element.getAttribute("aria-label"));
  if (label) return label;
  const root = element.getRootNode() as ParentNode & { getElementById?: (id: string) => Element | null };
  const by = (element.getAttribute("aria-labelledby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => words(root.getElementById?.(id)?.textContent ?? (root as ParentNode).querySelector?.(`#${CSS.escape(id)}`)?.textContent))
    .filter(Boolean)
    .join(" ");
  if (by) return by;
  for (const inner of element.querySelectorAll("*")) if (levelOf(inner) !== undefined) return words(inner.textContent);
  return "";
}

/** Whether an element is a section of its own: marked, a landmark, a region. */
const isSection = (element: Element) => element.hasAttribute("data-section") || LANDMARK.has(tagOf(element)) || element.getAttribute("role") === "region";

/** A heading and the siblings after it, up to the next heading as high or higher. */
function headedBlock(heading: Element): Element[] {
  const level = levelOf(heading) ?? 6;
  const block = [heading];
  for (let at = heading.nextElementSibling; at; at = at.nextElementSibling) {
    const next = levelOf(at);
    if (next !== undefined && next <= level) break;
    block.push(at);
  }
  return block;
}

/**
 * THE SECTION OF A VIEW UNDER AN ELEMENT: the element itself under a
 * press, inside a worker view's shadow root. Nothing outside a view, and
 * nothing for a part with no name a person could say.
 */
export function sectionUnder(element: Element | null | undefined): MenuViewSection | undefined {
  if (!element) return undefined;
  const root = element.getRootNode();
  if (typeof ShadowRoot === "undefined" || !(root instanceof ShadowRoot)) return undefined;
  const view = root.host.getAttribute("data-worker-view");
  if (!view) return undefined;
  /* A section of its own around it — marked, a landmark, a region — before any heading's block inside one. */
  for (let at: Element | null = element; at; at = at.parentElement) {
    if (!isSection(at)) continue;
    const name = nameOf(at);
    if (name) return { name, view, elements: [at] };
  }
  /* Else a heading's block: the heading itself, or the nearest one before it among its siblings, up the tree. */
  for (let at: Element | null = element; at; at = at.parentElement) {
    for (let before: Element | null = at; before; before = before.previousElementSibling) {
      if (levelOf(before) === undefined) continue;
      const block = headedBlock(before);
      if (!block.includes(at)) break;
      const name = words(before.textContent);
      if (name) return { name, view, elements: block };
      break;
    }
  }
  return undefined;
}

/** The element a view is drawn in (`data-worker-view-place`), from a section of it. */
export function placeOfSection(section: MenuViewSection): Element | undefined {
  const first = section.elements[0];
  const root = first?.getRootNode();
  if (typeof ShadowRoot === "undefined" || !(root instanceof ShadowRoot)) return undefined;
  return root.host.closest("[data-worker-view-place]") ?? root.host.parentElement ?? undefined;
}
