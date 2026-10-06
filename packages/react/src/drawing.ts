/**
 * `@graview/react/drawing` — WHAT A DRAWN VIEW USES BEYOND THE PROVIDER.
 *
 * Everything here is also exported from `@graview/react`. It is apart from
 * `@graview/react/provider` because the frame of every face imports that
 * before anything is drawn, and a bundler places a whole file in a page's
 * first chunk when the first chunk can reach it and any chunk uses it: the
 * measured text, the kit's connector, the boundary a view draws inside, the
 * sets a view lights and dims by, the fields edited in place, the others
 * placed on a picture and the attention a seat pipes in rode up front for
 * a page that had drawn nothing yet. A face's views import them from here,
 * and they are fetched with the face. Nothing in this module's files may
 * import the scene's, or `@graview/react`.
 */
export { useActivity, useAttention } from "./attention.js";
export { useDrawnSize, useTextMeasure } from "./drawn.js";
export type { DrawnOptions, DrawnSize } from "./drawn.js";
export { useEditableFields } from "./editable-fields.js";
export { NOTHING_FOUND, useFlagged, useImplicated, useReached } from "./emphasis.js";
export { kitConnector, useKit } from "./kit.js";
export { anchorOf, AUDIENCE_ROW, placeOthers } from "./placement.js";
export type { Placed } from "./placement.js";
export { ViewBoundary } from "./view-boundary.js";
export type { ViewBoundaryProps } from "./view-boundary.js";
