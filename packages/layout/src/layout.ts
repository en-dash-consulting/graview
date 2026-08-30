import type { AnySchema, GraphReader, NodeOfSchema } from "@graview/core";
import {
  DEFAULT_OPTIONS,
  type Aggregate,
  type Connector,
  type Layout,
  type LayoutNode,
  type LayoutOptions,
  type Plane,
  type Via,
} from "./types.js";
import type { ViewState } from "./view-state.js";

export const AGGREGATE_PREFIX = "aggregate:";

/**
 * The id of a group standing in for one or more kinds.
 *
 * Several kinds because a group is a view of a SET of kinds, not a synonym
 * for one: the household example's week is its blocks and its runs together, and no node
 * kind called "week" exists or should. Kinds are sorted so the same group is
 * always the same id, which keeps it stable in a URL.
 */
export function aggregateId(...kinds: readonly string[]): string {
  return `${AGGREGATE_PREFIX}${[...kinds].sort().join("+")}`;
}

export function isAggregateId(id: string): boolean {
  return id.startsWith(AGGREGATE_PREFIX);
}

/** The kinds a group id names, or an empty list if it is not a group id. */
export function kindsOfAggregate(id: string): string[] {
  if (!isAggregateId(id)) return [];
  return id.slice(AGGREGATE_PREFIX.length).split("+").filter(Boolean);
}

/**
 * Ranks by a STABLE key — the node id — and never by a mutable count.
 *
 * This is the single rule that protects spatial memory. Ordering people by
 * "how many runs they have" would reshuffle the whole plane the moment
 * anything is reassigned, and the picture you remember would stop being the
 * picture you get.
 */
function byStableKey(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Lays a row of equal boxes out, centred on the canvas. */
function row(
  count: number,
  size: { width: number; height: number },
  gap: number,
  canvasWidth: number,
  y: number,
): { x: number; y: number }[] {
  const total = count * size.width + Math.max(0, count - 1) * gap;
  const startX = Math.max(gap, (canvasWidth - total) / 2);
  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * (size.width + gap),
    y,
  }));
}

/**
 * Where everything sits, as a pure function of (focus, relation, graph),
 * overlaid with user pins.
 *
 * Same graph and same view always produce the same picture — that is what
 * lets spatial memory survive, and what lets any two states be interpolated
 * into an animated transition.
 */
