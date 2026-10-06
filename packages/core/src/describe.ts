/*
 * `@graview/core/describe` — what a place shows one seat, without a browser
 * (FR-89).
 *
 * An entry of its own, not part of `@graview/core/document`: a page imports
 * that barrel up front, and a bundler places a module by what can reach
 * it, so a describer the page never calls would ride in what every hosted
 * page loads first. Only an agent's seat reaches this, and it loads when
 * the seat does.
 */
export { describePlace, placeText } from "./document/describe-place.js";
/*
 * A status board's columns and the moves a seat's acts make between them
 * (FR-97): what the board shows one seat, here for the same reason — only
 * the board's own drawing, fetched when it is first drawn, and the
 * describer reach it.
 */
export { columnActs, columnMoves, columnOf, statusColumns } from "./columns.js";
export type { ColumnMove, StatusColumn } from "./columns.js";
export type { DescribedItem, DescribedPart, DescribedProblem, DescribePlaceOptions, DescribePlaceResult, PlaceDescription } from "./document/describe-place.js";
