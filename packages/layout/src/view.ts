/**
 * `@graview/layout/view` — WHERE THE READER IS, AND WHAT A CARD'S PARTS
 * TAKE, WITHOUT THE CITY (FR-57).
 *
 * Everything here is also exported from `@graview/layout`. It is its own
 * entry because a bundler splits a page by which files its first chunk can
 * reach, and `@graview/layout` reaches the layout itself — the city, the
 * bands, the interpolation — which only the scene uses: a provider that
 * read the view state from it carried the city into a page that drew the
 * pages. The provider, the default views and the embed import from here.
 */
export * from "./view-state.js";
export { aggregateId, AGGREGATE_PREFIX, BAND_PREFIX, isAggregateId, isBandAggregate, KIND_PREFIX, kindCardId, kindOfCard, kindsOf, kindsOfAggregate, withJackIn } from "./ids.js";
export { MARQUEE_GAP, marqueeHeightFor, ROSTER_CHROME, ROSTER_KEPT, ROSTER_MOST, ROSTER_ROW, rosterHeight, rosterRows, THUMB_ONE, THUMB_TITLE, THUMB_TWO } from "./sizes.js";
export { areaOf, boxOf, centroidOf, estimateWidth, fitLabel, overlaps, spanAt } from "./label-fit.js";
export type { FitOptions, FitPoint, FittedLabel, LabelBox, Measure } from "./label-fit.js";
