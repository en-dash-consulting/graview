import { describeArg } from "./mutations/node-ref.js";
import { humanizeField, isCurrent } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";
import type { AnyNodeDefinition } from "./schema/types.js";
import { capitalize } from "./capital.js";

/**
 * ARRANGEMENT IS A CAPABILITY OF THE DECLARATION, not of a view.
 *
 * Every surface that lists things arranges them, and each did it its own
 * way or not at all: the list page grouped by an edge through a URL key of
 * its own, the districts sorted by id, the board and the calendar took no
 * sort, filter or group whatever. What a kind CAN be arranged by is already
 * written down — its fields have types, its edges have far ends, its
 * lifecycle names the past, the rules name what is flagged — so the offers
 * are derived here once, headless, and the same string carries the chosen
 * arrangement in a stop's fragment (`in.sort`, `in.filter`, `in.group`) and
 * in a page's search, so an arranged picture is a link.
 */

export type SortDirection = "asc" | "desc";

export interface Sort {
  /** `label`, a field name, or an edge kind (by the far end's label). */
  readonly by: string;
  readonly direction: SortDirection;
}

/**
 * One condition; a filter is the conjunction of several.
 *
 * `key` is a field name, an edge kind, or `is`. The value's grammar depends
 * on the key: a boolean, enum or text field takes one of its values; a date
 * field takes `before:<date>`, `after:<date>` or `on:<date>`; a number field
 * takes `at-most:<n>`, `at-least:<n>` or a value; an edge takes a
 * node id, `*` (tied to anything) or `none`; `is` takes `current`, `past`,
 * `any`, `flagged` or `clear`. Anything else is dropped, not thrown.
 */
export interface Condition {
  readonly key: string;
  readonly value: string;
}

/** How wide a date group is. A year and a decade are what a catalog of thirty years reads by. */
export type DateBucket = "day" | "week" | "month" | "year" | "decade";

export interface Grouping {
  /** A field name or an edge kind. */
  readonly by: string;
  /** For a date field: how wide a group is. Day when unsaid. */
  readonly bucket?: DateBucket;
}

export interface Arrangement {
  readonly sort?: Sort;
  readonly filter?: readonly Condition[];
  readonly group?: Grouping;
  /**
   * Words to look for: a node stays when its label or any scalar field
   * contains them, case aside. The narrowing a person types, beside the
   * conditions a person picks — and the same matcher a search would use.
   */
  readonly query?: string;
}

export const NO_ARRANGEMENT: Arrangement = {};

/** What a lens says to decline arrangement, wholly or a part at a time. */
export type ArrangeOption = boolean | { readonly sort?: boolean; readonly filter?: boolean; readonly group?: boolean };

export type OfferType = "text" | "number" | "date" | "boolean" | "choice";

/** One thing a kind can be sorted, filtered or grouped by, in the declaration's own words. */
export interface ArrangeOffer {
  readonly key: string;
  /** The words for it: the field's reading, the edge kind humanized, or the reserved word's sentence. */
  readonly label: string;
  readonly about: "label" | "field" | "edge" | "is";
  readonly type?: OfferType;
  /** For a choice field, its options; for `is`, its words; for an edge, nothing — the far ends are the graph's. */
  readonly options?: readonly string[];
  /** For a date field, how it may be bucketed when grouped. */
  readonly buckets?: readonly DateBucket[];
  /** For an edge: the kinds at the far end, and how it reads from this kind. */
  readonly far?: readonly string[];
}

export interface Arrangeable {
  readonly kind: string;
  readonly sorts: readonly ArrangeOffer[];
  readonly filters: readonly ArrangeOffer[];
  readonly groups: readonly ArrangeOffer[];
  /** The kind's natural order, when `fieldRoles.order` names one. */
  readonly natural?: Sort;
}

/** The words for a field, after the declaration's own `display.labels`. */
export function readingOf(definition: AnyNodeDefinition, field: string): string {
  return definition.display?.labels?.[field] ?? humanizeField(field);
}

export function fieldType(schema: unknown): OfferType | undefined {
  const shape = describeArg(schema);
  switch (shape.type) {
    case "text":
    case "date":
    case "number":
    case "boolean":
    case "choice":
      return shape.type;
    default:
      return undefined;
  }
}

/** The edges this kind takes part in, from either end, with how each reads from here. */
export function edgesOf(schema: AnySchema, kind: string): readonly ArrangeOffer[] {
  const offers = new Map<string, ArrangeOffer>();
  const definition = schema.tryDefinition(kind);
  for (const [edgeKind, declared] of Object.entries(definition?.edges ?? {})) {
    offers.set(edgeKind, {
      key: edgeKind,
      label: declared.description ? capitalize(declared.description) : humanizeField(edgeKind),
      about: "edge",
      far: declared.to === "*" ? [...(schema.kinds as readonly string[])] : [...declared.to],
    });
  }
  for (const other of schema.definitions) {
    if (other.kind === kind) continue;
    for (const [edgeKind, declared] of Object.entries(other.edges ?? {})) {
      if (offers.has(edgeKind)) continue;
      if (declared.to !== "*" && !(declared.to as readonly string[]).includes(kind)) continue;
      offers.set(edgeKind, {
        key: edgeKind,
        label: declared.inverse ? capitalize(declared.inverse) : humanizeField(edgeKind),
        about: "edge",
        far: [other.kind],
      });
    }
  }
  return [...offers.values()];
}

