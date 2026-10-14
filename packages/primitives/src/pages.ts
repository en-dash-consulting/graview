/**
 * `@graview/primitives/pages` — WHAT THE ROUTED FACE DRAWS FROM HERE,
 * WITHOUT THE WORKBENCH (FR-57).
 *
 * Everything here is also exported from `@graview/primitives`. It is its
 * own entry because a bundler splits a page by which files a chunk can
 * reach, and `@graview/primitives` reaches the seat's panel, the inspector
 * and the scene they stand on: the pages face, importing a mark from it,
 * fetched the whole map to draw a list. `@graview/pages` imports from here,
 * and the seat's panel when its ask field is first opened. Nothing in this
 * module's files may import a barrel.
 */
export { ArrangeBar, arrangementCaption, arrangementOf, withArrangement } from "./arrange-bar.js";
export type { ArrangeBarProps } from "./arrange-bar.js";
export { DefaultViewElsewhere } from "./default-view.js";
// A record's values as the scene draws them: changed in place, prose with its paragraphs kept (FR-146, FR-147).
export { EditableValue, FieldLink, LongValue } from "./editable.js";
// A record's pictures and documents, drawn and put there, fetched with the first one drawn (FR-162, FR-163).
export { Files } from "./files-door.js";
export type { FilesProps } from "./files-door.js";
// Another app on a record, as the host names it (FR-171), fetched with the first one drawn.
export { AppLink } from "./app-link-door.js";
export type { AppLinkProps } from "./app-link-door.js";
export { LinkedPicker, LinkedRecordView } from "./linked-record-door.js";
export type { LinkedPickerProps, LinkedRecordViewProps } from "./linked-record-door.js";
// How a date repeats: asked for in a form and changed beside a record's date, fetched with the first one drawn.
export { RepeatEditor, RepeatPicker } from "./repeat-picker-door.js";
export type { RepeatPickerProps } from "./repeat-picker-door.js";
export { hasShape, TextBody, textBlocks, type TextBlock } from "./text-body.js";
export { KindFigure } from "./figure.js";
export { ownSentence, problemLine, problemTitle, RuleLineView, RuleParts, useLined, useRuleLines } from "./rule-line.js";
export { useMarkup } from "./markup.js";
export { AppMark, AppTitle, useFavicon } from "./app-title.js";
export { BarActivity } from "./bar-activity.js";
// What tidying suggests, beside Activity on the routed face's bar, fetched only while something waits.
export { BarSuggested } from "./bar-suggested.js";
export { AppBar, BarFindContext, barPlaceAt, barPlaces, BAR_HEIGHT, BAR_PHONE, HOME_KEY, HOME_PATH, TOOL, toolStyle, useBarFind } from "./app-bar.js";
export type { BarFace, BarFaces, BarFind, BarGo, BarPlace, BarPlaceGroup, BarSwitch } from "./app-bar.js";
export { RelationMark } from "./relation-key.js";
// The framework's own views and the declaration's specs, for a routed face that registers them outright (`@graview/embed/pages`) without reaching every lens through the package's main entry.
export { registerDefaultViews } from "./default-views.js";
export { HeadingsUnder, HomeLine, pageSays, registerViewSpecs, SpecLinks } from "./spec-views.js";
export { StandingDot, standingWords } from "./workbench/standing.js";
export { useViewportHeight } from "./primitives/measure.js";
export { Profile } from "./profile.js";
export { viewsCss } from "./views-css.js";
// Where a notice stands over a picture, clear of what stands at its foot (FR-133): the routed face's way back is one.
export { FOOT_MOVED, FOOT_OBSTACLES, NARROW_PICTURE, placeAtTheFoot, placeAtTheTop } from "./notice-place.js";
// The way back after an act, judged and timed alike on both faces (FR-152).
export { freshChangeOf, isTakeBackKey, lastChangeOf, takeBackLast, takeBackWords, WAY_BACK_MS } from "./way-back.js";
export type { LastChange } from "./way-back.js";
// The seat: the ask field at the foot of the face, its panel fetched when it is first opened.
export { SeatField } from "./seat-field.js";
export { DraftDoor } from "./draft-door.js";
export { appKeyOf } from "./reader-lenses.js";
export { registerReaderLenses } from "./declared-lens-doors.js";
export type { SeatFieldProps, SeatStart } from "./seat-field.js";
// Choosing several records on a list, and the bar that acts on them all at once — fetched with the first one chosen.
export { CHOOSING_CSS, LONG_PRESS_MS, useChoosing } from "./choosing.js";
export type { Choosing } from "./choosing.js";
export { prefetchSeveral, SeveralBarDoor } from "./several-door.js";
export type { SeveralBarProps } from "./several-door.js";
// The app as it was (Roadmap f-playback): the timeline, fetched when somebody first looks back.
export { PastBar, prefetchTimeline } from "./past-bar.js";
export type { TimelineFace } from "./past-bar.js";
