import { humaniseField, labelOf, tellApart } from "./schema/define-node.js";
import { matchNode, parseQuery } from "./search.js";
import {
  arrangeable,
  asRecord,
  conditionHolds,
  describeArgOptions,
  edgesOf,
  farEnds,
  fields,
  fieldType,
  readingOf,
  type ArrangeContext,
  type Arrangeable,
  type Arranged,
  type ArrangementWords,
  type ArrangeNode,
  type ArrangeOption,
  type Arrangement,
  type Condition,
  type DateBucket,
  type Grouping,
  type Sort,
} from "./arrangement.js";

/*
 * ARRANGING: what a list, a lens or a band does with an arrangement —
 * filter, sort and group the records it is handed — and the words a chosen
 * arrangement is written back in. Apart from the offers and the grammar
 * (`./arrangement.ts`), which the Find box and the opening of a page read
 * from the first paint: only a drawn list arranges, so a page carries this
 * when it fetches one (`@graview/core/arrange`).
 */

/** Whether a lens offers a part, given what it declared. Everything is on unless declined. */
export function arrangeAllows(option: ArrangeOption | undefined, part: "sort" | "filter" | "group"): boolean {
  if (option === undefined || option === true) return true;
  if (option === false) return false;
  return option[part] !== false;
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
