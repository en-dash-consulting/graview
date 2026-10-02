import { describeArg } from "./mutations/node-ref.js";
import { matchNode, parseQuery } from "./search.js";
import { humaniseField, isCurrent, labelOf, tellApart } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";
import type { AnyNodeDefinition } from "./schema/types.js";

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

/** How wide a date group is. A year and a decade are what a catalogue of thirty years reads by. */
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

/** Whether a lens offers a part, given what it declared. Everything is on unless declined. */
export function arrangeAllows(option: ArrangeOption | undefined, part: "sort" | "filter" | "group"): boolean {
  if (option === undefined || option === true) return true;
  if (option === false) return false;
  return option[part] !== false;
}

export type OfferType = "text" | "number" | "date" | "boolean" | "choice";

/** One thing a kind can be sorted, filtered or grouped by, in the declaration's own words. */
export interface ArrangeOffer {
  readonly key: string;
  /** The words for it: the field's reading, the edge kind humanised, or the reserved word's sentence. */
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
function readingOf(definition: AnyNodeDefinition, field: string): string {
  return definition.display?.labels?.[field] ?? humaniseField(field);
}

function fieldType(schema: unknown): OfferType | undefined {
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
      label: declared.description ? capitalise(declared.description) : humaniseField(edgeKind),
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
        label: declared.inverse ? capitalise(declared.inverse) : humaniseField(edgeKind),
        about: "edge",
        far: [other.kind],
      });
    }
  }
  return [...offers.values()];
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

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

