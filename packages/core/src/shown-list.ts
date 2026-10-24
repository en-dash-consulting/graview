import type { AnySchema } from "./schema/schema.js";
import type { GraphReader, AnyGraphNode } from "./graph/types.js";
import { asksForThePast, type Arrangeable, type Arranged, type ArrangedGroup, type ArrangeGraph, type Arrangement, type ArrangeNode } from "./arrangement.js";
import { arrange } from "./arranging.js";
import { parseQuery } from "./search.js";
import { orderListGroups } from "./kind-list.js";
import { withComputed } from "./document/computed-values.js";
import type { KindListGroup } from "./views/types.js";

/*
 * A KIND'S LIST AS IT IS SHOWN (Roadmap f-view-export-csv), worked out in
 * one place. The list page drew its rows from a dozen lines of its own —
 * the horizon added unless the past was asked for, a rank worked out over
 * what the seat sees, the declared groups in their order with the closed
 * ones shut — and "Export CSV" writes the rows the page shows. Two copies
 * of that would disagree the day one of them changed, so the page and the
 * export both call this.
 */

export interface ShownListOptions<N extends ArrangeNode> {
  readonly schema: AnySchema;
  readonly graph: ArrangeGraph;
  readonly kind: string;
  /** Every record the list could show: the kind's live ones, or its archived ones where the address asks. */
  readonly nodes: readonly N[];
  /** The arrangement the place is in, as the address or the opening chose it, before the horizon. */
  readonly arrangement: Arrangement;
  /** What the kind can be arranged by: its groups say what a declared grouping is over. */
  readonly offers: Arrangeable;
  /** The grouping the declaration opens the list in (`pages.lists.<kind>.group`), whose order and closed groups hold while the list is grouped that way. */
  readonly declaredGroup?: KindListGroup | undefined;
  /** Node ids the rules implicate, for `is:flagged`. */
  readonly flagged?: ReadonlySet<string>;
  /** Today, YYYY-MM-DD, for the lifecycle. */
  readonly today?: string | undefined;
  /** The closed groups a person opened (`?open=done`), by their declared value. */
  readonly opened?: ReadonlySet<string>;
}

/** One group as the list shows it: in the declared order, closed when the declaration closes it, and shut when closed and not opened. */
export interface ShownGroup<N extends ArrangeNode = ArrangeNode> extends ArrangedGroup<N> {
  readonly closed: boolean;
  readonly shut: boolean;
  /** The group's value as the declaration and the address name it: a yes-or-no group's `"true"` or `"false"`. */
  readonly value: string;
}

export interface ShownList<N extends ArrangeNode = ArrangeNode> {
  /** What the list is arranged by, the horizon (`is:current`) added where the kind has a lifecycle and the past was not asked for. */
  readonly arrangement: Arrangement;
  /** Whether the past is shown: asked for with `is:past`, `is:any`, or a retired value by name. */
  readonly showingPast: boolean;
  readonly arranged: Arranged<N>;
  /** Whether the rows are drawn in groups. */
  readonly grouped: boolean;
  /** The groups as drawn; one unnamed group when the list is not grouped. */
  readonly groups: readonly ShownGroup<N>[];
  /** The records as drawn, in order: a shut group's are not drawn. */
  readonly nodes: readonly N[];
}

/** The list as shown: arranged over the horizon, its declared groups in order, the closed ones shut unless opened or narrowed to find something. */
export function shownList<N extends ArrangeNode>(options: ShownListOptions<N>): ShownList<N> {
  const { schema, graph, kind, nodes, arrangement, offers, declaredGroup } = options;
  const definition = schema.tryDefinition(kind);
  const typed = parseQuery(arrangement.query ?? "");
  const conditions = [...(arrangement.filter ?? []), ...typed.conditions];
  const showingPast =
    conditions.some((condition) => condition.key === "is" && (condition.value === "past" || condition.value === "any")) ||
    // `status:demo` where demos are past is the past, asked for by name.
    asksForThePast(definition, conditions);
  const effective: Arrangement = showingPast || !definition?.lifecycle ? arrangement : { ...arrangement, filter: [...(arrangement.filter ?? []), { key: "is", value: "current" }] };
  // A rank the kind works out is worked out once a record, over what this seat sees (FR-83).
  const worked = new Map<string, Record<string, unknown>>();
  const arranged = arrange(nodes, effective, {
    schema,
    graph,
    ...(options.flagged ? { flagged: options.flagged } : {}),
    ...(options.today !== undefined ? { today: options.today } : {}),
    read: (node, key) => {
      let values = worked.get(node.id);
      if (!values) worked.set(node.id, (values = withComputed(schema, graph as unknown as GraphReader, node as unknown as AnyGraphNode) as unknown as Record<string, unknown>));
      return values[key];
    },
  });
  const grouped = arranged.grouped && Boolean(arrangement.group?.by);
  /*
   * THE DECLARED GROUPS, IN THEIR ORDER, THE CLOSED ONES LAST AND SHUT —
   * while the list is grouped the way the declaration groups it. A closed
   * group stands open when a person opened it, or when the list is narrowed
   * to find something: by words, or by the very field it groups.
   */
  const groupField = declaredGroup && arrangement.group?.by === declaredGroup.by && !arrangement.group.bucket ? offers.groups.find((offer) => offer.key === declaredGroup.by) : undefined;
  const ordered =
    declaredGroup && groupField && (groupField.type === "choice" || groupField.type === "boolean")
      ? orderListGroups(arranged.groups, declaredGroup, { type: groupField.type, ...(groupField.options ? { options: groupField.options } : {}) })
      : arranged.groups.map((group) => ({ ...group, closed: false }));
  const narrowedToFind = Boolean(arrangement.query) || (arrangement.filter ?? []).some((condition) => condition.key === declaredGroup?.by);
  const valueOf = (key: string) => (groupField?.type === "boolean" ? (key === "1" ? "true" : "false") : key);
  const opened = options.opened ?? new Set<string>();
  const groups = ordered.map((group) => {
    const value = valueOf(group.key);
    return { ...group, value, shut: group.closed && !narrowedToFind && !opened.has(value) };
  });
  return {
    arrangement: effective,
    showingPast,
    arranged,
    grouped,
    groups,
    nodes: grouped ? groups.flatMap((group) => (group.shut ? [] : group.nodes)) : arranged.nodes,
  };
}
