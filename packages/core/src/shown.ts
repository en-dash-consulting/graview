/**
 * `@graview/core/shown` — A KIND'S LIST AS A PLACE SHOWS IT (Roadmap
 * f-view-export-csv): arranged over the horizon, its declared groups in
 * their order, the closed ones shut (`shownList`). The list page draws its
 * rows from it and "Export CSV" writes the same rows, so the two cannot
 * disagree. Apart from `@graview/core/arrange`, which the scene and every
 * lens fetch to arrange: a bundler places a whole file in every chunk that
 * can reach it, and only a kind's list page reads this.
 */
export { shownList } from "./shown-list.js";
export type { ShownGroup, ShownList, ShownListOptions } from "./shown-list.js";