function describeArgOptions(schema: unknown): readonly string[] {
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

export function formatArrangement(arrangement: Arrangement): ArrangementWords {
  const out: { sort?: string; filter?: string; group?: string; q?: string } = {};
  if (arrangement.query && arrangement.query.trim().length > 0) out.q = arrangement.query;
  if (arrangement.sort) {
    out.sort = arrangement.sort.direction === "desc" ? `${arrangement.sort.by}:desc` : arrangement.sort.by;
  }
  if (arrangement.filter?.length) {
    out.filter = arrangement.filter.map((condition) => `${condition.key}:${condition.value}`).join(",");
  }
  if (arrangement.group) {
    out.group = arrangement.group.bucket ? `${arrangement.group.by}:${arrangement.group.bucket}` : arrangement.group.by;
  }
  return out;
}

/**
 * Keeps only the parts a kind can actually be arranged by, and says which
 * were dropped — a stale link names a field that was renamed, and the
 * honest thing is to show the rest arranged and say what was ignored.
 */
export function admitArrangement(
  arrangement: Arrangement,
  offers: Arrangeable,
): { readonly arrangement: Arrangement; readonly dropped: readonly string[] } {
  const dropped: string[] = [];
  const out: { sort?: Sort; filter?: Condition[]; group?: Grouping; query?: string } = {};
  if (arrangement.query) out.query = arrangement.query;
  if (arrangement.sort) {
    if (offers.sorts.some((offer) => offer.key === arrangement.sort!.by)) out.sort = arrangement.sort;
    else dropped.push(`sort ${arrangement.sort.by}`);
  }
  if (arrangement.filter) {
    const kept = arrangement.filter.filter((condition) => {
      const offer = offers.filters.find((candidate) => candidate.key === condition.key);
      if (!offer) {
        dropped.push(`filter ${condition.key}`);
        return false;
      }
      return true;
    });
    if (kept.length > 0) out.filter = kept;
  }
  if (arrangement.group) {
    if (offers.groups.some((offer) => offer.key === arrangement.group!.by)) out.group = arrangement.group;
    else dropped.push(`group ${arrangement.group.by}`);
  }
  return { arrangement: out, dropped };
}

/*
 * ARRANGING. Pure over the nodes it is handed and the graph it may read.
 */

/** What arranging needs of a node: its identity. Fields are read off it by name. */
export type ArrangeNode = { readonly id: string; readonly kind: string };

const fields = (node: ArrangeNode): Record<string, unknown> => node as unknown as Record<string, unknown>;
const asRecord = (node: ArrangeNode) => node as ArrangeNode & Record<string, unknown>;

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
function farEnds(graph: ArrangeGraph, id: string, edgeKind: string): ArrangeNode[] {
  const seen = new Map<string, ArrangeNode>();
  for (const node of [...graph.out(id, edgeKind), ...graph.in(id, edgeKind)]) seen.set(node.id, node as ArrangeNode);
  return [...seen.values()];
}

function labelFor(ctx: ArrangeContext, node: ArrangeNode): string {
  return labelOf(ctx.schema.tryDefinition(node.kind), asRecord(node));
}

const compare = (a: unknown, b: unknown): number => {
  if (a === undefined || a === null) return b === undefined || b === null ? 0 : 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

/** What a node sorts by, for a key: its label, a field, or its first far end's label. */
function sortValue(ctx: ArrangeContext, node: ArrangeNode, by: string): unknown {
  if (by === "label") return labelFor(ctx, node);
  const definition = ctx.schema.tryDefinition(node.kind);
  if (definition && by in ((definition.fields.shape ?? {}) as Record<string, unknown>)) return fields(node)[by];
  const ends = farEnds(ctx.graph, node.id, by).map((end) => labelFor(ctx, end)).sort();
  return ends[0];
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** The first day of the bucket a date falls in, as YYYY-MM-DD; weeks start on Monday, in UTC. */
export function bucketStart(date: string, bucket: DateBucket): string | undefined {
  const match = DAY.exec(date);
  if (!match) return undefined;
  const [, y, m, d] = match;
  if (bucket === "day") return `${y}-${m}-${d}`;
  if (bucket === "month") return `${y}-${m}-01`;
  if (bucket === "year") return `${y}-01-01`;
  if (bucket === "decade") return `${String(Number(y) - (Number(y) % 10)).padStart(4, "0")}-01-01`;
  const at = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const back = (at.getUTCDay() + 6) % 7;
  at.setUTCDate(at.getUTCDate() - back);
  return at.toISOString().slice(0, 10);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function bucketLabel(start: string, bucket: DateBucket): string {
  if (bucket === "month") return `${MONTHS[Number(start.slice(5, 7)) - 1]} ${start.slice(0, 4)}`;
  if (bucket === "week") return `Week of ${start}`;
  if (bucket === "year") return start.slice(0, 4);
  if (bucket === "decade") return `The ${start.slice(0, 4)}s`;
  return start;
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

/**
 * Whether the words find the node — search's own matcher, so a list's `q`
 * and the Find box never disagree: every word the start of a word in the
 * label or a readable field, case, diacritics and punctuation aside.
 */
export function matches(ctx: ArrangeContext, node: ArrangeNode, query: string): boolean {
  return matcherFor(ctx, query)(node);
}

/**
 * The words, read once for a whole list. `key:value` tokens are conditions,
 * as in the Find box: judged where the kind offers them, ignored where it
 * does not — and words made ONLY of tokens nothing here offers (a pasted
 * `https://…`, a `foo:bar`) find nothing, as `search()` says, rather than
 * everything. `is:any` alone is a horizon, not a search: it keeps all.
 */
function matcherFor(ctx: ArrangeContext, query: string): (node: ArrangeNode) => boolean {
  const { words, conditions } = parseQuery(query);
  if (words.length === 0 && conditions.length === 0) return () => true;
  const offers = new Map<string, ReadonlySet<string>>();
  const offered = (kind: string): ReadonlySet<string> => {
    let held = offers.get(kind);
    if (!held) {
      held = new Set(arrangeable(ctx.schema, kind).filters.map((offer) => offer.key));
      offers.set(kind, held);
    }
    return held;
  };
  return (node) => {
    const keys = offered(node.kind);
    const applied = conditions.filter((condition) => keys.has(condition.key));
    if (!applied.every((condition) => conditionHolds(ctx, node, condition))) return false;
    if (words.length > 0) return matchNode(ctx.schema.tryDefinition(node.kind), asRecord(node), words) !== undefined;
    return applied.length > 0;
  };
}

/**
 * Filters, sorts and groups. The filter is a conjunction; the sort is
 * stable; a grouping puts the group with nothing to say last. Nodes whose
 * kind the context cannot describe are kept and sort by what they carry.
 */
export function arrange<N extends ArrangeNode>(nodes: readonly N[], arrangement: Arrangement, ctx: ArrangeContext): Arranged<N> {
  const query = arrangement.query?.trim();
  const found = query ? nodes.filter(matcherFor(ctx, query)) : nodes;
  const kept = arrangement.filter?.length
    ? found.filter((node) => arrangement.filter!.every((condition) => conditionHolds(ctx, node, condition)))
    : [...found];

  const sort = arrangement.sort;
  const ordered = sort
    ? kept
        .map((node, index) => ({ node, index, value: sortValue(ctx, node, sort.by) }))
        .sort((a, b) => {
          const byValue = compare(a.value, b.value);
          const signed = sort.direction === "desc" && byValue !== 0 && a.value !== undefined && b.value !== undefined ? -byValue : byValue;
          return signed !== 0 ? signed : a.index - b.index;
        })
        .map((entry) => entry.node)
    : kept;

  const grouping = arrangement.group;
  if (!grouping) return { nodes: ordered, groups: [{ key: "", label: "", nodes: ordered }], grouped: false };

  const groups = new Map<string, { label: string; nodes: N[] }>();
  const put = (key: string, label: string, node: N) => {
    const group = groups.get(key) ?? { label, nodes: [] };
    group.nodes.push(node);
    groups.set(key, group);
  };
  const first = ordered[0];
  const definition = first ? ctx.schema.tryDefinition(first.kind) : undefined;
  const shape = (definition?.fields.shape ?? {}) as Record<string, unknown>;
  const reading = definition ? readingOf(definition, grouping.by) : humaniseField(grouping.by);
  const isField = grouping.by in shape;
  const type = isField ? fieldType(shape[grouping.by]) : undefined;
  const edgeReading = edgesOf(ctx.schema, first?.kind ?? "").find((offer) => offer.key === grouping.by)?.label;
  // "No due date" for a field; an edge reads as a sentence, so "Without the list it is on".
  const none = isField
    ? `No ${reading.toLowerCase()}`
    : `Without ${(edgeReading ?? humaniseField(grouping.by)).toLowerCase()}`;

  /*
   * Two far ends of one name — a single and its album, both "Blue Hour" —
   * are told apart in the heading, as they are in a picker (see `tellApart`):
   * "Blue Hour · single, Blue Hour · album" rather than "Blue Hour, Blue Hour".
   */
  const apart = isField
    ? new Map<string, string>()
    : tellApart(
        [...new Map(ordered.flatMap((node) => farEnds(ctx.graph, node.id, grouping.by)).map((end) => [end.id, end])).values()].map(asRecord) as never,
        (kind) => ctx.schema.tryDefinition(kind),
      );
  for (const node of ordered) {
    if (isField) {
      const value = fields(node)[grouping.by];
      if (value === undefined || value === null || value === "") {
        put("", none, node);
      } else if (type === "date") {
        const bucket = grouping.bucket ?? "day";
        const start = bucketStart(String(value), bucket);
        if (start) put(start, bucketLabel(start, bucket), node);
        else put("", none, node);
      } else if (type === "boolean") {
        put(value ? "1" : "0", value ? "Yes" : "No", node);
      } else {
        const format = definition?.display?.format?.[grouping.by];
        put(String(value), format ? format(value) : String(value), node);
      }
      continue;
    }
    const ends = farEnds(ctx.graph, node.id, grouping.by)
      .map((end) => ({ id: end.id, label: apart.has(end.id) ? `${labelFor(ctx, end)} · ${apart.get(end.id)!}` : labelFor(ctx, end) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (ends.length === 0) put("", none, node);
    else put(ends.map((end) => end.id).join(","), ends.map((end) => end.label).join(", "), node);
  }

  const optionOrder = type === "choice" ? describeArgOptions(shape[grouping.by]) : undefined;
  const orderedGroups = [...groups.entries()]
    .sort(([a, ga], [b, gb]) => {
      if (a === "") return 1;
      if (b === "") return -1;
      if (optionOrder) return optionOrder.indexOf(a) - optionOrder.indexOf(b);
      if (type === "boolean") return b.localeCompare(a); // Yes before No
      if (type === "date") return a.localeCompare(b);
      return ga.label.localeCompare(gb.label);
    })
    .map(([key, group]) => ({ key, label: group.label, nodes: group.nodes }));

  return { nodes: ordered, groups: orderedGroups, grouped: true };
}
