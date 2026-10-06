import { SCENE_LAYERS } from "@graview/core";
import { type Connector, edgeSelectionId, edgeOfSelection } from "@graview/layout";
import { CONNECTOR_DASH, connectorStroke, connectorWidth } from "@graview/render";
import type { ActivityMark } from "./activity.js";
import { kitConnector, useKit } from "./kit.js";
import {
  clipPolyline,
  latticePoints,
  orthogonalPoints,
  polylineD,
  roundedPolylineD,
  routedQuadratic,
} from "./routes.js";
import { channelRoute } from "./channels.js";
import { parallelOffsets } from "./parallel.js";
import { altitudeOpacity, drawnBox, measureVisible, onScreen, stackOpacity } from "./where-drawn.js";
import type { SceneNode } from "./scene-root.js";

/**
 * Where a line toward `towards` should MEET a box: on its border, not at its
 * centre.
 *
 * Centre-anchored lines cross the card's own interior on the way out — the
 * yellow dash sawing through the middle of REASONS was this — and where
 * several relations share an endpoint they converge to a single point at the
 * centre, which reads as a knot rather than as several roads arriving. The
 * border is where a road meets a building.
 */
/**
 * HOW A TIE RUNS between two measured drawings — a pure decision, so it is
 * testable without a browser.
 *
 * Two drawings stacked in one column used to get a near-straight vertical
 * aimed centre-to-centre — a line THROUGH every row between them, whose
 * hit corridor then stole those rows' clicks. Boxes that share a column
 * stitch along their common right edge, in the gutter; boxes that share a
 * row stitch over the top. Only ends with clear air between them take the
 * direct arc. Returns null when no honest line exists: one drawing inside
 * another is the view's own composition, and anchors within a few pixels
 * are one drawing restating itself.
 */
export function tieRoute(
  fromBox: { x: number; y: number; width: number; height: number },
  toBox: { x: number; y: number; width: number; height: number },
):
  | {
      from: { x: number; y: number };
      to: { x: number; y: number };
      control: { x: number; y: number };
      mode: "stacked" | "abreast" | "direct";
    }
  | null {
  const xOverlap =
    Math.min(fromBox.x + fromBox.width, toBox.x + toBox.width) - Math.max(fromBox.x, toBox.x);
  const yOverlap =
    Math.min(fromBox.y + fromBox.height, toBox.y + toBox.height) - Math.max(fromBox.y, toBox.y);
  if (xOverlap > 0 && yOverlap > 0) return null;
  const stacked = xOverlap > 0.5 * Math.min(fromBox.width, toBox.width);
  const abreast = !stacked && yOverlap > 0.5 * Math.min(fromBox.height, toBox.height);
  if (stacked) {
    const from = { x: fromBox.x + fromBox.width, y: fromBox.y + fromBox.height / 2 };
    const to = { x: toBox.x + toBox.width, y: toBox.y + toBox.height / 2 };
    return {
      from,
      to,
      control: { x: Math.max(from.x, to.x) + 18, y: (from.y + to.y) / 2 },
      mode: "stacked",
    };
  }
  if (abreast) {
    const from = { x: fromBox.x + fromBox.width / 2, y: fromBox.y };
    const to = { x: toBox.x + toBox.width / 2, y: toBox.y };
    return {
      from,
      to,
      control: { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 18 },
      mode: "abreast",
    };
  }
  const toCentre = { x: toBox.x + toBox.width / 2, y: toBox.y + toBox.height / 2 };
  const fromCentre = { x: fromBox.x + fromBox.width / 2, y: fromBox.y + fromBox.height / 2 };
  const from = edgePoint(fromBox, toCentre);
  const to = edgePoint(toBox, fromCentre);
  const direct = Math.hypot(to.x - from.x, to.y - from.y);
  if (direct < 8) return null;
  const bow = Math.min(36, direct * 0.12);
  const nx = -(to.y - from.y) / direct;
  const ny = (to.x - from.x) / direct;
  return {
    from,
    to,
    control: { x: (from.x + to.x) / 2 + nx * bow, y: (from.y + to.y) / 2 + ny * bow },
    mode: "direct",
  };
}

function edgePoint(
  box: { x: number; y: number; width: number; height: number },
  towards: { x: number; y: number },
): { x: number; y: number } {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = towards.x - cx;
  const dy = towards.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  // How far along the direction the border sits, on whichever side is hit
  // first — the standard slab intersection, for an axis-aligned box.
  const tx = dx === 0 ? Infinity : box.width / 2 / Math.abs(dx);
  const ty = dy === 0 ? Infinity : box.height / 2 / Math.abs(dy);
  const t = Math.min(tx, ty);
  // A few pixels shy of the border, so the stroke's rounded cap does not
  // poke into the card.
  const out = Math.max(0, t * 0.98);
  return { x: cx + dx * out, y: cy + dy * out };
}

/**
 * Whether the connector layer draws this line — ONE rule, shared with the
 * ties layer so a relation is never drawn twice with different manners.
 * Above the stack every relation earns its ink; inside it a line must touch
 * a raised node and must not end on a receded group ("some of these" is not
 * a relationship anyone can read).
 */
