/*
 * `@graview/core/revisions` — WHAT A CHANGE BROKE, SAID WITH THE CHANGE
 * (Roadmap f-revisions-say-what-broke).
 *
 * A host that applies a revised view or runs an act tells whoever asked
 * what it broke, in the same answer: a view's classes still drawn and no
 * longer styled, its rules taken out from under markup still drawn, its
 * sections gone, its height moved (`compareViewRevision`); how much of a
 * page a picture held and the sections it left out (`MEASURE_PICTURED_PAGE`,
 * `picturedCoverage`); the rules that held and fail, and the view problems
 * new, with the act that repairs each (`problemsMade`); and the records and
 * links an act changed beyond what it was asked (`beyondAsked`). Each is
 * pure, judges nothing on its own, and is a host's: no page imports it.
 */
export { compareViewRevision, namesInSelector, selectorsOfStylesheet, stringsOfSource } from "./revisions/view.js";
export type { HeightChange, RemovedSelector, UnstyledClass, ViewRevision, ViewRevisionSide } from "./revisions/view.js";
export { sectionsOfDrawing } from "./revisions/sections.js";
export type { DrawnSection, ElementLike } from "./revisions/sections.js";
export { MEASURE_PICTURED_PAGE, picturedCoverage } from "./revisions/pictured.js";
export type { PageMeasure, PictureCoverage, PlacedSection } from "./revisions/pictured.js";
export { problemsMade, viewProblemKey } from "./revisions/problems.js";
export type { ChangedProblem, ProblemSet, ProblemsMade, ViewProblem } from "./revisions/problems.js";
export { beyondAsked } from "./revisions/beyond.js";
export type { ActReach, BeyondAskedOptions, BeyondChange } from "./revisions/beyond.js";
