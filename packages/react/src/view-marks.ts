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
 * facts, the links and what can be done.
 */
export const REPLACES_PAGE: unique symbol = Symbol.for("graview.replaces-page");

/** Marks a view of one record as the whole record page. Returns the same component. */
export function markReplacesPage<V extends object>(view: V): V {
  Object.defineProperty(view, REPLACES_PAGE, { value: true, enumerable: false });
  return view;
}

/** Whether a view of one record replaces the whole record page. */
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
