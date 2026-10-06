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
 *
 * A label's fit is not here, only the estimate of a line's width: only the
 * scene fits a label, and a file this entry reaches is in a page's first
 * chunk whenever any chunk uses it.
 */
export * from "./view-state.js";
export { aggregateId, AGGREGATE_PREFIX, BAND_PREFIX, isAggregateId, isBandAggregate, KIND_PREFIX, kindCardId, kindOfCard, kindsOf, kindsOfAggregate, withJackIn } from "./ids.js";
export { MARQUEE_GAP, marqueeHeightFor, ROSTER_CHROME, ROSTER_KEPT, ROSTER_MOST, ROSTER_ROW, rosterHeight, rosterRows, MARQUEE_WIDTH, type NameWidth } from "./sizes.js";
export { estimateWidth } from "./estimate.js";
export type { Measure } from "./estimate.js";
