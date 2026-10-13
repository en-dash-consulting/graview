import { GraphError } from "../graph/graph.js";

/**
 * WHAT A CHANGE WAS BASED ON, AND HOW SURE ITS MAKER WAS (FR-172).
 *
 * An author says who moved; it is the same for every change a seat makes,
 * so it cannot say why THIS one was made. A background actor that links
 * and prunes on its own ("Graview, tidying") owes the reader a reason per
 * change — "both name the Harbor Street lease" — and a measure of how far
 * to trust it. Lineage is that, kept on the op beside its author: in the
 * log, on the wire, on the history line and the record's page.
 *
 * `confidence` is 0 to 1; one below 1 makes what the op links PROVISIONAL
 * until a person touches it (`linkProvenance`). Absent, the maker did not
 * say, and nothing is drawn quieter for it. `model` names what judged it,
 * when a model did. The framework records, draws and explains; it never
 * decides what to link.
 *
 * What draws a link or a history line reads `provenance.ts`; only the check
 * every change is held to lives here, so a page carries the rest when it
 * draws.
 */
export interface Lineage {
  readonly basis: string;
  readonly confidence?: number;
  readonly model?: string;
}

/** The longest basis an op keeps: a reason, not a transcript. */
export const LINEAGE_BASIS_LIMIT = 500;
/** The longest model name an op keeps. */
export const LINEAGE_MODEL_LIMIT = 120;

/**
 * A lineage as an op keeps it — the basis trimmed, keys it does not know
 * dropped — or a GraphError: a basis of 1–500 characters, a confidence
 * from 0 to 1, a model name of 1–120. Asked before anything is kept;
 * nothing said is no lineage.
 */
export function lineageOf(value: unknown): Lineage | undefined {
  if (value === undefined) return undefined;
  const { basis, confidence, model } = (value ?? {}) as Record<string, unknown>;
  const said = typeof basis === "string" ? basis.trim() : "";
  const named = typeof model === "string" ? model.trim() : "";
  if (
    !said ||
    said.length > LINEAGE_BASIS_LIMIT ||
    (confidence !== undefined && !(typeof confidence === "number" && confidence >= 0 && confidence <= 1)) ||
    (model !== undefined && !(named && named.length <= LINEAGE_MODEL_LIMIT))
  ) {
    throw new GraphError("A lineage is { basis: 1–500 characters, confidence?: 0–1, model?: 1–120 characters }");
  }
  return { basis: said, ...(confidence !== undefined ? { confidence } : {}), ...(named ? { model: named } : {}) } as Lineage;
}