function connectorShows(
  connector: { from: string; to: string },
  byId: Map<string, SceneNode>,
  overview: boolean,
): boolean {
  const from = byId.get(connector.from);
  const to = byId.get(connector.to);
  if (!from || !to) return false;
  if (overview) return true;
  const raised = Math.round(from.plane) === 1 || Math.round(to.plane) === 1;
  const vagueEnd = (node: SceneNode) => Boolean(node.aggregate) && Math.round(node.plane) === 2;
  return raised && !vagueEnd(from) && !vagueEnd(to);
}

/** A box in stage space, anchored at its top-left. */
export type Box = { x: number; y: number; width: number; height: number };

type SceneConnector = Connector & { readonly opacity?: number };

/**
 * ONE DRAWN LINE: an anchor at each end, and the real edges that run
 * between them.
 *
 * Layout resolves an edge's ends to whatever is PLACED — a session inside
 * the week resolves to the week — and bundles every edge that lands on the
 * same pair. That is right for the layout, which cannot see inside a view.
 * The renderer can: the week draws each session as its own span, a session
 * card draws each drill as a chip, and any element wearing
 * `data-graview-pick` for a member is where a line to that member should
 * start. So a connector is unpicked here into strands, one per distinct
 * pair of anchors, and bundled again only where the view draws nothing for
 * the member. A strand that stands for exactly one edge is selectable.
 */
export interface Strand {
  readonly key: string;
  readonly connector: SceneConnector;
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly fromBox: Box;
  readonly toBox: Box;
  /** What each end is anchored ON: the drawn node, or a member drawn inside it. */
  readonly fromAnchor: string;
  readonly toAnchor: string;
  /** Every other drawn box, so the line can dive under cards it merely crosses. */
  readonly obstacles: readonly Box[];
  /** Both ends are chips of the relation band: every chip of it, so the line can take the gutters. */
  readonly band?: readonly Box[];
  /**
   * The cards an end is drawn INSIDE, when it lands on a member: the line
   * is visible across them (that is what landing on a member means), but
   * its hit stroke is not, so a line to Ravi never takes a click meant
   * for June above him.
   */
  readonly hosts: readonly Box[];
}

/**
 * Whether an element is actually visible inside every scroller above it.
 *
 * Walks up to the view it belongs to, and at each clipping ancestor asks
 * whether the element still overlaps it. Partly visible counts: half a row
 * is still that row, and a line to it is still true.
 */
/**
 * What one measuring pass has already asked the DOM. Every member's walk up
 * to its scroller passes the same few panels, and asking each of them for
 * its computed style and its box again, per member, per connector, per
 * pointer move, was most of the cost of dragging a card.
 */
interface Pass {
  /** A clipping ancestor's box, or null for one that does not clip. */
  readonly clips: Map<Element, DOMRect | null>;
  /** A member's boxes inside a host, keyed by host and member. */
  readonly members: Map<Element, Map<string, Box[]>>;
  /**
   * A host's marked elements by the id they mark, read once: a selector per
   * member walked the whole of a large picture for each of its lines.
   */
  readonly marks: Map<Element, Map<string, Element[]>>;
}
const newPass = (): Pass => ({ clips: new Map(), members: new Map(), marks: new Map() });

function marksIn(host: Element, pass: Pass): Map<string, Element[]> {
  let marks = pass.marks.get(host);
  if (marks) return marks;
  marks = new Map();
  for (const el of host.querySelectorAll("[data-graview-pick], [data-graview-slot]")) {
    for (const id of new Set([el.getAttribute("data-graview-pick"), el.getAttribute("data-graview-slot")])) {
      if (id === null) continue;
      const list = marks.get(id);
      if (list) list.push(el);
      else marks.set(id, [el]);
    }
  }
  pass.marks.set(host, marks);
  return marks;
}

function clipOf(parent: Element, pass: Pass): DOMRect | null {
  let held = pass.clips.get(parent);
  if (held === undefined) {
    const style = getComputedStyle(parent);
    const clips = style.overflow !== "visible" || style.overflowX !== "visible" || style.overflowY !== "visible";
    held = clips ? parent.getBoundingClientRect() : null;
    pass.clips.set(parent, held);
  }
  return held;
}

function withinItsScroller(el: Element, rect: DOMRect, pass: Pass): boolean {
  let parent = el.parentElement;
  while (parent !== null) {
    const box = clipOf(parent, pass);
    if (box) {
      const overlaps =
        rect.right > box.left + 1 &&
        rect.left < box.right - 1 &&
        rect.bottom > box.top + 1 &&
        rect.top < box.bottom - 1;
      if (!overlaps) return false;
    }
    if (parent.hasAttribute("data-graview-view")) break;
    parent = parent.parentElement;
  }
  return true;
}

/**
 * The elements a view draws for a MEMBER of a drawn node — a session's span
 * in the week, a drill's chip in a session card — measured in stage space
 * and sorted compact-first. Chrome is not scene: an offstage rail repeating
 * a name as a chip is never an anchor.
 */