export function layout<S extends AnySchema>(
  graph: GraphReader<NodeOfSchema<S>>,
  schema: S,
  state: ViewState,
  options: LayoutOptions = {},
): Layout {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const nodes: LayoutNode[] = [];
  const placed = new Map<string, LayoutNode>();

  // A group may be focused as readily as a node: "show me the week" and
  // "show me this run" are the same gesture at different granularities.
  const focusKinds = state.focusId ? kindsOfAggregate(state.focusId) : [];
  const focusGroup =
    focusKinds.length > 0
      ? [...graph.allNodes()]
          .filter((node) => focusKinds.includes(node.kind))
          .sort(byStableKey)
      : [];
  const focus =
    state.focusId && focusKinds.length === 0 ? graph.getNode(state.focusId) : undefined;

  /*
   * Bands are PROPORTIONS of the canvas, and they tile it.
   *
   * Fixed pixel bands in a scene that is now sized to its container left
   * more than half the height empty — the focus panel floating in the top
   * third with a void beneath it. Every band is a share of the height, so
   * the composition holds at any size, and the three planes read as one
   * arrangement rather than three rows that happen to be stacked.
   *
   * A DETAIL gets a tighter set than a group. The week's calendar fills 56%
   * of the height honestly; one nap does not, and holding the same band open
   * for it puts a small card alone in the top half with several hundred
   * pixels of nothing under it before its relations begin.
   */
  const band =
    focus === undefined
      ? {
          focusY: opts.height * 0.035,
          focusH: opts.height * 0.56,
          relationY: opts.height * 0.65,
          relationH: opts.height * 0.19,
          contextY: opts.height * 0.87,
          contextH: opts.height * 0.16,
        }
      : {
          focusY: opts.height * 0.04,
          focusH: opts.height * 0.36,
          relationY: opts.height * 0.46,
          relationH: opts.height * 0.24,
          contextY: opts.height * 0.79,
          contextH: opts.height * 0.17,
        };

  /*
   * A group gets the whole width; a single node does not.
   *
   * The week's calendar has five columns to fill and earns 1040 pixels. One
   * nap, with a name, a time and one person at it, drawn across the same
   * width is a letterbox with four words in it. Narrowing the detail box is
   * the difference between a card and an empty page.
   */
  const detailWidth = Math.min(700, opts.width - opts.gap * 6);
  const groupWidth = Math.min(opts.focusSize.width, opts.width - opts.gap * 6);

  /** Fits `count` boxes across the canvas, never wider than the cap. */
  const fit = (count: number, cap: number, height: number) => ({
    width:
      count === 0
        ? cap
        : Math.min(cap, (opts.width - opts.gap * (count + 1)) / count),
    height,
  });
  const expanded = new Set(state.expanded);

  const related = relatedNodes(graph, schema, focus, state.relation);

  /*
   * With plane 1 empty, the focus takes the relation band too.
   *
   * The alternative is a void: context used to slide up under the focus
   * whenever nothing was raised, which avoided a dead stripe through the
   * middle but left a bigger one along the bottom, and the week's calendar
   * stayed squeezed into 56% of a screen it could have filled. Growing the
   * focus keeps the context row anchored where it always is, so raising
   * something moves one band rather than re-composing the whole scene.
   */
  const focusHeight =
    related.length > 0
      ? band.focusH
      : band.contextY - band.focusY - opts.gap * 2;

  // ------------------------------------------------------- plane 0: focus
  if (focus) {
    push({
      id: focus.id,
      kind: focus.kind,
      plane: 0,
      x: (opts.width - detailWidth) / 2,
      y: band.focusY,
      width: detailWidth,
      height: focusHeight,
    });
  } else if (focusGroup.length > 0 && state.focusId) {
    push({
      id: state.focusId,
      kind: focusKinds[0]!,
      plane: 0,
      x: (opts.width - groupWidth) / 2,
      y: band.focusY,
      width: groupWidth,
      height: focusHeight,
      aggregate: {
        kind: focusKinds.join("+"),
        memberIds: focusGroup.map((node) => node.id),
        label:
          options.plurals?.[state.focusId] ??
          focusKinds.map((kind) => pluralOf(schema, kind)).join(" and "),
      },
    });
  }

  // --------------------------------------------------- plane 1: relations
  const relationSize = fit(related.length, opts.relationSize.width, band.relationH);
  const relationPositions = row(
    related.length,
    relationSize,
    opts.gap,
    opts.width,
    band.relationY,
  );
  related.forEach((entry, index) => {
    const position = relationPositions[index]!;
    push({
      id: entry.node.id,
      kind: entry.node.kind,
      plane: 1,
      x: position.x,
      y: position.y,
      width: relationSize.width,
      height: relationSize.height,
      ...(entry.via ? { via: entry.via } : {}),
    });
  });

  // ----------------------------------------------------- plane 2: context
  const shown = new Set(placed.keys());
  // Members of the focused group are already on screen, inside it.
  for (const member of focusGroup) shown.add(member.id);
  const groups = new Map<string, NodeOfSchema<S>[]>();
  for (const node of graph.allNodes()) {
    if (shown.has(node.id)) continue;
    const list = groups.get(node.kind);
    if (list) list.push(node);
    else groups.set(node.kind, [node]);
  }

  const entries: { id: string; kind: string; members: NodeOfSchema<S>[] }[] = [];
  for (const [kind, members] of groups) {
    entries.push({ id: aggregateId(kind), kind, members: [...members].sort(byStableKey) });
  }
  entries.sort(byStableKey);

  // Expanding an aggregate and collapsing it run through this one loop:
  // an open group contributes its members, a closed one contributes itself.
  const contextItems: { id: string; kind: string; aggregate?: Aggregate }[] = [];
  for (const entry of entries) {
    if (expanded.has(entry.id)) {
      for (const member of entry.members) {
        contextItems.push({ id: member.id, kind: member.kind });
      }
    } else {
      contextItems.push({
        id: entry.id,
        kind: entry.kind,
        aggregate: {
          kind: entry.kind,
          memberIds: entry.members.map((m) => m.id),
          label: options.plurals?.[entry.kind] ?? pluralOf(schema, entry.kind),
        },
      });
    }
  }

  const contextSize = fit(contextItems.length, opts.contextSize.width, band.contextH);
  const contextPositions = row(
    contextItems.length,
    contextSize,
    opts.gap,
    opts.width,
    band.contextY,
  );
  contextItems.forEach((item, index) => {
    const position = contextPositions[index]!;
    push({
      id: item.id,
      kind: item.kind,
      plane: 2,
      x: position.x,
      y: position.y,
      width: contextSize.width,
      height: contextSize.height,
      ...(item.aggregate ? { aggregate: item.aggregate } : {}),
    });
  });

  return {
    nodes,
    connectors: connectorsFor(graph, placed),
    width: opts.width,
    height: opts.height,
  };

  function push(node: Omit<LayoutNode, "pinned">): void {
    // A user pin overrides the computed position and survives graph changes
    // underneath: the layout keeps recomputing, the pin keeps winning.
    const pin = state.pins[node.id];
    const final: LayoutNode = pin
      ? { ...node, x: pin.x, y: pin.y, pinned: true }
      : { ...node, pinned: false };
    nodes.push(final);
    placed.set(final.id, final);
  }
}

function pluralOf(schema: AnySchema, kind: string): string {
  const definition = schema.tryDefinition(kind);
  return definition?.plural ?? `${kind}s`;
}

