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
export type { DescribedItem, DescribedPart, DescribedProblem, DescribePlaceOptions, DescribePlaceResult, PlaceDescription } from "./document/describe-place.js";