function memberBoxes(
  stageEl: HTMLElement | null,
  host: Element | null,
  memberId: string,
  pass: Pass,
): Box[] {
  if (!stageEl || !host || typeof document === "undefined") return [];
  let inHost = pass.members.get(host);
  if (!inHost) pass.members.set(host, (inHost = new Map()));
  const known = inHost.get(memberId);
  if (known) return known;
  const stage = stageEl.getBoundingClientRect();
  const boxes: Box[] = [];
  for (const el of marksIn(host, pass).get(memberId) ?? []) {
    if (el.closest("[data-graview-offstage]")) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 2 || rect.height <= 2) continue;
    /*
     * A MEMBER SCROLLED OUT OF ITS PANEL IS NOT AN ANCHOR.
     *
     * `getBoundingClientRect` answers for an element that has been scrolled
     * past the edge of its own scroller just as happily as for one you can
     * see — with coordinates that are outside the panel, and often outside
     * the stage. A line drawn to that lands somewhere there is nothing,
     * usually across a neighbouring card, and reads as the picture lying
     * about the graph.
     *
     * Where the member is out of sight the line falls back to the host,
     * which is the honest answer: the thing is in there somewhere, and the
     * panel is the finest box that is actually true.
     */
    if (!withinItsScroller(el, rect, pass)) continue;
    boxes.push({
      x: rect.left - stage.left,
      y: rect.top - stage.top,
      width: rect.width,
      height: rect.height,
    });
  }
  boxes.sort((a, b) => a.width * a.height - b.width * b.height);
  inHost.set(memberId, boxes);
  return boxes;
}

/**
 * Resolves the frame's connectors into the strands the scene will draw.
 *
 * Pure of React and null-safe without a DOM: headless, every strand is
 * anchored on the layout's own boxes, which is the old behaviour exactly.
 * From altitude nothing is unpicked — the constellation is a picture of
 * kinds, and a line from a span inside the shrunk stamp would say nothing
 * the road between two districts does not.
 */
