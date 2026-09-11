import { labelOf } from "@graview/core";
import type { AnySchema, Fidelity, GraphReader, NodeOfSchema } from "@graview/core";
import {
  isAggregateId,
  kindOfCard,
  kindsOf,
  layout,
  withFocus,
  withOverview,
  withPan,
  withPin,
  withRelation,
  type Connector,
  type InterpolatedLayout,
  type Layout,
  type LayoutNode,
  type LayoutOptions,
  edgeSelectionId,
  edgeOfSelection,
  withJackIn,
} from "@graview/layout";
import {
  CONNECTOR_DASH,
  connectorStroke,
  connectorStyle,
  connectorWidth,
  mixStyles,
  PLANE_STYLES,
  styleFor,
  transformFor,
  type Matrix4,
  hueFor,
} from "@graview/render";
import {
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useActivity, type ActivityMark, type Manner } from "./activity.js";
import { useAnimatedLayout, useTouched } from "./animation.js";
import { useFlagged, useImplicated } from "./hooks.js";
import { useGraph, useGraview, ViewModeProvider, type ViewMode } from "./context.js";
import { isDefaultView } from "./view-registry.js";
import { pickedFrom, usePickTargets } from "./picking.js";
import type { ViewComponent, ViewProps } from "./view-registry.js";

export interface SceneProps<S extends AnySchema> {
  readonly options?: LayoutOptions;
  /**
   * `gpu` composites through @graview/render; `dom` positions views with CSS
   * transforms. `auto` picks gpu when the platform supports it.
   *
   * The DOM path is not a toy: the plane model is affine by design, so a CSS
   * transform reproduces the geometry exactly. What it cannot do is per-plane
   * blur and falloff — which is precisely the thing that justified the GPU
   * pipeline, and precisely what is safe to lose when it is unavailable.
   */
  readonly renderer?: "gpu" | "dom" | "auto";
  /**
   * Wires a renderer to the canvas. Called whenever the layout changes, with
   * the canvas and the current picture; return a cleanup.
   *
   * The binding stays out of the renderer's business deliberately: it hands
   * over the canvas and what layout decided, and the renderer decides pixels.
   */
  readonly attachRenderer?: (scene: {
    canvas: HTMLCanvasElement;
    /**
     * The picture as it is RIGHT NOW, which mid-transition is between two
     * view states. Planes may be fractional and nodes may be part-faded.
     */
    layout: InterpolatedLayout;
    /**
     * Views whose CONTENT changed, so a cached texture must be retaken.
     *
     * Position and size changes the renderer can see for itself; a count
     * inside an aggregate changing is invisible to it, and `glyph` fidelity
     * would otherwise show the old number for ever.
     */
    dirty: ReadonlySet<string>;
    /** The DOM host for a view id — what the capture API is given. */
    hostOf(id: string): HTMLElement | null;
  }) => (() => void) | void;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Animate between view states. Off in tests and SSR. */
  readonly animate?: boolean;
  /** Rendered over the scene — an affordance surface, a header, a legend. */
  readonly children?: ReactNode;
}

/**
 * A node as the scene draws it: a laid-out node, possibly mid-transition, so
 * its plane is fractional and it may be fading in or out.
 */
export type SceneNode = Omit<LayoutNode, "plane"> & {
  readonly plane: number;
  readonly opacity?: number;
};

/**
 * The spatial scene: one `<canvas layoutsubtree>` with the views as its
 * IMMEDIATE children.
 *
 * That flatness is a platform constraint, not a style: capture rejects
 * anything deeper than a direct child of the canvas. Nesting happens inside a
 * view, never between views.
 */
/**
 * How far a pointer must travel before it is a drag rather than a click.
 * Below this nothing has moved and the gesture is an ordinary selection.
 */
const DRAG_THRESHOLD = 4;

