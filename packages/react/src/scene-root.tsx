import { beginning, toIso, touchWeights } from "@graview/core";
import type { AnySchema } from "@graview/core";
import {
  aggregateId,
  cameraLimit,
  panForZoom,
  kindOfCard,
  kindsOf,
  layout,
  withFocus,
  withOverview,
  withPan,
  withPin,
  panLayout,
  withRelation,
  type InterpolatedLayout,
  type Layout,
  type LayoutNode,
  type LayoutOptions,
  withJackIn,
  holdLayout,
  isBandAggregate,
  toggleExpanded,
  withWithin,
} from "@graview/layout";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useActivity, type ActivityMark } from "./activity.js";
import { useAnimatedLayout, useSeatWork, useTouched } from "./animation.js";
import { SeatMarks } from "./seat-marks.js";
import { useViolations } from "./hooks.js";
import { useFound, useGraph, useGraview } from "./context.js";
import { isDefaultView } from "./view-registry.js";
import { Plots } from "./plots.js";
import { Occupants } from "./occupants.js";
import { useCameraFlights } from "./scene-camera.js";
import { useHeldDistrict, useSceneDrag, useWheelAndPinch, useWorldShift } from "./scene-hand.js";
import { whereIsIn } from "./where-drawn.js";
import { BandCard, BeyondCard, SettledView } from "./resolved-view.js";
import { selectionFor, useElementSize, useRootUnit } from "./scene-helpers.js";
import { Lines, RelationCaptions } from "./scene-lines.js";
import { railInset } from "./rails.js";

export { railInset };
import { SceneViewHost } from "./view-host.js";