export function connectorStrands(
  nodes: readonly SceneNode[],
  connectors: readonly SceneConnector[],
  stageEl: HTMLElement | null,
  overview: boolean,
  scheme: "light" | "dark",
): Strand[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const pass = newPass();
  const hostEls = new Map<string, Element | null>();
  const hostOf = (id: string): Element | null => {
    if (!stageEl || typeof document === "undefined") return null;
    let held = hostEls.get(id);
    if (held === undefined) {
      held = stageEl.querySelector(`[data-graview-view="${CSS.escape(id)}"]`);
      hostEls.set(id, held);
    }
    return held;
  };
  // Every drawn box, measured once; a line dives under any it merely crosses.
  const boxes = new Map<string, Box>();
  for (const node of nodes) {
    const box = measureVisible(stageEl, node.id, overview) ?? drawnBox(node, scheme);
    if (box) boxes.set(node.id, box);
  }
  /*
   * THE DRAWINGS INSIDE THE VIEWS ARE OBSTACLES TOO.
   *
   * A line dives under any card it merely crosses — but "card" meant a
   * DRAWN NODE, and the things a lens draws inside itself are not drawn
   * nodes. So a line across the week passed over ten shift cards, and the
   * connector layer sits above the hosts, so it passed over them literally:
   * a stroke painted across somebody's Tuesday. Going under is what the
   * clipping already does; it just had nothing to clip against in there.
   *
   * Measured once per pass, keyed by the id each drawing wears, so a
   * strand can leave its own two ends out.
   */
  const memberBoxesById = new Map<string, Box[]>();
  if (stageEl && typeof document !== "undefined") {
    const stage = stageEl.getBoundingClientRect();
    for (const el of stageEl.querySelectorAll("[data-graview-pick], [data-graview-slot]")) {
      if (el.closest("[data-graview-offstage]")) continue;
      const id = el.getAttribute("data-graview-pick") ?? el.getAttribute("data-graview-slot");
      if (id === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 2 || rect.height <= 2) continue;
      /*
       * A ROTATED HEADER'S BOUNDING BOX is a huge diagonal rectangle whose
       * border is nowhere near the visible text — a matrix's column names
       * are written on the slant, and taking their boxes as obstacles
       * erased every line in the picture. Anything approaching the size of
       * the stage is furniture, not a drawing.
       */
      if (rect.width > stage.width * 0.6 && rect.height > stage.height * 0.6) continue;
      const held = memberBoxesById.get(id);
      const box = { x: rect.left - stage.left, y: rect.top - stage.top, width: rect.width, height: rect.height };
      if (held) held.push(box);
      else memberBoxesById.set(id, [box]);
    }
  }
  const obstaclesFor = (a: string, b: string): Box[] => {
    const out: Box[] = [];
    for (const [id, box] of boxes) if (id !== a && id !== b) out.push(box);
    for (const [id, drawn] of memberBoxesById) if (id !== a && id !== b) out.push(...drawn);
    return out;
  };
  // The relation band's chips, for a line whose both ends are in it.
  const inBand = (id: string) => Math.round(byId.get(id)?.plane ?? -1) === 1;
  const bandBoxes: Box[] = [];
  for (const node of nodes) {
    const box = boxes.get(node.id);
    if (box && Math.round(node.plane) === 1) bandBoxes.push(box);
  }
  const bandFor = (a: string, b: string): Box[] | undefined => (!overview && inBand(a) && inBand(b) ? bandBoxes : undefined);

  const strands: Strand[] = [];
  for (const connector of connectors) {
    if (!connectorShows(connector, byId, overview)) continue;
    const fromHost = boxes.get(connector.from);
    const toHost = boxes.get(connector.to);
    if (!fromHost || !toHost) continue;
    const obstacles = obstaclesFor(connector.from, connector.to);
    const edges = connector.edges;
    /*
     * At altitude a line runs district to district — unless a district has
     * been opened in place and draws the member the line is about, in which
     * case it lands on the member. Whether one is drawn is the only test.
     */
    const drawnMember =
      overview &&
      edges.some(
        (edge) =>
          (edge.from !== connector.from && memberBoxes(stageEl, hostOf(connector.from), edge.from, pass).length > 0) ||
          (edge.to !== connector.to && memberBoxes(stageEl, hostOf(connector.to), edge.to, pass).length > 0),
      );
    const band = bandFor(connector.from, connector.to);
    if ((overview && !drawnMember) || connector.loop || edges.length === 0) {
      strands.push({
        key: connector.id,
        connector,
        edges,
        fromBox: fromHost,
        toBox: toHost,
        fromAnchor: connector.from,
        toAnchor: connector.to,
        obstacles,
        hosts: [],
        ...(band ? { band } : {}),
      });
      continue;
    }
    const groups = new Map<
      string,
      { edges: { from: string; to: string }[]; fromBox: Box; toBox: Box; fromAnchor: string; toAnchor: string }
    >();
    for (const edge of edges) {
      const fromCandidates =
        edge.from === connector.from ? [] : memberBoxes(stageEl, hostOf(connector.from), edge.from, pass);
      const toCandidates =
        edge.to === connector.to ? [] : memberBoxes(stageEl, hostOf(connector.to), edge.to, pass);
      /*
       * THE FOCUS THAT DRAWS BOTH ENDS HAS DRAWN THE RELATION. The lists
       * view draws every task inside its list; a line from each list column
       * to the same task's chip in the band restated, twelve times over the
       * panel, what the columns already said. Only the FOCUS counts: a card
       * in the band summarising its members as chips has not drawn the
       * relation between the focus's spans and itself — those lines are the
       * point of raising it, and silencing them left a calendar whose
       * entries seemed to belong to no list until one was selected.
       */
      const focusEnd = [connector.from, connector.to].find((id) => Math.round(byId.get(id)?.plane ?? -1) === 0);
      if (
        !overview &&
        focusEnd !== undefined &&
        (edge.from !== connector.from || edge.to !== connector.to) &&
        memberBoxes(stageEl, hostOf(focusEnd), focusEnd === connector.from ? edge.to : edge.from, pass).length > 0
      ) {
        continue;
      }
      /*
       * A LINE LANDS ON A DRAWING OF THE THING, OR IS NOT DRAWN. A group in
       * focus draws what its view draws — a calendar, the entries with a
       * time — and an edge to a member it does not draw has no end here.
       * Anchored on the panel instead, three someday tasks with no time
       * became one line from their list into the middle of the week.
       */
      const focusNode = focusEnd !== undefined ? byId.get(focusEnd) : undefined;
      if (
        !overview &&
        focusNode?.aggregate &&
        stageEl &&
        (focusEnd === connector.from ? edge.from !== connector.from && fromCandidates.length === 0 : edge.to !== connector.to && toCandidates.length === 0)
      ) {
        continue;
      }
      const fromAnchor = fromCandidates.length > 0 ? edge.from : connector.from;
      const toAnchor = toCandidates.length > 0 ? edge.to : connector.to;
      const key = `${connector.id}|${fromAnchor}|${toAnchor}`;
      const held = groups.get(key);
      if (held) {
        held.edges.push(edge);
        continue;
      }
      /*
       * THE CLOSEST PAIR of drawings, when an end is drawn more than once —
       * the same rule a tie follows, so a line and a tie to the same chip
       * agree about which chip.
       */
      const froms = fromCandidates.length > 0 ? fromCandidates : [fromHost];
      const tos = toCandidates.length > 0 ? toCandidates : [toHost];
      let fromBox = froms[0]!;
      let toBox = tos[0]!;
      let nearest = Infinity;
      for (const a of froms) {
        for (const b of tos) {
          const gap = Math.hypot(
            a.x + a.width / 2 - (b.x + b.width / 2),
            a.y + a.height / 2 - (b.y + b.height / 2),
          );
          if (gap < nearest) {
            nearest = gap;
            fromBox = a;
            toBox = b;
          }
        }
      }
      groups.set(key, { edges: [edge], fromBox, toBox, fromAnchor, toAnchor });
    }
    for (const [key, group] of groups) {
      strands.push({
        key,
        connector,
        obstacles,
        hosts: [
          ...(group.fromAnchor !== connector.from ? [fromHost] : []),
          ...(group.toAnchor !== connector.to ? [toHost] : []),
        ],
        ...(band ? { band } : {}),
        ...group,
      });
    }
  }
  return strands;
}

type Point = { x: number; y: number };
type Quadratic = { p0: Point; c: Point; p1: Point };

function quadraticAt(q: Quadratic, t: number): Point {
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return {
    x: a * q.p0.x + b * q.c.x + c * q.p1.x,
    y: a * q.p0.y + b * q.c.y + c * q.p1.y,
  };
}

/** The piece of a quadratic between parameters `a` and `b`, as a quadratic. */
function subQuadratic(q: Quadratic, a: number, b: number): Quadratic {
  // The polar form: the control point of the piece is the blossom at (a, b).
  const w0 = (1 - a) * (1 - b);
  const w1 = (1 - a) * b + a * (1 - b);
  const w2 = a * b;
  return {
    p0: quadraticAt(q, a),
    c: { x: w0 * q.p0.x + w1 * q.c.x + w2 * q.p1.x, y: w0 * q.p0.y + w1 * q.c.y + w2 * q.p1.y },
    p1: quadraticAt(q, b),
  };
}

