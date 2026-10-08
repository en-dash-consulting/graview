import { humanizeField, SCENE_LAYERS, type AnySchema, type GraphReader, type NodeOfSchema } from "@graview/core";
import { type InterpolatedLayout, edgeSelectionId, edgeOfSelection } from "@graview/layout";
import { CONNECTOR_DASH, connectorStroke, styleFor } from "@graview/render";
import { useMemo, useLayoutEffect, useState } from "react";
import type { ActivityMark } from "./activity.js";
import { kitConnector, useKit } from "./kit.js";
import { orthogonalPoints, polylineD, routePoint, routedQuadratic } from "./routes.js";
import { Connectors, connectorStrands, tieRoute } from "./connectors.js";
import { drawnBox, measureVisible, visibleRect } from "./where-drawn.js";
import type { SceneNode } from "./scene-root.js";
import { captionRuns, type CaptionEntry, type CaptionRun } from "./captions.js";
import { railInset } from "./rails.js";

/**
 * EVERY LINE IN THE SCENE, measured against the DOM it is drawn over.
 *
 * Both line layers measure elements — panels, spans, chips — and anything
 * measured during a render reads the PREVIOUS commit's geometry. The scene
 * used to live with that: a tween paints sixty frames so one stale frame
 * is invisible, and a settle tick after the last one catches the rest. A
 * cut had no such cover, and a drag left every line one pointer event
 * behind the card it was tied to.
 *
 * So the lines are their own component, and after each commit that could
 * have moved anything — a new frame, a new selection, a graph edit that
 * re-flowed a view — they re-render ONCE from a layout effect, before the
 * browser paints. Only this subtree renders twice; the hosts do not.
 *
 * The strands are resolved here rather than inside a layer because two
 * layers need the same answer: the connector layer draws them, and the
 * ties layer yields to exactly the relations that already have a line.
 * Deciding that from the layout alone was the bug: a session's line into
 * the week was CLAIMED as drawn while it actually rose from the panel's
 * center, so selecting the session lit three of its four drills and left
 * the fourth to a faint line from nowhere.
 */