export interface SceneProps {
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

export function Scene<S extends AnySchema>({
  options,
  renderer = "auto",
  attachRenderer,
  className,
  style,
  animate = true,
  children,
}: SceneProps) {
  const {
    store,
    scheme,
    views,
    view,
    setView,
    selection,
    setSelection,
    setMenuAt,
    emphasis, hiddenKinds, registerScene, pointer, brand, noteMoved, robots } = useGraview<S>();
  const found = useFound();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(wrapperRef);
  const unit = useRootUnit();

  // Pinch and ctrl+wheel: altitude from the ground, zoom about the pointer from above; the plain wheel pans. See scene-hand.ts.
  const { zoomAbout, panBy } = useWheelAndPinch({ stage: wrapperRef, view, setView });

  // `nodes` is a cached snapshot that only changes when the graph does, so
  // the layout is recomputed exactly when the picture could have changed.
  const nodes = useGraph<S>();
  // What each subject's violations name, so a rule's neighbourhood is what it judges.
  const violations = useViolations<S>();
  const judged = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const violation of violations) {
      if (violation.subjectId === undefined) continue;
      const list = (map[violation.subjectId] ??= []);
      for (const id of violation.nodeIds) if (id !== violation.subjectId && !list.includes(id)) list.push(id);
    }
    return map;
  }, [violations]);
  // The scene is laid out to the space it actually has. A fixed canvas leaves
  // dead ground on a wide screen and clips on a narrow one, and the plane
  // bands are proportions rather than pixels, so they follow.
  /*
   * FLYING CLOSER. Choosing a picture from altitude brings the camera in:
   * the city's cell grows, the villages and roads with it, the billboard
   * bigger on its plot, and the camera keeps the picture in view. Derived
   * from the stop, never stored: leaving the picture flies back out.
   */
  const closer = (view.overview ?? false) && view.within?.["view"] !== undefined ? 1.5 : 1;
  /*
   * ZOOM BY HAND. The fly-closer step above is the scene's own; this is the
   * person's, changed continuously by pinch and ctrl+wheel about the
   * pointer and by the controls in the ground's corner, multiplied in.
   * Scene state like the camera, never the URL: an address says where you
   * are, not how close you are standing. Reset on the way down — on the
   * ground it means nothing, and rising again starts level.
   */
  const [zoom, setZoom] = useState(1);
  const zoomLive = useRef(1);
  useEffect(() => {
    if (view.overview) return;
    zoomLive.current = 1;
    setZoom(1);
  }, [view.overview]);
  const cityZoom = closer * zoom;
  /*
   * THE BILLBOARD IS CUT TO ITS PICTURE. The lens draws in a box as tall as
   * the window; the screen's host reports how much of it the lens actually
   * used, and the layout sizes the billboard to that — so the picture's foot
   * is on the kerb instead of a village's height above it. Whole pixels,
   * and only a change re-lays the city.
   */
  /*
   * Reported by the layout's CURRENT screen only. A billboard on its way
   * into its village is still drawn as one, but for the length of the tween
   * two hosts would report, the layout would flip between their two heights,
   * and every flip restarted the tween from where it was — a crawl of a
   * pixel a frame until the old picture had faded.
   */
  const [screenHeight, setScreenHeight] = useState<number | undefined>(undefined);
  const noteScreenHeight = useCallback((height: number | undefined) => {
    setScreenHeight((current) => {
      const next = height === undefined ? undefined : Math.round(height);
      return current === next ? current : next;
    });
  }, []);
  /*
   * WHAT STANDS AS ITSELF when the band cannot hold a relation: the search's
   * hits, the flagged, the recently written — the selection the layout reads
   * from the stop. Each only changes with the graph or the words.
   */
  const relevance = useMemo(
    () => ({
      hits: new Set(found?.matched ?? []),
      flagged: new Set(violations.flatMap((violation) => violation.nodeIds)),
      touched: touchWeights(store.log.all()),
    }),
    // `nodes` is the graph's tick: the log only grows when the graph changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [found, violations, store, nodes],
  );
  const sized = useMemo<LayoutOptions>(
    () => ({
      ...options,
      cityZoom,
      ...(screenHeight !== undefined ? { screenHeight } : {}),
      // What is not drawn for this seat at this stop: a workspace's disabled
      // modules, and the administered ones this seat may not see or has not
      // asked to — one set, from the provider, so every surface agrees.
      ...(hiddenKinds.size > 0 ? { hiddenKinds: [...hiddenKinds].sort() } : {}),
      ...(Object.keys(judged).length > 0 ? { judged } : {}),
      // What stands as itself when a relation does not fit the band (docs/scale.md).
      relevance,
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
      //
      // And below a phone's width there is no rail at all: the companion
      // is a sheet at the foot, the inspector a sheet over the picture, and
      // the only thing on the right is the altitude control's corner. A
      // 360px frame that kept a fifth of itself for panes nobody drew there
      // gave a focused lens 145 pixels, which is not a lens, it is a spine.
      inset: railInset(size?.width ?? 1200),
      // The reader's own text size, which the cards are sized in: the city
      // grows with the words rather than holding them at a fixed 230×97.
      unit,
      // Groups the framework's own list shows: from altitude those are
      // districts, not scaled cards. A group with an app's view keeps its card.
      plainGroups: (store.schema.kinds as readonly string[]).filter((kind) =>
        isDefaultView(views.lookup(kind as never, { cardinality: "many", fidelity: "full" })),
      ),
      /*
       * THE ORDER THE CITY IS WALKED IN: the chain a blank installation fills
       * its kinds in, read from the store's own acts. The declaration's
       * order, so the map is the declaration's map.
       */
      cityOrder: beginning({
        name: "scene",
        schema: store.schema,
        mutations: store.allMutations().filter((mutation) => !mutation.derived),
      }).order.map((entry) => entry.kind),
      /*
       * THE SHOWINGS, by kind: the named places the registry holds, so a
       * focused picture stands on its kind's plot as a screen from altitude.
       */
      screens: views.places().reduce<Record<string, { as: string; title: string; across?: string }[]>>((held, place) => {
        (held[place.kind] ??= []).push({ as: place.as, title: place.title, ...(place.across ? { across: place.across } : {}) });
        return held;
      }, {}),
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
    [options, size, unit, store, views, hiddenKinds, judged, relevance, cityZoom, screenHeight],
  );
  /*
   * THE CAMERA IS NOT A MOVE. A drive-in on the far side of a large city
   * lights up off-screen unless the camera goes to it, and the camera's
   * own offset is derived from the focus rather than made by a hand — so
   * it lives here, added to whatever the person panned, and never in the
   * URL. "Put it back" then clears the person's pan and leaves the camera
   * on the screen, which is what putting it back means.
   */
  const [camera, setCamera] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panned = useMemo(
    () => ({ x: (view.pan?.x ?? 0) + camera.x, y: (view.pan?.y ?? 0) + camera.y }),
    [view.pan, camera],
  );
  const seen = useMemo(
    () => (camera.x === 0 && camera.y === 0 ? view : withPan(view, panned)),
    [view, camera, panned],
  );
  /*
   * THE WHOLE OFFSET IS WHAT IS CLAMPED. The person's pan and the camera's
   * flight add up to where the city is; clamping the pan alone let the
   * flight to a far village eat the room to pan back, and the far side of
   * a flown-closer city could not be reached. Pan plus camera stays within
   * the camera limit — a little way over a picture that fits, as far as the
   * city reaches when it is bigger than the window — and every district is
   * reachable.
   */
  const cameraLive = useRef(camera);
  cameraLive.current = camera;
  const panWithin = useCallback(
    (limit: { x: number; y: number }, wanted: { x: number; y: number }): { x: number; y: number } => {
      const cam = cameraLive.current;
      /*
       * AND THE CAMERA'S OWN FLIGHT IS INSIDE THE LIMIT, WHEREVER IT WENT.
       *
       * Flying closer to a picture takes the camera past what the limit
       * allows on purpose — the billboard stands above the city's extent,
       * and the limit does not know about it. Clamping the total offset to
       * that limit afterwards meant every drag resolved to the same
       * clamped number: the ground would not move at all once a lens had
       * been chosen, which is the picture refusing to be looked around.
       *
       * The interval is the limit OR the camera, whichever reaches further
       * — so at rest this is exactly the old rule, and after a flight you
       * can pan back over the city and as far as the flight itself went,
       * but never further out than either.
       */
      const room = (bound: number, at: number) => ({ low: Math.min(-bound, at), high: Math.max(bound, at) });
      const across = room(limit.x, cam.x);
      const down = room(limit.y, cam.y);
      return {
        x: Math.max(across.low, Math.min(across.high, wanted.x + cam.x)) - cam.x,
        y: Math.max(down.low, Math.min(down.high, wanted.y + cam.y)) - cam.y,
      };
    },
    [],
  );
  const pinnedIds = useMemo(() => new Set(Object.keys(view.pins)), [view.pins]);
  // A district under the hand is placed here while it is dragged, and written into the view on release.
  const district = useHeldDistrict();
  const held = district.held;
  /*
   * THE WORLD IS LAID OUT AT REST, AND THEN MOVED.
   *
   * `layout` bakes the pan into every coordinate, which is what lets two
   * layouts be interpolated into motion — but it does that at the very end,
   * after it has decided communities, plots, band packing and the drive-in's
   * own sizing loop. A drag changes nothing but the pan, and this memo was
   * keyed on a view that carried it, so every pointer move ran all of that
   * again to reach an answer that differed from the last one by a
   * subtraction. Measured on rota's city: 169 of 467 frames dropped and ten
   * seconds of blocked main thread in a two-second drag.
   *
   * So the pan comes off the key. The expensive half is held still while a
   * hand is moving, and `panLayout` puts the world where the hand has taken
   * it — the same object, held to that by `the-pan-is-a-translation`.
   */
  /*
   * Keyed on the VIEW, not on the view-plus-camera: the camera is an offset
   * the scene makes for itself — flying to a drive-in, landing a descent —
   * and it is the same kind of thing as a pan. Keying this on `seen` meant a
   * camera that moved by a pixel rebuilt the world exactly as a pan did.
   */
  /*
   * A CARD UNDER THE HAND IS MOVED, NOT LAID OUT (docs/scale.md). In the
   * stack a held card is the only thing a drag changes, so the world is laid
   * out without it and `holdLayout` moves it — a full layout per pointer
   * move was the band's grouping and every edge's bundle, every frame. A
   * district held at altitude carries its plot and village with it, which
   * only the layout knows, so up there the pin still goes into the layout.
   */
  const inPlace = held !== null && !(view.overview ?? false);
  // Only a pin the layout needs is a dependency: a card moved in place must not re-lay the stop.
  const pinned = inPlace ? null : held;
  const atRest = useMemo(() => {
    const still = view.pan ? { ...view, pan: undefined } : view;
    return pinned ? withPin(still, pinned.id, { x: pinned.x, y: pinned.y }) : still;
  }, [view, pinned]);
  const laid = useMemo<Layout>(
    () => layout(store.graph, store.schema, atRest, sized),
    [store, atRest, sized, nodes],
  );
  const still = useMemo<Layout>(
    () =>
      held && inPlace
        ? (holdLayout(laid, held.id, { x: held.x, y: held.y }) ??
          layout(store.graph, store.schema, withPin(atRest, held.id, { x: held.x, y: held.y }), sized))
        : laid,
    [laid, held, inPlace, store, atRest, sized],
  );
  const result = useMemo<Layout>(
    () => panLayout(still, seen.pan ?? { x: 0, y: 0 }),
    [still, seen.pan],
  );
  const ZOOM_MIN = 0.6;
  const ZOOM_MAX = 3;
  zoomAbout.current = (factor, clientX, clientY) => {
    if (!(view.overview ?? false)) return;
    /*
     * A ZOOM WRITES STATE, so any pan the wheel is still holding has to
     * land first — zoom and pan share `steer`, and a zoom on top of an
     * uncommitted offset would compute from a pan the view does not have.
     */
    settleLive.current();
    const current = zoomLive.current;
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current * factor));
    if (Math.abs(next - current) < 1e-4) return;
    zoomLive.current = next;
    steer();
    setZoom(next);
    const box = wrapperRef.current?.getBoundingClientRect();
    const centre = { x: result.width / 2, y: result.height / 2 };
    const pointer = box && clientX !== undefined && clientY !== undefined ? { x: clientX - box.left, y: clientY - box.top } : centre;
    const ratio = next / current;
    setView((current) => withPan(current, panForZoom(current.pan ?? { x: 0, y: 0 }, cameraLive.current, pointer, centre, ratio)));
    noteMoved();
  };
  panBy.current = (dx, dy) => {
    steer();
    const limit = cameraLimit(result);
    const pan = view.pan ?? { x: 0, y: 0 };
    if (useDom) {
      /*
       * THE WHEEL IS A HAND TOO — so it moves the picture, and only the
       * wheel coming to rest moves the world. It was left on the old road
       * when the drag came off it: a `setView` per tick, which is a layout,
       * a render of every context consumer and a DOM re-measure for each
       * notch of a wheel.
       */
      const live = shift.offset();
      shift.shiftTo(panWithin(limit, { x: pan.x + live.x + dx, y: pan.y + live.y + dy }), pan);
    } else {
      setView((current) =>
        withPan(current, panWithin(limit, { x: (current.pan?.x ?? 0) + dx, y: (current.pan?.y ?? 0) + dy })),
      );
    }
    noteMoved();
  };

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
  /*
   * A WHEEL IS A HAND TOO. Zooming and panning by wheel arrive as a stream
   * of small moves; tweening each one lagged the picture behind the fingers
   * the way a tweened drag did. While the wheel is turning, and for a beat
   * after, the picture snaps to it.
   */
  const [steering, setSteering] = useState(false);
  const steeringUntil = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
   * A WHEEL LETS GO TOO, and this is how it says so.
   *
   * The live-shift machinery is declared below — it needs the layout, which
   * needs the view — and `steer` is needed above it, by the wheel and the
   * zoom. A ref rather than a reordering: moving the declaration would drag
   * `steering` and the tween's own `enabled` down with it, which is three
   * hundred lines of unrelated motion for one call.
   */
  const settleLive = useRef<() => boolean>(() => false);
  const steer = useCallback(() => {
    setSteering(true);
    if (steeringUntil.current) clearTimeout(steeringUntil.current);
    steeringUntil.current = setTimeout(() => {
      steeringUntil.current = null;
      /*
       * The wheel stops steering when the pan it made has been DRAWN, not
       * when the wheel stops turning — clearing it here would re-enable the
       * tween in the same breath as the commit, and the city would fly from
       * where the wheel left it back to where it started. The same trap the
       * drag fell into; the layout effect closes both.
       */
      if (settleLive.current()) return;
      setSteering(false);
    }, 160);
  }, []);
  // The picture as it is right now, part-way between the last view and this
  // one. Everything downstream draws the tween, not the destination.
  const frame = useAnimatedLayout(result, { enabled: animate && !dragging && !steering });
  // Whether anything is moving: the hand, the wheel, or a transition not yet landed.
  const { motion } = useGraview<S>();
  // `t` is the tween's progress: a landed frame is at 1 (the frame is always a fresh object, never `result`).
  useEffect(() => motion.set(dragging || steering || frame.t < 1), [motion, dragging, steering, frame]);
  const touched = useTouched<S>();
  const seatWork = useSeatWork<S>();

  // Where the camera goes on its own: to a drive-in off the edge, and down into a village. See scene-camera.ts.
  const screenId = result.nodes.find((node) => node.screenOf !== undefined)?.id ?? null;
  const flights = useCameraFlights({ view, result, frame, panned, closer, screenId, setCamera });

  /*
   * WHERE IS: the scene lends the context its live frame. A ref, so the
   * answer is the frame being drawn right now — mid-tween, mid-pan — and
   * asking costs nobody a render.
   */
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useEffect(() => {
    registerScene({
      whereIs: (id) => whereIsIn(frameRef.current, wrapperRef.current, scheme, views, id),
    });
    return () => registerScene(null);
  }, [registerScene, scheme, views]);

  /*
   * THE POINTER, only while somebody is listening. The store tells the
   * scene when its first subscriber arrives and its last leaves; between
   * those two moments there is a listener, and outside them there is none.
   */
  useEffect(
    () =>
      pointer.onActive((active) => {
        const element = wrapperRef.current;
        if (!element) return;
        const move = (event: PointerEvent) => {
          const rect = element.getBoundingClientRect();
          pointer.set({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        };
        const leave = () => pointer.set(null);
        if (active) {
          element.addEventListener("pointermove", move);
          element.addEventListener("pointerleave", leave);
          (element as HTMLElement & { __graviewPointer?: () => void }).__graviewPointer = () => {
            element.removeEventListener("pointermove", move);
            element.removeEventListener("pointerleave", leave);
          };
        } else {
          (element as HTMLElement & { __graviewPointer?: () => void }).__graviewPointer?.();
          delete (element as HTMLElement & { __graviewPointer?: () => void }).__graviewPointer;
        }
      }),
    [pointer],
  );

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

  /* THE HAND: dragging the ground to look around and a district to place it — see scene-hand.ts. */
  const shift = useWorldShift({
    stage: wrapperRef,
    pan: view.pan,
    setView,
    // The gesture ends with the world already where the hand left it, so nothing tweens there afterwards.
    settled: () => {
      setDragging(false);
      setSteering(false);
    },
  });
  // Wired here, where the shift exists; see the ref's own note above.
  settleLive.current = shift.settle;
  const { onGroundDown, onCardDown, onDragMove, onDragUp, swallow } = useSceneDrag({
    view,
    panned,
    limit: () => cameraLimit(result),
    panWithin,
    moveByTransform: useDom,
    setView,
    setDragging,
    noteMoved,
    shift,
    district,
  });

  /*
   * A CROWD drops to glyphs. A summary panel needs room, and a raised
   * relation with many members divides the band until no card has any —
   * ten titles wrapping to five lines in 130-pixel slivers. Below the
   * legibility floor a card renders the kind's GLYPH instead, which is
   * what the fidelity axis is for: legible at any width, still selectable,
   * still the node. A band that WRAPPED into rows is a crowd by height: a
   * summary card in a 46-pixel row showed its title cut at the second line.
   */
  const crowded = (node: SceneNode) => Math.round(node.plane) === 1 && (node.width < 175 || node.height < 64);

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
      {...(node.plot && frame.city && Math.round(node.plane) === 2
        ? {
            frontY: frame.city.originY + panned.y + toIso(node.plot.col + node.plot.side / 2, node.plot.row + node.plot.side, frame.city.cell).y - node.y,
            centreY: frame.city.originY + panned.y + toIso(node.plot.col + node.plot.side / 2, node.plot.row + node.plot.side / 2, frame.city.cell).y - node.y,
          }
        : {})}
      {...(node.screenOf !== undefined ? { screen: true, ...(node.id === screenId ? { onDrawnHeight: noteScreenHeight } : {}) } : {})}
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
        // A band's group is selected as itself: its members could be hundreds of ids in the address.
        if (isBandAggregate(node.id)) {
          setSelection((current) => (additive ? (current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id]) : [node.id]));
          return;
        }
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
         * A BAND'S GROUP OPENS: in place, as the `expanded` stop Back undoes;
         * "+N more" through to the kind's picture, filtered by the relation,
         * where the row and the search make any number of them browsable.
         */
        const opens = node.aggregate?.opens;
        if (opens) {
          if (opens.in === "place") setView((current) => toggleExpanded(current, node.id));
          else
            setView((current) =>
              Object.entries(opens.within).reduce(
                (stop, [key, value]) => withWithin(stop, key, value),
                withFocus(withOverview(current, false), opens.focus),
              ),
            );
          setSelection([]);
          return;
        }
        /*
         * A kind with a lens over it goes INTO the lens; a kind without one
         * explodes into its district. The card already draws a ◆ when it has
         * a picture of its own, and used to burst into a ring of chips
         * anyway — trading the designed view for the fallback it exists to
         * improve on.
         */
        // A district the search lit opens narrowed by the same words.
        const card = kindOfCard(node.id);
        const lit = card !== null && (found?.byKind[card] ?? 0) > 0;
        setView((current) =>
          withJackIn(current, node.id, { ownPicture: ownPictureOf(node), ...(lit && current.q ? { carry: current.q } : {}) }),
        );
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
      {node.screenOf !== undefined ? (
        /*
         * THE RAIL YOU MOVE THE BOARD BY.
         *
         * Dragging the picture itself looks around the city, and must go on
         * doing so: the billboard is the biggest thing on screen and the one
         * most likely to be under the hand, and taking panning away from it
         * was how the far side of a city became unreachable once. So the
         * board gets a rail along its top edge, the way a window has a title
         * bar — the picture pans, the rail moves the board, and neither
         * gesture has to be discovered from the other.
         *
         * How far it may go is not this rail's business: `layout` leashes
         * the pin to its own plot, so a hand and a pasted link are held to
         * the same distance.
         */
        /*
         * A TITLE BAR, not a grey strip with a pill floating over it: the
         * picture's name on the left, the one way down on the right, and
         * the whole bar the handle that moves the board.
         */
        <div
          className="graview-screen-grip"
          data-graview-grip={node.id}
          data-testid="screen-grip"
          title="Move this picture — it stays by its own village"
        >
          <span className="graview-screen-title" aria-hidden="true">
            {views.places().find((place) => place.as === view.within?.["view"] && place.kind === node.screenOf)?.title ?? ""}
          </span>
          {/* THE BILLBOARD'S FULL-SCREEN CONTROL: the one way down from a picture. */}
          <button
            type="button"
            className="graview-screen-fullscreen"
            data-testid="screen-fullscreen"
            title="Open this picture on its own — leave the graview with it"
            onClick={(event) => {
              event.stopPropagation();
              setView((current) => withOverview(current, false));
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            Open ↗
          </button>
        </div>
      ) : null}
      {node.beyond ? (
        <BeyondCard kinds={node.beyond} />
      ) : node.aggregate?.opens ? (
        <BandCard node={node} />
      ) : (
        <SettledView
          node={node}
          mode="scene"
          selected={selection.includes(node.id)}
          {...(crowded(node) ? { fidelity: "glyph" as const } : {})}
        />
      )}
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
      /*
       * HOW FAR THE CAMERA REACHES, said on the ground — so a harness that
       * finds a district past the edge can tell "pannable to" from "lost":
       * a city wider than a phone is reached by dragging the ground.
       */
      data-graview-reach={frame.city ? `${Math.round(cameraLimit(result).x)} ${Math.round(cameraLimit(result).y)}` : undefined}
      // Nothing in motion: no tween running and no camera glide pending. A harness can wait on this rather than on a timer.
      data-graview-settled={frame.t >= 1 && !flights.gliding() ? "" : undefined}
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
        /*
         * THE LATTICE THE CITY STANDS ON. The ground draws its diamonds at
         * the cell the map was placed with, anchored where cell (0,0) meets
         * the canvas — and the anchor pans with the picture, since the pan
         * is baked into every coordinate — so a plot sits on a grid line a
         * person can see. The kit's own size stands when no city is drawn.
         */
        ...(frame.city
          ? {
              ["--graview-lattice-cell" as string]: `${frame.city.cell.toFixed(2)}px`,
              // The tween's own pan, not the live one: the ground moves with the cards it is under.
              ["--graview-lattice-x" as string]: `${(frame.city.originX + frame.city.pan.x).toFixed(1)}px`,
              ["--graview-lattice-y" as string]: `${(frame.city.originY + frame.city.pan.y).toFixed(1)}px`,
            }
          : {}),
        ...(dragging ? { userSelect: "none" as const } : {}),

        // The stage is sized to the measurement, but a stale measurement
        // during a resize can briefly exceed it. Clipping keeps the scene
        // inside its own bounds instead of pushing the page taller and
        // cutting off anything floating over it.
        overflow: "hidden",
        ...style,
      }}
    >
      {/*
        * THE GROUND: every district's plot as a tile, under the cards and
        * over the fields, from the same origin and pan the lattice rides.
        */}
      <Plots
        frame={frame}
        width={result.width}
        height={result.height}
        // The tween's own pan: the tiles, the villages and the roads move with the cards on them.
        pan={frame.city ? frame.city.pan : panned}
        brand={brand}
        pinned={pinnedIds}
        swallowed={swallow}
        // A tile is its district: focusing it means the kind's aggregate, never the card's own id.
        onFocus={(id) => {
          const kind = kindOfCard(id);
          if (kind !== null) setView((current) => withFocus(current, aggregateId(kind)));
        }}
      />
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
          /* One of the layers the hand moves as a unit; see `liveShift`. */
          data-graview-world=""
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
      {view.overview ? (
        /* SCENE FURNITURE in the ground's other corner: the way a map carries its own zoom. */
        <div
          className="graview-zoom"
          role="group"
          aria-label="Zoom"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="graview-zoom-button"
            data-testid="zoom-out"
            aria-label="Zoom out"
            title="Zoom out — or pinch, or ctrl+wheel"
            disabled={zoom <= ZOOM_MIN + 1e-6}
            onClick={() => zoomAbout.current(1 / 1.25)}
          >
            −
          </button>
          <span className="graview-zoom-level" data-testid="zoom-level" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="graview-zoom-button"
            data-testid="zoom-in"
            aria-label="Zoom in"
            title="Zoom in — or pinch, or ctrl+wheel"
            disabled={zoom >= ZOOM_MAX - 1e-6}
            onClick={() => zoomAbout.current(1.25)}
          >
            +
          </button>
        </div>
      ) : null}
      <Lines
        frame={frame}
        holding={inPlace}
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
          setMenuAt(at ? { ...at, on: edgeId } : null);
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
      {/*
        * THE OCCUPANTS — the robots — over the stage on both paths, placed
        * from the frame being drawn. Never in layout(): a body stands where
        * the fold says, at the box whereIs answers.
        */}
      <Occupants
        width={result.width}
        whereIs={(id) => whereIsIn(frame, wrapperRef.current, scheme, views, id)}
      />
      {/* What the seat just wrote, marked where it is — the attribution the figure used to carry. */}
      <SeatMarks
        marks={seatWork.marks}
        questions={[...robots.values()]
          .filter((one) => one.mode === "asking" && one.at !== null && one.say)
          .map((one) => ({ id: one.at!, who: one.who, asks: one.say! }))}
        whereIs={(id) => whereIsIn(frame, wrapperRef.current, scheme, views, id)}
        stageRef={wrapperRef}
        width={result.width}
        height={result.height}
      />
      <RelationCaptions
        nodes={frame.nodes}
        moving={frame.t < 1}
        holding={inPlace}
        scheme={scheme}
        width={result.width}
        stageRef={wrapperRef}
      />
      {children}
    </div>
  );
}
