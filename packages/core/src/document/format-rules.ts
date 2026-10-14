import { withArticle } from "../schema/define-node.js";

/*
 * WHICH FORMAT GOES ON WHICH FIELD, said once for the checker and for an
 * edit: `money`, `percent` and `duration` say how a NUMBER is said (on a
 * `number` or an `integer`), and `markdown` that a TEXT field is written in
 * Markdown (FR-180). The checker's `field-format` and `editDocument`'s
 * refusals read the same sentence: "<format> is a <number's | text field's>
 * format, and this field is <a type>".
 */

/** Whether a format belongs on a field of this type. */
export const formatFits = (format: string, type: string): boolean => (format === "markdown" ? type === "text" : type === "number" || type === "integer");

/** Why a format (or a unit, `"a unit"`) is not this field's, and what to do instead. */
export function formatMisplaced(format: string, type: string): { readonly sentence: string; readonly fix: string } {
  const what = format === "a unit" ? "a unit" : `"format": "${format}"`;
  if (format === "markdown") return { sentence: `${what} is a text field's format, and this field is ${withArticle(type)}`, fix: 'make it {"type": "text", "format": "markdown"}, or leave the format out' };
  return { sentence: `${what} is a number's format, and this field is ${withArticle(type)}`, fix: `make it a number (retype-field with "type": "number"), or leave the ${format === "a unit" ? "unit" : "format"} out` };
}
