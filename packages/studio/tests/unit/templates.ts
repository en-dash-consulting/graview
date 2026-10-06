import { readFileSync } from "node:fs";
import { editDocument, type DocumentEdit, type GraviewDocument } from "@graview/core/document";
import { compileDocument } from "@graview/core/check";
import { createStudio } from "../../src/index.js";

/*
 * FIVE OF GRAVIEW CLOUD'S CURATED TEMPLATES, as documents: the shapes a
 * hosted studio is opened on (graview-cloud packages/templates, copied
 * here so the framework is judged against them without depending on them).
 */
export const TEMPLATES = ["vendor-shortlist", "job-search", "renovation", "small-inventory", "household-chores"] as const;
export type Template = (typeof TEMPLATES)[number];

export function template(name: Template): GraviewDocument {
  return JSON.parse(readFileSync(new URL(`../fixtures/templates/${name}.gdd.json`, import.meta.url), "utf8")) as GraviewDocument;
}

export type Call = { readonly name: string; readonly args: Record<string, unknown> };

export function studioOn(document: GraviewDocument) {
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error(`the fixture must compile: ${JSON.stringify(compiled.findings)}`);
  return createStudio(compiled.app);
}

export function throughTheStudio(document: GraviewDocument, calls: readonly Call[]) {
  const studio = studioOn(document);
  for (const call of calls) studio.store.apply(call as never);
  return studio;
}

export function throughEditDocument(document: GraviewDocument, edits: readonly DocumentEdit[]): GraviewDocument {
  const outcome = editDocument(document, edits);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome.document;
}

type Declared = { readonly id: string; readonly kind: string; readonly label: string };
/** What the studio reads a document's declaration as: every declared kind, field and relation, by its node. */
export function declared(document: GraviewDocument): readonly Declared[] {
  return studioOn(document).store.snapshot().nodes as unknown as readonly Declared[];
}
/** The kind a field or relation node belongs to, from its id ("field:vendor.quote" → "vendor"). */
export const ownerOf = (id: string): string => id.replace(/^(field|edge):/, "").split(".")[0]!;
