import { counted, labelOf, SCENE_LAYERS, type AnySchema, type HasLog, type GraphReader, type NodeOfSchema } from "@graview/core";
import { edgeWords } from "@graview/core/words";
import { provenanceWords, provisionalLinks } from "@graview/core/provenance";
import { type InterpolatedLayout, edgeOfSelection } from "@graview/layout";
import { edgeSelectionId } from "@graview/layout/view-moves";
import { CONNECTOR_DASH, PROVISIONAL_DASH, PROVISIONAL_OPACITY, connectorStroke, styleFor } from "@graview/render";
import { Suspense, useEffect, useMemo, useLayoutEffect, useRef, useState } from "react";
import type { ActivityMark } from "./activity.js";
import { kitConnector, useKit } from "./kit.js";
import { orthogonalPoints, polylineD, roundedPolylineD, routePoint, routedQuadratic } from "./routes.js";
import { channelRoute } from "./channels.js";
import { captionBoxes, clipQuadratic, Connectors, connectorStrands, movedBy, tieRoute, type Owed } from "./connectors.js";
import { watchDrawnLate } from "./drawn-late.js";
import { drawingIn, drawnBox, measureVisible, visibleRect } from "./where-drawn.js";
import type { SceneNode } from "./scene-node.js";
import { CAPTION_RISE, captionRuns, captionText, type CaptionEntry, type CaptionRun } from "@graview/layout";
import { railInset } from "./rails.js";
import { placeTieLabels, tiesReached, type TieLabel, type TieReach } from "./tie-labels.js";
import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "./lazy-part.js";
import { mapChoice } from "./map-choice.js";

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
/**
 * THE LINKS STILL PROVISIONAL, as the lines read them (FR-172): each by its
 * selection id, with the sentence its hover says — who made it and what it
 * was based on. Undefined when there are none, which is nearly always.
 */