/**
 * THE VISIBLE RUNS of a curve: every stretch of it that lies outside the
 * given boxes, as exact pieces of the same curve.
 *
 * A line used to be clipped by sitting BEHIND the cards, which was free and
 * was also why a line anchored on a span inside the week never showed the
 * stretch from the span to the panel's edge — it was under the panel. The
 * lines now sit over the cards and clip themselves: out of the box they
 * start in, into the box they end in, and under any card they cross on
 * the way. Sampled, then each crossing refined by bisection, so a run ends
 * on a border rather than a sample shy of it.
 */
export function clipQuadratic(q: Quadratic, boxes: readonly Box[]): Quadratic[] {
  const inside = (p: Point) =>
    boxes.some(
      (box) =>
        p.x > box.x && p.x < box.x + box.width && p.y > box.y && p.y < box.y + box.height,
    );
  const out = (t: number) => !inside(quadraticAt(q, t));
  const STEPS = 64;
  // Where a sample and its neighbour disagree, the border lies between them.
  const refine = (lo: number, hi: number, loOut: boolean): number => {
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      if (out(mid) === loOut) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const runs: Quadratic[] = [];
  let open: number | null = null;
  let wasOut = out(0);
  if (wasOut) open = 0;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const isOut = out(t);
    if (isOut === wasOut) continue;
    const at = refine((i - 1) / STEPS, t, wasOut);
    if (isOut) open = at;
    else if (open !== null) {
      if (at - open > 1e-3) runs.push(subQuadratic(q, open, at));
      open = null;
    }
    wasOut = isOut;
  }
  if (open !== null && 1 - open > 1e-3) runs.push(subQuadratic(q, open, 1));
  return runs;
}

/**
 * Connectors, drawn in SVG over the scene on BOTH renderer paths.
 *
 * A deliberate choice, not an omission: the GPU pipeline earns its cost on
 * per-plane blur of captured pixels, and lines are the one thing it would be
 * worse at. SVG strokes stay crisp at any scale, carry their edge kind into
 * the DOM where a test or a screen reader can find it, and cost nothing to
 * restyle. The capture inside a `layoutsubtree` canvas is not disturbed,
 * because this sits outside it.
 */
