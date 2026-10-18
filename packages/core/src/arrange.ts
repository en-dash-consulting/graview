/**
 * `@graview/core/arrange` — WHAT A KIND CAN BE ARRANGED BY, AND ARRANGING IT.
 *
 * The offers a kind's declaration makes (`arrangeable`), the grammar that
 * carries a chosen arrangement in an address (`parseArrangement`,
 * `formatArrangement`), and the filtering, sorting and grouping itself
 * (`arrange`). Apart from `@graview/core` because a bundler places a whole
 * file in a page's first chunk when the first chunk can reach it and any
 * chunk uses it: a page that has drawn no list yet carries none of the
 * arranging. The types stay on `@graview/core`, where a declaration names
 * them.
 */
export { arrangeable, asksForThePast, conditionHolds, edgesOf, NO_ARRANGEMENT, throughEdges, withWorkedOut, listFieldsOf } from "./arrangement.js";
export { parseArrangement } from "./arrangement-words.js";
// A kind's list as its declaration opens it (`pages.lists.<kind>.sort` and `.group`).
export { kindListFindings, listGroup, listOpening, listSort, orderListGroups } from "./kind-list.js";
export type { ListFields } from "./arrangement.js";
export type { ListFinding } from "./kind-list.js";
export {
  admitArrangement,
  arrange,
  arrangeAllows,
  bucketStart,
  formatArrangement,
  matches,
} from "./arranging.js";
export type {
  Arrangeable,
  ArrangeContext,
  Arranged,
  ArrangeGraph,
  ArrangedGroup,
  Arrangement,
  ArrangementWords,
  ArrangeNode,
  ArrangeOffer,
  ArrangeOption,
  Condition,
  DateBucket,
  Grouping,
  OfferType,
  Sort,
  SortDirection,
} from "./arrangement.js";
