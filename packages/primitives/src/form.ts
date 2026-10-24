/**
 * `@graview/primitives/form` — WHAT A FORM DRAWS WITH, AND NOTHING ELSE
 * (FR-201): the doors to a field's own controls (a file, a linked record,
 * a repeat, a day and a time) and the theme's base sheet.
 *
 * The derived form imported these from `@graview/primitives/pages`, the
 * barrel every routed page draws from. A bundler places in what a page
 * loads first every module that page's imports reach and that anything in
 * the bundle uses, so the barrel brought the bar, the lists, the arranging
 * and the framework's views of a kind into a visitor's form, a form that
 * draws none of them (`scripts/lib/bundle-budget.mjs`, "a visitor's form
 * alone"). The pages face imports them from here too: a module is one
 * module whichever entry names it.
 */
export { Files } from "./files-door.js";
export type { FilesProps } from "./files-door.js";
export { LinkedPicker } from "./linked-record-door.js";
export type { LinkedPickerProps } from "./linked-record-door.js";
export { RepeatPicker } from "./repeat-picker-door.js";
export type { RepeatPickerProps } from "./repeat-picker-door.js";
export { WhenInput } from "./when-input-door.js";
export type { WhenInputProps } from "./when-input-door.js";
export { themeBaseCss } from "./theme.js";
