import type { AnySchema, GraphReader, NodeOfSchema } from "@graview/core";
import {
  DEFAULT_OPTIONS,
  type Aggregate,
  type Connector,
  type Layout,
  type LayoutNode,
  type LayoutOptions,
  type Plane,
} from "./types.js";
import type { ViewState } from "./view-state.js";

export const AGGREGATE_PREFIX = "aggregate:";

export function aggregateId(kind: string): string {
  return `${AGGREGATE_PREFIX}${kind}`;
}

export function isAggregateId(id: string): boolean {
  return id.startsWith(AGGREGATE_PREFIX);
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

  const focus = state.focusId ? graph.getNode(state.focusId) : undefined;
  const expanded = new Set(state.expanded);

  // ------------------------------------------------------- plane 0: focus
  if (focus) {
    push({
      id: focus.id,
      kind: focus.kind,
      plane: 0,
      x: (opts.width - opts.focusSize.width) / 2,
      y: opts.gap,
      width: opts.focusSize.width,
      height: opts.focusSize.height,
    });
  }

  // --------------------------------------------------- plane 1: relations
  const related = relatedNodes(graph, focus, state.relation);
  const relationY = opts.gap + (focus ? opts.focusSize.height + opts.gap * 2 : opts.gap);
  const relationPositions = row(
    related.length,
    opts.relationSize,
    opts.gap,
    opts.width,
    relationY,
  );
  related.forEach((node, index) => {
    const position = relationPositions[index]!;
    push({
      id: node.id,
      kind: node.kind,
      plane: 1,
      x: position.x,
      y: position.y,
      width: opts.relationSize.width,
      height: opts.relationSize.height,
    });
  });

  // ----------------------------------------------------- plane 2: context
  const shown = new Set(placed.keys());
  const groups = new Map<string, NodeOfSchema<S>[]>();
  for (const node of graph.allNodes()) {
    if (shown.has(node.id)) continue;
    const list = groups.get(node.kind);
    if (list) list.push(node);
    else groups.set(node.kind, [node]);
  }

  const contextY = opts.height - opts.contextSize.height - opts.gap;
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

  const contextPositions = row(
    contextItems.length,
    opts.contextSize,
    opts.gap,
    opts.width,
    contextY,
  );
  contextItems.forEach((item, index) => {
    const position = contextPositions[index]!;
    push({
      id: item.id,
      kind: item.kind,
      plane: 2,
      x: position.x,
      y: position.y,
      width: opts.contextSize.width,
      height: opts.contextSize.height,
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

/**
 * What plane 1 shows. `relation` names either an edge kind to follow from the
 * focus, or a node kind to raise wholesale — "show me People" and "show me
 * what this is assigned to" are the same gesture.
 */
function relatedNodes<S extends AnySchema>(
  graph: GraphReader<NodeOfSchema<S>>,
  focus: NodeOfSchema<S> | undefined,
  relation: string | null,
): NodeOfSchema<S>[] {
  if (!relation) return [];

  if (focus) {
    const outgoing = graph.out(focus.id, relation);
    const incoming = graph.in(focus.id, relation);
    const byId = new Map<string, NodeOfSchema<S>>();
    for (const node of [...outgoing, ...incoming]) byId.set(node.id, node);
    if (byId.size > 0) return [...byId.values()].sort(byStableKey);
  }

  // Not an edge kind from the focus (or nothing there): treat it as a kind.
  const ofKind = graph.allNodes().filter((node) => node.kind === relation);
  return ofKind.sort(byStableKey);
}

/**
 * Edges between two laid-out nodes. Both endpoints must be placed: a
 * connector to something off-scene is a line into nowhere.
 */
function connectorsFor<N extends { id: string; kind: string }>(
  graph: GraphReader<N>,
  placed: Map<string, LayoutNode>,
): Connector[] {
  const connectors: Connector[] = [];
  for (const edge of graph.allEdges()) {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (!from || !to) continue;
    connectors.push({
      id: `${edge.kind}:${edge.from}:${edge.to}`,
      kind: edge.kind,
      from: edge.from,
      to: edge.to,
      x1: from.x + from.width / 2,
      y1: from.y + from.height / 2,
      x2: to.x + to.width / 2,
      y2: to.y + to.height / 2,
    });
  }
  return connectors.sort(byStableKey);
}

/** Which plane a node ended up on, or null if it is not in the layout. */
export function planeOf(result: Layout, id: string): Plane | null {
  return result.nodes.find((node) => node.id === id)?.plane ?? null;
}
