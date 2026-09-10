import { isCurrent, type AnySchema, type GraphReader, type NodeOfSchema } from "@graview/core";
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
import { rankKinds } from "./rank.js";
import { toggleExpanded, withFocus, withZoom, type ViewState } from "./view-state.js";

export const AGGREGATE_PREFIX = "aggregate:";

/**
 * The kinds plane's cards have ids of their own.
 *
 * They cannot share `aggregate:<kind>` with a focusable group, because an app
 * whose primary view IS one kind — the coaching example's formation is
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
 * Going deeper into a card, as view state.
 *
 * A record ZOOMS: the same scene with the record grown to most of it, and
 * the same gesture on the zoomed record zooms back out. A KIND CARD stands
 * for a group, so deeper means the group: on the ground it zooms into the
 * group as a place (`aggregate:<kind>`), and from altitude it opens the
 * district in place — the exploded view — and the same gesture closes it.
 *
 * The card's own id (`kind:<kind>`) is never made the focus. A focus
 * resolves to a node or to a group's kinds, and a kind card is neither: a
 * focus on one laid out an empty scene with the card's name in the URL,
 * which is what double-clicking a group looked like before this existed.
 */
export function withJackIn(state: ViewState, id: string): ViewState {
  const kind = kindOfCard(id);
  if (kind !== null && state.overview) return toggleExpanded(state, id);
  const target = kind !== null ? aggregateId(kind) : id;
  return state.zoom && state.focusId === target
    ? withZoom(state, false)
    : withZoom({ ...withFocus(state, target), relation: null }, true);
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
 * Lays boxes on an ellipse — a circle seen from above and in front — the way
 * a city reads from altitude: what is on the near side of the ring comes
 * toward the viewer, larger and sharper; what is on the far side sits
 * smaller, hazier, further back. Every card is still an axis-aligned box
 * under scale and translate, so the whole picture stays affine.
 *
 * Ordered the way the shelf is ordered, so a card keeps its neighbours when
 * the shelf becomes a ring and the eye can follow it round.
 */
function ring(
  count: number,
  size: { width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  inset: { readonly left?: number; readonly right?: number } = {},
  /** Extra height the nearest card may take: a district opened in place lists its members. */
  opened = 0,
): { x: number; y: number; depth: number; width: number; height: number }[] {
  // The span the ring may use: the canvas, less any rail reserved for chrome.
  const left = inset.left ?? 0;
  const span = canvasWidth - left - (inset.right ?? 0);
  const cx = left + span / 2;
  const cy = canvasHeight * 0.53;
  /*
   * A wide, tall ring: a picture of the whole domain should use the space it
   * was given. The ellipse is a circle under a vertical squash — affine.
   */
  const rx = span * 0.385;
  /*
   * The nearest card is the largest (1.3× at the bottom of the ellipse) and
   * sits lowest; in a short canvas — an embed the height of a paragraph —
   * the ring's natural sweep put it past the bottom edge. The ring is only
   * as tall as leaves that card whole, with a little ground under it.
   */
  const ry = Math.max(0, Math.min(canvasHeight * 0.365, canvasHeight - cy - size.height * 0.65 - opened - 12));
  return Array.from({ length: count }, (_, index) => {
    // Starting at the bottom, going clockwise, so the first card of the shelf
    // ends up nearest the viewer rather than hidden at the back.
    const angle = Math.PI / 2 + (index / Math.max(1, count)) * Math.PI * 2;
    /*
     * How near this stop on the ring is: 1 at the bottom of the ellipse
     * (toward the viewer), 0 at the top (the far side). Depth and size both
     * follow it, which is the entire altitude effect — the ellipse gives the
     * ground positions, nearness gives the elevation.
     */
    const near = (1 + Math.sin(angle)) / 2;
    const grow = 0.85 + near * 0.45;
    const width = size.width * grow;
    const height = size.height * grow;
    return {
      // Held inside the canvas: the near-bottom card is the largest, and a
      // generous ring can push its lower edge past the ground line.
      x: Math.max(4, Math.min(cx + Math.cos(angle) * rx - width / 2, canvasWidth - width - 4)),
      y: Math.max(4, Math.min(cy + Math.sin(angle) * ry - height / 2, canvasHeight - height - 4)),
      depth: 1 - near * 0.65,
      width,
      height,
    };
  });
}

/**
 * Lays the kinds out as a flat shelf: one baseline, even spacing.
 *
 * It used to bow upward in an arc, middle cards lifted and receded. The bow
 * carried no meaning — the row is not curved in the model, and the lift
 * mostly existed to negotiate room with chrome that no longer reserves any.
 * A shelf is a map; a map lies flat. Depth within the plane still separates
 * a secondary kind from a primary one, without moving anything.
 */
const SHELF_DEPTH = 0.85;

function shelf(
  count: number,
  size: { width: number; height: number },
  gap: number,
  canvasWidth: number,
  baseY: number,
  depth: number = SHELF_DEPTH,
): { x: number; y: number; depth: number }[] {
  const total = count * size.width + Math.max(0, count - 1) * gap;
  const startX = Math.max(gap, (canvasWidth - total) / 2);
  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * (size.width + gap),
    y: baseY,
    depth,
  }));
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
  /*
   * THE SPAN: the canvas less the rail reserved for chrome. Every card is
   * sized and centred within it, in every mode — the inspector and the
   * quick relations live on the left edge whether the picture is the whole
   * domain or one thing, and a lens that takes the full focus width was
   * drawn under them. The reported width stays the canvas's own.
   */
  const railLeft = opts.inset?.left ?? 0;
  const spanW = opts.width - railLeft - (opts.inset?.right ?? 0);
  const nodes: LayoutNode[] = [];
  const placed = new Map<string, LayoutNode>();

  // A group may be focused as readily as a node: "show me the week" and
  // "show me this run" are the same gesture at different granularities.
  /*
   * THE HORIZON. A node retired under its kind's declared lifecycle is not
   * in the picture unless the view has deliberately widened to the past —
   * and everything that drops out is COUNTED where it dropped from, so the
   * archive is one step away rather than gone.
   */
  const current = (node: NodeOfSchema<S>): boolean =>
    state.past === true || isCurrent(schema.tryDefinition(node.kind), node, opts.today);

  /*
   * MODULES OFF are not drawn at all — no card, no members, no raised
   * plane. Unlike the horizon there is no advert and no count: a workspace
   * that turned Vehicles off did not archive its cars, it scoped its
   * interface, and a "+2 elsewhere" pill would reintroduce the very concept
   * the toggle removed. The nodes stay in the graph untouched.
   */
  const hidden = new Set(options.hiddenKinds ?? []);
  const visible = (node: NodeOfSchema<S>): boolean => !hidden.has(node.kind);

  let focusKinds = state.focusId
    ? kindsOfAggregate(state.focusId).filter((kind) => !hidden.has(kind))
    : [];
  /*
   * A URL can point where this workspace cannot go — a bookmarked vehicle
   * in a workspace that turned the module off. The honest landing is the
   * default view, not a void with that node's name on it.
   */
  if (state.focusId && kindsOfAggregate(state.focusId).length > 0 && focusKinds.length === 0) {
    state = { ...state, focusId: null };
  }
  const hiddenFocus = state.focusId ? graph.getNode(state.focusId) : undefined;
  if (hiddenFocus && !visible(hiddenFocus)) {
    state = { ...state, focusId: null };
    focusKinds = [];
  }
  const focusAll =
    focusKinds.length > 0
      ? [...graph.allNodes()]
          .filter((node) => focusKinds.includes(node.kind))
          .sort(byStableKey)
      : [];
  const focusGroup = focusAll.filter(visible).filter(current);
  const focusRetired = focusAll.length - focusGroup.length;
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
  /*
   * ZOOMED IN CLOSE, the focus takes most of the scene — most, not all.
   *
   * The shelf and any raised relation keep thin bands at the bottom,
   * receded: the zoomed stop is still a place in the same picture, with its
   * connectors, not a document that replaced it. This is what the jack-in
   * gesture lands on now; the modal page it used to open isolated the view
   * from every relation it had.
   */
  const zoomed = state.zoom === true && !state.overview && state.focusId !== null;
  const band = zoomed
    ? focus !== undefined
      ? {
          // A zoomed RECORD is a reading column with its neighbourhood
          // under it at full size: the column does not need the height a
          // dense picture does, and a neighbourhood squeezed into a sliver
          // clipped its own cards.
          focusY: opts.height * 0.03,
          focusH: opts.height * 0.58,
          relationY: opts.height * 0.645,
          relationH: opts.height * 0.2,
          contextY: opts.height * 0.895,
          contextH: Math.max(56, opts.height * 0.062),
        }
      : {
          // A zoomed PLACE is the dense picture: most of the scene, with a
          // raised relation kept usable and the shelf receded below.
          focusY: opts.height * 0.03,
          focusH: opts.height * 0.71,
          relationY: opts.height * 0.765,
          relationH: opts.height * 0.1,
          contextY: opts.height * 0.895,
          contextH: Math.max(56, opts.height * 0.062),
        }
    : focus === undefined
      ? {
          /*
           * Checked WITH a relation raised, which is the state that broke:
           * the old proportions left plane 1's bottom edge minus one pixel
           * from plane 2's top, and the raised cards sat directly on the
           * kinds shelf. Every band boundary here keeps clear ground below
           * it at any canvas height the surveys cover.
           */
          focusY: opts.height * 0.045,
          focusH: opts.height * 0.62,
          relationY: opts.height * 0.68,
          relationH: opts.height * 0.2,
          contextY: opts.height * 0.918,
          contextH: opts.height * 0.082,
        }
      : (() => {
          /*
           * A SHORT CANVAS gives the focus more of itself. At a window's
           * height 42% is a card with room to spare; in a box the height of
           * a paragraph it is a card cut across its own facts. The focus
           * takes up to 56% until it has 300 pixels, and the relations band
           * gives up what the focus took; at 715 and above nothing changes.
           */
          const h = opts.height;
          const focusY = h * 0.04;
          const focusH = Math.max(h * 0.42, Math.min(h * 0.56, 300));
          const relationY = focusY + focusH + h * 0.06;
          return {
            focusY,
            focusH,
            relationY,
            relationH: Math.max(h * 0.12, h * 0.878 - h * 0.068 - relationY),
            contextY: h * 0.878,
            contextH: h * 0.092,
          };
        })();

  /*
   * A group gets the whole width; a single node does not.
   *
   * The week's calendar has five columns to fill and earns 1040 pixels. One
   * nap, with a name, a time and one person at it, drawn across the same
   * width is a letterbox with four words in it. Narrowing the detail box is
   * the difference between a card and an empty page.
   */
  // Zoomed, a group runs nearly wall to wall; a record stays a readable
  // column even with the room — 880 is a document's width, not a letterbox.
  const detailWidth = zoomed
    ? Math.min(880, spanW - opts.gap * 5)
    : Math.min(700, spanW - opts.gap * 6);
  const groupWidth = zoomed
    ? spanW - opts.gap * 5
    : Math.min(opts.focusSize.width, spanW - opts.gap * 6);

  /** Fits `count` boxes across the canvas, never wider than the cap. */
  const fit = (count: number, cap: number, height: number) => ({
    width:
      count === 0
        ? cap
        : Math.min(cap, (spanW - opts.gap * (count + 1)) / count),
    height,
  });
  const expanded = new Set(state.expanded);

  // Nothing is raised while you are above the stack: the ring IS the
  // relation plane up here.
  const related = state.overview
    ? []
    : relatedNodes(graph, schema, focus, state.relation)
        .filter((entry) => visible(entry.node))
        .filter((entry) => current(entry.node));

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
  /*
   * The live view is the TALLEST STRUCTURE in the picture, not a peer stamp.
   *
   * At 0.4 by 0.42 the shrunk interface read as one more card among the
   * kinds — the same visual rank as a district of five nodes — and most of
   * the scene was empty ground. Half the width and nearly half the height
   * says what is actually true from up here: this is the thing you were
   * standing in, and everything else is arranged around it.
   */
  const overviewScale = Math.min((spanW * 0.5) / naturalW, (opts.height * 0.48) / naturalH);
  const overviewW = naturalW * overviewScale;
  const overviewH = naturalH * overviewScale;

  // ------------------------------------------------------- plane 0: focus
  /*
   * A focused GROUP, from altitude, is its district when its picture is only
   * the framework's list: the district opens in place instead. A group with
   * its own view keeps the scaled card — and then its district stays shut,
   * so the same names are never drawn twice.
   */
  const plain = new Set(options.plainGroups ?? []);
  const groupFocus = state.overview && !focus && focusGroup.length > 0 && state.focusId !== null;
  const groupIsPlain = groupFocus && focusKinds.length > 0 && focusKinds.every((kind) => plain.has(kind));
  if (groupFocus) {
    for (const kind of focusKinds) {
      if (groupIsPlain) expanded.add(kindCardId(kind));
      else expanded.delete(kindCardId(kind));
    }
  }
  if (state.overview && (focus || focusGroup.length > 0) && state.focusId && !groupIsPlain) {
    push({
      id: state.focusId,
      kind: focus ? focus.kind : focusKinds[0]!,
      plane: 0,
      // Centred in the span the ring uses, so the picture and its ring agree.
      x: railLeft + (spanW - overviewW) / 2,
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
              ...(focusRetired > 0 ? { retired: focusRetired } : {}),
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
      x: railLeft + (spanW - detailWidth) / 2,
      y: band.focusY,
      width: detailWidth,
      height: focusHeight,
    });
  } else if (focusGroup.length > 0 && state.focusId) {
    push({
      id: state.focusId,
      kind: focusKinds[0]!,
      plane: 0,
      x: railLeft + (spanW - groupWidth) / 2,
      y: band.focusY,
      width: groupWidth,
      height: focusHeight,
      aggregate: {
        kind: focusKinds.join("+"),
        memberIds: focusGroup.map((node) => node.id),
        label:
          options.plurals?.[state.focusId] ??
          focusKinds.map((kind) => pluralOf(schema, kind)).join(" and "),
        ...(focusRetired > 0 ? { retired: focusRetired } : {}),
      },
    });
  }

  // --------------------------------------------------- plane 1: relations
  /*
   * A run of one or two cards takes wider ones. The cap exists to fit a
   * crowd; holding a lone neighbour to crowd width drew one small slip in
   * the middle distance of an otherwise empty band, with its caption
   * stretched past both its edges.
   */
  const relationSize = fit(
    related.length,
    related.length <= 2 ? Math.round(opts.relationSize.width * 1.35) : opts.relationSize.width,
    band.relationH,
  );
  const relationPositions = row(
    related.length,
    relationSize,
    opts.gap,
    spanW,
    band.relationY,
  ).map((position) => ({ ...position, x: position.x + railLeft }));
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
    retired: number;
    raised?: boolean;
    focused?: boolean;
  }[] = [];
  for (const kind of schema.kinds as readonly string[]) {
    if (hidden.has(kind)) continue;
    const all = groups.get(kind) ?? [];
    const members = all.filter(current);
    entries.push({
      id: kindCardId(kind),
      kind,
      members: members.sort(byStableKey),
      retired: all.length - members.length,
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

  /*
   * RANKED, not merely listed.
   *
   * A strip of nine identical thumbnails says which kinds exist and nothing
   * about which of them matter. What the focus actually touches is drawn full
   * size; what it reaches only through something else is drawn smaller and
   * tucked behind whatever it hangs off, so a nested relationship reads as
   * nested. The ranking comes from the schema, which is what makes it stable:
   * adding a node can never promote a kind and shuffle the row.
   */
  const ranking = rankKinds(schema, focusedKinds);
  /*
   * Ranking only says something when something is actually near. A focus
   * whose kind declares no edges makes EVERY other kind secondary, and a
   * strip where all nine cards shrank together carries no more information
   * than one where none did — only less legibility.
   *
   * On the ring nothing ranks and nothing nests: up there every kind is a
   * district of the same city, what-touches-what is the connectors' job,
   * and a card tucked behind another is a pile — which is exactly the thing
   * altitude exists to undo.
   */
  const ranked =
    !state.overview &&
    (schema.kinds as readonly string[]).some((kind) => ranking.rankOf(kind) === "primary");

  // Expanding an aggregate and collapsing it run through this one loop:
  // an open group contributes its members, a closed one contributes itself.
  const contextItems: {
    id: string;
    kind: string;
    aggregate?: Aggregate;
    raised?: boolean;
    focused?: boolean;
    opened?: boolean;
    rank?: "primary" | "secondary";
    nestedUnder?: string;
  }[] = [];
  for (const entry of entries) {
    /*
     * In the stack an expanded aggregate DISSOLVES into its members. From
     * altitude it OPENS instead: the card keeps its ring stop and shows its
     * members in place, because dissolving up there would hand every member
     * its own stop and re-flow the whole map.
     */
    if (!state.overview && expanded.has(entry.id) && entry.members.length > 0) {
      for (const member of entry.members) {
        contextItems.push({ id: member.id, kind: member.kind });
      }
    } else {
      const rank = ranked ? ranking.rankOf(entry.kind) : undefined;
      const parent = rank === "secondary" ? ranking.parentOf(entry.kind) : undefined;
      contextItems.push({
        id: entry.id,
        kind: entry.kind,
        ...(entry.raised ? { raised: true } : {}),
        ...(entry.focused ? { focused: true } : {}),
        ...(state.overview && expanded.has(entry.id) ? { opened: true } : {}),
        ...(rank ? { rank } : {}),
        // Only nest under a card that is actually on the plane: an expanded
        // parent has dissolved into its members and has nothing to hang off.
        ...(parent && !expanded.has(kindCardId(parent))
          ? { nestedUnder: kindCardId(parent) }
          : {}),
        aggregate: {
          kind: entry.kind,
          memberIds: entry.members.map((m) => m.id),
          label: options.plurals?.[entry.kind] ?? pluralOf(schema, entry.kind),
          ...(entry.retired > 0 ? { retired: entry.retired } : {}),
        },
      });
    }
  }

  /*
   * A nested card takes no slot of its own: it hangs off its parent's.
   *
   * Drawn first so the card it belongs to paints over it — same plane, same
   * z-index, so the order here IS the stacking, and "behind" is the whole
   * reading.
   */

  /*
   * TWO of them, at most, and the rest take ordinary slots.
   *
   * Nesting is an emphasis device: "these hang off that". Six kinds sharing a
   * parent turned it into the opposite — the fan divides the parent's width
   * between them, so the coaching week drew FIXTURES, PLAYERS, POSITIONS,
   * RULES, SQUADS and UNAVAILABILITY as six seventy-pixel slivers whose
   * labels ran into each other and whose longest wrapped mid-word. An
   * emphasis that costs legibility is not emphasis, it is damage.
   *
   * The overflow is not demoted — it keeps `rank: "secondary"`, so it is
   * still drawn smaller and further back in its own slot. The ranking
   * survives; only the pile does not. Which two nest is decided by the same
   * stable sort everything else here uses, so this stays a pure function of
   * the view.
   */
  const FANNED_PER_PARENT = 2;
  const fannedSoFar = new Map<string, number>();
  for (const item of contextItems) {
    if (item.nestedUnder === undefined) continue;
    const already = fannedSoFar.get(item.nestedUnder) ?? 0;
    if (already >= FANNED_PER_PARENT) delete (item as { nestedUnder?: string }).nestedUnder;
    else fannedSoFar.set(item.nestedUnder, already + 1);
  }

  const tucked = contextItems.filter((item) => item.nestedUnder !== undefined);
  const slotted = contextItems.filter((item) => item.nestedUnder === undefined);

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
    ? // Squat cards: a kind card holds a name, a count and a bar, and a tall
      // one from altitude was mostly empty tint — a sticky note, not a
      // building face.
      { width: Math.min(220, spanW / 6.5), height: Math.min(92, opts.height * 0.125) }
    : fit(slotted.length, zoomed ? 240 : opts.contextSize.width, band.contextH);
  const contextPositions: {
    x: number;
    y: number;
    depth: number;
    width?: number;
    height?: number;
  }[] = state.overview
    ? ring(
        slotted.length,
        contextSize,
        opts.width,
        opts.height,
        opts.inset ?? {},
        // An opened district lists its members below its name: room for a few.
        slotted.some((item) => expanded.has(item.id)) ? 96 : 0,
      )
    : shelf(
        slotted.length,
        contextSize,
        opts.gap,
        spanW,
        band.contextY,
        // Zoomed in, the shelf recedes further — present, quieter.
        zoomed ? 0.97 : SHELF_DEPTH,
      ).map((position) => ({ ...position, x: position.x + railLeft }));

  /*
   * A secondary kind is drawn SMALLER and further back inside its own slot,
   * sitting on the same baseline as its neighbours. Same row, same order,
   * different weight — the eye reads the primaries first without anything
   * having moved.
   */
  const SECONDARY = 0.74;
  /*
   * A tucked card still has to hold a name and a count. Half was sized
   * against a context card twice as tall and clipped the moment the band
   * became a strip of glyphs. It does not go much beyond this: at nearly the
   * parent's size the two cards coincide, which reads as a rendering fault
   * and puts the tucked one out of reach of a click.
   */
  const NESTED = 0.8;
  /*
   * A kind card holds a name and a count, and that is a fixed number of
   * pixels. Every shrink here is proportional — secondary at 0.74, tucked at
   * 0.8 of that, and tucked again by how many share a parent — so at a
   * glyph-sized band the multiplications land under the content and the card
   * clips. Proportion is right until it crosses the floor.
   */
  const CARD_MIN_HEIGHT = 56;
  const TUCK_MIN_HEIGHT = 52;
  const TUCK_MIN_WIDTH = 86;
  /** Further back within the plane. 1 is the plane's own depth. */
  const recede = (depth: number, by: number) => Math.min(1, depth + (1 - depth) * by);

  interface Slot {
    x: number;
    y: number;
    depth: number;
    width: number;
    height: number;
  }
  const slotOf = new Map<string, Slot>();
  slotted.forEach((item, index) => {
    const position = contextPositions[index]!;
    // A ring stop carries its own size — nearness grows it. A shelf slot is
    // uniform, and rank shrinks into it.
    const slotW = position.width ?? contextSize.width;
    const slotH = position.height ?? contextSize.height;
    const shrink = item.rank === "secondary" ? SECONDARY : 1;
    const width = slotW * shrink;
    const height = Math.max(CARD_MIN_HEIGHT, slotH * shrink);
    slotOf.set(item.id, {
      // Centred across the slot it was allotted, sitting on its baseline.
      x: position.x + (slotW - width) / 2,
      y: position.y + (slotH - height),
      depth: item.rank === "secondary" ? recede(position.depth, 0.5) : position.depth,
      width,
      height,
    });
  });

  type PlacedCard = (typeof contextItems)[number] & Slot;
  const placedContext: PlacedCard[] = [];
  const lastSlot = contextPositions[contextPositions.length - 1];

  /*
   * Several kinds can hang off the same one, and stacking them at one point
   * would draw a single card with two others hidden underneath it. They climb
   * off their parent's top-right corner instead — a small pile, each one
   * still a target, each one further back than the last.
   */
  const siblings = new Map<string, number>();
  for (const item of tucked) {
    siblings.set(item.nestedUnder!, (siblings.get(item.nestedUnder!) ?? 0) + 1);
  }
  const seen = new Map<string, number>();

  for (const item of tucked) {
    const parent = slotOf.get(item.nestedUnder!);
    if (parent) {
      const count = siblings.get(item.nestedUnder!) ?? 1;
      const index = seen.get(item.nestedUnder!) ?? 0;
      seen.set(item.nestedUnder!, index + 1);
      /*
       * PEEKING OVER the parent's top edge, from behind.
       *
       * Behind means further, and further means higher on screen — the same
       * reading the whole depth model uses — so a kind reached through
       * another stands behind it the way a building stands behind the one in
       * front. The room above exists now that the focus stops clear of the
       * shelf instead of reaching down over an arc.
       *
       * Below the parent was the old place, and it broke clicking: hovering
       * the parent grows it downward to reveal its note, which covered the
       * tuck under the pointer — the card you were reaching for disappeared
       * under the one it hangs off, and stayed covered while the pointer was
       * on it.
       *
       * Overlap is capped at just under half a card, because a card whose
       * MIDDLE is covered cannot be clicked — the point at the centre belongs
       * to whatever is drawn over it. Where several share a parent they
       * shrink to fit rather than piling up.
       */
      /*
       * Offset enough to read as a pile, not enough to hide a label.
       *
       * At 0.55 each card covered forty-five per cent of the one to its left
       * — and a kind card's label sits along its top edge, so the left card
       * of every pair read as half a word running into the next: "FIXTURES"
       * and "PLAYERS" drawn as "FIXTURESPLAYERS". The offset is a depth cue;
       * it does not have to cost the thing it is a cue about.
       */
      const step = 0.86;
      const roomy = contextSize.width * NESTED;
      /*
       * Never smaller than the card's own content.
       *
       * The height followed the width so a fan of two shrank both, and at a
       * glyph-sized band that landed exactly on the height of a name plus a
       * count — so every tucked card in a pair clipped by four or five
       * pixels. A proportional rule is right until it crosses the floor;
       * below that the card is not smaller, it is broken.
       */
      /*
       * The whole fan fits the parent's slot plus its gap, never more.
       *
       * At 1.02 of the parent's width the fan of two spread to 1.86 widths,
       * centred — so it spilled almost half a card into the slot on either
       * side, and "PLAYERS" ran into "UNAVAILABILITY" while every automated
       * check counted the pile as deliberate. A tuck that leaves its
       * parent's ground is not tucked behind anything.
       */
      const width = Math.max(
        TUCK_MIN_WIDTH,
        Math.min(roomy, (parent.width + opts.gap) / (step * (count - 1) + 1)),
      );
      const height = Math.max(
        TUCK_MIN_HEIGHT,
        contextSize.height * NESTED * (width / roomy),
      );
      const spread = width * step;
      const fan = (count - 1) * spread + width;
      placedContext.push({
        ...item,
        x: parent.x + (parent.width - fan) / 2 + index * spread,
        /*
         * A FIXED bite behind the parent, not half the tuck.
         *
         * Sixteen pixels of the tuck's bottom sit behind the parent's top
         * edge — enough to read as "behind that one" at any card size,
         * little enough that the tuck's own label and its centre stay
         * clickable above the edge. The parent paints over the overlap, so
         * its name and its trouble bar are never covered.
         *
         * Never above the canvas: a card pushed off the top of the screen is
         * not tucked, it is gone.
         */
        y: Math.max(0, parent.y - height + Math.min(height * 0.5, 16)),
        width,
        height,
        depth: recede(parent.depth, 0.8),
      });
    } else if (lastSlot) {
      const width = contextSize.width * NESTED;
      const height = contextSize.height * NESTED;
      // A parent that never got a slot leaves nothing to hang off. The card
      // is still drawn, at the end of the row, rather than silently dropped.
      placedContext.push({
        ...item,
        x: lastSlot.x,
        y: lastSlot.y,
        width,
        height,
        depth: recede(lastSlot.depth ?? 1, 0.8),
      });
    }
  }
  for (const item of slotted) {
    placedContext.push({ ...item, ...slotOf.get(item.id)! });
  }

  placedContext.forEach((item) => {
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
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      ...(item.aggregate ? { aggregate: item.aggregate } : {}),
      ...(item.raised ? { raised: true } : {}),
      ...(item.focused ? { focused: true } : {}),
      ...(item.opened ? { opened: true } : {}),
      ...(item.rank ? { rank: item.rank } : {}),
      ...(item.nestedUnder ? { nestedUnder: item.nestedUnder } : {}),
      depth: item.depth,
    });
  });

  return {
    nodes,
    connectors: connectorsFor(graph, placed, state),
    width: opts.width,
    height: opts.height,
  };

  function push(node: Omit<LayoutNode, "pinned">): void {
    // A user pin overrides the computed position and survives graph changes
    // underneath: the layout keeps recomputing, the pin keeps winning.
    const pin = state.pins[node.id];
    const placedNode: LayoutNode = pin
      ? { ...node, x: pin.x, y: pin.y, pinned: true }
      : { ...node, pinned: false };
    /*
     * The camera moves LAST, and moves everything.
     *
     * Applied here rather than as a transform on the stage, so it is part of
     * the one function that decides where things are: connectors are drawn
     * from these coordinates, the frame planner reads them, and both
     * renderers get panning without either of them learning about it. A pin
     * is stored unpanned for the same reason — pan the camera back and the
     * card is where you left it, relative to everything else.
     */
    const final: LayoutNode = state.pan
      ? { ...placedNode, x: placedNode.x + state.pan.x, y: placedNode.y + state.pan.y }
      : placedNode;
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
function connectorsFor<N extends { id: string; kind: string }>(
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
      if (held.edges.some((e) => e.from === edge.from && e.to === edge.to)) continue;
      const { single: _dropped, ...rest } = held;
      connectors.set(id, { ...rest, edges: [...held.edges, { from: edge.from, to: edge.to }] });
      continue;
    }
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
  return [...connectors.values()].sort(byStableKey);
}

/** Which plane a node ended up on, or null if it is not in the layout. */
export function planeOf(result: Layout, id: string): Plane | null {
  return result.nodes.find((node) => node.id === id)?.plane ?? null;
}