export function Connectors({
  strands,
  result,
  scheme,
  overview,
  selection,
  emphasis,
  stageRef,
  liveOf,
  onPickEdge,
}: {
  /** The lines to draw, resolved once per render by `connectorStrands`. */
  readonly strands: readonly Strand[];
  readonly overview: boolean;
  /** For measuring the boxes a person can actually see. */
  readonly stageRef: { current: HTMLElement | null };
  /** So a chosen kind's relations can stand out from the rest. */
  readonly selection: readonly string[];
  /** A relation the legend is asking about: its lines come forward. */
  readonly emphasis: string | null;
  /** Select the ONE edge a line stands for; `at` set means "and menu here". */
  readonly onPickEdge?: (edgeId: string, at?: { x: number; y: number }) => void;
  /** What just happened to this relation, if anything. */
  liveOf?: (connector: { from: string; to: string }) => ActivityMark | undefined;
  result: {
    nodes: readonly SceneNode[];
    width: number;
    height: number;
    /** Present at altitude: the roads run along this lattice. */
    city?: { readonly cell: number };
  };
  scheme: "light" | "dark";
}) {
  const kit = useKit();
  /*
   * ROADS. From altitude, with the districts on the lattice, a line between
   * two of them runs along the lattice's diagonals rather than bowing
   * around the middle — a road on the same grid the buildings stand on.
   * Inside the stack the kit's route stands.
   */
  const onLattice = new Set(
    result.nodes.filter((node) => node.plot !== undefined && Math.round(node.plane) === 2).map((node) => node.id),
  );
  const roadBetween = (connector: { from: string; to: string }) =>
    overview && result.city !== undefined && onLattice.has(connector.from) && onLattice.has(connector.to);
  /*
   * Selecting DRAWS ITS RELATIONS and recedes the rest.
   *
   * The selection holds real node ids; a connector in the overview holds the
   * ids of whatever is DRAWN, which up there is always a kind card. Comparing
   * them directly matched nothing — so carrying an ordinary selection into the
   * Graview, or clicking a target inside the shrunk picture, receded every
   * line at once and blanked the thing you rose to look at.
   *
   * So the selection is resolved the same way `connectorsFor` resolves an
   * endpoint: a node that is not drawn is represented by the card that stands
   * for it. And a selection that resolves to nothing on screen means NO
   * emphasis rather than none-of-the-above, which is the rule every view here
   * follows.
   */
  const chosen = onScreen(result.nodes, selection);
  const touches = (connector: { from: string; to: string }) =>
    chosen.size === 0 || chosen.has(connector.from) || chosen.has(connector.to);
  /*
   * Inside the stack the SELECTED THING'S OWN LINES come forward.
   *
   * A strand knows the real edges it stands for, so no resolution is needed:
   * a line touches the selection when one of its edges does. This is what
   * the ties layer used to add on top — and then had to yield, one relation
   * at a time, to the line already here. One line, lit.
   */
  const chosenReal = new Set(selection.filter((id) => edgeOfSelection(id) === null));
  /*
   * The live view standing in the middle of the ring, whose box is the one
   * thing a road between districts must not run beneath.
   */
  const stampNode = overview
    ? result.nodes.find((node) => Math.round(node.plane) === 0)
    : undefined;
  const stamp = stampNode
    ? (measureVisible(stageRef.current, stampNode.id, false) ?? drawnBox(stampNode, scheme))
    : null;
  if (strands.length === 0) return null;
  /*
   * A CHOSEN MEMBER IS NOT ITS WHOLE DISTRICT.
   *
   * Up at altitude a selection is resolved to the card that stands for it,
   * because that is what a connector actually points at — and that is right
   * for deciding WHICH CARDS a line touches. It is wrong for deciding which
   * LINE: with the volunteers opened, every one of the seven covered-by
   * strands ends at the volunteers card, so choosing Ada lit Bo's shifts,
   * and Cass's, and Dev's. Clicking a name in an opened district changed
   * nothing about the picture, which is the one thing clicking a name is for.
   *
   * A strand knows the real edges it stands for. When the selection names
   * something those edges actually mention, that is the finer and truer
   * answer and it wins; when it names none of them — a district chosen as a
   * district, a stop carried in from elsewhere — the card rule stands.
   */
  const touchesChosen = (strand: Strand) =>
    strand.edges.some((edge) => chosenReal.has(edge.from) || chosenReal.has(edge.to));
  const anyStrandChosen = chosenReal.size > 0 && strands.some(touchesChosen);
  /** How many lines each relation is drawing at once, for the crowd rule. */
  const siblings = new Map<string, number>();
  for (const strand of strands) siblings.set(strand.connector.id, (siblings.get(strand.connector.id) ?? 0) + 1);

  // Lines that share both ends, fanned so each is its own line (see parallel.ts).
  const fanned = parallelOffsets(
    strands.map((strand) => ({ key: strand.key, a: strand.fromAnchor, b: strand.toAnchor })),
  );

  const drawn = strands.map((strand, lane) => {
        const { connector, fromBox, toBox } = strand;
        const fromCentre = { x: fromBox.x + fromBox.width / 2, y: fromBox.y + fromBox.height / 2 };
        const toCentre = { x: toBox.x + toBox.width / 2, y: toBox.y + toBox.height / 2 };
        /*
         * In the overview a line meets a card at its border, facing the
         * other end — the border is honest up there, because a kind card
         * fills its box. Inside the stack a host is a band slot with the
         * panel centred somewhere in it, so a border anchor dangles in open
         * ground; centre-to-centre is right, and the run inside each box is
         * clipped away below.
         */
        const from = overview ? edgePoint(fromBox, toCentre) : fromCentre;
        const to = overview ? edgePoint(toBox, fromCentre) : toCentre;
        /*
         * A LOOP, where both ends are the same card.
         *
         * "A task waits for a task" is a real fact about the domain and the
         * constellation is exactly where you would look for it — but as a line
         * it has zero length. Drawn as an arc leaving the card's top and
         * returning to its right, which is how every graph drawing has shown a
         * self-relation for fifty years.
         */
        const self = connector.loop === true;
        // Stroke treatment is derived from the edge kind, so `protects` can
        // never be mistaken for `assigned-to`.
        const { connector: kitLine, style } = kitConnector(kit, connector.kind);
        // A kind the kit keeps quiet is not drawn; the legend still lists it.
        if (!kitLine.visible) return null;
        const radius = self ? Math.max(22, Math.min(fromBox.width, fromBox.height) * 0.3) : 0;
        /*
         * The loop SITS ON the card's top edge, off to the right.
         *
         * Centred it drew a ring straight through the card's own name; pushed
         * clear of the corner it became a circle floating in the ground next
         * to a card, which from the Graview read as a stray mark rather than
         * as a relation belonging to anything. Overlapping the edge by a few
         * pixels is what makes it hang off the card instead of near it.
         */
        const anchor = self
          ? {
              x: fromCentre.x + fromBox.width * 0.22,
              y: fromCentre.y - fromBox.height / 2 - radius + 7,
            }
          : from;
        /*
         * A gentle curve, bowed AWAY from the live view. Straight lines read
         * as lasers; and in the overview the middle is where the live view
         * stands, so a road between districts goes around it rather than
         * underneath it. The bow is sized to what actually needs clearing:
         * a chord that would cross the view's box bows until its apex is
         * outside it, and a chord that already misses keeps only a gentle
         * arc — bowing everything as though it crossed left slack cables
         * sagging across open ground.
         */
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        let bow = Math.min(overview ? 40 : 90, dist * (overview ? 0.09 : 0.16));
        let nx = 0;
        let ny = 0;
        if (dist > 0) {
          nx = -(to.y - from.y) / dist;
          ny = (to.x - from.x) / dist;
          let awayX = midX - result.width / 2;
          let awayY = midY - result.height / 2;
          if (stamp && !self) {
            const cx = stamp.x + stamp.width / 2;
            const cy = stamp.y + stamp.height / 2;
            awayX = midX - cx;
            awayY = midY - cy;
            // How close the chord passes to the view's centre, against how
            // far the view's corner reaches: the shortfall, doubled (the
            // apex of a quadratic sits halfway to its control), is the bow
            // that clears it.
            const d = Math.abs(nx * (cx - from.x) + ny * (cy - from.y));
            const reach = Math.hypot(stamp.width / 2, stamp.height / 2) * 0.85 + 24;
            const along = ((cx - from.x) * (to.x - from.x) + (cy - from.y) * (to.y - from.y)) / (dist * dist);
            if (d < reach && along > 0.1 && along < 0.9) {
              bow = Math.min(180, Math.max(bow, (reach - d) * 2));
            }
          }
          if (nx * awayX + ny * awayY < 0) {
            nx = -nx;
            ny = -ny;
          }
        }
        // A second relation between the same two ends bows beside the first.
        bow += 2 * (fanned.get(strand.key) ?? 0);
        // The route is the kit's call: the bowed arc, its chord, or two elbows.
        const curve: Quadratic = routedQuadratic(kitLine.route, { p0: from, c: { x: midX + nx * bow, y: midY + ny * bow }, p1: to });
        /* A road runs between two districts on the lattice; a line to the
           picture standing in the middle keeps the kit's own route. */
        const road = roadBetween(connector);
        const orthogonal = kitLine.route === "orthogonal" || road;
        const bends = (a: { x: number; y: number }, b: { x: number; y: number }) => (road ? latticePoints(a, b) : orthogonalPoints(a, b));
        /*
         * The visible runs: out of the box it starts in, into the box it
         * ends in, and under any card it crosses between. A line with no
         * run in the open — one drawing inside another — has nothing
         * honest to show.
         */
        /*
         * TWO CHIPS OF ONE BAND take the gutters: a road through the grid
         * that crosses nothing, so it is drawn whole rather than clipped to
         * the pieces an arc left between the chips it ran under.
         */
        const channelled = !self && strand.band ? channelRoute(fromBox, toBox, strand.band, lane) : null;
        const runs = self || orthogonal || channelled ? [] : clipQuadratic(curve, [fromBox, toBox, ...strand.obstacles]);
        const legs = channelled ? [channelled] : !self && orthogonal ? clipPolyline(bends(from, to), [fromBox, toBox, ...strand.obstacles]) : [];
        if (!self && runs.length === 0 && legs.length === 0) return null;
        const lastLeg = legs[legs.length - 1];
        const firstDrawn = orthogonal || channelled ? legs[0]?.[0] : runs[0]?.p0;
        const lastDrawn = orthogonal || channelled ? lastLeg?.[lastLeg.length - 1] : runs[runs.length - 1]?.p1;
        const quad = (segments: Quadratic[]) =>
          segments
            .map((run) => `M ${run.p0.x} ${run.p0.y} Q ${run.c.x} ${run.c.y} ${run.p1.x} ${run.p1.y}`)
            .join(" ");
        const loopD =
          // An arc that leaves and returns: two arcs of the same
          // circle, so it closes cleanly at any size.
          `M ${anchor.x - radius} ${anchor.y} A ${radius} ${radius} 0 1 1 ${anchor.x + radius} ${anchor.y}` +
          ` A ${radius} ${radius} 0 0 1 ${anchor.x - radius} ${anchor.y}`;
        const d = self ? loopD : channelled ? roundedPolylineD(channelled, 10) : orthogonal ? polylineD(legs) : quad(runs);
        // The hit stroke also keeps out of the cards an end is drawn inside.
        /*
         * The hit corridor keeps OFF the cards by its own half-width: a
         * road leaves a district at its border, and a fourteen-pixel
         * corridor centred on that border sat seven pixels inside the
         * card — so a press on the card's corner selected the road, and a
         * double-click there travelled down it instead of into the kind.
         */
        const clear = (box: { x: number; y: number; width: number; height: number }) => ({
          x: box.x - 8,
          y: box.y - 8,
          width: box.width + 16,
          height: box.height + 16,
        });
        const keptOff = [fromBox, toBox, ...strand.hosts, ...strand.obstacles].map(clear);
        const hitD = self
          ? loopD
          : channelled
            ? polylineD(legs)
            : orthogonal
            ? polylineD(clipPolyline(bends(from, to), keptOff))
            : quad(clipQuadratic(curve, keptOff));
        const only = strand.edges.length === 1 ? strand.edges[0]! : null;
        const edgeId = only ? edgeSelectionId(connector.kind, only.from, only.to) : null;
        const edgeChosen = edgeId !== null && selection.includes(edgeId);
        const mine = strand.edges.some((edge) => chosenReal.has(edge.from) || chosenReal.has(edge.to));
        const lit = !overview && chosenReal.size > 0 && mine;
        const stressed = (emphasis !== null && connector.kind === emphasis) || edgeChosen;
        /*
         * FROM ALTITUDE THE ROADS ARE ON THE GROUND (the plots layer draws
         * one per pair of districts, kerb to kerb). A line up here is drawn
         * only when it says something the road cannot: the relation the
         * legend is asking about, the edge that is chosen, a member of the
         * selection, or a change that just happened. A focused screen's
         * every member wired across the city was the picture this replaces.
         */
        const live = liveOf?.(connector) !== undefined;
        if (overview && !stressed && !mine && !(chosen.size > 0 && touches(connector)) && !live) return null;
        const opacity = overview
          ? altitudeOpacity({
              emphasised: emphasis !== null,
              stressed,
              anyChosen: anyStrandChosen,
              mine,
              touches: touches(connector),
              siblings: siblings.get(connector.id) ?? 1,
            })
          : stackOpacity({
              edgeChosen,
              lit,
              // A relation the key is hovering lights the picture the same
              // way a selection does, so the rest recedes for it too.
              anyLit: anyStrandChosen || emphasis !== null,
              own: style.opacity,
              kit: kit.emphasis,
            });
        /*
         * A lit line MARKS ITS FAR END, as a tie does: the destination is
         * where the eye is being sent, and a dot says the line lands on
         * something specific rather than trailing off.
         */
        const far =
          lit && firstDrawn && lastDrawn
            ? strand.edges.some((edge) => chosenReal.has(edge.from))
              ? lastDrawn
              : firstDrawn
            : null;
        const line = (
          <g key={strand.key}>
            <path
              data-graview-connector={connector.kind}
              data-graview-edges={strand.edges.length}
              /* What each end lands on, in the edge's direction: the drawn node, or a member drawn inside it. */
              data-graview-from={strand.fromAnchor}
              data-graview-to={strand.toAnchor}
              data-graview-lit={lit || undefined}
              data-graview-activity={liveOf?.(connector)?.manner}
              opacity={opacity * (connector.opacity ?? 1)}
              d={d}
              fill="none"
              stroke={connectorStroke(style)}
              /*
               * Above the stack the LINES ARE THE CONTENT.
               *
               * Inside the scene a connector is an aside — it says how the
               * thing you are looking at is caught up in something else, and
               * drawing it loudly would compete with the thing itself. From
               * the Graview the shape of the domain IS the subject.
               */
              strokeWidth={
                (lit ? Math.max(1.6, connectorWidth(style, overview)) : connectorWidth(style, overview)) +
                (stressed ? 0.6 : 0)
              }
              strokeDasharray={CONNECTOR_DASH[style.pattern]}
              strokeLinecap="round"
            />
            {far ? (
              <circle cx={far.x} cy={far.y} r={2.6} fill={connectorStroke(style)} opacity={opacity} />
            ) : null}

            {/*
              * A loop says WHICH relation it is, in place. A dashed circle
              * hanging off a card was the one unlabelled mark in the whole
              * picture — every line has a legend row, but nothing tied this
              * shape to its row without guessing.
              */}
            {self && overview ? (
              <text
                x={anchor.x}
                y={anchor.y - radius - 5}
                textAnchor="middle"
                opacity={opacity}
                style={{
                  font: "9px var(--graview-font-body, system-ui)",
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  fill: "var(--graview-ink-faint)",
                }}
              >
                {connector.kind.replace(/-/g, " ")}
              </text>
            ) : null}
          </g>
        );

        /*
         * The HIT PATH for a line that stands for one edge: the SAME visible
         * runs, hosted on a layer above the panels. Because the runs are
         * already clipped to open ground, the pickable region is exactly
         * what a person can see, and pressing a line never steals a card's
         * click.
         */
        let hit: React.ReactNode = null;
        // A line the picture has faded to a ghost must not keep a click
        // band: pickability follows visibility.
        if (edgeId && onPickEdge && !self && opacity >= 0.2) {
          hit = (
            <path
              key={`hit:${strand.key}`}
              data-graview-edge={edgeId}
              className="graview-edge-hit"
              d={hitD}
              fill="none"
              // The ends stay clear: a line lands ON a chip, and a hit stroke that reached
              // the chip took the click meant for it. Seven percent off each end.
              pathLength={1}
              strokeDasharray="0.86"
              strokeDashoffset={-0.07}
              stroke="transparent"
              strokeWidth={14}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              /*
               * EITHER button opens the menu AT THE LINE. A left-click
               * that only swapped the rail's contents changed the world
               * quietly, three hundred pixels from the pointer — a line
               * has no page to travel to, so its one meaning is "act on
               * this relation, here".
               */
              onClick={(event) => {
                event.stopPropagation();
                onPickEdge(edgeId, { x: event.clientX, y: event.clientY });
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onPickEdge(edgeId, { x: event.clientX, y: event.clientY });
              }}
            />
          );
        }
        return { key: strand.key, line, hit };
      });

  return (
    <>
      <svg
        aria-hidden="true"
        data-graview-world=""
        width={result.width}
        height={result.height}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
          /*
           * OVER the cards, on both paths.
           *
           * Behind them was free clipping on the DOM path and no clipping at
           * all on the GPU path, whose canvas is opaque — and it hid the one
           * stretch a line anchored inside a panel most needs to show, from
           * the span to the panel's edge. Every run is clipped to open ground
           * now, so sitting on top costs nothing the picture can see.
           */
          zIndex: SCENE_LAYERS.ties,
        }}
      >
        {drawn.map((piece) => piece?.line)}
      </svg>
      {drawn.some((piece) => piece?.hit) ? (
        <svg
          data-graview-world=""
          width={result.width}
          height={result.height}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "none",
            // Above the hosts (auto) but BELOW the scene chrome at 5 —
            // the legend and the quick-select must win their own corners;
            // the paths inside are clipped to open ground, so nothing that
            // looks like a panel behaves like a line.
            zIndex: SCENE_LAYERS.tieLabels,
          }}
        >
          {drawn.map((piece) => piece?.hit)}
        </svg>
      ) : null}
    </>
  );
}