export function Lines<S extends AnySchema>({
  frame,
  width,
  height,
  scheme,
  overview,
  selection,
  emphasis,
  stageRef,
  store,
  graphNodes,
  onPickEdge,
  liveOf,
  holding = false,
}: {
  readonly frame: InterpolatedLayout;
  readonly width: number;
  readonly height: number;
  readonly scheme: "light" | "dark";
  readonly overview: boolean;
  readonly selection: readonly string[];
  readonly emphasis: string | null;
  readonly stageRef: { current: HTMLElement | null };
  readonly store: { graph: GraphReader<NodeOfSchema<S>> };
  readonly graphNodes: unknown;
  readonly onPickEdge: (edgeId: string, at?: { x: number; y: number }) => void;
  readonly liveOf: (connector: { from: string; to: string }) => ActivityMark | undefined;
  /** A card is held by the hand: draw from the layout, measure when it lets go. */
  readonly holding?: boolean;
}) {
  const [asked, remeasure] = useState(0);
  /*
   * MEASURED ONCE, AFTER THE DOM IS THERE. Measuring during render read the
   * boxes of the frame before, so every frame was measured twice — once
   * wrong, and again after a re-render to get it right. Now the render
   * draws from the layout's own boxes, and the measurement is taken once,
   * after commit and before paint, and is what is drawn.
   */
  const [measured, setMeasured] = useState<ReturnType<typeof connectorStrands> | null>(null);
  /*
   * NOTHING MEASURES WHILE MOVING (docs/scale.md). Both ends of every line
   * are in flight during a transition, so no line drawn then is right; and
   * measuring every host, every pick and every member box on every frame
   * was the largest cost of a transition. The lines leave with the flight
   * and are measured once, where it lands. A pan moves them by transform
   * with the world, which is not a new frame, so they follow the hand.
   */
  const moving = frame.t < 1;
  useLayoutEffect(() => {
    if (moving || holding) return;
    setMeasured(connectorStrands(frame.nodes, frame.connectors, stageRef.current, overview, scheme));
  }, [frame, moving, holding, selection, overview, graphNodes, scheme, asked, stageRef]);

  /*
   * A LINE POINTS AT WHERE A THING IS, NOT AT WHERE IT WAS.
   *
   * Connectors are anchored on MEASURED DOM boxes — that is what lets a line
   * land on one row of a matrix rather than on the panel containing it — and
   * the measurement was taken once, when the frame, the selection, the
   * altitude or the graph changed. None of those is what moves a row.
   *
   * What moves a row is a scroll. A matrix wider than its panel, a roster
   * taller than its card, a lens with a filter in it: the content slides and
   * every line still points at the place the content used to be. It does
   * not look like a stale measurement, it looks like the lines are wrong
   * about the graph.
   *
   * Scroll does not bubble, so this listens in the capture phase and hears
   * every scroller in the stage; a ResizeObserver catches the other half —
   * a panel that grows because something inside it opened moves everything
   * below it, and no frame changed.
   */
  /*
   * Which views there are, not where they are: a drag moves every view it
   * touches on every pointer move, and re-observing the whole stage for
   * each of those moves cost more than the drag.
   */
  const views = frame.nodes.map((node) => node.id).join("\n");
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (stage === null || typeof window === "undefined") return;
    let queued = 0;
    const again = () => {
      if (queued !== 0) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        remeasure((n) => n + 1);
      });
    };
    stage.addEventListener("scroll", again, { capture: true, passive: true });
    window.addEventListener("resize", again, { passive: true });
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(again);
    if (watch) {
      watch.observe(stage);
      /* Every view, because a view growing moves its neighbors' members. */
      for (const view of stage.querySelectorAll("[data-graview-view]")) watch.observe(view);
    }
    return () => {
      if (queued !== 0) cancelAnimationFrame(queued);
      stage.removeEventListener("scroll", again, { capture: true } as never);
      window.removeEventListener("resize", again);
      watch?.disconnect();
    };
  }, [stageRef, views]);

  if (moving) return null;
  /*
   * Without a DOM — the first render, a server — the lines stand on the
   * layout's own boxes; and so they do while a card is held, following the
   * hand from the layout rather than measuring the page on every move.
   */
  const strands =
    (holding ? null : measured) ?? connectorStrands(frame.nodes, frame.connectors, null, overview, scheme);
  const drawnSingles = new Set<string>();
  for (const strand of strands) {
    if (strand.edges.length !== 1) continue;
    const edge = strand.edges[0]!;
    drawnSingles.add(`${strand.connector.kind}|${edge.from}|${edge.to}`);
  }

  return (
    <>
      <Connectors
        strands={strands}
        result={frame}
        scheme={scheme}
        overview={overview}
        selection={selection}
        emphasis={emphasis}
        stageRef={stageRef}
        onPickEdge={onPickEdge}
        liveOf={liveOf}
      />
      <SelectionTies
        stageRef={stageRef}
        nodes={frame.nodes}
        scheme={scheme}
        selection={selection}
        store={store}
        graphNodes={graphNodes}
        overview={overview}
        width={width}
        height={height}
        onPickEdge={onPickEdge}
        alreadyDrawn={drawnSingles}
        tick={asked}
      />
    </>
  );
}

/**
 * The SELECTION'S OWN EDGES, drawn from where the thing actually is.
 *
 * Selecting a span in the calendar used to change nothing outside the
 * calendar: the graph knew the span's agreement, its person and its reasons,
 * and the picture kept that to itself. These lines start at the selected
 * element's real drawn box — the pick target inside the view, measured from
 * the DOM — and run to whatever stands for each neighbor on screen: another
 * pick target in the same view, a raised card, or the kind card holding it
 * on the shelf. Item-level, not kind-level; and the kind cards say "N tied"
 * at the same moment, so the lines have destinations that answer back.
 *
 * Only for a DELIBERATE selection: a handful of things someone picked.
 * Selecting a whole place selects its population, and forty fans of edges is
 * a hairball, not an answer.
 */