export function Scene<S extends AnySchema>({
  options,
  renderer = "auto",
  attachRenderer,
  className,
  style,
  animate = true,
  children,
}: SceneProps<S>) {
  const {
    store,
    scheme,
    views,
    view,
    setView,
    selection,
    setSelection,
    setMenuAt,
    emphasis,
  } = useGraview<S>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(wrapperRef);

  /*
   * PINCH IS ALTITUDE. The camera has one axis, so the universal zoom
   * gesture maps to it: fingers together rises to the Graview, fingers
   * apart descends — one discrete step per gesture, with a cooldown so a
   * long pinch does not bounce. Chromium and Firefox hand a trackpad
   * pinch over as ctrl+wheel; Safari speaks GestureEvent. Both are
   * claimed here so the browser's own page zoom never fires on the scene.
   */
  const altitude = useRef({ view, charge: 0, coolUntil: 0 });
  altitude.current.view = view;
  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const step = (rising: boolean, stamp: number) => {
      const held = altitude.current;
      if (stamp < held.coolUntil) return;
      const up = held.view.overview ?? false;
      if (rising === up) return;
      held.coolUntil = stamp + 600;
      held.charge = 0;
      setView(withOverview(held.view, rising));
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const held = altitude.current;
      held.charge += event.deltaY;
      if (Math.abs(held.charge) < 60) return;
      step(held.charge > 0, performance.now());
    };
    const onGesture = (event: Event) => {
      event.preventDefault();
      const scale = (event as Event & { scale?: number }).scale ?? 1;
      if (scale < 0.72) step(true, performance.now());
      else if (scale > 1.4) step(false, performance.now());
    };
    const swallowGesture = (event: Event) => event.preventDefault();
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("gesturestart", swallowGesture);
    element.addEventListener("gesturechange", onGesture);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("gesturestart", swallowGesture);
      element.removeEventListener("gesturechange", onGesture);
    };
  }, [setView]);

  // `nodes` is a cached snapshot that only changes when the graph does, so
  // the layout is recomputed exactly when the picture could have changed.
  const nodes = useGraph<S>();
  // The scene is laid out to the space it actually has. A fixed canvas leaves
  // dead ground on a wide screen and clips on a narrow one, and the plane
  // bands are proportions rather than pixels, so they follow.
  const sized = useMemo<LayoutOptions>(
    () => ({
      ...options,
      // A workspace's disabled modules, projected once by the store: the
      // layout simply never draws those kinds.
      ...(store.modules.disabledKinds.size > 0
        ? { hiddenKinds: [...store.modules.disabledKinds].sort() }
        : {}),
      /*
       * THE LEFT RAIL. The relation key, the quick relations and the
       * inspector live on the scene's left edge in every mode, and the
       * picture used to run under them — a district beneath the pane at
       * altitude, a lens's title under the quick relations in focus. The
       * layout keeps every card to what is left. The altitude control sits
       * in the top-right corner, where a full-width focus card's own corner
       * used to be — so the right has a rail too.
       */
      // In proportion: an embed a paragraph wide cannot give a third of
      // itself to chrome. From the default 1200 up these are 264 and 128.
      inset: {
        left: Math.round(Math.min(264, (size?.width ?? 1200) * 0.22)),
        right: Math.round(Math.min(128, (size?.width ?? 1200) * 0.107)),
      },
      // Groups the framework's own list shows: from altitude those are
      // districts, not scaled cards. A group with an app's view keeps its card.
      plainGroups: (store.schema.kinds as readonly string[]).filter((kind) =>
        isDefaultView(views.lookup(kind as never, { cardinality: "many", fidelity: "full" })),
      ),
      ...(size
        ? {
            width: size.width,
            /*
             * The scene lays out into its WHOLE box. The actions strip is a
             * transient elevated surface — it floats in front of the scene
             * the way a menu floats in front of a page, and reserving a
             * permanent band of the height for it squeezed every band on
             * every screen for chrome that mostly is not there.
             */
            height: size.height,
          }
        : {}),
    }),
    [options, size, store, views],
  );
  const result = useMemo<Layout>(
    () => layout(store.graph, store.schema, view, sized),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, view, sized, nodes],
  );

  /*
   * A DRAG IS NOT A TRANSITION.
   *
   * Every pointer move writes a new view state, and easing toward each one
   * over half a second made the scene chase the pointer — panning felt
   * laggy because it literally lagged, by design meant for navigation. While
   * a drag owns the pointer the picture snaps to it; the tween is for the
   * moves you did not make with your own hand.
   */
  const [dragging, setDragging] = useState(false);
  // The picture as it is right now, part-way between the last view and this
  // one. Everything downstream draws the tween, not the destination.
  const frame = useAnimatedLayout(result, { enabled: animate && !dragging });
  const touched = useTouched<S>();

  useEffect(() => {
    if (renderer === "dom") return;
    const canvas = canvasRef.current;
    if (!canvas || !attachRenderer) return;
    // The renderer is handed the FRAME, not the target.
    //
    // Two reasons, both of which were bugs before: the DOM holds the tween,
    // so a host for a node that has not entered yet does not exist to be
    // captured; and drawing the target during a transition would snap every
    // view to its final position while the DOM animated underneath it.
    // A group is stale when any of its members changed, since its own view
    // is a summary of them.
    const dirty = new Set<string>();
    for (const node of frame.nodes) {
      if (touched.has(node.id)) dirty.add(node.id);
      else if (node.aggregate?.memberIds.some((id) => touched.has(id))) dirty.add(node.id);
    }

    const detach = attachRenderer({
      canvas,
      layout: frame,
      dirty,
      hostOf: (id) =>
        canvas.querySelector<HTMLElement>(`[data-graview-view="${CSS.escape(id)}"]`),
    });
    return () => {
      detach?.();
    };
  }, [renderer, attachRenderer, frame, touched]);

  const useDom = renderer === "dom" || (renderer === "auto" && !attachRenderer);

  /*
   * What just happened, resolved onto whatever is DRAWN.
   *
   * The op log names node ids, and a node is not always on screen as itself:
   * above the stack a duty is inside the Runs card, and inside the stack it
   * may be its own panel. An edit should land on whichever of those the eye
   * can actually see, which is the same rule the connectors follow — the
   * node if it is placed, otherwise the group standing in for it.
   */
  const activity = useActivity<S>();
  const activityOf = (node: SceneNode | undefined): ActivityMark | undefined => {
    const own = node ? activity.get(node.id) : undefined;
    const members = node?.aggregate?.memberIds ?? [];
    if (!own && members.length === 0) return undefined;

    let best: ActivityMark | undefined = own;
    let wrote = own?.wrote ?? false;
    let read = own?.read ?? false;
    let broke = own?.broke ?? false;
    for (const memberId of members) {
      const mark = activity.get(memberId);
      if (!mark) continue;
      // A card standing for forty nodes reports the strongest thing that
      // happened inside it, not the last one alphabetically — and a rule
      // that broke in there is reported whichever member it landed on,
      // because that is the news.
      wrote ||= mark.wrote;
      read ||= mark.read;
      broke ||= mark.broke;
      if (!best || mark.at > best.at || (mark.at === best.at && mark.wrote && !best.wrote)) {
        best = mark;
      }
    }
    return best ? { ...best, wrote, read, broke } : undefined;
  };

  /*
   * DRAGGING.
   *
   * Two gestures, one mechanism. Drag the ground and the camera moves; drag a
   * card and it stays where you put it. Both are ordinary view state — a pan
   * and a pin — so both go in the URL, both interpolate, and both come back
   * when someone opens the link. Neither is a mode: there is nothing to turn
   * on and nothing to turn off.
   *
   * The threshold is what keeps a click a click. Below it nothing has
   * happened and the pointer-up is an ordinary selection; above it the
   * gesture owns the pointer and the click that follows is swallowed.
   */
  const swallow = useRef(false);
  const gesture = useRef<{
    kind: "pan" | "card";
    id?: string;
    fromX: number;
    fromY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);

  const onGroundDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // Only the ground itself. A card, a chip or anything a view drew keeps
    // whatever meaning it already had.
    if ((event.target as HTMLElement).closest("[data-graview-view]")) return;
    const pan = view.pan ?? { x: 0, y: 0 };
    gesture.current = {
      kind: "pan",
      fromX: event.clientX,
      fromY: event.clientY,
      baseX: pan.x,
      baseY: pan.y,
      moved: false,
    };
  };

  const onCardDown = (node: SceneNode, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    gesture.current = {
      kind: "card",
      id: node.id,
      fromX: event.clientX,
      fromY: event.clientY,
      // Unpanned, because that is the space a pin is stored in.
      baseX: node.x - (view.pan?.x ?? 0),
      baseY: node.y - (view.pan?.y ?? 0),
      moved: false,
    };
  };

  const onDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = gesture.current;
    if (!drag) return;
    const dx = event.clientX - drag.fromX;
    const dy = event.clientY - drag.fromY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      setDragging(true);
      /*
       * Capture only once it IS a drag.
       *
       * Taken on pointer-down it broke every click on an inner target:
       * pointer capture redirects the compatibility mouse events too, so the
       * click and double-click that followed were reported against the host
       * rather than the chip, `data-graview-pick` stopped resolving, and
       * double-clicking a task opened the card instead of travelling into the
       * task. Nothing had moved and the gesture had already changed meaning.
       */
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    if (drag.kind === "pan") {
      // A LITTLE way, not anywhere. Losing the scene off the edge of its own
      // window is not panning, it is dropping it.
      const limit = { x: result.width * 0.45, y: result.height * 0.45 };
      setView((current) =>
        withPan(current, {
          x: Math.max(-limit.x, Math.min(limit.x, drag.baseX + dx)),
          y: Math.max(-limit.y, Math.min(limit.y, drag.baseY + dy)),
        }),
      );
    } else if (drag.id) {
      setView((current) =>
        withPin(current, drag.id!, { x: drag.baseX + dx, y: drag.baseY + dy }),
      );
    }
  };

  const onDragUp = () => {
    if (gesture.current?.moved) {
      // Swallow the click this pointer-up is about to produce, so a drag that
      // ends on a card does not also select it.
      swallow.current = true;
      setTimeout(() => (swallow.current = false), 0);
    }
    gesture.current = null;
    setDragging(false);
  };

  /*
   * A CROWD drops to glyphs. A summary panel needs room, and a raised
   * relation with many members divides the band until no card has any —
   * ten titles wrapping to five lines in 130-pixel slivers. Below the
   * legibility floor a card renders the kind's GLYPH instead, which is
   * what the fidelity axis is for: legible at any width, still selectable,
   * still the node.
   */
  const crowded = (node: SceneNode) => Math.round(node.plane) === 1 && node.width < 175;

  /*
   * Whether this card stands for a kind the app gave a picture of its own —
   * the same question `ResolvedView` asks to draw the ◆, asked here so the
   * gesture and the mark cannot disagree.
   */
  const ownPictureOf = (node: SceneNode): boolean => {
    if (kindOfCard(node.id) === null && !node.aggregate) return false;
    const own = views.resolve(node.kind, { cardinality: "many", fidelity: "full" })?.view as
      | { generic?: boolean }
      | undefined;
    return own !== undefined && own.generic !== true;
  };

  const hosts = frame.nodes.map((node) => (
    <SceneViewHost
      key={node.id}
      node={node}
      crowded={crowded(node)}
      useDom={useDom}
      touched={touched.has(node.id)}
      {...(activityOf(node) ? { activity: activityOf(node) } : {})}
      scheme={scheme}
      canvasWidth={result.width}
      canvasHeight={result.height}
      selected={selection.includes(node.id)}
      onSelect={(additive) => {
        /*
         * A group is a PLACE; a node is a THING.
         *
         * Clicking a group raises its members onto plane 1 — which is what
         * "open the People block" obviously means, and what the whole
         * aggregate model is for. Before this, clicking a group silently
         * selected members that were not on screen and looked like nothing
         * had happened, and the only way to raise anything was a button in
         * the far corner of the command bar.
         *
         * Hold shift or meta to select the members instead.
         */
        /*
         * Above the stack, raising a relation means nothing.
         *
         * `withRelation` moves a kind's members onto plane 1, and the overview
         * has no plane 1 — `relatedNodes` is hard-coded empty up there. So the
         * gesture did nothing at all, and the emphasis this comment promised
         * had no way to be triggered except through the legend. Selecting the
         * card is what "what does this touch" means when the cards are kinds.
         */
        const kinds = node.aggregate ? kindsOf(node.id) : [];
        if (view.overview) {
          setSelection((current) => (additive ? [...new Set([...current, node.id])] : [node.id]));
          return;
        }
        if (kinds.length === 1 && !additive && Math.round(node.plane) !== 0) {
          const kind = kinds[0]!;
          setView((current) => withRelation(current, current.relation === kind ? null : kind));
          return;
        }
        setSelection((current) => selectionFor(node, current, additive));
      }}
      /*
       * Picking a thing SELECTS it, and leaves the picture where it is.
       *
       * It used to travel, which is the wrong default: most of the time you
       * want to act on the thing where it is — substitute a player without
       * leaving the formation, move an event without leaving the week — and
       * being thrown into a detail view to do it costs you the context that
       * made the decision obvious. Travel is the deliberate second gesture.
       */
      onPick={(id, additive) =>
        setSelection((current) =>
          additive
            ? current.includes(id)
              ? current.filter((other) => other !== id)
              : [...current, id]
            : [id],
        )
      }
      /*
       * Double click means GO DEEPER, whatever it lands on: into the node a
       * view nominated, or — where a view nominated nothing — into the view
       * itself as a full page. One gesture, one meaning.
       */
      onTravel={(id) => {
        setView((current) => ({ ...withFocus(current, id), relation: null }));
        setSelection([id]);
      }}
      onMenu={setMenuAt}
      selection={selection}
      /*
       * Jacking in ZOOMS: the same scene, the focus grown to most of it,
       * shelf and relations receded but present. On the node already zoomed
       * the same gesture zooms back out — in and out are one motion.
       */
      onJackIn={() => {
        /*
         * A kind with a lens over it goes INTO the lens; a kind without one
         * explodes into its district. The card already draws a ◆ when it has
         * a picture of its own, and used to burst into a ring of chips
         * anyway — trading the designed view for the fallback it exists to
         * improve on.
         */
        setView((current) => withJackIn(current, node.id, { ownPicture: ownPictureOf(node) }));
        /*
         * A zoomed RECORD is selected — reading closely is when you act.
         * A zoomed PLACE starts quiet: the click half of the double-click
         * had just selected every member, and arriving with the whole
         * population selected buries the place under its own strip.
         */
        setSelection(node.aggregate ? [] : [node.id]);
      }}
      onDragStart={(event) => onCardDown(node, event)}
      onDragMove={onDragMove}
      onDragEnd={onDragUp}
      swallowClick={swallow}
    >
      <ResolvedView
        node={node}
        mode="scene"
        selected={selection.includes(node.id)}
        {...(crowded(node) ? { fidelity: "glyph" as const } : {})}
      />
    </SceneViewHost>
  ));

  return (
    <div
      ref={wrapperRef}
      className={`graview-ground${className ? ` ${className}` : ""}`}
      // From altitude the ground itself recedes; the theme reads this. The
      // attribute flips the non-animatable modes; the NUMBER is what the
      // grids, blocks and shadows actually ride, and it transitions — so
      // rising is a morph, not a cut.
      data-graview-altitude={view.overview ? "" : undefined}
      onPointerDown={onGroundDown}
      onPointerMove={onDragMove}
      onPointerUp={onDragUp}
      onPointerCancel={onDragUp}
      /*
       * CLICKING EMPTY GROUND puts the selection down — the gesture every
       * canvas tool teaches, and the graceful half of deselection the ×
       * and Escape were carrying alone. Only the bare ground: a card, a
       * control or a piece of chrome keeps its own meaning, and a drag
       * that ends on the ground is still a pan, not a deselection.
       */
      onClick={(event) => {
        if (swallow.current) return;
        const target = event.target as HTMLElement;
        if (target.closest("[data-graview-view], button, aside, a, input, select")) return;
        setSelection([]);
        setMenuAt(null);
      }}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        cursor: dragging ? "grabbing" : "grab",
        touchAction: "none",
        ["--graview-altitude" as string]: view.overview ? 1 : 0,
        ...(dragging ? { userSelect: "none" as const } : {}),

        // The stage is sized to the measurement, but a stale measurement
        // during a resize can briefly exceed it. Clipping keeps the scene
        // inside its own bounds instead of pushing the page taller and
        // cutting off anything floating over it.
        overflow: "hidden",
        ...style,
      }}
    >
      {useDom ? (
        /*
         * The DOM path uses an ORDINARY container, not a capture canvas.
         *
         * `layoutsubtree` exists so the GPU can capture these elements, and
         * it changes how the browser lays them out. Combining it with the CSS
         * transforms and filters this path applies crashes the renderer
         * process in Chromium 154 — silently, on first paint. Since the DOM
         * path never captures anything, the canvas has no job here, and not
         * creating one removes the whole interaction.
         */
        <div
          data-graview-stage="dom"
          style={{
            position: "relative",
            zIndex: 1,
            width: result.width,
            height: result.height,
            overflow: "hidden",
          }}
        >
          {hosts}
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          data-graview-stage="gpu"
          // The attribute form works before the property is available.
          {...{ layoutsubtree: "" }}
          width={result.width}
          height={result.height}
          style={{
            display: "block",
            position: "relative",
            zIndex: 1,
            width: result.width,
            height: result.height,
          }}
        >
          {hosts}
        </canvas>
      )}
      <Lines
        frame={frame}
        width={result.width}
        height={result.height}
        scheme={scheme}
        overview={view.overview ?? false}
        selection={selection}
        emphasis={emphasis}
        stageRef={wrapperRef}
        store={store}
        graphNodes={nodes}
        /*
         * A LINE IS A THING. Clicking one that stands for exactly one edge
         * selects the relation itself — the inspector then says what it is
         * and what may lawfully be done to it; right-click opens the same
         * actions at the pointer. Bundled lines stay scenery: "some of
         * these" is not an honest thing to act on.
         */
        onPickEdge={(edgeId, at) => {
          // A pan that happened to start on a line is a pan, not a pick.
          if (swallow.current) return;
          setSelection([edgeId]);
          setMenuAt(at ?? null);
        }}
        liveOf={(connector) => {
          /*
           * A relation PULSES where it was just made or broken.
           *
           * An edge write touches both of its ends, so a connector is live
           * exactly when both of the things it joins were written in the same
           * window — which is what making or breaking a relation looks like in
           * the log, and is not what changing one node's field looks like.
           */
          const from = activityOf(frame.nodes.find((node) => node.id === connector.from));
          const to = activityOf(frame.nodes.find((node) => node.id === connector.to));
          return from?.wrote && to?.wrote ? (from.at > to.at ? from : to) : undefined;
        }}
      />
      <RelationCaptions
        nodes={frame.nodes}
        scheme={scheme}
        width={result.width}
        stageRef={wrapperRef}
      />
      {children}
    </div>
  );
}

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
 * centre, so selecting the session lit three of its four drills and left
 * the fourth to a faint line from nowhere.
 */
