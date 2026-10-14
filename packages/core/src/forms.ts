/**
 * `@graview/core/forms` — AN ACT'S FORM, WALKED OFF ITS DECLARATION.
 *
 * `formFields` reads a mutation's input as the controls a form asks with —
 * a text, a date, a choice, a node picker, a group, a variant, a list, a
 * file (FR-162) — and `formArgs` what a form sends; `undecidableArguments`
 * what no decision can answer. Apart from `@graview/core` because a bundler
 * places a whole file in a page's first chunk when the first chunk can
 * reach it and any chunk uses it: only a drawn form, the strip's ask and a
 * seat read them, so a hosted page that has asked nothing carries none.
 */
export { formArgs, formComplete, formField, formFields } from "./mutations/form.js";
export type { FormField, ScalarField } from "./mutations/form.js";
export { undecidableArguments } from "./mutations/decidable.js";
export type { UndecidableArgument } from "./mutations/decidable.js";
export { keptArguments } from "./mutations/kept-arguments.js";
