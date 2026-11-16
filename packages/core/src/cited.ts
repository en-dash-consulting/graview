import { isArchived } from "./graph/archived.js";
import { citedFieldsOf, holdsValue, sightMayKeep } from "./schema/cites.js";
import { fieldInPassing, labelOf } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";
import type { Policy, Principal } from "./permissions/types.js";
import { isSystem } from "./permissions/policy.js";

/*
 * WHICH RECORDS HOLD A VALUE NOTHING CITES (Roadmap f-field-cites-marker).
 * A cited field (`cites: "source"`) holding a value, on a record whose
 * citing field is empty or whose citing relation links no current record,
 * is said once per record and field: the checker says it of a template's
 * examples and of a seed (`field-uncited`), and the app's own actor of the
 * records it keeps (`@graview/core/tidying`). Apart from the store, so a
 * page that never asks carries none of it.
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

/** What `uncitedValues` is told beyond the records: a citing field it may not judge, since a seat may not see it. */
export interface UncitedOptions {
  readonly unjudged?: (kind: string, field: string) => boolean;
}

/**
 * The uncited values among these records (archived ones left out): each
 * cited field that holds a value where the field naming its citation holds
 * none, or the relation naming it links nothing out of the record
 * (`linked(id, relation)`, counting only current records).
 */
export function uncitedValues(schema: AnySchema, records: Iterable<Record_>, linked: (id: string, relation: string) => number, options: UncitedOptions = {}): UncitedValue[] {
  const found: UncitedValue[] = [];
  for (const record of records) {
    if (isArchived(record as never)) continue;
    const definition = schema.tryDefinition(record.kind) as ({ readonly edges?: Readonly<Record<string, unknown>> } & Parameters<typeof labelOf>[0]) | undefined;
    if (!definition) continue;
    for (const [field, cites] of Object.entries(citedFieldsOf(schema, record.kind))) {
      if (!holdsValue(record[field])) continue;
      const relation = Object.prototype.hasOwnProperty.call(definition.edges ?? {}, cites);
      if (!relation && options.unjudged?.(record.kind, cites)) continue;
      if (relation ? linked(record.id, cites) > 0 : holdsValue(record[cites])) continue;
      const name = labelOf(definition, record as never);
      found.push({ record: record.id, kind: record.kind, field, cites, relation, words: `${name}'s ${fieldInPassing(definition as never, field)} cites no ${fieldInPassing(definition as never, cites)}` });
    }
  }
  return found;
}

/**
 * The uncited values of a store's current records, as `seat` would be told
 * them (unsaid, as the store sees them all): a citing field some sight may
 * keep from that seat is not judged, and a link to an archived record cites
 * nothing.
 */
export function uncitedIn(
  store: { readonly schema: AnySchema; readonly policy?: Policy | undefined; readonly graph: { allNodes(): readonly Record_[]; out(id: string, kind?: string): readonly unknown[] } },
  seat?: Principal,
): UncitedValue[] {
  const narrowed = seat !== undefined && !isSystem(seat);
  return uncitedValues(store.schema, store.graph.allNodes(), (id, relation) => store.graph.out(id, relation).length, narrowed ? { unjudged: (kind, field) => sightMayKeep(store.policy, kind, field) } : {});
}

/** How many current records a seed's relation links out of one, counting no link to a record set aside (`$archived`). */
export function seedLinks(nodes: readonly { readonly id: string }[], edges: readonly { readonly kind: string; readonly from: string; readonly to: string }[]): (id: string, relation: string) => number {
  const archived = new Set(nodes.filter((node) => isArchived(node)).map((node) => node.id));
  return (id, relation) => edges.filter((edge) => edge.from === id && edge.kind === relation && !archived.has(edge.to)).length;
}
