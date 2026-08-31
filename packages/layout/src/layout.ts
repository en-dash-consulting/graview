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
 * The kinds plane's cards have ids of their own.
 *
 * They cannot share `aggregate:<kind>` with a focusable group, because an app
 * whose primary view IS one kind — the coaching example' formation is
 * `aggregate:position` — would then place the same id twice: once as the
 * focus and once as its own card in the strip. The strip is a MAP of kinds,
 * not a set of groups you focus, so it gets its own namespace.
 */
export const KIND_PREFIX = "kind:";

export function kindCardId(kind: string): string {
  return `${KIND_PREFIX}${kind}`;
}

export function kindOfCard(id: string): string | null {
  return id.startsWith(KIND_PREFIX) ? id.slice(KIND_PREFIX.length) : null;
}

/** The kinds an id stands for, whichever namespace it is in. */
export function kindsOf(id: string): string[] {
  const card = kindOfCard(id);
  return card ? [card] : kindsOfAggregate(id);
}

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

/**
 * Lays boxes on an ellipse — a circle seen from above and in front.
 *
 * Ordered the way the row is ordered, so a card keeps its neighbours when the
 * strip becomes a ring and the eye can follow it round.
 */
function ring(
  count: number,
  size: { width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number }[] {
  const cx = canvasWidth / 2;
  const cy = canvasHeight * 0.53;
  const rx = canvasWidth * 0.33;
  const ry = canvasHeight * 0.31;
  return Array.from({ length: count }, (_, index) => {
    // Starting at the bottom, going clockwise, so the first card of the strip
    // ends up nearest the viewer rather than hidden at the back.
    const angle = Math.PI / 2 + (index / Math.max(1, count)) * Math.PI * 2;
    return {
      x: cx + Math.cos(angle) * rx - size.width / 2,
      y: cy + Math.sin(angle) * ry - size.height / 2,
    };
  });
}

/**
 * Lays boxes on a shallow arc curving away from the viewer.
 *
 * The middle of the arc is the far side: it sits higher on screen and further
 * back in depth, and the ends come round toward you. That is the difference
 * between a strip pinned to the bottom of the window and a set of things you
 * are standing in front of — and it costs one number per card, because the
 * renderer already mixes plane treatments continuously.
 */
function arc(
  count: number,
  size: { width: number; height: number },
  gap: number,
  canvasWidth: number,
  baseY: number,
  lift: number,
): { x: number; y: number; depth: number }[] {
  const total = count * size.width + Math.max(0, count - 1) * gap;
  const startX = Math.max(gap, (canvasWidth - total) / 2);
  return Array.from({ length: count }, (_, index) => {
    // -1 at the near left, 0 at the far middle, 1 at the near right.
    const across = count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
    const away = 1 - across * across;
    return {
      x: startX + index * (size.width + gap),
      y: baseY - away * lift,
      depth: 0.62 + away * 0.38,
    };
  });
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
  /*
   * Every band ends inside the canvas. This is checked, because it was not
   * true: the group set ran to 1.03 of the height, so the bottom 3% of every
   * context card was cut off on every screen, in every app, from the day the
   * bands became proportional. Nothing scrolls — a scene is sized to its
   * container on purpose — so an overflowing band is content nobody can
   * reach rather than content below the fold.
   */
  const band =
    focus === undefined
      ? {
          // A little smaller than it was, and a little further from the
          // strip: the gap is what puts one in front of the other.
          /*
           * The focus REACHES DOWN over the arc.
           *
           * A panel that stops short of the strip is stacked above it; one
           * that overlaps it is in front of it. The kinds are drawn behind
           * by z-order, so the overlap reads as depth rather than as a
           * collision.
           */
          focusY: opts.height * 0.045,
          focusH: opts.height * 0.6,
          relationY: opts.height * 0.66,
          relationH: opts.height * 0.16,
          contextY: opts.height * 0.83,
          contextH: opts.height * 0.155,
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

  // Nothing is raised while you are above the stack: the ring IS the
  // relation plane up here.
  const related = state.overview ? [] : relatedNodes(graph, schema, focus, state.relation);

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

  /*
   * Above the stack your interface STAYS, shrunk, in the middle of the ring.
   *
   * Not a picture of it and not a card standing in for it: the same view, at
   * plane 0, at full fidelity, still live — the board is still a board, the
   * calendar is still a calendar, and anything the platform lets you do to it
   * you can still do. That is the whole point of rising: seeing what you are
   * working on IN RELATION to everything else, rather than swapping it for a
   * diagram of the schema.
   *
   * It can coexist with its own kind card now because the kinds plane has its
   * own namespace — `aggregate:position` and `kind:position` are different
   * things, which they always were.
   */
  /*
   * The slot keeps the proportions of the thing it is showing, so the scale
   * is uniform and the picture is not stretched.
   */
  const naturalW = groupWidth;
  /*
   * Generous on purpose: the view lays itself out here, so a short box means
   * a scrollbar in the middle of the Graview showing one row of nine.
   * Complete and small beats partial and larger.
   *
   * The whole canvas height rather than most of it, because the slot's own
   * size does not depend on this — the scale is what absorbs it. At 0.92 the
   * week and the board each came up a handful of pixels short and put a
   * scroll region inside a picture drawn at 46%, which is a scrollbar nobody
   * can use. Measured in `scripts/verify-shrunk.mjs`.
   */
  const naturalH = opts.height;
  const overviewScale = Math.min((opts.width * 0.4) / naturalW, (opts.height * 0.42) / naturalH);
  const overviewW = naturalW * overviewScale;
  const overviewH = naturalH * overviewScale;

  // ------------------------------------------------------- plane 0: focus
  if (state.overview && (focus || focusGroup.length > 0) && state.focusId) {
    push({
      id: state.focusId,
      kind: focus ? focus.kind : focusKinds[0]!,
      plane: 0,
      x: (opts.width - overviewW) / 2,
      y: opts.height * 0.53 - overviewH / 2,
      width: overviewW,
      height: overviewH,
      // Lay out as if it had the whole scene, then draw it small. The view
      // is the view; only the picture is scaled.
      natural: { width: naturalW, height: naturalH },
      ...(focus
        ? {}
        : {
            aggregate: {
              kind: focusKinds.join("+"),
              memberIds: focusGroup.map((node) => node.id),
              label:
                options.plurals?.[state.focusId] ??
                focusKinds.map((kind) => pluralOf(schema, kind)).join(" and "),
            },
          }),
    });
  } else if (state.overview) {
    // nothing focused: the ring is the whole picture
  } else if (focus) {
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

  /* ----------------------------------------------------- plane 2: the kinds
   *
   * EVERY declared kind, always, in the same place.
   *
   * This used to be "whatever is not on screen", which meant the row's
   * membership changed as you navigated: the kind you were looking at
   * vanished from it, and reappeared somewhere else the moment you looked
   * at something else. That is unreadable as a map — you could not tell that
   * the board WAS Positions, and Positions turning up at the bottom when you
   * switched to training looked like a bug rather than the same card.
   *
   * A constant strip is what makes the plane a map: the kind in focus is
   * marked as focused rather than removed, a raised kind is marked as
   * raised, and nothing ever moves.
   */
  const shown = new Set(placed.keys());
  for (const member of focusGroup) shown.add(member.id);
  const groups = new Map<string, NodeOfSchema<S>[]>();
  for (const node of graph.allNodes()) {
    const list = groups.get(node.kind);
    if (list) list.push(node);
    else groups.set(node.kind, [node]);
  }

  const focusedKinds = new Set(focusKinds.length > 0 ? focusKinds : focus ? [focus.kind] : []);
  const entries: {
    id: string;
    kind: string;
    members: NodeOfSchema<S>[];
    raised?: boolean;
    focused?: boolean;
  }[] = [];
  for (const kind of schema.kinds as readonly string[]) {
    const members = groups.get(kind) ?? [];
    entries.push({
      id: kindCardId(kind),
      kind,
      members: [...members].sort(byStableKey),
      ...(focusedKinds.has(kind) ? { focused: true } : {}),
    });
  }
  /*
   * A raised kind keeps its place, emptied.
   *
   * Raising a kind moves every member to plane 1, which used to delete the
   * group from the context plane entirely — so the only sign of what was
   * raised was the breadcrumb. The id is unchanged, so it sorts into exactly
   * the position it held before: the picture you remember is the picture you
   * get, and clicking it again drops the relation.
   */
  for (const entry of entries) {
    if (entry.kind === state.relation) entry.raised = true;
  }
  entries.sort(byStableKey);

  // Expanding an aggregate and collapsing it run through this one loop:
  // an open group contributes its members, a closed one contributes itself.
  const contextItems: {
    id: string;
    kind: string;
    aggregate?: Aggregate;
    raised?: boolean;
    focused?: boolean;
  }[] = [];
  for (const entry of entries) {
    if (expanded.has(entry.id) && entry.members.length > 0) {
      for (const member of entry.members) {
        contextItems.push({ id: member.id, kind: member.kind });
      }
    } else {
      contextItems.push({
        id: entry.id,
        kind: entry.kind,
        ...(entry.raised ? { raised: true } : {}),
        ...(entry.focused ? { focused: true } : {}),
        aggregate: {
          kind: entry.kind,
          memberIds: entry.members.map((m) => m.id),
          label: options.plurals?.[entry.kind] ?? pluralOf(schema, entry.kind),
        },
      });
    }
  }

  /*
   * The overview is the SAME CARDS, on a ring instead of a row.
   *
   * Not a different surface. The kinds plane is already a constant map of
   * every kind, so rising to the overview only has to move those cards —
   * which means `interpolate` tweens them from the strip out into the ellipse
   * for free, and what you were looking at recedes into the middle rather
   * than being replaced by a picture of something else.
   *
   * The ellipse is a circle under a vertical squash, which is affine, so this
   * is the same class of transform the plane model already uses.
   */
  const contextSize = state.overview
    ? { width: Math.min(200, opts.width / 7), height: Math.min(120, opts.height * 0.17) }
    : fit(contextItems.length, opts.contextSize.width, band.contextH);
  const contextPositions = state.overview
    ? ring(contextItems.length, contextSize, opts.width, opts.height).map((position) => ({
        ...position,
        depth: 1,
      }))
    : arc(
        contextItems.length,
        contextSize,
        opts.gap,
        opts.width,
        band.contextY,
        opts.height * 0.045,
      );
  contextItems.forEach((item, index) => {
    const position = contextPositions[index]!;
    push({
      id: item.id,
      kind: item.kind,
      /*
       * Plane 2 on the ring as well as in the strip.
       *
       * Not because they are peripheral — up here they are the whole subject —
       * but because plane 2 asks for GLYPH fidelity, which is the view that
       * says what a kind IS and how many there are. On plane 1 the position
       * aggregate rendered as the board lens's summary, so half the ring
       * described lenses and half described kinds.
       */
      plane: 2,
      x: position.x,
      y: position.y,
      width: contextSize.width,
      height: contextSize.height,
      ...(item.aggregate ? { aggregate: item.aggregate } : {}),
      ...(item.raised ? { raised: true } : {}),
      ...(item.focused ? { focused: true } : {}),
      depth: position.depth,
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
