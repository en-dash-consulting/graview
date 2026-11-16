import { citedFieldsOf, holdsValue } from "./schema/cites.js";
import { fieldInPassing, labelOf } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";

/*
 * WHICH RECORDS HOLD A VALUE NOTHING CITES (Roadmap f-field-cites-marker).
 * A cited field (`cites: "source"`) holding a value, on a record whose
 * citing field is empty or whose citing relation links nothing, is said
 * once per record and field: the checker says it of a template's examples
 * and of a seed (`field-uncited`), and the app's own actor of the records
 * it keeps (`@graview/core/tidying`). Apart from the store, so a page that
 * never asks carries none of it.
 */

/** One value a cited field holds with nothing cited. */
export interface UncitedValue {
  /** The record, by id. */
  readonly record: string;
  readonly kind: string;
  /** The cited field that holds the value. */
  readonly field: string;
  /** The field or relation that should cite it, and is empty. */
  readonly cites: string;
  /** Whether `cites` names a relation (true) or a field. */
  readonly relation: boolean;
  /** Said to a person: "Lagos's population cites no source". */
  readonly words: string;
}

type Record_ = { readonly id: string; readonly kind: string } & Readonly<Record<string, unknown>>;

/**
 * The uncited values among these records: each cited field that holds a
 * value where the field naming its citation holds none, or the relation
 * naming it links nothing out of the record (`linked(id, relation)`).
 */
export function uncitedValues(schema: AnySchema, records: Iterable<Record_>, linked: (id: string, relation: string) => number): UncitedValue[] {
  const found: UncitedValue[] = [];
  for (const record of records) {
    const definition = schema.tryDefinition(record.kind) as ({ readonly edges?: Readonly<Record<string, unknown>> } & Parameters<typeof labelOf>[0]) | undefined;
    if (!definition) continue;
    for (const [field, cites] of Object.entries(citedFieldsOf(schema, record.kind))) {
      if (!holdsValue(record[field])) continue;
      const relation = Object.prototype.hasOwnProperty.call(definition.edges ?? {}, cites);
      if (relation ? linked(record.id, cites) > 0 : holdsValue(record[cites])) continue;
      const name = labelOf(definition, record as never);
      found.push({ record: record.id, kind: record.kind, field, cites, relation, words: `${name}'s ${fieldInPassing(definition as never, field)} cites no ${fieldInPassing(definition as never, cites)}` });
    }
  }
  return found;
}

/** The uncited values of a graph's current records (archived ones left out). */
export function uncitedIn(store: { readonly schema: AnySchema; readonly graph: { allNodes(): readonly Record_[]; outEdges(id: string, kind?: string): readonly unknown[] } }): UncitedValue[] {
  return uncitedValues(store.schema, store.graph.allNodes(), (id, relation) => store.graph.outEdges(id, relation).length);
}