const IS_WORDS = ["current", "past", "any", "flagged", "clear"] as const;

/**
 * Whether a condition names one of a kind's RETIRED states — `status:demo`
 * where demos are behind the horizon — which is asking for the past by
 * name. The search box and the list page both left the past out for it and
 * found nothing.
 */
export function asksForThePast(
  definition: { readonly lifecycle?: { readonly field: string; readonly retired: readonly unknown[] | "date" } } | undefined,
  conditions: readonly { readonly key: string; readonly value: string }[],
): boolean {
  const lifecycle = definition?.lifecycle;
  if (!lifecycle || lifecycle.retired === "date") return false;
  const retired = (lifecycle.retired as readonly unknown[]).map(String);
  return conditions.some((condition) => condition.key === lifecycle.field && retired.includes(condition.value));
}

/**
 * What a kind can be arranged by, derived from its declaration alone.
 *
 * Sorts: the label, every field with a scalar type, every edge (by the far
 * end's label). Filters: boolean and choice fields by value, date fields by
 * before/after/on, every edge by a node or by having one at all, and `is`
 * for the lifecycle and the standing. Groups: boolean and choice fields,
 * date fields by day, week or month, and every edge by its far end. A field
 * the declaration hides is not offered — an ordering key is not a thing a
 * person groups by.
 */
export function arrangeable(schema: AnySchema, kind: string): Arrangeable {
  const definition = schema.tryDefinition(kind);
  if (!definition) return { kind, sorts: [], filters: [], groups: [] };
  const hidden = new Set(definition.display?.hide ?? []);
  const shape = (definition.fields.shape ?? {}) as Record<string, unknown>;

  const sorts: ArrangeOffer[] = [{ key: "label", label: "Name", about: "label", type: "text" }];
  const filters: ArrangeOffer[] = [];
  const groups: ArrangeOffer[] = [];

  for (const [field, fieldSchema] of Object.entries(shape)) {
    if (field === "id" || field === "kind" || field === "label" || hidden.has(field)) continue;
    const type = fieldType(fieldSchema);
    if (!type) continue;
    const label = readingOf(definition, field);
    const options = type === "choice" ? describeArgOptions(fieldSchema) : type === "boolean" ? ["true", "false"] : undefined;
    const offer: ArrangeOffer = { key: field, label, about: "field", type, ...(options ? { options } : {}) };
    sorts.push(offer);
    /*
     * A NUMBER AND A WORD ARE FILTERS TOO. "SUVs under £25,000 with fewer
     * than 30,000 miles, a Kia or a Hyundai" is the whole of a car
     * shopper's first minute, and the list offered none of it: only a
     * choice, a yes or no and a date could be picked. A number is kept at
     * most or at least a value; a word field is picked by the values it
     * holds (which the graph says, so a surface lists them).
     */
    filters.push(offer);
    if (type === "boolean" || type === "choice") groups.push(offer);
    if (type === "date") groups.push({ ...offer, buckets: ["day", "week", "month", "year", "decade"] });
  }

  for (const edge of edgesOf(schema, kind)) {
    sorts.push(edge);
    filters.push(edge);
    groups.push(edge);
  }

  const is: ArrangeOffer = {
    key: "is",
    label: definition.lifecycle ? "Standing and currency" : "Standing",
    about: "is",
    type: "choice",
    options: definition.lifecycle ? [...IS_WORDS] : ["flagged", "clear"],
  };
  filters.push(is);

  const order = definition.fieldRoles?.["order"];
  const natural: Sort | undefined =
    order && (order in shape || order === "label") ? { by: order, direction: "asc" } : undefined;

  return { kind, sorts, filters, groups, ...(natural ? { natural } : {}) };
}

export function describeArgOptions(schema: unknown): readonly string[] {
  const shape = describeArg(schema);
  return shape.type === "choice" ? shape.options : [];
}

/*
 * THE GRAMMAR. One string per part, short enough to read in an address bar
 * and to type by hand:
 *
 *   sort   = <key>[:asc|:desc]                  due:desc      label
 *   filter = <key>:<value>[,<key>:<value>...]   done:false,holds:today,is:past
 *   group  = <key>[:day|:week|:month]           status        due:month     holds
 *
 * A lens carries them as `in.sort`, `in.filter`, `in.group` in the fragment;
 * a page carries them as `?sort=&filter=&group=`. Same words, same parser.
 */

export interface ArrangementWords {
  readonly sort?: string;
  readonly filter?: string;
  readonly group?: string;
  readonly q?: string;
}

const BUCKETS: readonly DateBucket[] = ["day", "week", "month", "year", "decade"];

