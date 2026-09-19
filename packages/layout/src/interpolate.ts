import { aggregateId, isAggregateId, kindCardId, kindOfCard } from "./layout.js";
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
function standIn(node: LayoutNode, other: Layout): LayoutNode | null {
  if (isAggregateId(node.id) || kindOfCard(node.id) !== null) {
    // A group vanishing: its members are the thing it becomes. Collapse to
    // the centroid of wherever they went.
    const members = (node.aggregate?.memberIds ?? [])
      .map((id) => other.nodes.find((n) => n.id === id))
      .filter((n): n is LayoutNode => n !== undefined);
    if (members.length === 0) return null;
    const points = members.map(centre);
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return { ...node, x: x - node.width / 2, y: y - node.height / 2 };
  }

  const group = other.nodes.find(
    (candidate) =>
      (candidate.id === kindCardId(node.kind) || candidate.id === aggregateId(node.kind)) &&
      candidate.aggregate?.memberIds.includes(node.id),
  );
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
    /* The lattice arrives with the destination: the ground crossfades to it
       by the altitude number, and a half-scaled lattice would be no grid. */
    ...(to.city ? { city: to.city } : {}),
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
