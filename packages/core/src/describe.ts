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
export { columnActs, columnMoves, columnOf, columnReach, columnSteps, statusColumns } from "./columns.js";
export type { ColumnMove, ColumnReach, StatusColumn } from "./columns.js";
export type { DescribedItem, DescribedMasthead, DescribedPart, DescribedProblem, DescribePlaceOptions, DescribePlaceResult, PlaceDescription } from "./document/describe-place.js";
/*
 * A record's declared blocks — or the home's — resolved over what a seat
 * may see exactly as the faces and the describer resolve them: one call for
 * a product's own face. Here, beside the describer that goes through it,
 * and not on `@graview/core/blocks`, which the faces import as they draw:
 * they hold their blocks parsed and read them in `blockContextFor`'s
 * context, and need no lookup of a declaration's views.
 */
export { resolveFor } from "./document/resolve-for.js";
export type { DeclaredBlocks, ResolveForOptions } from "./document/resolve-for.js";
