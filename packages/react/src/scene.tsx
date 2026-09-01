import type { AnySchema, Fidelity, NodeOfSchema } from "@graview/core";
import {
  isAggregateId,
  kindOfCard,
  kindsOf,
  layout,
  withFocus,
  withPan,
  withPin,
  withRelation,
  type InterpolatedLayout,
  type Layout,
  type LayoutNode,
  type LayoutOptions,
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
} from "@graview/render";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useActivity, type ActivityMark, type Manner } from "./activity.js";
import { useAnimatedLayout, useTouched } from "./animation.js";
import { useFlagged, useImplicated } from "./hooks.js";
import { useGraph, useGraview, ViewModeProvider, type ViewMode } from "./context.js";
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
    setJackedIn,
    setMenuAt,
    bottomInset,
  } = useGraview<S>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(wrapperRef);

  // `nodes` is a cached snapshot that only changes when the graph does, so
  // the layout is recomputed exactly when the picture could have changed.
  const nodes = useGraph<S>();
  // The scene is laid out to the space it actually has. A fixed canvas leaves
  // dead ground on a wide screen and clips on a narrow one, and the plane
  // bands are proportions rather than pixels, so they follow.
  const sized = useMemo<LayoutOptions>(
    () => ({
      ...options,
      ...(size
        ? {
            width: size.width,
            /*
             * The height the scene actually HAS, not the height of its box.
             *
             * Chrome that floats over the bottom — the actions strip — takes
             * real estate the layout was still handing out, and the context
             * plane's cards land at 98.5% of the height. So selecting
             * anything put the strip on top of the row of kinds. Laying out
             * into the remaining height moves the cards up instead, and the
             * transition already tweens, so they slide rather than jump.
             *
             * Floored well above zero: a badly-measured or enormous piece of
             * chrome must not be able to collapse the scene to nothing.
             */
            height: Math.max(size.height * 0.55, size.height - bottomInset),
          }
        : {}),
    }),
    [options, size, bottomInset],
  );
  const result = useMemo<Layout>(
    () => layout(store.graph, store.schema, view, sized),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, view, sized, nodes],
  );

  // The picture as it is right now, part-way between the last view and this
  // one. Everything downstream draws the tween, not the destination.
  const frame = useAnimatedLayout(result, { enabled: animate });
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
  const [dragging, setDragging] = useState(false);

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

  const hosts = frame.nodes.map((node) => (
    <SceneViewHost
      key={node.id}
      node={node}
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
      onJackIn={() => setJackedIn(node.id)}
      onDragStart={(event) => onCardDown(node, event)}
      onDragMove={onDragMove}
      onDragEnd={onDragUp}
      swallowClick={swallow}
    >
      <ResolvedView node={node} mode="scene" selected={selection.includes(node.id)} />
    </SceneViewHost>
  ));

  return (
    <div
      ref={wrapperRef}
      className={`graview-ground${className ? ` ${className}` : ""}`}
      onPointerDown={onGroundDown}
      onPointerMove={onDragMove}
      onPointerUp={onDragUp}
      onPointerCancel={onDragUp}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        cursor: dragging ? "grabbing" : "grab",
        touchAction: "none",
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
      <Connectors
        result={frame}
        above={!useDom}
        scheme={scheme}
        overview={view.overview ?? false}
        selection={selection}
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
      <RelationCaptions nodes={frame.nodes} scheme={scheme} width={result.width} />
      {children}
    </div>
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
}: {
  readonly nodes: readonly SceneNode[];
  readonly scheme: "light" | "dark";
  readonly width: number;
}) {
  const runs: { key: string; text: string; left: number; right: number; top: number }[] = [];
  for (const node of nodes) {
    if (!node.via || Math.round(node.plane) !== 1) continue;
    const { scale } = styleFor(1, scheme);
    const left = node.x;
    const right = node.x + node.width * scale;
    const top = node.y;
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
      aria-label={node.aggregate ? node.aggregate.label : node.id}
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
        // Only when the key landed on an inner target; the host itself is
        // reached by Tab and has its own meaning.
        if (!picked || picked === node.id) return;
        event.preventDefault();
        event.stopPropagation();
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
        if (picked && picked !== node.id) onPick(picked, false);
        else onSelect(false);
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
        // Nearer planes paint over further ones, so the focus reaching down
        // over the arc reads as in front of it rather than as a collision.
        zIndex: 10 - Math.round(node.plane),
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

/** The centre of a node's box as DRAWN, after its plane's scale. */
function drawnCentre(
  node: SceneNode | undefined,
  scheme: "light" | "dark",
): { x: number; y: number } | null {
  if (!node) return null;
  const lower = Math.max(0, Math.min(2, Math.floor(node.plane))) as 0 | 1 | 2;
  const upper = Math.max(0, Math.min(2, Math.ceil(node.plane))) as 0 | 1 | 2;
  const { scale } =
    lower === upper
      ? styleFor(lower, scheme)
      : mixStyles(styleFor(lower, scheme), styleFor(upper, scheme), node.plane - lower);
  return { x: node.x + (node.width * scale) / 2, y: node.y + (node.height * scale) / 2 };
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
  result,
  above,
  scheme,
  overview,
  selection,
  liveOf,
}: {
  readonly overview: boolean;
  /** So a chosen kind's relations can stand out from the rest. */
  readonly selection: readonly string[];
  /** What just happened to this relation, if anything. */
  liveOf?: (connector: { from: string; to: string }) => ActivityMark | undefined;
  result: {
    nodes: readonly SceneNode[];
    connectors: Layout["connectors"] | InterpolatedLayout["connectors"];
    width: number;
    height: number;
  };
  /** The GPU canvas is opaque, so connectors have to sit over it, not under. */
  above: boolean;
  scheme: "light" | "dark";
}) {
  const byId = new Map(result.nodes.map((node) => [node.id, node]));
  const centre = (node: SceneNode | undefined) => drawnCentre(node, scheme);
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
   * A connector must touch a RAISED node, and must not end on a receded
   * GROUP.
   *
   * "Touches plane 1" alone was too loose: a person belongs to half the
   * context groups, so raising one drew a fan of long curves down to Blocks,
   * Runs and Agreements. A line into a group of nine says "some of these",
   * which is not a relationship anyone can read — while a line to a real
   * node on plane 2, like the run a person drives, says something exact.
   */
  const connectors = result.connectors.filter((connector) => {
    const from = byId.get(connector.from);
    const to = byId.get(connector.to);
    if (!from || !to) return false;
    /*
     * Above the stack, every relation earns its ink: the shape of the domain
     * IS the content, and a line into a group is no longer vague because a
     * group is what the ring is made of.
     */
    if (overview) return true;
    const raised = Math.round(from.plane) === 1 || Math.round(to.plane) === 1;
    const vagueEnd = (node: SceneNode) => node.aggregate && Math.round(node.plane) === 2;
    return raised && !vagueEnd(from) && !vagueEnd(to);
  });
  if (connectors.length === 0) return null;
  return (
    <svg
      aria-hidden="true"
      width={result.width}
      height={result.height}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
        // Behind the views on the DOM path, where the stage is transparent
        // and a relationship should not compete with what it connects. Above
        // on the GPU path, where the canvas clears to the ground colour and
        // anything beneath it is simply painted over.
        zIndex: above ? 2 : 0,
      }}
    >
      {connectors.map((connector) => {
        // Endpoints are recomputed against the DRAWN boxes, not layout's own
        // centres: a plane scales its box in place, so a receded node's centre
        // is not where layout's unscaled box says it is. Using layout's
        // coordinates here sent every connector to a point off the canvas.
        const from = centre(byId.get(connector.from));
        const to = centre(byId.get(connector.to));
        if (!from || !to) return null;
        /*
         * A LOOP, where both ends are the same card.
         *
         * "A task waits for a task" is a real fact about the domain and the
         * constellation is exactly where you would look for it — but as a line
         * it has zero length. Drawn as an arc leaving the card's top and
         * returning to its right, which is how every graph drawing has shown a
         * self-relation for fifty years.
         */
        const self = (connector as { loop?: boolean }).loop === true;
        // Stroke treatment is derived from the edge kind, so `protects` can
        // never be mistaken for `assigned-to`.
        const style = connectorStyle(connector.kind);
        const box = byId.get(connector.from);
        const radius = self && box ? Math.max(22, Math.min(box.width, box.height) * 0.3) : 0;
        /*
         * The loop SITS ON the card's top edge, off to the right.
         *
         * Centred it drew a ring straight through the card's own name; pushed
         * clear of the corner it became a circle floating in the ground next
         * to a card, which from the Graview read as a stray mark rather than
         * as a relation belonging to anything. Overlapping the edge by a few
         * pixels is what makes it hang off the card instead of near it.
         */
        const anchor =
          self && box
            ? { x: from.x + box.width * 0.22, y: from.y - box.height / 2 - radius + 7 }
            : from;
        // A gentle curve, bowed along the dominant axis. Straight lines
        // between distant planes read as lasers crossing the scene; a curve
        // reads as a relationship and lets several of them stay apart.
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const bow = Math.min(90, Math.hypot(to.x - from.x, to.y - from.y) * 0.16);
        const control =
          Math.abs(to.y - from.y) > Math.abs(to.x - from.x)
            ? `${midX + bow} ${midY}`
            : `${midX} ${midY - bow}`;
        return (
          <path
            key={connector.id}
            data-graview-connector={connector.kind}
            data-graview-activity={liveOf?.(connector)?.manner}
            d={
              self
                ? // An arc that leaves and returns: two arcs of the same
                  // circle, so it closes cleanly at any size.
                  `M ${anchor.x - radius} ${anchor.y} A ${radius} ${radius} 0 1 1 ${anchor.x + radius} ${anchor.y}` +
                  ` A ${radius} ${radius} 0 0 1 ${anchor.x - radius} ${anchor.y}`
                : `M ${from.x} ${from.y} Q ${control} ${to.x} ${to.y}`
            }
            fill="none"
            stroke={connectorStroke(style)}
            /*
             * Above the stack the LINES ARE THE CONTENT.
             *
             * Inside the scene a connector is an aside — it says how the thing
             * you are looking at is caught up in something else, and drawing
             * it loudly would compete with the thing itself. From the Graview
             * the shape of the domain IS the subject, and at a third of an
             * already-receded plane's opacity it was a set of cards floating
             * in nothing, which answers none of the question you rose to ask.
             */
            strokeWidth={connectorWidth(style, overview)}
            strokeDasharray={CONNECTOR_DASH[style.pattern]}
            strokeLinecap="round"
            opacity={
              (overview ? (touches(connector) ? 0.9 : 0.12) : style.opacity * 0.34) *
              ((connector as { opacity?: number }).opacity ?? 1)
            }
          />
        );
      })}
    </svg>
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
          label: node.aggregate.label,
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
