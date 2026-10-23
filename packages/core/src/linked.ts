/**
 * `@graview/core/linked` — RECORDS IN ANOTHER APP, READ AS THE VIEWER (FR-171).
 *
 * A relation may go to a kind in another app (`"to": ["@nick/house/house"]`);
 * the record that links keeps which one (`house:h1`) and the host reads the
 * far record as whoever is looking (`LinkedRecords`, on `@graview/core`).
 * This entry is what a host and a face need beyond that, fetched when a
 * link is first drawn or a host first serves one:
 *
 * - `linkedRecordsOver` — the host over apps it holds in memory: each far
 *   record read through the far store's `seenBy(viewer)`, so a viewer is
 *   told only what they may see there, and refused an app they may not
 *   open. The tests read two compiled documents through it; a host serving
 *   many apps answers the same shape from its own store.
 * - `readLinkedRecord` — one record of a store, as a viewer is told it.
 * - `linkedChange`, `recordLinkedChange` — a far value's change, kept in the
 *   READING app's history: an op authored by the far app (`system`,
 *   `app:<address>`, via `app:<address>`) on each record that links it,
 *   naming what changed and nothing of its value.
 * - `linkedRelationWords` — a relation to another app, said: what
 *   `describe_app` and the agent's tools tell a model.
 */
// A host serves seats: a sight that hides a field shows the rest, never nothing (`@graview/core/field-sight`).
import "./field-sight.js";
import "./publishing.js";
import { labelOf } from "./schema/define-node.js";
import { humanizeField } from "./schema/define-node.js";
import { readableFields } from "./schema/reading.js";
import { computedValues } from "./document/computed-values.js";
import { linkedRelations, linkedRefsOf, linkedValue, type LinkedRead, type LinkedReader, type LinkedRecord, type LinkedRecordAnswer, type LinkedRecordRef, type LinkedRecords, type LinkedRelation, type LinkedSearch, type LinkedViewer } from "./schema/linked.js";
import type { AnySchema } from "./schema/schema.js";
import type { AnyNodeDefinition } from "./schema/types.js";
import type { Principal } from "./permissions/types.js";
import type { Operation } from "./ops/types.js";
import type { Store } from "./store.js";

export type { LinkedRead, LinkedReader, LinkedRecord, LinkedRecordAnswer, LinkedRecordRef, LinkedRecords, LinkedRelation, LinkedSearch, LinkedViewer };

/** An app a host holds, as far records are read from it. */
export interface LinkedHome {
  /** The far app's store: its records, its policy and its sights. */
  readonly store: Store<AnySchema>;
  /** What the app is called, as a history line says where a change came from. */
  readonly name?: string;
  /** Whether a viewer may open the app at all; everyone, when unsaid. */
  readonly opens?: (viewer: LinkedViewer) => boolean;
  /** Where a record opens in the app: a path on the host or an http(s) address. */
  readonly href?: (ref: LinkedRecordRef) => string;
}

const asPrincipal = (viewer: LinkedViewer): Principal => ({ kind: viewer.kind, ...(viewer.id === undefined ? {} : { id: viewer.id }), ...(viewer.roles ? { roles: viewer.roles } : {}) }) as Principal;

const NOT_A_FIELD = new Set(["id", "kind"]);

/**
 * ONE RECORD OF A STORE, AS A VIEWER IS TOLD IT: read through the store's
 * `seenBy(viewer)`, so a record they may not see is null and a field kept
 * from them is not there — its label, its describe line, its card (a
 * glance, field by field, in words) and its values, computed ones too.
 */
export function readLinkedRecord(store: Store<AnySchema>, ref: LinkedRecordRef, viewer: LinkedViewer, options: { readonly href?: string; readonly app?: string } = {}): LinkedRecord | null {
  const seen = store.seenBy(asPrincipal(viewer));
  const node = seen.graph.getNode(ref.id) as ({ id: string; kind: string } & Record<string, unknown>) | undefined;
  if (!node || node.kind !== ref.kind) return null;
  return recordOf(seen, node, ref.address, options);
}

function recordOf(seen: Store<AnySchema>, node: { id: string; kind: string } & Record<string, unknown>, address: string, options: { readonly href?: string; readonly app?: string }): LinkedRecord {
  const definition = seen.schema.tryDefinition(node.kind) as AnyNodeDefinition | undefined;
  const { values } = computedValues(seen.schema, seen.graph as never, node as never);
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) if (!NOT_A_FIELD.has(key) && value !== undefined) fields[key] = value;
  for (const [key, value] of Object.entries(values)) fields[key] = typeof value === "object" && value !== null && !Array.isArray(value) ? (value as { label: string }).label : value;
  const label = labelOf(definition, node);
  const describe = (definition as { describe?: (n: unknown) => string } | undefined)?.describe?.(node)?.trim();
  const card = readableFields(node, definition, { glance: true, limit: 4, said: [label] })
    .filter((field) => !field.files && !field.app)
    .map((field) => ({ label: field.label, text: field.value }));
  return {
    address,
    kind: node.kind,
    id: node.id,
    label,
    ...(describe ? { describe } : {}),
    ...(card.length > 0 ? { card } : {}),
    fields,
    ...(options.href ? { href: options.href } : {}),
    ...(options.app ? { app: options.app } : {}),
  };
}

/**
 * THE HOST, OVER APPS IT HOLDS IN MEMORY (FR-171): every answer as the
 * viewer. An address it does not hold, or a record not there for this
 * viewer, is null; an app the viewer may not open is `{ denied: true }`,
 * for a record and for a search alike — nothing of it is said.
 */
