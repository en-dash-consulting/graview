import { error, warning, type Finding } from "./findings.js";
import { formatFits, formatMisplaced } from "./format-rules.js";
import type { GraviewDocument } from "./schema.js";

/*
 * WHAT A FIELD'S FORMAT MAY SAY (FR-180 and the money a Cloud app found
 * said as 10000), judged with the checker and not by the page that compiles
 * a document: a page's first load carries the document's shape, and these
 * sentences are the checker's.
 *
 * `markdown` is a text field's: prose written in Markdown, drawn as prose
 * on the record's page. `money`, `percent` and `duration` say how a number
 * is said. One code, `field-format`, says a format on a field it does not
 * fit — an error for Markdown, which no declaration could hold before it;
 * a warning for a number's format, which a declaration could always write
 * and which is said as written — and notes a number shown as a duration,
 * which the duration type says once. `money-currency` says money with no
 * currency to be said in.
 */
export function formatFindings(document: GraviewDocument): readonly Finding[] {
  const found: Finding[] = [];
  for (const [kind, spec] of Object.entries(document.kinds)) {
    for (const [name, field] of Object.entries(spec.fields)) {
      const path = `kinds.${kind}.fields.${name}.format`;
      if (!field.format) continue;
      if (!formatFits(field.format, field.type)) {
        const { sentence, fix } = formatMisplaced(field.format, field.type);
        found.push((field.format === "markdown" ? error : warning)("field-format", path, `${kind}'s ${name}: ${sentence}`, fix));
      } else if (field.format === "duration") {
        found.push({ severity: "note", code: "field-format", path, message: `${kind}'s ${name} is a number shown as a duration, which is the duration type: whole minutes, said "1 h 30 min" and typed as "1h 30m"`, fix: 'say {"type": "duration"} and leave the format out' });
      } else if (field.format === "money" && !/^[A-Z]{3}$/.test(field.unit ?? "") && !document.brand?.currency) {
        found.push(warning("money-currency", path, `${kind}'s ${name} is money with no currency to be said in, so every face says it as a bare number (10,000, not $10,000)`, `say the app's currency once, { "brand": { "currency": "USD" } }, or the field's own, "unit": "EUR"`));
      }
    }
  }
  return found;
}