export function provisionalLines(store: HasLog): ReadonlyMap<string, string> | undefined {
  const links = provisionalLinks(store);
  return links.length > 0 ? new Map(links.map((link) => [edgeSelectionId(link.edge.kind, link.edge.from, link.edge.to), provenanceWords(link)])) : undefined;
}

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
  provisional,
  focusId = null,
  beside = false,
}: {
  /** A panel is drawn beside the map: from altitude, a record in focus is shown there and draws its links (`mapChoice`). */
  readonly beside?: boolean;
  /** The links still provisional, by selection id, with what to say of each (FR-172; `provisionalLines`). */
  readonly provisional?: ReadonlyMap<string, string>;
  readonly frame: InterpolatedLayout;
  readonly width: number;
  readonly height: number;
  readonly scheme: "light" | "dark";
  readonly overview: boolean;
  readonly selection: readonly string[];
  readonly emphasis: string | null;
  readonly stageRef: { current: HTMLElement | null };
  readonly store: { graph: GraphReader<NodeOfSchema<S>>; schema: S };
  readonly graphNodes: unknown;
  readonly onPickEdge: (edgeId: string, at?: { x: number; y: number }) => void;
  readonly liveOf: (connector: { from: string; to: string }) => ActivityMark | undefined;
  /** A card is held by the hand: draw from the layout, measure when it lets go. */
  readonly holding?: boolean;
  /** The stop's focus: from altitude, a group in focus is a lens open beside the map, and no record's links are drawn over it. */
  readonly focusId?: string | null;
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
  /*
   * THE CAPTIONS ARE PLACED IN THE SAME COMMIT, measured from the same
   * boxes, so the first measurement can come before them: a road along a
   * gutter went behind words that were not there yet. Where they stood is
   * kept with each measurement, and a frame later, if they stand elsewhere,
   * the lines are measured again.
   */
  const captionsAt = useRef("");
  /* Where the layout had every card when the lines were measured: a held card's lines move by what it has moved since. */
  const measuredAt = useRef<readonly SceneNode[]>([]);
  /* What the last measurement looked for inside a view and found no drawing of (`watchDrawnLate`, below). */
  const owed = useRef<Owed>(new Map());
  const captionsNow = () => [...(stageRef.current?.querySelectorAll("[data-graview-relation] > span") ?? [])].map((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}`; }).join(" ");
  useLayoutEffect(() => {
    if (moving || holding) return;
    captionsAt.current = captionsNow();
    measuredAt.current = frame.nodes;
    const owing: Owed = new Map();
    setMeasured(connectorStrands(frame.nodes, frame.connectors, stageRef.current, overview, scheme, owing));
    owed.current = owing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, moving, holding, selection, overview, graphNodes, scheme, asked, stageRef]);
  /*
   * A VIEW THAT DRAWS LATE (`watchDrawnLate`): a lens fetched as it is first
   * drawn puts its members down after the frame landed, at the same size,
   * and nothing above measures again for it. The members this measurement
   * looked for and found no drawing of are watched for, and the lines are
   * measured again when one is drawn.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (moving || holding || stage === null) return;
    return watchDrawnLate(stage, owed.current, () => remeasure((n) => n + 1));
  }, [measured, moving, holding, stageRef]);
  useEffect(() => {
    if (moving || holding || overview || typeof requestAnimationFrame === "undefined") return;
    const later = requestAnimationFrame(() => {
      if (captionsNow() !== captionsAt.current) remeasure((n) => n + 1);
    });
    return () => cancelAnimationFrame(later);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured]);

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

  /*
   * AND WHAT EACH VIEW DRAWS INSIDE ITS BOX. A host is the box the layout
   * gave it and keeps its size; the panel a line lands on stands in the
   * middle of it, so a panel whose words settle a frame late moves up or
   * down inside a box that never changed, and the lines measured before it
   * pointed above or below the card (todo's rule-order on the nightly's
   * runner). Watched afresh with each measurement, since a drawing can come
   * after its view; a size first seen is only remembered, so watching
   * measures nothing.
   */
  const drawnSizes = useRef(new WeakMap<Element, string>());
  useEffect(() => {
    const stage = stageRef.current;
    if (moving || holding || stage === null || typeof ResizeObserver === "undefined") return;
    let queued = 0;
    const watch = new ResizeObserver((entries) => {
      let changed = false;
      for (const { target, contentRect } of entries) {
        const size = `${Math.round(contentRect.width)}x${Math.round(contentRect.height)}`;
        if (drawnSizes.current.has(target) && drawnSizes.current.get(target) !== size) changed = true;
        drawnSizes.current.set(target, size);
      }
      if (changed && queued === 0) {
        queued = requestAnimationFrame(() => {
          queued = 0;
          remeasure((n) => n + 1);
        });
      }
    });
    for (const view of stage.querySelectorAll("[data-graview-view]")) {
      const drawing = drawingIn(view);
      if (drawing !== view) watch.observe(drawing);
    }
    return () => {
      if (queued !== 0) cancelAnimationFrame(queued);
      watch.disconnect();
    };
  }, [measured, moving, holding, stageRef]);

  /*
   * WHICH RECORD A PERSON IS AT: the pointer on it, or the keyboard. A tie
   * the record's card has already said is drawn for that one (`said`);
   * nobody is listened to while no tie waits on it.
   */
  const [pointed, point] = useState<string | null>(null);
  const waiting = (measured ?? []).some((strand) => strand.tie !== undefined);
  useEffect(() => {
    const stage = stageRef.current;
    if (!waiting || stage === null) return;
    const at = (event: Event) => {
      const mark = (event.target as Element | null)?.closest?.("[data-graview-pick], [data-graview-view]");
      point(mark?.getAttribute("data-graview-pick") ?? mark?.getAttribute("data-graview-view") ?? null);
    };
    const away = () => point(null);
    stage.addEventListener("pointerover", at);
    stage.addEventListener("focusin", at);
    stage.addEventListener("pointerleave", away);
    stage.addEventListener("focusout", away);
    return () => {
      stage.removeEventListener("pointerover", at);
      stage.removeEventListener("focusin", at);
      stage.removeEventListener("pointerleave", away);
      stage.removeEventListener("focusout", away);
    };
  }, [waiting, stageRef]);

  if (moving) return null;
  /*
   * Without a DOM — the first render, a server — the lines stand on the
   * layout's own boxes. While a card is held they stand on what was
   * measured, moved by as far as the hand has moved each card since: the
   * page is not measured on every move, and a line still starts on the
   * card's drawn edge rather than on the edge of the slot the layout gave
   * it (a gap as tall as the slot is taller), and a tie the card has said
   * stays waiting.
   */
  const strands =
    (measured && holding ? movedBy(measured, measuredAt.current, frame.nodes) : measured) ?? connectorStrands(frame.nodes, frame.connectors, null, overview, scheme);
  const drawnSingles = new Set<string>();
  for (const strand of strands) {
    if (strand.edges.length === 1) {
      const edge = strand.edges[0]!;
      drawnSingles.add(`${strand.connector.kind}|${edge.from}|${edge.to}`);
      continue;
    }
    /*
     * A BUNDLE FROM THE RECORD ITSELF has drawn each of its edges too: the
     * line from a focused artist to the band's "790 more songs" is the line
     * a tie from the artist to any of those songs would draw. The tie drew
     * it again, from inside the card's edge (the focused scene of a product
     * with many relations: a second line under the card to the same door).
     */
    for (const edge of strand.edges) {
      if (strand.connector.from === edge.from || strand.connector.to === edge.to) drawnSingles.add(`${strand.connector.kind}|${edge.from}|${edge.to}`);
    }
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
        pointed={pointed}
        {...(provisional ? { provisional } : {})}
      />
      {/*
        * FROM ALTITUDE A CHOSEN RECORD DRAWS ITS OWN LINKS, labeled, and
        * nothing else does: the ties and the lit connectors were three
        * manners of line at once, none saying which relation it was.
        */}
      {overview && mapChoice(selection, { overview, focusId, beside }, (id) => store.graph.getNode(id)?.kind as string | undefined).records.length > 0 ? (
        <Suspense fallback={null}>
          <RecordLinks frame={frame} width={width} height={height} stageRef={stageRef} tick={asked} store={store} graphVersion={graphNodes} selection={selection} view={{ overview, focusId, beside }} rulers={provisional ? { ...RULERS, unsureOf: (edge, from, to) => provisional.get(edgeSelectionId(edge, from, to)) } : RULERS} />
        </Suspense>
      ) : null}
      {overview ? null : <SelectionTies
        {...(provisional ? { provisional } : {})}
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
      />}
    </>
  );
}

/*
 * A CHOSEN RECORD'S LINKS FROM ALTITUDE (`record-links-layer.tsx`), fetched
 * the first time a record is chosen up there: a page nobody chooses
 * anything on carries none of it.
 */
/* The scene's rulers, handed to the links rather than imported by them: a part fetched apart reaching into the scene's own modules splits them around it. */
const RULERS = { visibleRect, clipQuadratic, unsureDash: PROVISIONAL_DASH, unsureOpacity: PROVISIONAL_OPACITY };
const recordLinks = /* @__PURE__ */ lazyModule(retryingImport(() => import("./record-links-layer.js")));
const RecordLinks = /* @__PURE__ */ recordLinks.part(
  (module, props: Parameters<typeof import("./record-links-layer.js").RecordLinks>[0]) => <module.RecordLinks {...props} />,
  { what: "The links", quiet: true },
);

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
/** The strip at the top of a card where its title is said, which a tie's words keep off. */
const TITLE_STRIP = 44;
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
  /** The chosen record, and the far one (or, to a district, how many are there): what the line says, in the chosen record's kind's words. */
  self: string;
  other: string;
  others: number;
  said?: string;
  /** On the ground, from a chip of the band: the road through its gutters (`channelRoute`), drawn whole. */
  points?: { x: number; y: number }[];
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
  provisional,
}: {
  /** The links still provisional, by selection id (FR-172). */
  readonly provisional?: ReadonlyMap<string, string>;
  /** Select the ONE edge a tie stands for; `at` means "and menu here". */
  readonly onPickEdge?: (edgeId: string, at?: { x: number; y: number }) => void;
  /** Real edge pairs the connector layer already drew — one line, not two. */
  readonly alreadyDrawn?: ReadonlySet<string>;
  readonly stageRef: { current: HTMLElement | null };
  readonly nodes: readonly SceneNode[];
  readonly scheme: "light" | "dark";
  readonly selection: readonly string[];
  readonly store: { graph: GraphReader<NodeOfSchema<S>>; schema: S };
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
      joined.push({ key: `join:${id}`, self: id, other: "", others: 1, kind: edge?.kind ?? "", endX: route.to.x, endY: route.to.y, ...route, fromBox: cellBox, toBox: box, proxy: false, edgeId: edge ? edgeSelectionId(edge.kind, edge.from, edge.to) : null });
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

  /* The band's chips and the words over them, which a road from a chip goes round. */
  const band: Box[] = [];
  if (!overview && stageRef.current) {
    for (const node of nodes) {
      if (Math.round(node.plane) !== 1) continue;
      const box = measureVisible(stageRef.current, node.id, false);
      if (box) band.push(box);
    }
    const stageEl = stageRef.current;
    band.push(...captionBoxes(stageEl, stage, nodes, (id) => measureVisible(stageEl, id, false)));
  }
  const seen = new Map<string, TieLine>();
  const found: TieLine[] = [];
  for (const tie of ties) {
    if (someViewDrawsBoth(tie.self, tie.other)) continue;
    const selfHost = hostOf(tie.self);
    const selfHostEl = selfHost
      ? stageRef.current?.querySelector(`[data-graview-view="${CSS.escape(selfHost.id)}"]`)
      : null;
    /*
     * A CHIP OF THE BAND IS THE THING: chosen there, its tie leaves the chip,
     * not a mention of it in the record's card above, whose line then ran
     * down through the card's own chips and across the band.
     */
    const ownChip = !overview && selfHost?.id === tie.self && Math.round(selfHost.plane) === 1 ? measureVisible(stageRef.current, selfHost.id, false) : null;
    const fromCandidates = ownChip ? [ownChip] : elementBoxes(tie.self, () => false);
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
    const twin = seen.get(key);
    if (twin) {
      // Several records of one district on one line: the line counts them.
      twin.others += 1;
      continue;
    }
    const route = tieRoute(fromBox, toBox);
    if (!route) continue;
    const { from, control } = route;
    // From a chip of the band, the road runs whole through its gutters, under nothing and over nothing.
    const points = ownChip && fromBox === ownChip ? channelRoute(fromBox, toBox, band, found.length) : undefined;
    const to = points ? points[points.length - 1]! : route.to;
    // The real edge this tie stands for, oriented the way the graph holds it.
    const oriented = [...store.graph.allEdges()].find(
      (edge) =>
        edge.kind === tie.kind &&
        ((edge.from === tie.self && edge.to === tie.other) ||
          (edge.from === tie.other && edge.to === tie.self)),
    );
    const line: TieLine = {
      key: `${tie.kind}:${tie.self}:${tie.other}`,
      self: tie.self,
      other: tie.other,
      others: 1,
      kind: tie.kind,
      endX: to.x,
      endY: to.y,
      from,
      to,
      control,
      fromBox,
      toBox,
      ...(points ? { points } : {}),
      proxy: toProxy,
      edgeId: oriented ? edgeSelectionId(oriented.kind, oriented.from, oriented.to) : null,
    };
    seen.set(key, line);
    found.push(line);
  }
  /*
   * A RECORD ON THE GROUND HAS ITS RELATIONS SAID ALREADY: the band's
   * captions name each of them over the cards they reach. The focused scene
   * of a product with many relations hung "questions that would settle it:
   * 1 question" and "is a call about: Additive file o…" in open ground as
   * well, clipped at the edge, detached from what they named — a band card
   * chosen said its own links over the focus's, and the focus said again
   * what its captions said, with the count of the ties kept rather than the
   * relation's. So on the ground only the focused record's own ties speak,
   * and only where no caption already does; another record's links are its
   * inspector's to say.
   */
  const focused = overview ? undefined : nodes.find((node) => Math.round(node.plane) === 0 && !node.aggregate);
  const captioned = (line: TieLine): boolean => {
    const far = nodes.find((node) => node.id === line.other) ?? nodes.find((node) => node.aggregate?.memberIds.includes(line.other));
    return far !== undefined && Math.round(far.plane) === 1 && far.via?.edgeKind === line.kind;
  };
  // EVERY LINE SAYS ITS RELATION at its far end, in the chosen record's kind's words, as the same record's links do from altitude.
  for (const line of found) {
    if (focused && (line.self !== focused.id || captioned(line))) continue;
    const edge = [...store.graph.allEdges()].find((one) => one.kind === line.kind && ((one.from === line.self && one.to === line.other) || (one.from === line.other && one.to === line.self)));
    const selfNode = store.graph.getNode(line.self);
    const otherNode = store.graph.getNode(line.other);
    if (!edge || !selfNode || !otherNode) continue;
    const direction = edge.from === line.self ? "out" : "in";
    const words = edgeWords(store.schema, direction === "out" ? selfNode.kind : otherNode.kind, line.kind, direction);
    /*
     * Into a stand-in, how many the RELATION reaches, not how many ties this
     * one kept: a busy record keeps fourteen, and "their songs: 4 songs"
     * stood beside a door to 790.
     */
    const reach = line.proxy
      ? (direction === "out" ? store.graph.out(line.self, line.kind) : store.graph.in(line.self, line.kind)).filter((node) => node.kind === otherNode.kind).length
      : 1;
    line.said = line.proxy ? `${words}: ${counted(store.schema, otherNode.kind, Math.max(reach, line.others))}` : `${words}: ${labelOf(store.schema.tryDefinition(otherNode.kind), otherNode as never)}`;
  }
  return found;
  };
  const [lines, setLines] = useState<TieLine[]>([]);
  const [labels, setLabels] = useState<TieLabel[]>([]);
  useLayoutEffect(() => {
    const measured = measure();
    setLines(measured);
    setLabels(measured.some((line) => line.said) ? labelsFor(measured) : []);
    // The measurement depends on the DOM the frame committed, which these
    // name; `measure` itself closes over nothing that changes without them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ties, nodes, overview, scheme, width, height, alreadyDrawn, tick, stageRef]);
  /* Each tie's words beside its far end, once, clear of the cards' titles (`tie-labels.ts`). */
  const labelsFor = (measured: readonly TieLine[]): TieLabel[] => {
    const stageEl = stageRef.current;
    if (!stageEl) return [];
    const cards: { box: Box; title: Box }[] = [];
    for (const host of stageEl.querySelectorAll("[data-graview-view]")) {
      const frame = [...host.children].find((child) => !child.classList.contains("graview-kind-tag"));
      const box = frame ? visibleRect(frame, stageEl) : null;
      if (box) cards.push({ box, title: { ...box, height: Math.min(box.height, TITLE_STRIP) } });
    }
    return placeTieLabels(
      measured.flatMap((line) => (line.said ? [{ key: line.key, said: line.said, end: { x: line.endX, y: line.endY }, far: line.toBox }] : [])),
      cards,
      { width, height },
    );
  };
  /*
   * A TIE'S WORDS WAIT TO BE ASKED FOR: shown while the tie, or a card at
   * either end of it, is under the pointer or holds the keyboard.
   */
  const [reached, setReached] = useState<ReadonlySet<string>>(() => new Set());
  const reachable = useRef<readonly TieReach[]>([]);
  reachable.current = lines.map((line) => ({ key: line.key, fromBox: line.fromBox, toBox: line.toBox, ids: [line.self, line.other], edgeId: line.edgeId }));
  const anySaid = labels.length > 0;
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl || !anySaid) return;
    const settle = (next: Set<string>) =>
      setReached((was) => (was.size === next.size && [...next].every((key) => was.has(key)) ? was : next));
    let queued = 0;
    let last: PointerEvent | null = null;
    const pointed = () => {
      queued = 0;
      if (!last) return;
      const stage = stageEl.getBoundingClientRect();
      const target = last.target instanceof Element ? last.target : null;
      settle(
        tiesReached(reachable.current, {
          point: { x: last.clientX - stage.left, y: last.clientY - stage.top },
          edgeId: target?.closest("[data-graview-edge]")?.getAttribute("data-graview-edge") ?? null,
        }),
      );
    };
    const onMove = (event: PointerEvent) => {
      last = event;
      if (!queued) queued = requestAnimationFrame(pointed);
    };
    const onLeave = () => {
      last = null;
      settle(new Set());
    };
    const onFocus = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const stage = stageEl.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const id = target.closest("[data-graview-pick]")?.getAttribute("data-graview-pick") ?? target.closest("[data-graview-view]")?.getAttribute("data-graview-view");
      settle(
        tiesReached(reachable.current, {
          ...(id ? { ids: [id] } : {}),
          box: { x: rect.left - stage.left, y: rect.top - stage.top, width: rect.width, height: rect.height },
        }),
      );
    };
    const onBlur = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node && stageEl.contains(event.relatedTarget))) settle(new Set());
    };
    stageEl.addEventListener("pointermove", onMove, { passive: true });
    stageEl.addEventListener("pointerleave", onLeave);
    stageEl.addEventListener("focusin", onFocus);
    stageEl.addEventListener("focusout", onBlur);
    return () => {
      if (queued) cancelAnimationFrame(queued);
      stageEl.removeEventListener("pointermove", onMove);
      stageEl.removeEventListener("pointerleave", onLeave);
      stageEl.removeEventListener("focusin", onFocus);
      stageEl.removeEventListener("focusout", onBlur);
    };
  }, [stageRef, anySaid]);
  if (lines.length === 0) return null;

  return (
    <>
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
        // A link made less than sure, not yet kept by a person (FR-172): short dashes, quieter, its basis on hover.
        const unsure = line.edgeId ? provisional?.get(line.edgeId) : undefined;
        const quadratic = { p0: line.from, c: line.control, p1: line.to };
        // The route is the kit's call: the arc the layout chose, its chord, or two elbows.
        const d = line.points
          ? roundedPolylineD(line.points, 10)
          : connector.route === "orthogonal"
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
          const points: { x: number; y: number }[] = line.points ? [...line.points] : [];
          for (let i = 0; i <= (line.points ? -1 : 40); i++) {
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
                  // Option held: the browser's own menu.
                  if (event.altKey) return;
                  event.preventDefault();
                  event.stopPropagation();
                  onPickEdge(line.edgeId!, { x: event.clientX, y: event.clientY });
                }}
              >
                {unsure !== undefined ? <title>{unsure}</title> : null}
              </path>
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
          <g key={line.key} opacity={(line.proxy ? 0.32 : 0.72) * (unsure !== undefined ? PROVISIONAL_OPACITY : 1)}>
            <path
              data-graview-tie={line.kind}
              data-graview-tie-proxy={line.proxy || undefined}
              data-graview-provisional={unsure !== undefined || undefined}
              d={d}
              fill="none"
              stroke={connectorStroke(style)}
              strokeWidth={line.proxy ? 1.1 : 1.6}
              strokeDasharray={unsure !== undefined ? PROVISIONAL_DASH : CONNECTOR_DASH[style.pattern]}
              strokeLinecap="round"
            />
            {/* A destination, marked: the far end lands somewhere specific. */}
            <circle cx={line.endX} cy={line.endY} r={line.proxy ? 2 : 2.6} fill={connectorStroke(style)} />
            {hit}
          </g>
        );
      })}
    </svg>
    <div aria-hidden="true" data-graview-world="" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: SCENE_LAYERS.tieLabels }}>
      {labels.map((label) => {
        const first = lines.find((line) => line.key === label.keys[0]);
        return (
          <span
            key={label.said}
            className="graview-record-link-said"
            data-graview-link-said={first?.kind}
            data-graview-lands={first?.proxy ? "district" : "record"}
            /* How many ties these words speak for, and whether one of them is reached. */
            data-graview-said-for={label.keys.length}
            data-graview-tie-said={label.keys.some((key) => reached.has(key)) ? "shown" : "waiting"}
            /* Kept on the screen: landing near a phone's edge, the words step back by as much as they would run over (the tenth walk). */
            style={{ position: "absolute", left: label.x, top: label.y, transform: `translateX(min(0px, calc(${Math.round(width - label.x - 8)}px - 100%)))` }}
          >
            {label.said}
          </span>
        );
      })}
    </div>
    </>
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

/** The reader's rem over the browser's 16: what the captions' words are set in, so what their room is reckoned in. */
function remScale(): number {
  if (typeof document === "undefined") return 1;
  return parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;
}

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
    /** The layout's row each entry stands in. */
    const rowOf: number[] = [];
    for (const node of nodes) {
      if (!node.via || Math.round(node.plane) !== 1) continue;
      /*
       * Above the PANEL someone can see, not the band slot the layout allots:
       * a raised card centers its panel in a taller host, so a caption hung
       * from the host's top floated in open ground half a band above the
       * cards it captions.
       */
      // By the slot, as the layout made the rows: a chip sits lower in its slot than a card of several in the same row.
      const measured = measureVisible(stageRef.current, node.id, false, true);
      const { scale } = styleFor(1, scheme);
      entries.push({
        key: `${node.via.edgeKind}|${node.via.direction}`,
        // Where the declaration has no words for this end, the arrow says which way the relation points (FR-142).
        text: captionText(node.via),
        left: measured?.x ?? node.x,
        right: measured ? measured.x + measured.width : node.x + node.width * scale,
        top: measured?.y ?? node.y,
      });
      rowOf.push(Math.round(node.y));
    }
    /*
     * ONE ROW, ONE LINE OF CAPTIONS, over the tallest card in it. Each card
     * centers in its slot, so a row of a session, two topics and two
     * speakers had five tops; a relation's caption went over whichever of
     * its cards stood highest, and "who presents it" hung over one of its
     * two speakers with the other under no words at all.
     */
    const highest = new Map<number, number>();
    entries.forEach((entry, at) => highest.set(rowOf[at]!, Math.min(highest.get(rowOf[at]!) ?? Infinity, entry.top)));
    const level = entries.map((entry, at) => ({ ...entry, top: highest.get(rowOf[at]!) ?? entry.top }));
    const rails = railInset(stageWidth);
    return captionRuns(level, { left: rails.left, right: stageWidth - rails.right }, remScale());
  }
  // The kit may keep the captions off: the edge's words stay on the inspector.
  if (runs.length === 0 || !kit.captions.visible) return null;

  if (moving) return null;
  const rise = CAPTION_RISE * remScale();
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
              // Sits in the gutter the layout keeps above the run, not on top of the cards.
              top: Math.max(0, run.top - rise),
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
