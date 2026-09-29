import { aggregateId, isAggregateId, kindCardId, kindOfCard } from "./ids.js";
import type { CityFrame, Connector, Layout, LayoutNode } from "./types.js";

export interface InterpolatedNode extends Omit<LayoutNode, "plane"> {
  /** Fractional plane, so the renderer can mix two plane styles. */
  readonly plane: number;
  /** 0 while fully absent, 1 while fully present. */
  readonly opacity: number;
}

export interface InterpolatedLayout {
  readonly nodes: readonly InterpolatedNode[];
  readonly connectors: readonly (Connector & { opacity: number })[];
  readonly width: number;
  readonly height: number;
  readonly t: number;
  /** The destination's lattice, when it has one. */
  readonly city?: CityFrame;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function centre(node: LayoutNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

/**
 * The box a node should come from, or return to, when it is absent from one
 * side of a transition: the aggregate that stands in for it there.
 *
 * This is what makes expand and collapse one mechanism rather than two
 * animations — a member growing out of its group and a group swallowing its
 * members are the same interpolation run in opposite directions.
 */
/*
 * A layout's nodes by id, and the groups each member could shrink into —
 * read once per layout, not once per node per frame. `find` over every node
 * for every node entering or leaving was quadratic, and a hub whose band
 * groups hold a thousand members ran it sixty times a second.
 */
interface Index {
  readonly byId: ReadonlyMap<string, LayoutNode>;
  readonly groupsOf: ReadonlyMap<string, readonly LayoutNode[]>;
}
const indexed = new WeakMap<Layout, Index>();
function indexOf(layout: Layout): Index {
  let index = indexed.get(layout);
  if (index) return index;
  const byId = new Map<string, LayoutNode>();
  const groupsOf = new Map<string, LayoutNode[]>();
  for (const node of layout.nodes) {
    byId.set(node.id, node);
    for (const member of node.aggregate?.memberIds ?? []) {
      const groups = groupsOf.get(member);
      if (groups) groups.push(node);
      else groupsOf.set(member, [node]);
    }
  }
  index = { byId, groupsOf };
  indexed.set(layout, index);
  return index;
}

function standIn(node: LayoutNode, other: Layout): LayoutNode | null {
  const { byId, groupsOf } = indexOf(other);
  /*
   * A BILLBOARD SINKS INTO ITS VILLAGE, and rises out of it. The picture on
   * a kind's plot is an aggregate node, and an aggregate's stand-in is the
   * centroid of its members — but from altitude the members are buildings
   * on the ground, not nodes, so a billboard leaving had nowhere to go and
   * faded where it stood, at full size, under the billboard replacing it:
   * two pictures on top of each other for the length of the tween, and
   * the old one read as left up. Its kind's card is where it goes — the
   * signpost and board at the front of the village, where its own small
   * picture is — and where the next one comes from.
   */
  if (node.screenOf !== undefined) {
    const card = byId.get(kindCardId(node.screenOf));
    if (card) return { ...node, x: card.x, y: card.y, width: card.width, height: card.height };
  }
  if (isAggregateId(node.id) || kindOfCard(node.id) !== null) {
    // A group vanishing: its members are the thing it becomes. Collapse to
    // the centroid of wherever they went.
    const members = (node.aggregate?.memberIds ?? [])
      .map((id) => byId.get(id))
      .filter((n): n is LayoutNode => n !== undefined);
    if (members.length === 0) return null;
    const points = members.map(centre);
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return { ...node, x: x - node.width / 2, y: y - node.height / 2 };
  }

  const group = groupsOf
    .get(node.id)
    ?.find((candidate) => candidate.id === kindCardId(node.kind) || candidate.id === aggregateId(node.kind));
  if (!group) return null;
  const point = centre(group);
  return { ...node, x: point.x - node.width / 2, y: point.y - node.height / 2 };
}

/**
 * Interpolates two layouts. Because layout is a pure function of the view,
 * ANY two states can be tweened — there is no special-cased transition list,
 * and a new kind of navigation animates for free.
 */
export function interpolate(from: Layout, to: Layout, t: number): InterpolatedLayout {
  const clamped = Math.max(0, Math.min(1, t));
  const fromById = new Map(from.nodes.map((node) => [node.id, node]));
  const toById = new Map(to.nodes.map((node) => [node.id, node]));
  const nodes: InterpolatedNode[] = [];

  for (const [id, start] of fromById) {
    const end = toById.get(id);
    if (end) {
      nodes.push(mix(start, end, clamped, 1));
      continue;
    }
    // Leaving: shrink into whatever now stands in for it, and fade.
    const target = standIn(start, to) ?? start;
    nodes.push(mix(start, target, clamped, 1 - clamped));
  }

  for (const [id, end] of toById) {
    if (fromById.has(id)) continue;
    // Entering: grow out of whatever stood in for it, and fade in.
    const source = standIn(end, from) ?? end;
    nodes.push(mix(source, end, clamped, clamped));
  }

  const fromConnectors = new Map(from.connectors.map((c) => [c.id, c]));
  const toConnectors = new Map(to.connectors.map((c) => [c.id, c]));
  const connectors: (Connector & { opacity: number })[] = [];
  for (const [id, start] of fromConnectors) {
    const end = toConnectors.get(id);
    connectors.push(
      end
        ? { ...mixConnector(start, end, clamped), opacity: 1 }
        : { ...start, opacity: 1 - clamped },
    );
  }
  for (const [id, end] of toConnectors) {
    if (fromConnectors.has(id)) continue;
    connectors.push({ ...end, opacity: clamped });
  }

  return {
    // A node that has finished fading out is gone. Leaving it in the list at
    // opacity 0 means the renderer keeps a texture, a placement and a draw
    // call for something nobody can see — and it never leaves, because no
    // further frames are emitted once the tween settles.
    nodes: nodes
      .filter((node) => node.opacity > 0)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    connectors: connectors
      .filter((connector) => connector.opacity > 0)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    width: lerp(from.width, to.width, clamped),
    height: lerp(from.height, to.height, clamped),
    t: clamped,
    ...(mixCity(from.city, to.city, clamped) ? { city: mixCity(from.city, to.city, clamped)! } : {}),
  };
}

/**
 * THE GROUND MOVES WITH THE CITY. Between two cities — the camera flying
 * closer, a district pinned elsewhere — the cell and the origin tween, so
 * the lattice, the plots and the roads slide and grow with the cards on
 * them rather than snapping to the destination while the cards are still
 * on their way. Rising, there is no city to start from, so the lattice
 * arrives with the destination and the ground crossfades to it by the
 * altitude number; a half-scaled lattice would be no grid. Descending, the
 * city stays as it was while the ground fades out under the landing
 * picture, instead of vanishing on the first frame of the way down.
 */
function mixCity(from: CityFrame | undefined, to: CityFrame | undefined, t: number): CityFrame | undefined {
  if (!from) return to;
  if (!to) return from;
  return {
    cell: lerp(from.cell, to.cell, t),
    originX: lerp(from.originX, to.originX, t),
    originY: lerp(from.originY, to.originY, t),
    pan: { x: lerp(from.pan.x, to.pan.x, t), y: lerp(from.pan.y, to.pan.y, t) },
    extent: {
      x: lerp(from.extent.x, to.extent.x, t),
      y: lerp(from.extent.y, to.extent.y, t),
      width: lerp(from.extent.width, to.extent.width, t),
      height: lerp(from.extent.height, to.extent.height, t),
    },
  };
}

function mix(a: LayoutNode, b: LayoutNode, t: number, opacity: number): InterpolatedNode {
  return {
    id: b.id,
    kind: b.kind,
    plane: lerp(a.plane, b.plane, t),
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    width: lerp(a.width, b.width, t),
    height: lerp(a.height, b.height, t),
    pinned: b.pinned,
    opacity,
    ...(b.aggregate ? { aggregate: b.aggregate } : {}),
    ...(b.via ? { via: b.via } : {}),
    ...(b.raised ? { raised: true } : {}),
    ...(b.focused ? { focused: true } : {}),
    ...(b.opened ? { opened: true } : {}),
    ...(b.compact ? { compact: true } : {}),
    ...(b.rank ? { rank: b.rank } : {}),
    ...(b.nestedUnder ? { nestedUnder: b.nestedUnder } : {}),
    /* What a card STANDS FOR travels with it, or the row's overflow card
       arrives mid-transition as an empty box with no kind and nothing in it. */
    ...(b.beyond ? { beyond: b.beyond } : {}),
    /* An address is not a position: it does not tween, it travels. Dropped
       here, a district mid-flight to altitude has no plot, and the ground
       under it and the roads to it have nothing to stand on. */
    ...(b.plot ? { plot: b.plot } : {}),
    ...(b.screenOf ? { screenOf: b.screenOf } : {}),
    ...(b.depth === undefined ? {} : { depth: lerp(a.depth ?? 1, b.depth, t) }),
    ...(b.natural ? { natural: b.natural } : {}),
  };
}

function mixConnector(a: Connector, b: Connector, t: number): Connector {
  return {
    ...b,
    x1: lerp(a.x1, b.x1, t),
    y1: lerp(a.y1, b.y1, t),
    x2: lerp(a.x2, b.x2, t),
    y2: lerp(a.y2, b.y2, t),
  };
}

/** Ease-in-out, so a transition reads as motion rather than a slide. */
export function easeInOut(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - (-2 * clamped + 2) ** 3 / 2;
}
