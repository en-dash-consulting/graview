/**
 * `@graview/core/words` — A RECORD, AN ARGUMENT AND A REFUSAL, SAID.
 *
 * A record read as a person reads it (`readableFields`, `pageSections`,
 * `isLongText`, `describeNode`), two records of one name told apart
 * (`tellApart`), what an argument asks for (`argShape`, `describeArg`), an
 * argument and a refusal in the record's own words (`argumentWords`,
 * `failureWords`) and the channel a change came through (`viaSaid`).
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
export { viaSaid } from "./via.js";
// A date that repeats, in words: "Every Tuesday, next Oct 27".
export { repeatAsRead, repeatingDateAsRead } from "./repeat-words.js";