type Box = { x: number; y: number; width: number; height: number };
type TieLine = {
  key: string;
  kind: string;
  endX: number;
  endY: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  control: { x: number; y: number };
  fromBox: Box;
  toBox: Box;
  /** The far end is a stand-in (the kind's district), not the thing. */
  proxy: boolean;
  edgeId: string | null;
};

function SelectionTies<S extends AnySchema>({
  stageRef,
  nodes,
  scheme,
  selection,
  store,
  graphNodes,
  overview,
  width,
  height,
  onPickEdge,
  alreadyDrawn,
  tick,
}: {
  /** Select the ONE edge a tie stands for; `at` means "and menu here". */
  readonly onPickEdge?: (edgeId: string, at?: { x: number; y: number }) => void;
  /** Real edge pairs the connector layer already drew — one line, not two. */
  readonly alreadyDrawn?: ReadonlySet<string>;
  readonly stageRef: { current: HTMLElement | null };
  readonly nodes: readonly SceneNode[];
  readonly scheme: "light" | "dark";
  readonly selection: readonly string[];
  readonly store: { graph: GraphReader<NodeOfSchema<S>> };
  readonly graphNodes: unknown;
  /** From altitude a district's visible body is its iso block. */
  readonly overview: boolean;
  readonly width: number;
  readonly height: number;
  /** Bumped by the line layer after a scroll or a resize: measure again. */
  readonly tick: number;
}) {
  const kit = useKit();
  const ties = useMemo(() => {
    if (selection.length === 0 || selection.length > 4) return [];
    const chosen = new Set(selection);
    const found: { kind: string; self: string; other: string }[] = [];
    /*
     * A SELECTED EDGE KEEPS ITS LINE. Ties used to derive only from
     * selected nodes, so picking a line replaced the selection and the
     * line's own reason to exist vanished under it — an inspector about a
     * relation the picture no longer showed.
     */
    for (const id of selection) {
      const edge = edgeOfSelection(id);
      if (edge) found.push({ kind: edge.kind, self: edge.from, other: edge.to });
    }
    for (const edge of store.graph.allEdges()) {
      const self = chosen.has(edge.from) ? edge.from : chosen.has(edge.to) ? edge.to : null;
      if (!self) continue;
      const other = self === edge.from ? edge.to : edge.from;
      if (chosen.has(other)) continue;
      found.push({ kind: edge.kind, self, other });
    }
    if (found.length <= 14) return found;
    /*
     * A busy selection keeps its FIRST FOURTEEN rather than losing all of
     * them: a person on half the roster went from a fan of lines to none
     * at all the moment their sixteenth edge arrived, which read as the
     * selection having no relations. Ties to a card actually on screen
     * come first — a line to a real thing beats a line to a stand-in.
     */
    const placed = new Set(nodes.map((node) => node.id));
    return found
      .map((tie, index) => ({ tie, index, real: placed.has(tie.other) ? 0 : 1 }))
      .sort((a, b) => a.real - b.real || a.index - b.index)
      .slice(0, 14)
      .map(({ tie }) => tie);
  }, [store, selection, graphNodes, nodes]);

  /*
   * MEASURED AFTER COMMIT, NOT DURING RENDER.
   *
   * These lines are anchored on the DOM, and the render that draws a frame
   * runs before that frame's DOM exists — so every tie was measured against
   * the frame before, and after the last frame of a navigation nothing
   * rendered again: the lines stayed where the cards had been, dashes
   * starting in the air at the edge of a card that had moved. The
   * measurement is taken in a layout effect, after the boxes are where the
   * frame put them and before paint, and again whenever the layer's tick
   * says a scroll or a resize moved something.
   */
  const measure = (): TieLine[] => {
  if (ties.length === 0 || typeof document === "undefined") return [];
  const stage = stageRef.current?.getBoundingClientRect();
  if (!stage) return [];

  /*
   * A CHOSEN CROSSING IS NOT A FAN OF ITS ENDS' EDGES (FR-111).
   *
   * Choosing a coverage cell selects what it joins — Ryan, SEO and the
   * strength between them — and the lens draws the cell's own lines to its
   * row and its column. The ends' other relations are not the question, and
   * drawn from here they ran to the strengths' district, a stand-in for
   * records the picture does not draw. Only a record on the path that has a
   * card of its own on the stage gets a line, from the cell.
   */
  const crossing = [...(stageRef.current?.querySelectorAll("[data-graview-joins]") ?? [])].find((el) => {
    if (el.closest("[data-graview-offstage]")) return false;
    try {
      const ids = JSON.parse(el.getAttribute("data-graview-joins") ?? "[]") as string[];
      return ids.length === selection.length && ids.every((id) => selection.includes(id));
    } catch {
      return false;
    }
  });
  if (crossing) {
    const cellBox = visibleRect(crossing, stageRef.current!);
    if (!cellBox) return [];
    const joined: TieLine[] = [];
    for (const id of selection) {
      const card = nodes.find((node) => node.id === id);
      if (!card) continue;
      const box = measureVisible(stageRef.current, card.id, overview) ?? drawnBox(card, scheme);
      const route = box ? tieRoute(cellBox, box) : null;
      if (!box || !route) continue;
      const edge = [...store.graph.allEdges()].find((one) => (one.from === id && selection.includes(one.to)) || (one.to === id && selection.includes(one.from)));
      joined.push({ key: `join:${id}`, kind: edge?.kind ?? "", endX: route.to.x, endY: route.to.y, ...route, fromBox: cellBox, toBox: box, proxy: false, edgeId: edge ? edgeSelectionId(edge.kind, edge.from, edge.to) : null });
    }
    return joined;
  }

  /*
   * The ELEMENT standing for an id, when the view drew one: a pick target,
   * or a board slot (an occupied slot's pick is its occupant, but the slot
   * itself is still a place a tie can land on).
   */
  /*
   * EVERY element wearing the id, as candidate anchors. One node can be
   * drawn several times — a chip in a card, a row label, a matrix dot per
   * relation — and which drawing a tie should land on depends on where the
   * OTHER end is: the pair of drawings closest to each other is the line a
   * person would draw. (Picking the single smallest element anchored a
   * 3.2-row tie to a 5.2-row dot three rows away.) Chrome is not scene:
   * the activity rail and inspector repeat node names as chips, and a tie
   * must never land on the furniture.
   */
  /*
   * A MARK IS NOT THE THING.
   *
   * A lens that draws a relation — a coverage matrix above all — marks the
   * crossing of a row and a column, and the mark wears the column's id so
   * a press on it means the column. Read as an anchor, that made a selected
   * revenue stream fan five dashed lines up into the cells of somebody
   * else's ownership matrix: lines that said nothing about ownership and
   * crossed the whole picture to restate a fact the district below already
   * held. The fundamental mistake was treating everything that wears an id
   * as a place the thing is. A view says which of its drawings are marks
   * (`data-graview-mark`) and a tie never lands on one; a thing drawn only
   * as marks falls through to the district that holds it, which is where
   * the thing is. Said explicitly rather than guessed from repetition: a
   * planting drawn across five months of a calendar is drawn five times
   * and is still the thing, every time.
   */
  const elementBoxes = (id: string, insideOwnCard: (el: Element) => boolean): Box[] => {
    const els = stageRef.current?.querySelectorAll(
      `[data-graview-pick="${CSS.escape(id)}"], [data-graview-slot="${CSS.escape(id)}"]`,
    );
    const boxes: Box[] = [];
    for (const el of els ?? []) {
      if (el.closest("[data-graview-offstage]")) continue;
      if (insideOwnCard(el)) continue;
      if (el.closest("[data-graview-mark]")) continue;
      // What shows of it, not its whole rectangle: a chip scrolled off the
      // end of its roster anchors nothing.
      const rect = visibleRect(el, stageRef.current!);
      if (!rect) continue;
      // A rotated header's bounding box is a huge diagonal rectangle whose
      // border is nowhere near the visible text — anything card-sized or
      // smaller stays; the degenerate stays out via the closest-pair pick
      // preferring compact boxes on ties below.
      boxes.push(rect);
    }
    // Compact drawings first, so a distance tie resolves to the chip, not
    // the panel that contains it.
    return boxes.sort((a, b) => a.width * a.height - b.width * b.height);
  };
  /** The laid-out node that IS this id, or stands for it. */
  const hostOf = (id: string): SceneNode | undefined =>
    nodes.find((node) => node.id === id) ??
    nodes.find((node) => node.aggregate?.memberIds.includes(id));

  /*
   * A VIEW THAT DRAWS BOTH ENDS HAS DRAWN THE RELATION.
   *
   * `connectorStrands` has said this for as long as there have been lines;
   * ties said a weaker version of it — "not inside the SELECTION's own
   * card" — and in a matrix neither end owns the card. The coverage lens
   * belongs to the volunteers; a chosen shift is a row in it. So the guard
   * never fired, and choosing a shift drew a tie from its row label to the
   * cell in the chosen volunteer's column: a horizontal rule across one
   * row of a table, restating the mark already sitting at its end. The
   * cell IS the edge — the lens draws it, and lights it when either end is
   * chosen.
   *
   * Asked of the drawings rather than the nodes, so it holds however the
   * view came to draw them.
   */
  const drawingsOf = (id: string) => `[data-graview-pick="${CSS.escape(id)}"], [data-graview-slot="${CSS.escape(id)}"]`;
  const someViewDrawsBoth = (a: string, b: string): boolean => {
    const stageNow = stageRef.current;
    if (!stageNow) return false;
    for (const host of stageNow.querySelectorAll("[data-graview-view]")) {
      const here = host.querySelector(drawingsOf(a));
      if (here === null || here.closest("[data-graview-offstage]")) continue;
      const there = host.querySelector(drawingsOf(b));
      if (there !== null && !there.closest("[data-graview-offstage]")) return true;
    }
    return false;
  };

  const seen = new Set<string>();
  const found: TieLine[] = [];
  for (const tie of ties) {
    if (someViewDrawsBoth(tie.self, tie.other)) continue;
    const selfHost = hostOf(tie.self);
    const selfHostEl = selfHost
      ? stageRef.current?.querySelector(`[data-graview-view="${CSS.escape(selfHost.id)}"]`)
      : null;
    const fromCandidates = elementBoxes(tie.self, () => false);
    const hasFromEl = fromCandidates.length > 0;
    if (!hasFromEl && selfHost) {
      const box = measureVisible(stageRef.current, selfHost.id, false) ?? drawnBox(selfHost, scheme);
      if (box) fromCandidates.push(box);
    }
    /*
     * Where the OTHER end lands, in order of honesty:
     *
     * 1. Its own placed card — a raised or ring node is the thing itself,
     *    and beats any chip that merely mentions it (the fan of dashes
     *    sweeping out of the fixture card's own border was ties preferring
     *    the card's OWN chips over the real cards below).
     * 2. An element standing for it — but never one inside the view that
     *    already draws the selection. A VIEW THAT DRAWS BOTH ENDS HAS
     *    DRAWN THE RELATION; `connectorStrands` has said so for as long as
     *    there have been lines, and ties made an exception for chip-to-chip
     *    inside one view, on the grounds that it was the view's wiring made
     *    visible. In a matrix it is the opposite. The cell at the
     *    intersection IS the edge — the lens marks it, and lights it when
     *    either end is chosen — so the tie added a second drawing of the
     *    same fact, and because both ends sit in one row it drew it as a
     *    horizontal rule running from the row label to the cell. One rule
     *    for both layers, and the view keeps its own relations.
     * 3. The group card containing it — unless that is the very card the
     *    selection sits in, in which case the tie is internal and the
     *    view's own emphasis already shows it.
     */
    const otherNode = nodes.find((node) => node.id === tie.other);
    const toCandidates: Box[] = [];
    // The far end STANDS IN for the node when nothing draws the node
    // itself: a person with no card of their own resolves to their kind's
    // district. Such a line recedes below — it points at where the rest
    // live rather than claiming the thing is there.
    let toProxy = false;
    if (otherNode) {
      const box =
        measureVisible(stageRef.current, otherNode.id, overview) ?? drawnBox(otherNode, scheme);
      if (box) toCandidates.push(box);
    } else {
      toCandidates.push(
        ...elementBoxes(tie.other, (el) => (selfHostEl ? selfHostEl.contains(el) : false)),
      );
      if (toCandidates.length === 0) {
        const otherHost = hostOf(tie.other);
        if (otherHost && (!selfHost || otherHost.id !== selfHost.id)) {
          const box =
            measureVisible(stageRef.current, otherHost.id, overview) ??
            drawnBox(otherHost, scheme);
          if (box) {
            toCandidates.push(box);
            toProxy = true;
          }
        }
      }
    }
    if (fromCandidates.length === 0 || toCandidates.length === 0) continue;
    /*
     * From ALTITUDE a stand-in line says nothing the constellation does
     * not already draw between the districts themselves — and the two
     * near-identical dashes to one district read as a mistake. The proxy
     * tie is a ground-level device.
     */
    if (toProxy && overview) continue;
    /*
     * THE CLOSEST PAIR of drawings is the line a person would draw. Both
     * ends can be on screen more than once; a tie between the two nearest
     * instances says the relation without crossing the picture to reach a
     * copy further away.
     */
    let fromBox = fromCandidates[0]!;
    let toBox = toCandidates[0]!;
    let nearest = Infinity;
    for (const a of fromCandidates) {
      for (const b of toCandidates) {
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
    /*
     * ONE LINE PER RELATION. The connector layer draws (and takes clicks
     * for) any relation whose both ends are placed cards; a tie repeating
     * it produced the double line where one answered the pointer and its
     * twin did not. The tie yields BEFORE claiming a dedupe slot, or a
     * later tie sharing its coordinates dies for a line never drawn.
     */
    if (
      alreadyDrawn?.has(`${tie.kind}|${tie.self}|${tie.other}`) ||
      alreadyDrawn?.has(`${tie.kind}|${tie.other}|${tie.self}`)
    ) {
      continue;
    }
    /*
     * One line per relation between two DRAWINGS. Keyed on both boxes in
     * full: keyed on the origin's x alone, two selected chips stacked in
     * one column lost one of their ties to the same target.
     */
    const key =
      `${tie.kind}:${Math.round(fromBox.x)},${Math.round(fromBox.y)}` +
      `:${Math.round(toBox.x)},${Math.round(toBox.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const route = tieRoute(fromBox, toBox);
    if (!route) continue;
    const { from, to, control } = route;
    // The real edge this tie stands for, oriented the way the graph holds it.
    const oriented = [...store.graph.allEdges()].find(
      (edge) =>
        edge.kind === tie.kind &&
        ((edge.from === tie.self && edge.to === tie.other) ||
          (edge.from === tie.other && edge.to === tie.self)),
    );
    found.push({
      key: `${tie.kind}:${tie.self}:${tie.other}`,
      kind: tie.kind,
      endX: to.x,
      endY: to.y,
      from,
      to,
      control,
      fromBox,
      toBox,
      proxy: toProxy,
      edgeId: oriented ? edgeSelectionId(oriented.kind, oriented.from, oriented.to) : null,
    });
  }
  return found;
  };
  const [lines, setLines] = useState<TieLine[]>([]);
  useLayoutEffect(() => {
    setLines(measure());
    // The measurement depends on the DOM the frame committed, which these
    // name; `measure` itself closes over nothing that changes without them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ties, nodes, overview, scheme, width, height, alreadyDrawn, tick, stageRef]);
  if (lines.length === 0) return null;

  return (
    <svg
      // Decorative only while nothing inside takes the pointer; a pickable
      // relation must exist for assistive tech too.
      aria-hidden={lines.some((line) => line.edgeId) ? undefined : true}
      data-graview-ties={lines.length}
      /* Moves with the cards it is drawn between; see `liveShift`. */
      data-graview-world=""
      width={width}
      height={height}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
        // Over the views: these lines START on an element inside one, and a
        // line into the shelf that dives behind the focus card en route says
        // nothing.
        zIndex: SCENE_LAYERS.lines,
      }}
    >
      {lines.map((line) => {
        const { connector, style } = kitConnector(kit, line.kind);
        // A kind the kit keeps quiet is not drawn — still selectable from the inspector.
        if (!connector.visible) return null;
        const quadratic = { p0: line.from, c: line.control, p1: line.to };
        // The route is the kit's call: the arc the layout chose, its chord, or two elbows.
        const d =
          connector.route === "orthogonal"
            ? polylineD([orthogonalPoints(line.from, line.to)])
            : (({ p0, c, p1 }) => `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p1.x} ${p1.y}`)(routedQuadratic(connector.route, quadratic));
        /*
         * A tie that stands for one edge takes the pointer, like any line:
         * the hit run is the visible stretch between its two endpoint
         * boxes, so pressing a line never steals a card's click.
         */
        let hit: React.ReactNode = null;
        // A stand-in line takes no pointer: a 14px corridor across half
        // the scene stole clicks from every card it crossed, to select a
        // relation whose far end is not even drawn. The edge stays
        // selectable where it is really drawn, and from the inspector.
        if (line.edgeId && onPickEdge && !line.proxy) {
          const inside = (
            box: { x: number; y: number; width: number; height: number },
            p: { x: number; y: number },
          ) =>
            p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height;
          const points: { x: number; y: number }[] = [];
          for (let i = 0; i <= 40; i++) {
            const point = routePoint(connector.route, quadratic, i / 40);
            if (inside(line.fromBox, point) || inside(line.toBox, point)) continue;
            points.push(point);
          }
          if (points.length >= 2) {
            hit = (
              <path
                data-graview-edge={line.edgeId}
                className="graview-edge-hit"
                d={`M ${points[0]!.x} ${points[0]!.y} ${points
                  .slice(1)
                  .map((point) => `L ${point.x} ${point.y}`)
                  .join(" ")}`}
                fill="none"
                // The ends stay clear: a line lands ON a chip, and a hit stroke that reached
                // the chip took the click meant for it. Seven percent off each end.
                pathLength={1}
                strokeDasharray="0.86"
                strokeDashoffset={-0.07}
                stroke="transparent"
                strokeWidth={14}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onClick={(event) => {
                  event.stopPropagation();
                  onPickEdge(line.edgeId!, { x: event.clientX, y: event.clientY });
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onPickEdge(line.edgeId!, { x: event.clientX, y: event.clientY });
                }}
              />
            );
          }
        }
        return (
          /*
           * A line to a STAND-IN recedes: the far end is the kind's
           * district, not the thing itself, and five of those at full
           * strength crossing the scene is a hairball. Present enough to
           * say "the rest live over there", never louder than a real tie.
           */
          <g key={line.key} opacity={line.proxy ? 0.32 : 0.72}>
            <path
              data-graview-tie={line.kind}
              data-graview-tie-proxy={line.proxy || undefined}
              d={d}
              fill="none"
              stroke={connectorStroke(style)}
              strokeWidth={line.proxy ? 1.1 : 1.6}
              strokeDasharray={CONNECTOR_DASH[style.pattern]}
              strokeLinecap="round"
            />
            {/* A destination, marked: the far end lands somewhere specific. */}
            <circle cx={line.endX} cy={line.endY} r={line.proxy ? 2 : 2.6} fill={connectorStroke(style)} />
            {hit}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * What plane 1 is, said in words, over the run of cards it applies to.
 *
 * The schema has always carried a description on every edge — "who does the
 * run", "a nap that must not be interrupted" — and nothing ever showed them.
 * A row of anonymous cards under the thing you clicked is a puzzle; the same
 * row under "who does the run" is an answer. Layout groups the neighborhood
 * by edge kind, so each caption spans one contiguous run rather than
 * repeating itself once per card.
 */

export function RelationCaptions({
  nodes,
  scheme,
  width: stageWidth,
  stageRef,
  moving = false,
  holding = false,
}: {
  readonly nodes: readonly SceneNode[];
  readonly scheme: "light" | "dark";
  readonly width: number;
  readonly stageRef: { current: HTMLElement | null };
  /** In flight: captions are measured where the transition lands, not on every frame of it. */
  readonly moving?: boolean;
  /** A card is held: nothing the captions stand over moves, so they are not measured again. */
  readonly holding?: boolean;
}) {
  const kit = useKit();
  /* Measured after commit, for the reason the ties are: a caption placed
     over where a card WAS hung in open ground after every navigation. */
  const [runs, setRuns] = useState<CaptionRun[]>([]);
  useLayoutEffect(() => {
    // Nothing under a held card moves: the captions keep where they were measured.
    if (moving || holding) return;
    setRuns(placeCaptions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, moving, holding, scheme, stageWidth, stageRef]);
  function placeCaptions(): CaptionRun[] {
    const entries: CaptionEntry[] = [];
    for (const node of nodes) {
      if (!node.via || Math.round(node.plane) !== 1) continue;
      /*
       * Above the PANEL someone can see, not the band slot the layout allots:
       * a raised card centers its panel in a taller host, so a caption hung
       * from the host's top floated in open ground half a band above the
       * cards it captions.
       */
      const measured = measureVisible(stageRef.current, node.id, false);
      const { scale } = styleFor(1, scheme);
      entries.push({
        key: `${node.via.edgeKind}|${node.via.direction}`,
        text: node.via.description ?? humanizeField(node.via.edgeKind).toLowerCase(),
        left: measured?.x ?? node.x,
        right: measured ? measured.x + measured.width : node.x + node.width * scale,
        top: measured?.y ?? node.y,
      });
    }
    const rails = railInset(stageWidth);
    return captionRuns(entries, { left: rails.left, right: stageWidth - rails.right });
  }
  // The kit may keep the captions off: the edge's words stay on the inspector.
  if (runs.length === 0 || !kit.captions.visible) return null;

  if (moving) return null;
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: SCENE_LAYERS.lines }}
    >
      {runs.map((run) => {
        /*
         * The caption may be WIDER than the cards it captions.
         *
         * Constrained to the run, a single neighbor gave it about 240
         * pixels and "attends a block, or rides along on a run" was cut to
         * "attends a block, or rides alo…" — the schema's own words, the one
         * thing this element exists to show, truncated mid-word with empty
         * ground on both sides of it. It is centered over the run and clamped
         * to the stage instead, so it borrows the gutter when it needs it.
         */
        const { left, width: span } = run;
        return (
          <div
            key={run.key}
            data-graview-relation={run.key}
            title={run.text}
            style={{
              position: "absolute",
              left,
              width: span,
              textAlign: "center",
              // Sits in the gutter above the run, not on top of the cards.
              top: Math.max(0, run.top - 19),
              fontSize: "0.75rem",
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "var(--graview-ink-faint)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {/*
              * On its own ground, because the connector it labels runs
              * straight through it: a hairline crossing 10-pixel uppercase
              * text at the x-height is the difference between a caption and
              * a smudge.
              */}
            <span
              style={{
                background: "var(--graview-ground)",
                padding: "1px 7px",
                borderRadius: 4,
              }}
            >
              {run.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