/** A node on plane 1, and the edge that put it there. */
interface Related<N> {
  readonly node: N;
  readonly via?: Via;
}

/**
 * What plane 1 shows.
 *
 * With a single node focused and no relation named, plane 1 is that node's
 * whole NEIGHBOURHOOD — everything one edge away, in either direction,
 * grouped by edge kind. This is the default because the alternative is an
 * empty plane, and an empty plane is exactly what makes selecting a thing
 * feel like it did nothing: the graph knows who does this run, which
 * agreement protects it and why it exists, and refusing to show any of that
 * until the reader guesses the right edge kind is hiding the product behind
 * a menu.
 *
 * A named `relation` then acts as a FILTER on that neighbourhood — or, when
 * it names no edge from the focus, as a kind to raise wholesale. "Show me
 * People" and "show me what this is assigned to" stay the same gesture.
 */
function relatedNodes<S extends AnySchema>(
  graph: GraphReader<NodeOfSchema<S>>,
  schema: S,
  focus: NodeOfSchema<S> | undefined,
  relation: string | null,
): Related<NodeOfSchema<S>>[] {
  if (focus) {
    const found = new Map<string, Related<NodeOfSchema<S>>>();
    for (const edge of graph.allEdges()) {
      if (relation && edge.kind !== relation) continue;
      const otherId =
        edge.from === focus.id ? edge.to : edge.to === focus.id ? edge.from : null;
      if (otherId === null || otherId === focus.id) continue;
      const node = graph.getNode(otherId);
      if (!node) continue;
      // The first edge to reach a node names the relationship. Two edges to
      // the same neighbour is a rarity; picking the first by the sorted walk
      // keeps the caption stable rather than flickering between them.
      if (found.has(otherId)) continue;
      const direction = edge.from === focus.id ? "out" : "in";
      const owner = direction === "out" ? focus.kind : node.kind;
      const description = edgeDescription(schema, owner, edge.kind);
      found.set(otherId, {
        node,
        via: { edgeKind: edge.kind, direction, ...(description ? { description } : {}) },
      });
    }
    if (found.size > 0) {
      // Grouped by edge kind, so a relationship reads as a run of cards
      // under one caption rather than as scattered singletons.
      return [...found.values()].sort(
        (a, b) =>
          (a.via!.edgeKind < b.via!.edgeKind ? -1 : a.via!.edgeKind > b.via!.edgeKind ? 1 : 0) ||
          byStableKey(a.node, b.node),
      );
    }
  }

  if (!relation) return [];

  // Not an edge kind from the focus (or nothing there): treat it as a kind.
  return graph
    .allNodes()
    .filter((node) => node.kind === relation)
    .sort(byStableKey)
    .map((node) => ({ node }));
}

/**
 * An edge declaration's own description. The schema has been carrying these
 * since the first commit; this is the first thing that reads them.
 */
function edgeDescription(
  schema: AnySchema,
  ownerKind: string,
  edgeKind: string,
): string | undefined {
  const edges = schema.tryDefinition(ownerKind)?.edges as
    | Record<string, { description?: string }>
    | undefined;
  return edges?.[edgeKind]?.description;
}

/**
 * Edges between two laid-out nodes.
 *
 * An endpoint inside a group resolves to the GROUP: an edge into the week
 * points at the week, because that is where the thing it names actually is on
 * screen. Without this a focused group would sever every relationship the
 * scene is meant to show. Several edges collapsing onto the same pair become
 * one connector, so a person with four runs draws one line to the week
 * rather than four identical ones.
 */
function connectorsFor<N extends { id: string; kind: string }>(
  graph: GraphReader<N>,
  placed: Map<string, LayoutNode>,
): Connector[] {
  const containing = new Map<string, string>();
  for (const node of placed.values()) {
    for (const memberId of node.aggregate?.memberIds ?? []) {
      if (!placed.has(memberId)) containing.set(memberId, node.id);
    }
  }
  const resolve = (id: string): LayoutNode | undefined =>
    placed.get(id) ?? placed.get(containing.get(id) ?? "");

  const connectors = new Map<string, Connector>();
  for (const edge of graph.allEdges()) {
    const from = resolve(edge.from);
    const to = resolve(edge.to);
    // A connector to something off-scene is a line into nowhere.
    if (!from || !to || from.id === to.id) continue;
    const id = `${edge.kind}:${from.id}:${to.id}`;
    if (connectors.has(id)) continue;
    connectors.set(id, {
      id,
      kind: edge.kind,
      from: from.id,
      to: to.id,
      x1: from.x + from.width / 2,
      y1: from.y + from.height / 2,
      x2: to.x + to.width / 2,
      y2: to.y + to.height / 2,
    });
  }
  return [...connectors.values()].sort(byStableKey);
}

/** Which plane a node ended up on, or null if it is not in the layout. */
export function planeOf(result: Layout, id: string): Plane | null {
  return result.nodes.find((node) => node.id === id)?.plane ?? null;
}