function Lines<S extends AnySchema>({
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
}) {
  const [, remeasure] = useState(0);
  useLayoutEffect(() => {
    remeasure((n) => n + 1);
  }, [frame, selection, overview, graphNodes]);

  // Not memoised: it measures the DOM, and the DOM is what changed.
  const strands = connectorStrands(frame.nodes, frame.connectors, stageRef.current, overview, scheme);
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
 * the DOM — and run to whatever stands for each neighbour on screen: another
 * pick target in the same view, a raised card, or the kind card holding it
 * on the shelf. Item-level, not kind-level; and the kind cards say "N tied"
 * at the same moment, so the lines have destinations that answer back.
 *
 * Only for a DELIBERATE selection: a handful of things someone picked.
 * Selecting a whole place selects its population, and forty fans of edges is
 * a hairball, not an answer.
 */
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
}) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, selection, graphNodes, nodes]);

  if (ties.length === 0 || typeof document === "undefined") return null;
  const stage = stageRef.current?.getBoundingClientRect();
  if (!stage) return null;

  /*
   * The ELEMENT standing for an id, when the view drew one: a pick target,
   * or a board slot (an occupied slot's pick is its occupant, but the slot
   * itself is still a place a tie can land on).
   */
  type Box = { x: number; y: number; width: number; height: number };
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
  const elementBoxes = (id: string, insideOwnCard: (el: Element) => boolean): Box[] => {
    const els = stageRef.current?.querySelectorAll(
      `[data-graview-pick="${CSS.escape(id)}"], [data-graview-slot="${CSS.escape(id)}"]`,
    );
    const boxes: Box[] = [];
    for (const el of els ?? []) {
      if (el.closest("[data-graview-offstage]")) continue;
      if (insideOwnCard(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 2 || rect.height <= 2) continue;
      // A rotated header's bounding box is a huge diagonal rectangle whose
      // border is nowhere near the visible text — anything card-sized or
      // smaller stays; the degenerate stays out via the closest-pair pick
      // preferring compact boxes on ties below.
      boxes.push({ x: rect.left - stage.left, y: rect.top - stage.top, width: rect.width, height: rect.height });
    }
    // Compact drawings first, so a distance tie resolves to the chip, not
    // the panel that contains it.
    return boxes.sort((a, b) => a.width * a.height - b.width * b.height);
  };
  /** The laid-out node that IS this id, or stands for it. */
  const hostOf = (id: string): SceneNode | undefined =>
    nodes.find((node) => node.id === id) ??
    nodes.find((node) => node.aggregate?.memberIds.includes(id));

  const seen = new Set<string>();
  const lines: {
    key: string;
    kind: string;
    d: string;
    endX: number;
    endY: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
    control: { x: number; y: number };
    fromBox: { x: number; y: number; width: number; height: number };
    toBox: { x: number; y: number; width: number; height: number };
    /** The far end is a stand-in (the kind's district), not the thing. */
    proxy: boolean;
    edgeId: string | null;
  }[] = [];
  for (const tie of ties) {
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
     * 2. An element standing for it — but an element inside the selection's
     *    own card only counts when the origin is itself an element:
     *    chip-to-chip inside one view is the view's wiring made visible;
     *    whole-card-to-its-own-chip is the selection restating itself.
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
        ...elementBoxes(tie.other, (el) =>
          selfHostEl ? selfHostEl.contains(el) && !hasFromEl : false,
        ),
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
    lines.push({
      key: `${tie.kind}:${tie.self}:${tie.other}`,
      kind: tie.kind,
      d: `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`,
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
  if (lines.length === 0) return null;

  return (
    <svg
      // Decorative only while nothing inside takes the pointer; a pickable
      // relation must exist for assistive tech too.
      aria-hidden={lines.some((line) => line.edgeId) ? undefined : true}
      data-graview-ties={lines.length}
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
        zIndex: 3,
      }}
    >
      {lines.map((line) => {
        const style = connectorStyle(line.kind);
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
          const q = (t: number) => {
            const a = (1 - t) * (1 - t);
            const b = 2 * (1 - t) * t;
            const c = t * t;
            return {
              x: a * line.from.x + b * line.control.x + c * line.to.x,
              y: a * line.from.y + b * line.control.y + c * line.to.y,
            };
          };
          const points: { x: number; y: number }[] = [];
          for (let i = 0; i <= 40; i++) {
            const point = q(i / 40);
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
              d={line.d}
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
 * row under "who does the run" is an answer. Layout groups the neighbourhood
 * by edge kind, so each caption spans one contiguous run rather than
 * repeating itself once per card.
 */
/** Wide enough for a full edge description before anything is cut. */
const MIN_CAPTION = 300;

function RelationCaptions({
  nodes,
  scheme,
  width: stageWidth,
  stageRef,
}: {
  readonly nodes: readonly SceneNode[];
  readonly scheme: "light" | "dark";
  readonly width: number;
  readonly stageRef: { current: HTMLElement | null };
}) {
  const runs: { key: string; text: string; left: number; right: number; top: number }[] = [];
  for (const node of nodes) {
    if (!node.via || Math.round(node.plane) !== 1) continue;
    /*
     * Above the PANEL someone can see, not the band slot the layout allots:
     * a raised card centres its panel in a taller host, so a caption hung
     * from the host's top floated in open ground half a band above the
     * cards it captions.
     */
    const measured = measureVisible(stageRef.current, node.id, false);
    const { scale } = styleFor(1, scheme);
    const left = measured?.x ?? node.x;
    const right = measured ? measured.x + measured.width : node.x + node.width * scale;
    const top = measured?.y ?? node.y;
    const last = runs[runs.length - 1];
    if (last && last.key === node.via.edgeKind) {
      last.right = Math.max(last.right, right);
      last.top = Math.min(last.top, top);
      continue;
    }
    runs.push({
      key: node.via.edgeKind,
      text: node.via.description ?? node.via.edgeKind.replace(/-/g, " "),
      left,
      right,
      top,
    });
  }
  if (runs.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}
    >
      {runs.map((run) => {
        /*
         * The caption may be WIDER than the cards it captions.
         *
         * Constrained to the run, a single neighbour gave it about 240
         * pixels and "attends a block, or rides along on a run" was cut to
         * "attends a block, or rides alo…" — the schema's own words, the one
         * thing this element exists to show, truncated mid-word with empty
         * ground on both sides of it. It is centred over the run and clamped
         * to the stage instead, so it borrows the gutter when it needs it.
         */
        const mid = (run.left + run.right) / 2;
        const span = Math.max(run.right - run.left, MIN_CAPTION);
        const left = Math.max(4, Math.min(mid - span / 2, stageWidth - span - 4));
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
              fontSize: 10,
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

/**
 * What a click on a view selects.
 *
 * Selecting a GROUP selects its members, because a group is a view of a set
 * of nodes rather than a node itself — "select the People block" means the
 * people. Everything downstream then works unchanged: the affordance layer
 * sees a selection of real nodes and can say what is true about them.
 */
export function selectionFor(
  node: SceneNode,
  current: readonly string[],
  additive: boolean,
): string[] {
  const ids = node.aggregate ? [...node.aggregate.memberIds] : [node.id];
  if (!additive) return ids;
  const alreadyIn = ids.every((id) => current.includes(id));
  return alreadyIn
    ? current.filter((id) => !ids.includes(id))
    : [...current, ...ids.filter((id) => !current.includes(id))];
}

/**
 * The element's size, tracked. Returns null until it has been measured, so a
 * first render never lays out against a guess.
 */
function useElementSize(
  ref: { current: HTMLElement | null },
): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width === 0 || box.height === 0) return;
      // Round to whole pixels: a fractional width would recompute the layout
      // on every sub-pixel wobble and never settle.
      setSize((current) => {
        const next = { width: Math.round(box.width), height: Math.round(box.height) };
        return current && current.width === next.width && current.height === next.height
          ? current
          : next;
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

/**
 * A plane's elevation, in the idiom of its scheme.
 *
 * Dark separates by luminance, so one soft dark pool is right. Light
 * separates the way objects on a desk do — a tight contact shadow plus a
 * long diffuse one — so it gets both, and the further plane casts the
 * longer, weaker one.
 */
function planeShadow(shadow: number, scheme: "light" | "dark"): string {
  if (scheme === "dark") {
    return `0 ${(10 * shadow).toFixed(1)}px ${(34 * shadow).toFixed(1)}px rgba(0,0,0,${(shadow + 0.12).toFixed(2)})`;
  }
  const contact = `0 ${(1 + 2 * shadow).toFixed(1)}px ${(2 + 5 * shadow).toFixed(1)}px rgba(20,30,32,${(0.03 + 0.06 * shadow).toFixed(3)})`;
  const cast = `0 ${(6 + 26 * shadow).toFixed(1)}px ${(18 + 60 * shadow).toFixed(1)}px -${(10 + 10 * shadow).toFixed(1)}px rgba(20,30,32,${(0.1 + 0.3 * shadow).toFixed(3)})`;
  return `${contact}, ${cast}`;
}

function cssTransform(transform: Matrix4): string {
  // Column-major 4x4 into CSS matrix3d, which is also column-major.
  return `matrix3d(${transform.join(",")})`;
}

interface HostProps {
  readonly node: SceneNode;
  readonly useDom: boolean;
  readonly touched: boolean;
  /** Too narrow for its plane's fidelity; rendering its glyph instead. */
  readonly crowded?: boolean;
  /** What just happened here, if anything. Absent on a quiet graph. */
  readonly activity?: ActivityMark;
  readonly scheme: "light" | "dark";
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly selected: boolean;
  onSelect(additive: boolean): void;
  /** A view marked an inner element with `data-graview-pick`. */
  onPick(id: string, additive: boolean): void;
  /** The deliberate second gesture: go into the thing that was picked. */
  onTravel(id: string): void;
  /** Ask for the actions at a point, in viewport coordinates. */
  onMenu(at: { x: number; y: number }): void;
  /** The whole selection, so the keyboard can tell a first press from a second. */
  readonly selection: readonly string[];
  onJackIn(): void;
  /** Dragging a card pins it. The scene owns the gesture; the host reports it. */
  onDragStart(event: ReactPointerEvent<HTMLElement>): void;
  onDragMove(event: ReactPointerEvent<HTMLElement>): void;
  onDragEnd(): void;
  /** True for the instant after a drag, so the click it produces is ignored. */
  readonly swallowClick: { current: boolean };
  readonly children: ReactNode;
}

/**
 * One view's box. Absolutely positioned so the canvas can place it, and sized
 * so the capture texture matches the DOM exactly.
 */
function SceneViewHost({
  node,
  useDom,
  touched,
  crowded,
  activity,
  scheme,
  canvasWidth,
  canvasHeight,
  selected,
  onSelect,
  onPick,
  onTravel,
  onMenu,
  selection,
  onJackIn,
  onDragStart,
  onDragMove,
  onDragEnd,
  swallowClick,
  children,
}: HostProps) {
  // The tag's dot must agree with every other dot in a branded app.
  const { brand: hostBrand, store: hostStore } = useGraview();
  /*
   * The name a screen reader reads for this box: the group's plural, or the
   * node's own label — never the id, which is an address.
   */
  const hostName = node.aggregate
    ? node.aggregate.label
    : (() => {
        const graphNode = hostStore.graph.getNode(node.id);
        if (!graphNode) return node.id;
        return labelOf(hostStore.schema.tryDefinition(node.kind), graphNode as never);
      })();
  /*
   * The tag hugs the PANEL, not the band slot. A host flex-centres a
   * panel shorter than its slot, so a fixed top offset hung the tag in
   * open ground above the card it names — measured against the drawn
   * child instead, the same lesson every measured surface here learned.
   */
  const [tagAt, setTagAt] = useState<{ top: number; right: number } | null>(null);
  useLayoutEffect(() => {
    if (Math.round(node.plane) !== 0 || node.aggregate) return;
    const host = ref.current;
    const child = host?.firstElementChild as HTMLElement | null;
    if (!host || !child) return;
    const hostBox = host.getBoundingClientRect();
    const childBox = child.getBoundingClientRect();
    const next = {
      top: Math.round(childBox.top - hostBox.top) - 9,
      right: Math.round(hostBox.right - childBox.right) + 14,
    };
    setTagAt((current) =>
      current && current.top === next.top && current.right === next.right ? current : next,
    );
  });
  /*
   * A node's depth is its plane, pulled forward by however near it sits
   * within that plane.
   *
   * Mid-transition a plane is already fractional so the treatment is mixed
   * rather than snapping, and `depth` uses the same machinery: a card at the
   * near end of the arc is treated as 1.6 planes back rather than 2, which is
   * what makes the arc curve away instead of lying flat.
   */
  const at = node.plane - (1 - (node.depth ?? 1)) * 0.55;
  const lower = Math.max(0, Math.min(2, Math.floor(at))) as 0 | 1 | 2;
  const upper = Math.max(0, Math.min(2, Math.ceil(at))) as 0 | 1 | 2;
  const style =
    lower === upper
      ? styleFor(lower, scheme)
      : mixStyles(styleFor(lower, scheme), styleFor(upper, scheme), at - lower);
  const transform = transformFor(style, node.x, node.y, canvasWidth, canvasHeight);
  const ref = useRef<HTMLDivElement | null>(null);
  usePickTargets(ref);

  /*
   * A view drawn smaller than it was designed for is SCALED, not re-solved.
   *
   * When the layout gives a node a natural size, the view lays itself out at
   * that size and the whole result is transformed down into the slot. That is
   * the same picture, smaller — which is what a captured texture would do on
   * the GPU path anyway, and what keeps the shrunk interface an interface:
   * every pick target inside it is still a real target, because nothing here
   * is an image.
   *
   * Rendering into the slot instead is what broke it: a coverage matrix asked
   * to lay itself out in a third of its width piled its rotated column
   * headers into a corner and clipped its rows.
   */
  const natural = node.natural;
  const shrink = natural
    ? Math.min(node.width / natural.width, node.height / natural.height)
    : 1;

  const domOnly: CSSProperties = useDom
    ? {
        transform: cssTransform(transform),
        transformOrigin: "0 0",
        filter: style.blur > 0 ? `blur(${style.blur}px)` : undefined,
        // Recession dims toward the ground; entering and leaving nodes carry
        // their own fade on top of it.
        opacity: (1 - style.falloff * 0.55) * (node.opacity ?? 1),
        /*
         * Depth is handed DOWN as the elevation token, not painted on the
         * host.
         *
         * A host box-shadow outlines the box the layout allotted, which is
         * only the same shape as the view when the view fills it. Once a
         * detail panel sized to its own content, every focused node picked
         * up a large ghost rectangle behind it. Setting the token means the
         * panel casts the plane's shadow from its own edges — and any view
         * built on `Panel` gets it without knowing planes exist.
         */
        ["--graview-lift-low" as string]: planeShadow(style.shadow, scheme),
      }
    : // The GPU path does NOT fade the host: the shader owns opacity there,
      // and applying it in both places made an entering view fade as
      // opacity² — visibly faster and dimmer than the DOM path, so the two
      // renderers disagreed about the same transition. It also meant a view
      // captured mid-fade baked its own transparency into the texture.
      {};

  return (
    <div
      ref={ref}
      data-graview-view={node.id}
      data-graview-plane={Math.round(node.plane)}
      data-graview-selected={selected || undefined}
      data-graview-touched={touched || undefined}
      /*
       * A card drawn deliberately BEHIND another says so in the tree.
       *
       * Two boxes overlapping is either a tuck or a collision, and from the
       * outside those look identical — which is how a fan of six illegible
       * slivers went unnoticed while every automated check reported the
       * screen clean. Stating the intent is what lets a checker tell them
       * apart, and lets a person reading the tree know which it is.
       */
      data-graview-nested={node.nestedUnder ?? undefined}
      data-graview-crowded={crowded || undefined}
      /*
       * A card YOU put there says so. The layout already knows — a pin wins
       * over the computed position — and without the mark there is no way to
       * tell a card that was dragged from one the layout happened to put in
       * the same place, which is the difference between a scene you arranged
       * and a scene that looks slightly wrong.
       */
      data-graview-pinned={node.pinned || undefined}
      /*
       * Activity, stated as attributes rather than as inline styles.
       *
       * It is the theme's job to decide what "an agent read this" looks like,
       * and a stylesheet animation runs once and stops — which is how
       * watching costs nothing on a quiet graph. There is no frame loop here
       * and nothing to tick.
       */
      data-graview-activity={activity ? activity.manner : undefined}
      data-graview-wrote={activity?.wrote || undefined}
      data-graview-read={activity && !activity.wrote ? true : undefined}
      data-graview-broke={activity?.broke || undefined}
      /*
        * "Open X" only where clicking raises X. On plane 0 the group IS what
        * you are looking at, so the tooltip promised something clicking does
        * not do — and it shadowed the more specific titles a view puts on its
        * own contents.
        */
      /*
       * While something is happening here, the tooltip says WHAT — the
       * intent the op recorded, in the app's own words. Watching should not
       * require opening the activity list to find out what the light meant.
       */
      title={
        activity
          ? `${WHO[activity.manner]} ${activity.wrote ? "changed this" : "read this"}: ${activity.intent}`
          : node.aggregate && Math.round(node.plane) !== 0
            ? `Open ${node.aggregate.label}`
            : undefined
      }
      role="group"
      /*
       * A CARD IS NAMED WHAT IT SAYS IT IS.
       *
       * A district had its plural and a record had its id, so the whole
       * accessibility tree of a populated scene read "item:buy-milk" while
       * the card in front of you said "Buy milk". An id is an address, not a
       * name; the label comes from the declaration, the same `label(node)`
       * every heading, chip and crumb reads. An id with no node behind it
       * (mid-removal) keeps the address, which is at least true.
       */
      aria-label={hostName}
      tabIndex={0}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onClick={(event) => {
        // A drag that ends on a card must not also select it.
        if (swallowClick.current) return;
        const additive = event.metaKey || event.shiftKey;
        /*
         * A view may nominate its own inner targets.
         *
         * Any element carrying `data-graview-pick="<node id>"` is a real
         * thing in the graph, and clicking it means that thing — not the
         * view that happens to be drawing it. One rule, in one place, and
         * every view gets it: a span in the calendar, a row in a roster, a
         * chip in a summary.
         *
         * Without this, clicking an event in the week could only ever mean
         * "the week", which is why clicking an event appeared to do nothing.
         */
        const picked = pickedFrom(event.target);
        if (picked && picked !== node.id) {
          event.stopPropagation();
          onPick(picked, additive);
          return;
        }
        onSelect(additive);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const picked = pickedFrom(event.target);
        event.preventDefault();
        event.stopPropagation();
        /*
         * THE CARD ITSELF ANSWERS THE KEYBOARD.
         *
         * It was a tab stop that did nothing: the handler returned unless the
         * key had landed on an inner pick target, on the grounds that the
         * host "has its own meaning" — which was true, and reachable only
         * with a pointer. On a blank app that is the whole of it. The one
         * district is the only thing on screen, selecting it is what opens
         * the strip, and the strip is where the first act lives, so a
         * keyboard alone could not add the first record to a new product.
         *
         * Enter on the host does what a click on it does; Enter again on a
         * card already selected alone does what the second click does — the
         * same two-step the inner targets have.
         */
        if (!picked || picked === node.id) {
          const already = selection.length === 1 && selection[0] === node.id;
          if (already && !event.metaKey && !event.shiftKey) onJackIn();
          else onSelect(event.metaKey || event.shiftKey);
          return;
        }
        /*
         * Enter selects; Enter again on something already selected alone
         * travels. The keyboard needs the same two-step the pointer has, and
         * a modifier would have been a worse answer than repeating yourself.
         */
        const already = selection.length === 1 && selection[0] === picked;
        if (already && !event.metaKey && !event.shiftKey) onTravel(picked);
        else onPick(picked, event.metaKey || event.shiftKey);
      }}
      onContextMenu={(event) => {
        const picked = pickedFrom(event.target);
        event.preventDefault();
        event.stopPropagation();
        /*
         * Right-click SELECTS, always — through onPick, never onSelect,
         * because onSelect's kind-card branch toggles the raised relation
         * and returns without selecting, which opened a menu about nothing
         * (and quietly raised People on the way).
         */
        onPick(picked && picked !== node.id ? picked : node.id, false);
        onMenu({ x: event.clientX, y: event.clientY });
      }}
      onDoubleClick={(event) => {
        const picked = pickedFrom(event.target);
        if (picked && picked !== node.id) {
          event.stopPropagation();
          onTravel(picked);
          return;
        }
        onJackIn();
      }}
      style={{
        position: "absolute",
        /*
         * On the capture path the host is OUT of hit-testing entirely.
         *
         * This is the fix for the defect that kept the GPU path off by
         * default. It was recorded as "a click crashes the renderer process",
         * and that was a symptom rather than the cause: bisected in Chromium
         * 154, a plain HOVER over a captured view brings the process down just
         * as reliably, while selecting the same node from the keyboard does
         * not. What is fatal is the browser's own hit-test descending into a
         * `layoutsubtree` canvas child.
         *
         * Nothing is lost by removing it. `updateElementGeometry` does not
         * redirect hit-testing in this build, so a DOM hit-test on a captured
         * view was already returning the wrong answer — it reported the box
         * where the element was LAID OUT rather than where it was DRAWN, which
         * is why `PointerRouter` exists at all. The compositor already runs one
         * on the canvas; this stops the platform racing it into a crash.
         *
         * Keyboard reach and the accessibility tree are untouched:
         * `pointer-events` says nothing about focus, and the views stay real,
         * focusable DOM.
         *
         * On the DOM path the theme narrows the host's hit area to its drawn
         * content (`[data-graview-stage="dom"] [data-graview-view]`): the
         * box is the layout's, the target is the view's.
         */
        ...(useDom ? {} : { pointerEvents: "none" as const }),
        // Each host sits at its own layout position, on BOTH paths.
        //
        // Under `layoutsubtree` every child is laid out at the canvas origin,
        // so hosts pinned to 0,0 pile up on each other and only some of them
        // end up with usable paint records — five views captured completely
        // blank because of it. Giving each its own box keeps them distinct
        // for the capture. The GPU still draws each wherever its plane
        // transform says; this only decides what gets rasterised.
        // Nearer planes paint over further ones — and an OPENED district
        // comes to the front outright: its roster grows over whatever is
        // beside it, and a chip half-hidden behind the live view is a chip
        // nobody can press.
        zIndex: node.opened ? 11 : 10 - Math.round(node.plane),
        left: useDom ? 0 : Math.round(node.x),
        top: useDom ? 0 : Math.round(node.y),
        // Whole pixels, matching what the renderer allocates a texture for.
        // A host of height 399.4 rasterises into 400 rows; a texture sized
        // from the rounded 399 rejects the copy, and the view keeps whatever
        // was in the texture before — silently.
        width: Math.round(node.width),
        height: Math.round(node.height),
        boxSizing: "border-box",
        // A view that sizes to its content is centred in the box the layout
        // gave it, rather than pinned to the top with the remainder left as
        // dead white space.
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        ...domOnly,
      }}
    >
      {natural ? (
        /*
         * Centred on the slot and scaled about its own middle, so the
         * proportions the view chose survive a slot that does not share them.
         * `position: absolute` keeps the natural box out of the host's flow —
         * it must not be able to push the host's own geometry around, since
         * the capture allocates a texture from that.
         */
        <div
          data-graview-natural={`${Math.round(natural.width)}x${Math.round(natural.height)}`}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: natural.width,
            height: natural.height,
            transform: `translate(-50%, -50%) scale(${shrink})`,
            transformOrigin: "50% 50%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </div>
      ) : (
        children
      )}
      {/*
        * WHAT KIND OF THING THIS IS, said on the thing. The one thread that
        * runs through every Graview surface is the kind — its hue in every
        * chip's dot, its name in the legend — and the focus panel was the
        * one place it went unsaid: a person's page that never says
        * "person". The tag sits astride the panel's top-right edge, scene
        * chrome rather than view content, so no view has to remember it.
        */}
      {Math.round(node.plane) === 0 && !node.aggregate ? (
        <span
          data-graview-kindtag=""
          className="graview-kind-tag"
          aria-hidden="true"
          style={{
            ...(tagAt ?? {}),
            ["--graview-hue" as string]: Math.round(
              hueFor(node.kind, hostBrand?.accents) * 360,
            ),
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              flex: "0 0 auto",
              background: `hsl(${Math.round(hueFor(node.kind, hostBrand?.accents) * 360)} 55% var(--graview-tint-lightness) / 0.9)`,
            }}
          />
          {node.kind}
        </span>
      ) : null}
    </div>
  );
}

/** How each manner reads in words, for the tooltip and for assistive tech. */
const WHO: Record<Manner, string> = {
  directed: "You",
  autonomous: "An agent",
  "co-edited": "You and an agent",
  rule: "A rule",
};

/**
 * A selection, mapped onto what is actually DRAWN.
 *
 * The selection holds real node ids. A connector holds the ids of whatever is
 * on screen — which above the stack is always a kind card, because
 * `connectorsFor` resolves every endpoint through the nearest group that
 * contains it. Comparing the two directly matched nothing, so any ordinary
 * selection carried into the Graview receded every line at once and blanked
 * the picture you rose to look at.
 *
 * Exported because it is the whole of that bug, and a pure function is the
 * only way to hold it still.
 */
export function onScreen(
  nodes: readonly SceneNode[],
  selection: readonly string[],
): ReadonlySet<string> {
  const drawn = new Set(nodes.map((node) => node.id));
  const chosen = new Set<string>();
  for (const id of selection) {
    if (drawn.has(id)) {
      chosen.add(id);
      continue;
    }
    // Not drawn as itself: the card standing for it is what the eye can see,
    // and what a connector to it actually points at.
    const container = nodes.find((node) => node.aggregate?.memberIds.includes(id));
    if (container) chosen.add(container.id);
  }
  return chosen;
}

/** A node's box as DRAWN, after its plane's scale — anchored at its top-left. */
function drawnBox(
  node: SceneNode | undefined,
  scheme: "light" | "dark",
): { x: number; y: number; width: number; height: number } | null {
  if (!node) return null;
  const lower = Math.max(0, Math.min(2, Math.floor(node.plane))) as 0 | 1 | 2;
  const upper = Math.max(0, Math.min(2, Math.ceil(node.plane))) as 0 | 1 | 2;
  const { scale } =
    lower === upper
      ? styleFor(lower, scheme)
      : mixStyles(styleFor(lower, scheme), styleFor(upper, scheme), node.plane - lower);
  return { x: node.x, y: node.y, width: node.width * scale, height: node.height * scale };
}

/**
 * The box a person can SEE for a laid-out node, measured from the DOM.
 *
 * A host is a band slot with the view somewhere inside it — the focus band
 * pokes above its panel, a shrunk view centres in a taller natural box, and
 * from altitude the visible thing is the iso block at the bottom of the
 * card. Lines anchored to host borders ended in open air on every one of
 * those; lines anchored to the measured inner box end on the thing itself.
 * Null when there is no DOM to measure (tests, SSR) — callers fall back to
 * the layout box.
 */
function measureVisible(
  stageEl: HTMLElement | null,
  id: string,
  preferBlock: boolean,
): { x: number; y: number; width: number; height: number } | null {
  if (!stageEl || typeof document === "undefined") return null;
  const host = stageEl.querySelector(`[data-graview-view="${CSS.escape(id)}"]`);
  if (!host) return null;
  const inner =
    (preferBlock ? host.querySelector(".graview-kind-block") : null) ??
    host.querySelector('[data-graview-primitive="panel"], .graview-kind-face, .graview-kind-card') ??
    host;
  const rect = inner.getBoundingClientRect();
  if (rect.width <= 2 || rect.height <= 2) return null;
  const stage = stageEl.getBoundingClientRect();
  return { x: rect.left - stage.left, y: rect.top - stage.top, width: rect.width, height: rect.height };
}

/** The centre of a node's box as DRAWN, after its plane's scale. */
function drawnCentre(
  node: SceneNode | undefined,
  scheme: "light" | "dark",
): { x: number; y: number } | null {
  const box = drawnBox(node, scheme);
  return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
}

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
type Box = { x: number; y: number; width: number; height: number };

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
  /**
   * The cards an end is drawn INSIDE, when it lands on a member: the line
   * is visible across them (that is what landing on a member means), but
   * its hit stroke is not, so a line to Ravi never takes a click meant
   * for June above him.
   */
  readonly hosts: readonly Box[];
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
): Box[] {
  if (!stageEl || !host || typeof document === "undefined") return [];
  const stage = stageEl.getBoundingClientRect();
  const boxes: Box[] = [];
  const selector =
    `[data-graview-pick="${CSS.escape(memberId)}"], [data-graview-slot="${CSS.escape(memberId)}"]`;
  for (const el of host.querySelectorAll(selector)) {
    if (el.closest("[data-graview-offstage]")) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 2 || rect.height <= 2) continue;
    boxes.push({
      x: rect.left - stage.left,
      y: rect.top - stage.top,
      width: rect.width,
      height: rect.height,
    });
  }
  return boxes.sort((a, b) => a.width * a.height - b.width * b.height);
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
  const obstaclesFor = (a: string, b: string): Box[] => {
    const out: Box[] = [];
    for (const [id, box] of boxes) if (id !== a && id !== b) out.push(box);
    return out;
  };

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
          (edge.from !== connector.from && memberBoxes(stageEl, hostOf(connector.from), edge.from).length > 0) ||
          (edge.to !== connector.to && memberBoxes(stageEl, hostOf(connector.to), edge.to).length > 0),
      );
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
      });
      continue;
    }
    const groups = new Map<
      string,
      { edges: { from: string; to: string }[]; fromBox: Box; toBox: Box; fromAnchor: string; toAnchor: string }
    >();
    for (const edge of edges) {
      const fromCandidates =
        edge.from === connector.from ? [] : memberBoxes(stageEl, hostOf(connector.from), edge.from);
      const toCandidates =
        edge.to === connector.to ? [] : memberBoxes(stageEl, hostOf(connector.to), edge.to);
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
function Connectors({
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
  };
  scheme: "light" | "dark";
}) {
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
  const drawn = strands.map((strand) => {
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
        const style = connectorStyle(connector.kind);
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
        const curve: Quadratic = { p0: from, c: { x: midX + nx * bow, y: midY + ny * bow }, p1: to };
        /*
         * The visible runs: out of the box it starts in, into the box it
         * ends in, and under any card it crosses between. A line with no
         * run in the open — one drawing inside another — has nothing
         * honest to show.
         */
        const runs = self ? [] : clipQuadratic(curve, [fromBox, toBox, ...strand.obstacles]);
        if (!self && runs.length === 0) return null;
        const quad = (segments: Quadratic[]) =>
          segments
            .map((run) => `M ${run.p0.x} ${run.p0.y} Q ${run.c.x} ${run.c.y} ${run.p1.x} ${run.p1.y}`)
            .join(" ");
        const loopD =
          // An arc that leaves and returns: two arcs of the same
          // circle, so it closes cleanly at any size.
          `M ${anchor.x - radius} ${anchor.y} A ${radius} ${radius} 0 1 1 ${anchor.x + radius} ${anchor.y}` +
          ` A ${radius} ${radius} 0 0 1 ${anchor.x - radius} ${anchor.y}`;
        const d = self ? loopD : quad(runs);
        // The hit stroke also keeps out of the cards an end is drawn inside.
        const hitD = self
          ? loopD
          : quad(clipQuadratic(curve, [fromBox, toBox, ...strand.hosts, ...strand.obstacles]));
        const only = strand.edges.length === 1 ? strand.edges[0]! : null;
        const edgeId = only ? edgeSelectionId(connector.kind, only.from, only.to) : null;
        const edgeChosen = edgeId !== null && selection.includes(edgeId);
        const lit =
          !overview &&
          chosenReal.size > 0 &&
          strand.edges.some((edge) => chosenReal.has(edge.from) || chosenReal.has(edge.to));
        const stressed = (emphasis !== null && connector.kind === emphasis) || edgeChosen;
        const opacity = overview
          ? emphasis !== null
            ? stressed
              ? 0.95
              : 0.08
            : touches(connector)
              ? 0.9
              : 0.12
          : edgeChosen
            ? 0.9
            : lit
              ? 0.78
              : style.opacity * 0.34;
        /*
         * A lit line MARKS ITS FAR END, as a tie does: the destination is
         * where the eye is being sent, and a dot says the line lands on
         * something specific rather than trailing off.
         */
        const far =
          lit && runs.length > 0
            ? strand.edges.some((edge) => chosenReal.has(edge.from))
              ? runs[runs.length - 1]!.p1
              : runs[0]!.p0
            : null;
        const line = (
          <g key={strand.key}>
            <path
              data-graview-connector={connector.kind}
              data-graview-edges={strand.edges.length}
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
          zIndex: 2,
        }}
      >
        {drawn.map((piece) => piece?.line)}
      </svg>
      {drawn.some((piece) => piece?.hit) ? (
        <svg
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
            zIndex: 4,
          }}
        >
          {drawn.map((piece) => piece?.hit)}
        </svg>
      ) : null}
    </>
  );
}

export interface ResolvedViewProps<S extends AnySchema> {
  readonly node: SceneNode;
  readonly mode: ViewMode;
  readonly selected: boolean;
  /** Overrides the fidelity the plane would ask for. Jack-in uses this. */
  readonly fidelity?: Fidelity;
}

/**
 * Picks the view for a cell of the matrix — cardinality by whether this is an
 * aggregate, fidelity by plane depth — and renders it.
 *
 * A kind with no registered view falls back to the primitive the app
 * supplied, which is why a new node kind renders sensibly before anyone
 * writes a view for it.
 */
export function ResolvedView<S extends AnySchema>({
  node,
  mode,
  selected,
  fidelity,
}: ResolvedViewProps<S>) {
  const { store, views } = useGraview<S>();
  const implicated = useImplicated();
  const flagged = useFlagged();
  const cardinality =
    node.aggregate || isAggregateId(node.id) || kindOfCard(node.id) !== null ? "many" : "one";
  const cell = {
    cardinality,
    fidelity: fidelity ?? PLANE_STYLES[clampPlane(node.plane)].fidelity,
  } as const;

  const registration = views.resolve(node.kind, cell);
  const Component = registration?.view as ViewComponent<S> | undefined;
  // Whether this kind has a picture of its own to travel into.
  const own = views.resolve(node.kind, { cardinality: "many", fidelity: "full" })?.view as
    | (ViewComponent<S> & { generic?: boolean })
    | undefined;
  const hasOwnView = own !== undefined && own.generic !== true;

  const props: ViewProps<S> = {
    ...(node.aggregate
      ? {
          nodes: node.aggregate.memberIds
            .map((id) => store.graph.getNode(id))
            .filter((n): n is NodeOfSchema<S> => n !== undefined),
          // A titled registration names the picture; the plural is the fallback.
          label: registration?.title ?? node.aggregate.label,
        }
      : { node: store.graph.getNode(node.id) as never }),
    fidelity: cell.fidelity,
    cardinality: cell.cardinality,
    mode,
    selected,
    implicated,
    flagged,
    ...(node.raised ? { raised: true } : {}),
    ...(node.focused ? { focused: true } : {}),
    ...(node.opened ? { opened: true } : {}),
    ...(node.aggregate?.retired ? { retired: node.aggregate.retired } : {}),
    ...(node.rank ? { rank: node.rank } : {}),
    ...(node.nestedUnder ? { nestedUnder: node.nestedUnder } : {}),
    ...(hasOwnView ? { hasOwnView: true } : {}),
  };

  if (!Component) return <MissingView node={node} props={props} />;
  return (
    <ViewModeProvider mode={mode}>
      <Component {...props} />
    </ViewModeProvider>
  );
}

function clampPlane(plane: number): 0 | 1 | 2 {
  return Math.max(0, Math.min(2, Math.round(plane))) as 0 | 1 | 2;
}

/**
 * What a kind with no view looks like. Deliberately readable rather than
 * apologetic: an undecorated node is a legitimate state during development,
 * and it should still say what it is.
 */
function MissingView<S extends AnySchema>({
  node,
  props,
}: {
  node: SceneNode;
  props: ViewProps<S>;
}) {
  return (
    <div style={{ padding: 8, font: "13px/1.4 system-ui", overflow: "hidden" }}>
      <strong>{props.label ?? node.kind}</strong>
      {props.nodes ? <div>{props.nodes.length} items</div> : <div>{node.id}</div>}
    </div>
  );
}