export function parseArrangement(words: ArrangementWords): Arrangement {
  const out: { sort?: Sort; filter?: Condition[]; group?: Grouping; query?: string } = {};
  if (words.q && words.q.trim().length > 0) out.query = words.q;
  if (words.sort) {
    const [by, direction] = words.sort.split(":");
    if (by) out.sort = { by, direction: direction === "desc" ? "desc" : "asc" };
  }
  if (words.filter) {
    const conditions: Condition[] = [];
    for (const part of words.filter.split(",")) {
      const colon = part.indexOf(":");
      if (colon <= 0) continue;
      conditions.push({ key: part.slice(0, colon), value: part.slice(colon + 1) });
    }
    if (conditions.length > 0) out.filter = conditions;
  }
  if (words.group) {
    const [by, bucket] = words.group.split(":");
    if (by) out.group = { by, ...(BUCKETS.includes(bucket as DateBucket) ? { bucket: bucket as DateBucket } : {}) };
  }
  return out;
}

/*
 * ARRANGING. Pure over the nodes it is handed and the graph it may read.
 */

/** What arranging needs of a node: its identity. Fields are read off it by name. */
export type ArrangeNode = { readonly id: string; readonly kind: string };

export const fields = (node: ArrangeNode): Record<string, unknown> => node as unknown as Record<string, unknown>;
export const asRecord = (node: ArrangeNode) => node as ArrangeNode & Record<string, unknown>;

/**
 * The little of a graph arranging needs, said structurally so a `Graph<S>`
 * over any concrete schema fits — `GraphReader`'s generic `nodesOfKind`
 * does not, once the kinds are literal.
 */
export interface ArrangeGraph {
  getNode(id: string): ArrangeNode | undefined;
  allNodes(): readonly ArrangeNode[];
  out(id: string, kind?: string): readonly ArrangeNode[];
  in(id: string, kind?: string): readonly ArrangeNode[];
}

export interface ArrangeContext {
  readonly schema: AnySchema;
  readonly graph: ArrangeGraph;
  /** Node ids the rules currently implicate, for `is:flagged` and `is:clear`. */
  readonly flagged?: ReadonlySet<string>;
  /** For the lifecycle: today, as YYYY-MM-DD. */
  readonly today?: string;
}

export interface ArrangedGroup<N extends ArrangeNode = ArrangeNode> {
  /** Stable, sortable: the value, the date bucket's first day, the far end's id, or `` for none. */
  readonly key: string;
  /** The words for the group: a value as it reads, a date, a far end's label, or "No <reading>". */
  readonly label: string;
  readonly nodes: readonly N[];
}

export interface Arranged<N extends ArrangeNode = ArrangeNode> {
  /** The nodes that passed the filter, in order. */
  readonly nodes: readonly N[];
  /** The same nodes, grouped when a grouping was asked; one unnamed group otherwise. */
  readonly groups: readonly ArrangedGroup<N>[];
  readonly grouped: boolean;
}

/** The far ends of `edgeKind` from `id`, either way round, as nodes. */
export function farEnds(graph: ArrangeGraph, id: string, edgeKind: string): ArrangeNode[] {
  const seen = new Map<string, ArrangeNode>();
  for (const node of [...graph.out(id, edgeKind), ...graph.in(id, edgeKind)]) seen.set(node.id, node as ArrangeNode);
  return [...seen.values()];
}

/** Whether a node meets one condition of a filter. Search judges its `key:value` tokens with this too. */
export function conditionHolds(ctx: ArrangeContext, node: ArrangeNode, condition: Condition): boolean {
  const definition = ctx.schema.tryDefinition(node.kind);
  if (condition.key === "is") {
    switch (condition.value) {
      case "current":
        return isCurrent(definition, asRecord(node), ctx.today);
      case "past":
        return !isCurrent(definition, asRecord(node), ctx.today);
      case "any":
        return true;
      case "flagged":
        return ctx.flagged?.has(node.id) ?? false;
      case "clear":
        return !(ctx.flagged?.has(node.id) ?? false);
      default:
        return true;
    }
  }
  const shape = (definition?.fields.shape ?? {}) as Record<string, unknown>;
  if (condition.key in shape) {
    const value = fields(node)[condition.key];
    const type = fieldType(shape[condition.key]);
    if (type === "date") {
      const [op, date] = condition.value.split(":");
      if (typeof value !== "string" || !date) return false;
      const day = value.slice(0, 10);
      return op === "before" ? day < date : op === "after" ? day > date : day === date;
    }
    if (type === "boolean") return String(value) === condition.value;
    if (type === "number") {
      const at = condition.value.lastIndexOf(":");
      const op = at > 0 ? condition.value.slice(0, at) : "";
      const bound = Number(condition.value.slice(at + 1));
      if (op === "at-most" || op === "at-least") {
        if (typeof value !== "number" || !Number.isFinite(bound)) return false;
        return op === "at-most" ? value <= bound : value >= bound;
      }
    }
    return String(value) === condition.value;
  }
  // An edge: tied to this node, to anything, or to nothing.
  const ends = farEnds(ctx.graph, node.id, condition.key);
  if (condition.value === "*") return ends.length > 0;
  if (condition.value === "none") return ends.length === 0;
  return ends.some((end) => end.id === condition.value);
}
