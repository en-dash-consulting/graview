/**
 * `@graview/primitives/pages` — WHAT THE ROUTED FACE DRAWS FROM HERE,
 * WITHOUT THE WORKBENCH (FR-57).
 *
 * Everything here is also exported from `@graview/primitives`. It is its
 * own entry because a bundler splits a page by which files a chunk can
 * reach, and `@graview/primitives` reaches the companion, the inspector and
 * the scene they stand on: the pages face, importing a mark from it,
 * fetched the whole map to draw a list. `@graview/pages` imports from here,
 * and the companion — drawn on the pages only when "Ask" is opened — when
 * it is opened. Nothing in this module's files may import a barrel.
 */
export { ArrangeBar, arrangementCaption, arrangementOf, withArrangement } from "./arrange-bar.js";
export type { ArrangeBarProps } from "./arrange-bar.js";
export { DefaultViewElsewhere } from "./default-view.js";
export { KindFigure } from "./figure.js";
export { LadderSetting } from "./ladder.js";
export { useMarkup } from "./markup.js";
export { RelationMark } from "./relation-key.js";
// The framework's own views and the declaration's specs, for a routed face that registers them outright (`@graview/embed/pages`) without reaching every lens through the package's main entry.
export { registerDefaultViews } from "./default-views.js";
export { registerViewSpecs, SpecLinks } from "./spec-views.js";
// Where a notice stands over a picture, clear of what stands at its foot (FR-133): the routed face's way back is one.
export { FOOT_MOVED, FOOT_OBSTACLES, NARROW_PICTURE, placeAtTheFoot, placeAtTheTop } from "./notice-place.js";
