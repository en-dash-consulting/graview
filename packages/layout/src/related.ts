import type { AnySchema, GraphReader, NodeOfSchema } from "@graview/core";
import type { Connector, LayoutNode, Via } from "./types.js";
import type { ViewState } from "./view-state.js";

import { byStableKey } from "./ids.js";

/*
 * WHAT STANDS ON THE RELATION BAND, and the lines drawn to it: the nodes a
 * focus is related to, the edge that put each there, how that edge reads
 * from the end you are standing on, and the connectors between them.
 */

export function pluralOf(schema: AnySchema, kind: string): string {
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
export function relatedNodes<S extends AnySchema>(
  graph: GraphReader<NodeOfSchema<S>>,
  schema: S,
  focus: NodeOfSchema<S> | undefined,
  relation: string | null,
  judged: Readonly<Record<string, readonly string[]>> = {},
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
      /*
       * READ FROM THE END YOU ARE STANDING ON. An edge has one direction
       * and two readings; the caption over a neighbour is how the relation
       * reads from the FOCUS. A gardener's plot was captioned "who looks
       * after it" — the plot's words — as though the plot looked after her.
       * An incoming edge takes the declaration's `inverse`; without one,
       * the caption falls back to the edge kind in plain words downstream.
       */
      const description = edgeReading(schema, owner, edge.kind, direction);
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

  /*
   * WHAT THE FOCUS JUDGES. A rule has no edges; what it is about is what
   * its violations name. Those are its neighbourhood, captioned as such,
   * and a relation naming a kind filters them the way it filters edges.
   */
  if (focus) {
    const named = judged[focus.id] ?? [];
    const seen = new Set<string>();
    const found: Related<NodeOfSchema<S>>[] = [];
    for (const id of named) {
      if (id === focus.id || seen.has(id)) continue;
      const node = graph.getNode(id);
      if (!node) continue;
      if (relation && relation !== "judges" && node.kind !== relation) continue;
      seen.add(id);
      found.push({ node, via: { edgeKind: "judges", direction: "out", description: "what it finds wrong" } });
    }
    if (found.length > 0) return found.sort((a, b) => byStableKey(a.node, b.node));
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
function edgeReading(
  schema: AnySchema,
  ownerKind: string,
  edgeKind: string,
  direction: "out" | "in",
): string | undefined {
  const edges = schema.tryDefinition(ownerKind)?.edges as
    | Record<string, { description?: string; inverse?: string }>
    | undefined;
  const declaration = edges?.[edgeKind];
  return direction === "out" ? declaration?.description : declaration?.inverse;
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
export function connectorsFor<N extends { id: string; kind: string }>(
  graph: GraphReader<N>,
  placed: Map<string, LayoutNode>,
  state: ViewState,
): Connector[] {
  /*
   * A member belongs to the NEAREST group that contains it.
   *
   * The kinds plane is a constant map, so a duty is inside both the week on
   * plane 0 and the Runs card on plane 2. An edge into it should point at
   * where the thing actually is on screen, which is the nearer of the two —
   * otherwise every connector to the week suddenly aimed at the strip.
   */
  const containing = new Map<string, string>();
  const byDepth = [...placed.values()].sort((a, b) => a.plane - b.plane);
  for (const node of byDepth) {
    for (const memberId of node.aggregate?.memberIds ?? []) {
      if (!placed.has(memberId) && !containing.has(memberId)) containing.set(memberId, node.id);
    }
  }
  const resolve = (id: string): LayoutNode | undefined =>
    placed.get(id) ?? placed.get(containing.get(id) ?? "");

  const connectors = new Map<string, Connector>();
  // The real pairs a bundle holds, by connector: a set, not a scan of a copied array per edge (O(E²) in one bundle).
  const pairs = new Map<string, Set<string>>();
  const bundled = new Map<string, { from: string; to: string }[]>();
  for (const edge of graph.allEdges()) {
    const from = resolve(edge.from);
    const to = resolve(edge.to);
    // A connector to something off-scene is a line into nowhere.
    if (!from || !to) continue;
    /*
     * A relation between two members of the SAME group is not nothing.
     *
     * "A task waits for a task" collapses to one card up on the ring, and
     * dropping it made the legend advertise a relation the picture never drew.
     * Kept, and marked, so the renderer can draw it as a loop leaving and
     * returning to the card — which is what it is.
     *
     * Inside the stack it is still dropped: a line from a card to itself over
     * a scene full of other lines is noise, and the relation is visible there
     * as an ordinary edge between the two real nodes.
     */
    /*
     * A loop is drawn only on a KIND CARD. On the focus it said nothing: the
     * live view already shows that relation as its own content — the matrix
     * IS develops — and the ring it drew around the stamp read as a stray
     * mark the size of the scene.
     */
    if (from.id === to.id && !(state.overview && from.aggregate && from.plane === 2)) continue;
    const id = `${edge.kind}:${from.id}:${to.id}`;
    /*
     * A drawn line may STAND FOR several edges — into a group, between two
     * districts. It is honestly selectable exactly when it stands for ONE,
     * whoever it is drawn to: a person's line into the week that carries
     * their single ride is that ride, even though the drawn end is a stamp.
     * A second real edge arriving on the same line withdraws the claim.
     */
    const held = connectors.get(id);
    if (held) {
      // The same real pair twice is one relation, not two.
      const pair = `${edge.from}\n${edge.to}`;
      const seen = pairs.get(id)!;
      if (seen.has(pair)) continue;
      seen.add(pair);
      bundled.get(id)!.push({ from: edge.from, to: edge.to });
      if (held.single) {
        const { single: _dropped, ...rest } = held;
        connectors.set(id, rest as Connector);
      }
      continue;
    }
    pairs.set(id, new Set([`${edge.from}\n${edge.to}`]));
    bundled.set(id, [{ from: edge.from, to: edge.to }]);
    connectors.set(id, {
      id,
      kind: edge.kind,
      from: from.id,
      to: to.id,
      edges: [{ from: edge.from, to: edge.to }],
      single: { from: edge.from, to: edge.to },
      ...(from.id === to.id ? { loop: true } : {}),
      x1: from.x + from.width / 2,
      y1: from.y + from.height / 2,
      x2: to.x + to.width / 2,
      y2: to.y + to.height / 2,
    });
  }
  return [...connectors.values()].map((connector) => ({ ...connector, edges: bundled.get(connector.id)! })).sort(byStableKey);
}