export function linkedRecordsOver(homes: Readonly<Record<string, LinkedHome>>, options: { readonly open?: LinkedRecords["open"] } = {}): LinkedRecords {
  const homeOf = (address: string): LinkedHome | undefined => (Object.hasOwn(homes, address) ? homes[address] : undefined);
  return {
    async resolve(ref, viewer) {
      const home = homeOf(ref.address);
      if (!home) return null;
      if (home.opens && !home.opens(viewer)) return { denied: true };
      return readLinkedRecord(home.store, ref, viewer, { ...(home.href ? { href: home.href(ref) } : {}), ...(home.name ? { app: home.name } : {}) });
    },
    async find(search, viewer) {
      const home = homeOf(search.address);
      if (!home) return [];
      if (home.opens && !home.opens(viewer)) return { denied: true };
      const seen = home.store.seenBy(asPrincipal(viewer));
      const words = search.query.trim().toLowerCase();
      const found: LinkedRecord[] = [];
      for (const kind of search.kinds) {
        for (const node of seen.graph.nodesOfKind(kind as never) as unknown as ({ id: string; kind: string } & Record<string, unknown>)[]) {
          if (found.length >= search.limit) break;
          const label = labelOf(seen.schema.tryDefinition(kind) as AnyNodeDefinition | undefined, node);
          if (words && !label.toLowerCase().includes(words)) continue;
          const ref = { address: search.address, kind, id: node.id };
          found.push(recordOf(seen, node, search.address, { ...(home.href ? { href: home.href(ref) } : {}), ...(home.name ? { app: home.name } : {}) }));
        }
      }
      return found;
    },
    ...(options.open ? { open: options.open } : {}),
  };
}

/** The fields whose values differ between two readings of one far record, in the order the later one holds them. */
export function linkedChange(before: LinkedRecord, after: LinkedRecord): readonly string[] {
  const keys = [...new Set([...Object.keys(after.fields), ...Object.keys(before.fields)])];
  return keys.filter((key) => JSON.stringify(before.fields[key]) !== JSON.stringify(after.fields[key]));
}

/** A far record's change, as its host tells the app that reads it. */
export interface LinkedChange {
  readonly ref: LinkedRecordRef;
  /** Which of its fields changed; their values are the far app's, and not kept here. */
  readonly fields: readonly string[];
  /** What the far app is called, as the history says where the change came from; its address when unsaid. */
  readonly app?: string;
  /** When it changed there; the store's clock when unsaid. */
  readonly at?: string;
}

/** The records of a store that link a far record, and the relation each links it by. */
export function recordsLinking(store: Store<AnySchema>, ref: LinkedRecordRef): readonly { readonly id: string; readonly relation: string }[] {
  const kept = linkedValue(ref);
  const found: { id: string; relation: string }[] = [];
  for (const kind of store.schema.kinds as readonly string[]) {
    for (const [relation, link] of linkedRelations(store.schema.tryDefinition(kind))) {
      if (link.address !== ref.address || !link.kinds.includes(ref.kind)) continue;
      for (const node of store.graph.nodesOfKind(kind as never, { archived: "all" }) as unknown as Record<string, unknown>[]) {
        if (linkedRefsOf(node[relation], link).some((one) => linkedValue(one) === kept)) found.push({ id: node["id"] as string, relation });
      }
    }
  }
  return found;
}

/**
 * A FAR VALUE'S CHANGE, KEPT IN THE READING APP'S HISTORY (FR-171): one op
 * on each record that links the far record, in one batch, authored by the
 * far app — `{ kind: "system", id: "app:<address>", name }`, via
 * `app:<address>` — saying which of its fields changed and nothing of
 * their values, which are the far app's to show to whoever may see them.
 * It reads the linking record and writes nothing: the reading app's own
 * values are as they were, and its Activity and the record's history say
 * "Buy it outright: the linked house changed in House — list price".
 * Nothing is kept when no record links it or nothing changed.
 */
export function recordLinkedChange(store: Store<AnySchema>, change: LinkedChange): readonly Operation[] {
  if (change.fields.length === 0) return [];
  const linking = recordsLinking(store, change.ref);
  if (linking.length === 0) return [];
  const app = change.app ?? change.ref.address;
  const what = change.fields.map((field) => humanizeField(field).toLowerCase()).join(", ");
  const author = { kind: "system" as const, id: `app:${change.ref.address}`, name: app };
  return store.append(
    linking.map(({ id }) => {
      const node = store.graph.getNode(id) as ({ id: string; kind: string } & Record<string, unknown>) | undefined;
      const label = node ? labelOf(store.schema.tryDefinition(node.kind) as AnyNodeDefinition | undefined, node) : id;
      return {
        primitives: [],
        author,
        // The far kind's noun is its own app's: the record is said as the link it is.
        intent: `${label}: the linked record changed in ${app} — ${what}`,
        reads: [id],
        writes: [],
        via: `app:${change.ref.address}`,
        ...(change.at ? { at: change.at } : {}),
      };
    }),
  );
}

/**
 * A RELATION TO ANOTHER APP, SAID — for `describe_app`, the agent's tools and
 * a person reading the declaration: where it goes, how many, and how one is
 * linked. "forHouse → one house in the app @nick/house (another app; link
 * one by setting forHouse to "house:<id>", an id the host's search finds)".
 */
export function linkedRelationWords(name: string, relation: LinkedRelation, editAct?: string): string {
  const kinds = relation.kinds.join(" or ");
  const many = relation.cardinality === "many";
  const how = `link ${many ? "them" : "one"} by setting ${name} to ${many ? "a list of " : ""}"${relation.kinds[0]}:<id>"${editAct ? ` with ${editAct}` : ""}, an id found in that app (find_linked)`;
  return `${name} → ${many ? "records of" : "one"} ${kinds} in the app ${relation.address} (another app, read as the viewer; ${how})`;
}
