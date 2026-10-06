import type { Finding, GraviewDocument } from "@graview/core/document";

/*
 * WHAT THE STUDIO KEEPS BUT WILL NOT CHANGE (FR-62).
 *
 * How a number is shown (money, percent, duration), what it is counted in,
 * the range it is taken in (FR-114; `set-range` changes it in the document)
 * and what a list holds are the document's. The studio carries each through
 * an unrelated change untouched, and refuses to retype a field that has one
 * rather than guess what the new type does to it (edits.ts). A host could
 * learn that only by trying, so Graview Cloud copied the rule to warn ahead;
 * this is the rule itself, which the refusal reads too.
 */

/** One thing a field of a document carries that the studio keeps and will not change. */
export interface KeptProperty {
  readonly property: "format" | "unit" | "of" | "range";
  /** The words for it: "shown as money", "counted in h", "a list of strings". */
  readonly said: string;
}

type FieldWords = { readonly format?: string | undefined; readonly unit?: string | undefined; readonly of?: string | undefined; readonly min?: number | undefined; readonly max?: number | undefined; readonly step?: number | undefined };

/** A number's range (FR-114) in words: "from 1 to 5", "at least 0", "in steps of 0.5". */
function rangeSaid(field: FieldWords): string | undefined {
  const { min, max, step } = field;
  if (min === undefined && max === undefined && step === undefined) return undefined;
  const span = min !== undefined && max !== undefined ? `from ${min} to ${max}` : min !== undefined ? `at least ${min}` : max !== undefined ? `at most ${max}` : undefined;
  return [span, step !== undefined ? `in steps of ${step}` : undefined].filter(Boolean).join(", ");
}

/** What a field of a document carries that the studio keeps and will not change, in the order a person reads it. */
export function keptBy(field: FieldWords | undefined): readonly KeptProperty[] {
  if (!field) return [];
  return [
    ...(field.format ? [{ property: "format" as const, said: `shown as ${field.format}` }] : []),
    ...(field.unit ? [{ property: "unit" as const, said: `counted in ${field.unit}` }] : []),
    ...(field.of ? [{ property: "of" as const, said: `a list of ${field.of}s` }] : []),
    ...(rangeSaid(field) ? [{ property: "range" as const, said: `taken ${rangeSaid(field)}` }] : []),
  ];
}

const CODE: Record<KeptProperty["property"], string> = { format: "studio-keeps-format", unit: "studio-keeps-unit", of: "studio-keeps-item-type", range: "studio-keeps-range" };

/**
 * ONE FINDING PER FIELD PROPERTY the studio keeps but will not change, at
 * the field's path (`kinds.vendor.fields.quote`), as a note: nothing is
 * wrong, and the change belongs in the document itself.
 */
export function uneditable(document: GraviewDocument): readonly Finding[] {
  const found: Finding[] = [];
  for (const [kind, spec] of Object.entries(document.kinds)) {
    for (const [name, field] of Object.entries(spec.fields)) {
      for (const kept of keptBy(field as FieldWords)) {
        found.push({
          severity: "note",
          code: CODE[kept.property],
          path: `kinds.${kind}.fields.${name}`,
          message: `${kind}'s ${name} is ${kept.said}; the studio keeps that as it is and will not change it, nor retype the field`,
          fix: "change it in the document itself",
        });
      }
    }
  }
  return found;
}
