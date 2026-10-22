/**
 * `@graview/core/words` — A RECORD, AN ARGUMENT AND A REFUSAL, SAID.
 *
 * A record read as a person reads it (`readableFields`, `pageSections`,
 * `isLongText`, `describeNode`), two records of one name told apart
 * (`tellApart`), what an argument asks for (`argShape`, `describeArg`), an
 * argument and a refusal in the record's own words (`argumentWords`,
 * `failureWords`), the channel a change came through (`viaSaid`), a
 * field's value and a relation in the declaration's words (`valueWords`,
 * `edgeWords`), and an amount asked for as it is said (`amountBox`,
 * `amountInBox`, `readAmount`), and a date typed as
 * people say it (`readWhenTyped`, `storedOfWall`, `wallOfStored`, `zoneSaid`,
 * `endAfterStartMoved`, `startAndEndOf`).
 *
 * Apart from `@graview/core` because a bundler places a whole file in a
 * page's first chunk when the first chunk can reach it and any chunk uses
 * it (FR-179): each of these is said by a face as it draws a record, a form
 * as it asks, or the seat as it answers — all fetched as they are first
 * drawn or asked — and never by the bar and the frame a page draws first.
 * The types (`ReadableField`, `FieldSection`, `ArgShape`) stay on
 * `@graview/core`.
 */
export { describeNode, isLongText, pageSections, readableFields, tellApart } from "./schema/reading.js";
export { argShape, describeArg } from "./mutations/arg-shape.js";
export { argumentWords, failureWords } from "./mutations/words.js";
export { capitalize, lowerFirst } from "./capital.js";
export { viaSaid } from "./via.js";
export { edgeWords, valueWords } from "./schema/value-words.js";
// A date that repeats, in words: "Every Tuesday, next Oct 27".
export { repeatAsRead, repeatingDateAsRead } from "./repeat-words.js";
// A text's start at a glance, Markdown's syntax taken out (FR-180): what a row, a card, a describe line and a search hit say of prose.
export { excerptOf } from "./excerpt-of.js";
// Whether a field is written in Markdown (FR-180), as a record is read.
export { isMarkdownField } from "./schema/markdown.js";
// A phone, a place and a duration, said, linked, and read from what was typed.
export { fieldSays, mapsHref, parseDuration, sayDuration, sayPhone, telHref, typedHref, typedWords } from "./schema/field-words.js";
export { typedFieldOf } from "./schema/typed-field-of.js";
export { amountBox, amountInBox, readAmount } from "./amount-input.js";
export type { AmountBox } from "./amount-input.js";
// A day or a moment typed as people say it — "tomorrow 3pm", "Fri 10:30", "17 Oct" — kept as the field keeps it (Roadmap f-date-inputs).
export { readWhenTyped } from "./when-typed.js";
export { endAfterStartMoved, namesInstant, startAndEndOf, storedOfWall, wallNow, wallOfStored, zoneSaid } from "./wall-time.js";
export type { WallTime } from "./wall-time.js";
