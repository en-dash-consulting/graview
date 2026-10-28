/*
 * A VIEW'S CSS, READ AS A BROWSER READS IT (FR-90): the framework's one
 * sanitizer, on `@graview/core/css` since a document came to carry a
 * stylesheet for every view (`brand.views.css`, Roadmap
 * f-app-wide-view-theme) that `graview check` judges with the code a page
 * draws with. The host draws through this module as it did; what it
 * imports is core's.
 */
export { CSS_DRAWN_AS, OPEN_MAX_STYLESHEET, sanitizeDeclarations, sanitizeStylesheet, sanitizeStylesheets, sanitizeValue, serializeIdent, serializeString, serializeValues, tokenize } from "@graview/core/css";
export type { ComponentValue, CssRefusal, CssRefusalReason, Declaration, Rule, SanitizedCss, Token } from "@graview/core/css";
