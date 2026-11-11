/*
 * WHAT A PAGE OFF THE BROWSER READS, once for both of its writers: the
 * printed page (`@graview/pages/static`) and a fixed screen
 * (`@graview/pages/device`). Which place an address names for a seat, what
 * `describePlace` says it shows, the kinds kept from the seat, a record's
 * relations in its declaration's words and a plain row's glance — read here,
 * so the two can never disagree about what a seat may see or what a place
 * holds. Each only writes the answer down in its own markup.
 */
import {
  humanizeField,
  labelOf,
  localeFor,
  recordPath,
  SCHEMES,
  type AnySchema,
  type AppPlace,
  type Brand,
  type GraviewApp,
  type Principal,
  type Store,
} from "@graview/core";
import { readableFields } from "@graview/core/words";
import { withComputed } from "@graview/core/blocks";
import { describePlace, type DescribedItem, type DescribePlaceResult } from "@graview/core/describe";

/** A place as one seat may read it, before anything is written. */
export interface PlaceRead {
  readonly viewer: Principal;
  readonly brand: Brand;
  readonly locale: string;
  /** The graph this seat may see. */
  readonly seen: Store<AnySchema>;
  /** The kinds kept from this seat: an administered module's, a kind it sees none of, a disabled module's. */
  readonly kept: ReadonlySet<string>;
  readonly described: DescribePlaceResult;
  /** Whether the place is there for this seat: declared, and not over a kind kept from it. */
  readonly there: boolean;
}

export interface ReadPlaceOptions {
  readonly viewer?: Principal | undefined;
  readonly brand?: Brand | undefined;
  readonly locale?: string | undefined;
  readonly today?: string | undefined;
  /** The width the place is described at, in CSS pixels. */
  readonly width?: number | undefined;
}

/** What one place holds for one seat: `describePlace`'s answer over the graph it may see, with the kinds kept from it gone. */
export function readPlace<S extends AnySchema>(store: Store<S>, declaration: GraviewApp<S>, place: string | AppPlace, options: ReadPlaceOptions = {}): PlaceRead {
  const viewer: Principal = options.viewer ?? { kind: "human" };
  const brand = options.brand ?? declaration.brand ?? { name: declaration.name, schemes: SCHEMES };
  const seen = store.seenBy(viewer) as unknown as Store<AnySchema>;
  const asked = typeof place === "string" ? recordOfAddress(seen, place) ?? place : place;
  // Said in the reader's locale, else the brand's the page wears: the describer reads it off the app's brand, as every face does.
  const locale = localeFor(options.locale ?? brand.locale ?? declaration.brand?.locale);
  const described = describePlace(store, viewer, asked, {
    app: { ...declaration, brand: { ...brand, locale } },
    ...(options.today ? { today: options.today } : {}),
    ...(options.width ? { width: options.width } : {}),
  });
  /*
   * A KIND KEPT FROM THIS SEAT IS NOT THERE: an administered module's kinds
   * for a seat that does not administer it, a kind it sees none of, a
   * disabled module's — the routed face lists none of them, so a record, a
   * list or a picture of one is answered as nothing at all.
   */
  const kept = new Set<string>([...store.kindsKeptFrom(viewer), ...store.modules.disabledKinds]);
  const there = described.ok && !(described.description.place.kind !== null && kept.has(described.description.place.kind));
  return { viewer, brand, locale, seen, kept, described, there };
}

/** A record's address on the routed face, `/<plural>/<id>`, as the record's id; anything else is left to `describePlace`. */
export function recordOfAddress(seen: Store<AnySchema>, asked: string): string | undefined {
  const parts = asked.split(/[?#]/)[0]!.split("/").filter(Boolean);
  if (!asked.startsWith("/") || parts.length !== 2 || parts[0] === "places") return undefined;
  let id: string;
  try {
    id = decodeURIComponent(parts[1]!);
  } catch {
    return undefined;
  }
  const node = seen.graph.getNode(id);
  // The address names the kind as well as the id: `/lists/task-1` is no record's.
  if (!node || recordPath(seen.schema, node.kind, id) !== `/${parts[0]}/${encodeURIComponent(id)}`) return `\u0000${asked}`;
  return id;
}

/** A plain row (its name alone) given what a glance at the record says — the default card's facts, as the routed list shows them. */
export function glanced(seen: Store<AnySchema>, item: DescribedItem, locale: string): DescribedItem {
  if (item.parts.length > 0) return item;
  const node = seen.graph.getNode(item.id);
  if (!node) return item;
  const definition = seen.schema.tryDefinition(node.kind);
  const read = (definition as { computed?: object } | undefined)?.computed ? withComputed(seen.schema, seen.graph as never, node as never) : node;
  const fields = readableFields(read as Record<string, unknown>, definition, { limit: 3, said: [item.title], glance: true, locale });
  return { ...item, parts: fields.map((field) => ({ t: "text", text: field.alone })) };
}

/** One relation of a record from one end: its heading in the declaration's words, and the records it reaches, by name. */
export interface RelationGroup {
  readonly heading: string;
  readonly targets: readonly { readonly id: string; readonly kind: string; readonly label: string }[];
}

/** A record's relations, both ways, each captioned in its declaration's own words for this end — as its routed page groups them. */
export function relationsOf(seen: Store<AnySchema>, id: string, kept: ReadonlySet<string>): RelationGroup[] {
  const node = seen.graph.getNode(id);
  if (!node) return [];
  const groups = new Map<string, { heading: string; targets: { id: string; kind: string; label: string }[] }>();
  for (const edge of seen.graph.allEdges()) {
    const direction = edge.from === id ? "out" : edge.to === id ? "in" : null;
    if (!direction) continue;
    const other = seen.graph.getNode(direction === "out" ? edge.to : edge.from);
    if (!other || kept.has(other.kind)) continue;
    const declaredOn = seen.schema.tryDefinition(direction === "out" ? node.kind : other.kind);
    const words = (declaredOn?.edges as Record<string, { description?: string; inverse?: string }> | undefined)?.[edge.kind];
    const description = direction === "in" ? (words?.inverse ?? words?.description) : words?.description;
    const heading = description ? description.charAt(0).toUpperCase() + description.slice(1) : `${direction === "in" ? "← " : "→ "}${humanizeField(edge.kind)}`;
    const key = `${edge.kind}|${direction}|${heading}`;
    const group = groups.get(key) ?? { heading, targets: [] };
    groups.set(key, group);
    group.targets.push({ id: other.id, kind: other.kind, label: labelOf(seen.schema.tryDefinition(other.kind), other as never) });
  }
  return [...groups.values()].map((group) => ({ ...group, targets: group.targets.sort((a, b) => a.label.localeCompare(b.label)) }));
}

/** A kind's address word: `tasks` for a task. */
export function slugOf(seen: Store<AnySchema>, kind: string): string {
  return recordPath(seen.schema, kind, "x").split("/")[1]!;
}

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Text as markup says it: nothing in it is read as a tag or ends an attribute. */
export function esc(text: string): string {
  return String(text).replace(/[&<>"']/g, (ch) => ESCAPES[ch]!);
}
