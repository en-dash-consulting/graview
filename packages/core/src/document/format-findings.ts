import { error, type Finding } from "./findings.js";
import type { GraviewDocument } from "./schema.js";

/*
 * WHAT A FIELD'S FORMAT MAY SAY (FR-180), judged with the checker and not
 * by the page that compiles a document: a page's first load carries the
 * document's shape, and these sentences are the checker's.
 *
 * `markdown` is a text field's: prose written in Markdown, drawn as prose
 * on the record's page. `money`, `percent` and `duration` say how a number
 * is shown, and a text field is shown as written or as Markdown.
 */
export function formatFindings(document: GraviewDocument): readonly Finding[] {
  const found: Finding[] = [];
  for (const [kind, spec] of Object.entries(document.kinds)) {
    for (const [name, field] of Object.entries(spec.fields)) {
      const path = `kinds.${kind}.fields.${name}.format`;
      if (field.format === "markdown" && field.type !== "text")
        found.push(error("field-format", path, `"markdown" is a text field's format, and ${kind}'s ${name} is of type ${field.type}`, `make it {"type": "text", "format": "markdown"}, or leave the format out`));
      else if (field.type === "text" && field.format && field.format !== "markdown")
        found.push(error("field-format", path, `a text field is shown as written or as Markdown, not as ${field.format}`, `say "format": "markdown", or leave the format out`));
    }
  }
  return found;
}
