import { isShippedLens, SHIPPED_LENSES, unknownLensOption } from "../places.js";
import { error, type Finding } from "./findings.js";
import type { GraviewDocument } from "./schema.js";

type Lens = { readonly name?: unknown; readonly title?: unknown; readonly on?: unknown; readonly options?: unknown };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const lensesOf = (document: GraviewDocument): readonly Lens[] => (Array.isArray((document as { lenses?: unknown }).lenses) ? ((document as { lenses: unknown[] }).lenses.filter(isObject) as Lens[]) : []);
/* A lens is the same lens across a change by its lens, its title and the kind it stands on. */
const sameLens = (a: Lens, b: Lens) => a.name === b.name && a.title === b.title && a.on === b.on;

/**
 * THE OPTIONS A CHANGE BRINGS THAT ITS LENS DOES NOT TAKE (FR-190): for a
 * document changed some other way than `editDocument` — a JSON patch
 * (`applyPatch`), a document sent whole — each option key on a titled,
 * shipped lens of `proposed` that the lens does not take and the same lens
 * (its lens, title and kind) in `stored` did not already carry, as an
 * error at `lenses.<i>.options.<key>` in the checker's own words
 * (`lens-option-unknown`). A host refuses the change on any. What a
 * document already carried stays the warning it compiles with.
 */
export function lensOptionsRefused(stored: GraviewDocument, proposed: GraviewDocument): readonly Finding[] {
  const before = lensesOf(stored);
  const findings: Finding[] = [];
  lensesOf(proposed).forEach((lens, index) => {
    if (typeof lens.name !== "string" || !isShippedLens(lens.name) || typeof lens.title !== "string" || !isObject(lens.options)) return;
    const takes = SHIPPED_LENSES[lens.name].options as readonly string[];
    const was = before.find((one) => sameLens(one, lens));
    const carried = isObject(was?.options) ? Object.keys(was.options) : [];
    for (const key of Object.keys(lens.options)) {
      if (takes.includes(key) || carried.includes(key)) continue;
      const said = unknownLensOption(lens.name, key, lens.title.trim());
      findings.push(error("lens-option-unknown", `lenses.${index}.options.${key}`, said.message, said.fix));
    }
  });
  return findings;
}
