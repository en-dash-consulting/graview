/*
 * THE MARKS A VIEW CARRIES, in a file of their own: a page that only asks
 * what a view is — a worker view of one record (FR-149) — carries none of
 * the registry.
 */

/**
 * The mark a framework-supplied view carries, so a scene can tell a group
 * shown by the framework's own list from one an app gave a picture of its
 * own. From altitude the first is its district; the second keeps its card.
 */
export const DEFAULT_VIEW: unique symbol = Symbol.for("graview.default-view");

/** Marks a view as the framework's own. Returns the same component. */
export function markDefaultView<V extends object>(view: V): V {
  Object.defineProperty(view, DEFAULT_VIEW, { value: true, enumerable: false });
  return view;
}

/** Whether a view is the framework's own rather than the app's. */
export function isDefaultView(view: unknown): boolean {
  return typeof view === "function" && (view as { [DEFAULT_VIEW]?: boolean })[DEFAULT_VIEW] === true;
}

/**
 * The mark a record's own view carries when it replaces the whole record
 * page (FR-149): a worker view whose manifest says `replaces: "page"`. The
 * pages face then draws it alone under the record's heading, without the
 * facts, the links and what can be done. On a kind's view of many (FR-203),
 * it is the kind's list page: drawn under the list's heading, without the
 * list.
 */
export const REPLACES_PAGE: unique symbol = Symbol.for("graview.replaces-page");

/** Marks a view as the whole of its page: a record's, or its kind's list. Returns the same component. */
export function markReplacesPage<V extends object>(view: V): V {
  Object.defineProperty(view, REPLACES_PAGE, { value: true, enumerable: false });
  return view;
}

/** Whether a view replaces the whole of its page: a record's, or its kind's list. */
export function replacesPage(view: unknown): boolean {
  return typeof view === "function" && (view as { [REPLACES_PAGE]?: boolean })[REPLACES_PAGE] === true;
}

/**
 * The mark a view carries when it is drawn edge to edge on a phone (a
 * worker view whose manifest says `bleed: true`): the pages face takes the
 * page's side gutter back for it there, keeping the safe areas, so the view
 * is the phone's width. At a desk it is the column's width, as any view is.
 */
export const BLEEDS: unique symbol = Symbol.for("graview.bleeds");

/** Marks a view as drawn edge to edge on a phone. Returns the same component. */
export function markBleeds<V extends object>(view: V): V {
  Object.defineProperty(view, BLEEDS, { value: true, enumerable: false });
  return view;
}

/** Whether a view is drawn edge to edge on a phone. */
export function bleeds(view: unknown): boolean {
  return typeof view === "function" && (view as { [BLEEDS]?: boolean })[BLEEDS] === true;
}

/**
 * The mark a view of a kind's members carries when the Scene draws it as a
 * PREVIEW (Roadmap f-view-content-height): a worker view, which is as tall
 * as what it draws. The Scene draws it as a card — its title, as much of
 * it as fits, at most its content height and at most `maxHeight`, faded at
 * the foot where there is more, and Open, to its place — never as the
 * whole of it, standing taller than everything around it.
 */
export const PREVIEWS: unique symbol = Symbol.for("graview.previews");

/** How a previewed view is held on the Scene: the tallest it is drawn, in pixels, where it says. */
export interface ScenePreviewing {
  readonly maxHeight?: number;
}

/** Marks a view as drawn on the Scene as a preview. Returns the same component. */
export function markPreviews<V extends object>(view: V, how: ScenePreviewing = {}): V {
  Object.defineProperty(view, PREVIEWS, { value: how, enumerable: false });
  return view;
}

/** How a view is previewed on the Scene, or `undefined` where it is drawn whole. */
export function previewOf(view: unknown): ScenePreviewing | undefined {
  return typeof view === "function" ? (view as { [PREVIEWS]?: ScenePreviewing })[PREVIEWS] : undefined;
}
