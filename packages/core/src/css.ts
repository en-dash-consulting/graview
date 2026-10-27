/**
 * `@graview/core/css` — A VIEW'S CSS, READ AS A BROWSER READS IT, on no page
 * (FR-90, Roadmap f-app-wide-view-theme).
 *
 * The CSS Syntax Level 3 tokenizer and parser, and the sanitizer over them
 * that keeps of a stylesheet only what the open kit allows — the at-rules,
 * properties and functions on the tables here, `url(#id)` on a paint alone,
 * nothing that fetches — written out afresh from its tokens. It is the one
 * judge of CSS the framework has: `@graview/guest`'s host draws a worker
 * view's stylesheet through it, its headless run judges a transcript's
 * through it, and `graview check` and `editDocument` hold a document's own
 * stylesheet for every view (`brand.views.css`) to it, so what the checker
 * passes is exactly what a page draws. A subpath of its own, fetched by a
 * worker view's host as it first draws on the open kit and by the checker,
 * never up front.
 */
export {
  CSS_AT_RULES,
  CSS_DRAWN_AS,
  CSS_FRAGMENT_PROPERTIES,
  CSS_FUNCTIONS,
  CSS_KEYWORD_PROPERTIES,
  CSS_PREFIXED_SELECTORS,
  CSS_PROPERTIES,
  CSS_REFUSED_SELECTORS,
  OPEN_MAX_STYLESHEET,
} from "./css/tables.js";
export { sanitizeDeclarations, sanitizeStylesheet, sanitizeStylesheets, sanitizeValue, serializeIdent, serializeString, serializeValues, tokenize } from "./css/sanitize.js";
export type { ComponentValue, CssRefusal, CssRefusalReason, Declaration, Rule, SanitizedCss, Token } from "./css/sanitize.js";
