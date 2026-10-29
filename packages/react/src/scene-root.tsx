import { SCENE_LAYERS } from "@graview/core";
import { toIso, TOP_DOWN } from "@graview/core/city";
import type { SceneNode } from "./scene-node.js";
import type { AnySchema, GraviewApp, Store } from "@graview/core";
import { documentOf } from "@graview/core/document";
import type { AppWorkflows } from "@graview/core/workflows";
import {
  aggregateId,
  cameraLimit,
  panForZoom,
  kindOfCard,
  kindsOf,
  layout,
  withFocus,
  withOverview,
  panLayout,
  withRelation,
  type InterpolatedLayout,
  type Layout,
  type LayoutOptions,
  type ViewState,
  withJackIn,
  holdLayout,
  isBandAggregate,
  toggleExpanded,
  withWithin,
} from "@graview/layout";
import { withPan, withPin } from "@graview/layout/view-moves";
import {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { retryingImport } from "@graview/core/retry";
import { chooseRenderer, gpuCapturePresent, rendererAsked, type RendererPath } from "@graview/render";
import { useGroundMenu } from "./scene-ground-menu.js";
import { useDomBlurWithinBudget, usePlaneBlur } from "./scene-blur.js";
import type { ActivityMark } from "./activity.js";
import { lazyModule } from "./lazy-part.js";
import { BesideTheMap } from "./beside-the-map.js";
import { mapChoice } from "./map-choice.js";
import { useActivity } from "./attention.js";
import { useAnimatedLayout, useSeatWork, useTouched } from "./animation.js";
import { SeatMarks } from "./seat-marks.js";
import { GraviewContext, matchWith, useFound, useGraph, useGraview, type GraviewContextValue } from "./context.js";
import { samePanless, usePanFreeContext } from "./pan-free.js";
import { search, touchWeights } from "@graview/core/search";
import { kitConnector, useKit } from "./kit.js";

// The scene searches: it hands the provider the matcher as it is fetched (FR-179).
matchWith({ search, touchWeights });
import type { PointerStore } from "./pointer.js";
import type { PlotsProps } from "./plots.js";
import { Occupants } from "./occupants.js";
import { EdgeSigns, useHungShowings, useTrailBox } from "./edge-signs.js";
import { useCameraFlights } from "./scene-camera.js";
import { useKeyboardKeepsToWhatIsSeen } from "./scene-covered.js";
import { useDock, useHeldDistrict, useSceneDrag, useWheelAndPinch, useWorldShift, type Held } from "./scene-hand.js";
import { useAimedPress } from "./scene-aim.js";
import { whereIsIn } from "./where-drawn.js";
import { BandCard, BeyondCard, SettledView } from "./resolved-view.js";
import { selectionFor, useBoxHeldThroughToolbars, useElementSize, useRootUnit } from "./scene-helpers.js";
import { Lines, provisionalLines, RelationCaptions } from "./scene-lines.js";
import { railInset } from "./rails.js";
import { useLayoutOptions } from "./scene-options.js";

export { railInset };
import { SceneViewHost } from "./view-host.js";



export interface SceneProps {
  readonly options?: LayoutOptions;
  /**
   * `gpu` composites through @graview/render's capture path; `dom` positions
   * views with CSS transforms. `auto`, the default, is the GPU where this
   * browser has WebGPU and element capture and its first frames hold the
   * budget, and the DOM path everywhere else — silently, per page. The
   * capture path is fetched only where it can draw. An operator decides
   * `auto` with `?renderer=gpu|dom` (`rendererAsked`).
   *
   * The DOM path is not a toy: the plane model is affine by design, so a CSS
   * transform reproduces the geometry exactly, and the accessibility tree is
   * the same on both. What it cannot do cheaply is per-plane blur, so it
   * blurs only while its frames keep to the budget.
   */
  readonly renderer?: "gpu" | "dom" | "auto";
  /**
   * Whether receded planes are blurred, the focused plane always sharp. On
   * by default; off here, or by the reader's reduced motion or reduced
   * transparency, on either path.
   */
  readonly blur?: boolean;
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
    /**
     * The views the renderer cannot take — over its capture budget, or with
     * no capture at all — replacing the last set. The Scene draws these on
     * the DOM path, under the canvas, at the same transform.
     */
    drawOnDom(ids: ReadonlySet<string>): void;
    /** Whether receded planes are blurred this picture: the `blur` prop and the reader's preferences. */
    blur: boolean;
    /** The scheme the page is drawn in, so the renderer treats the planes as the DOM path does. */
    scheme: "light" | "dark";
    /**
     * The renderer cannot draw this page after all; the Scene draws it on
     * the DOM path from here on, as it would without a GPU.
     */
    fallBack(): void;
  }) => (() => void) | void;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Animate between view states. Off in tests and SSR. */
  readonly animate?: boolean;
  /** Rendered over the scene — an affordance surface, a header, a legend. */
  readonly children?: ReactNode;
}

type Point = { x: number; y: number };

/** A host's activity prop, worked out once: it reads every member of a group. */
const withActivity = (activity: ActivityMark | undefined): { activity?: ActivityMark } => (activity ? { activity } : {});

/** How far the camera reaches, as the ground says it. */
const reachOf = (limit: Point) => `${Math.round(limit.x)} ${Math.round(limit.y)}`;

/** A press on scene furniture stays there: the ground under it neither pans nor deselects. */
const stop = (event: { stopPropagation(): void }) => event.stopPropagation();

/** How far the person may zoom by hand from altitude. */
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;

/*
 * A CROWD drops to glyphs. A summary panel needs room, and a raised
 * relation with many members divides the band until no card has any —
 * ten titles wrapping to five lines in 130-pixel slivers. Below the
 * legibility floor a card renders the kind's GLYPH instead, which is
 * what the fidelity axis is for: legible at any width, still selectable,
 * still the node. A band that WRAPPED into rows is a crowd by height: a
 * summary card in a 46-pixel row showed its title cut at the second line.
 *
 * The floor is what a summary holds: its title and one row of chips, 80
 * pixels. At 64 a release in a three-row band drew its name and a sliver
 * of its date chip under a fade — a card that looked broken, where a chip
 * would have read.
 */
const SUMMARY_FLOOR = 80;
const crowded = (node: SceneNode) =>
  Math.round(node.plane) === 1 && (node.compact === true || node.width < 175 || node.height < SUMMARY_FLOOR);

/**
 * ZOOM BY HAND. The fly-closer step is the scene's own; this is the
 * person's, changed continuously by pinch and ctrl+wheel about the
 * pointer and by the controls in the ground's corner, multiplied in.
 * Scene state like the camera, never the URL: an address says where you
 * are, not how close you are standing. Reset on the way down — on the
 * ground it means nothing, and rising again starts level.
 */
function useHandZoom(overview: boolean | undefined) {
  const [zoom, setZoom] = useState(1);
  const zoomLive = useRef(1);
  useEffect(() => {
    if (overview) return;
    zoomLive.current = 1;
    setZoom(1);
  }, [overview]);
  return [zoom, zoomLive, setZoom] as const;
}


/**
 * THE CAMERA IS NOT A MOVE. A drive-in on the far side of a large city
 * lights up off-screen unless the camera goes to it, and the camera's
 * own offset is derived from the focus rather than made by a hand — so
 * it lives here, added to whatever the person panned, and never in the
 * URL. "Put it back" then clears the person's pan and leaves the camera
 * on the screen, which is what putting it back means.
 */
function useCamera(view: ViewState) {
  const [camera, setCamera] = useState<Point>({ x: 0, y: 0 });
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
    (limit: Point, wanted: Point): Point => {
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
      const within = (bound: number, at: number, want: number) => Math.max(Math.min(-bound, at), Math.min(Math.max(bound, at), want + at)) - at;
      return { x: within(limit.x, cam.x, wanted.x), y: within(limit.y, cam.y, wanted.y) };
    },
    [],
  );
  return [panned, seen, panWithin, cameraLive, setCamera] as const;
}

/**
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
 *
 * Keyed on the VIEW, not on the view-plus-camera: the camera is an offset
 * the scene makes for itself — flying to a drive-in, landing a descent —
 * and it is the same kind of thing as a pan. Keying this on `seen` meant a
 * camera that moved by a pixel rebuilt the world exactly as a pan did.
 *
 * A CARD UNDER THE HAND IS MOVED, NOT LAID OUT (docs/scale.md). In the
 * stack a held card is the only thing a drag changes, so the world is laid
 * out without it and `holdLayout` moves it — a full layout per pointer
 * move was the band's grouping and every edge's bundle, every frame. A
 * district held at altitude carries its plot and village with it, which
 * only the layout knows, so up there the pin still goes into the layout.
 */
function useLaidOut<S extends AnySchema>(
  store: Store<S>,
  view: ViewState,
  held: Held | null,
  sized: LayoutOptions,
  nodes: unknown,
  pan: Point | undefined,
) {
  const inPlace = held !== null && !view.overview;
  // Only a pin the layout needs is a dependency: a card moved in place must not re-lay the stop.
  const pinned = inPlace ? null : held;
  /*
   * KEYED ON THE STOP LESS ITS PAN, by what it holds: a view that differs
   * only in its pan is a new object all the same, and keyed on that, the
   * pan a hand let go of laid the whole city out again — communities,
   * plots, bands and the rules' counts — to draw what `panLayout` moves.
   */
  const stop = useRef(view);
  if (!samePanless(stop.current, view)) stop.current = view;
  const place = stop.current;
  const atRest = useMemo(() => {
    const still = place.pan ? { ...place, pan: undefined } : place;
    return pinned ? withPin(still, pinned.id, { x: pinned.x, y: pinned.y }) : still;
  }, [place, pinned]);
  /*
   * WHERE THE CITY STOOD, handed to the next layout (`cityStood`): a
   * district chosen from altitude is kept in sight from where the city is,
   * so choosing one already in sight moves nothing, and one past the edge
   * is brought in the least from there — not from the city's middle, which
   * slid the whole map back and forth under each tap.
   */
  const stood = useRef<Layout["city"]>(undefined);
  const laid = useMemo<Layout>(() => {
    const was = stood.current?.stood;
    const next = layout(store.graph, store.schema, atRest, was ? { ...sized, cityStood: was } : sized);
    stood.current = next.city;
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, atRest, sized, nodes]);
  const still = useMemo<Layout>(
    () =>
      held && inPlace
        ? (holdLayout(laid, held.id, { x: held.x, y: held.y }) ??
          layout(store.graph, store.schema, withPin(atRest, held.id, { x: held.x, y: held.y }), sized))
        : laid,
    [laid, held, inPlace, store, atRest, sized],
  );
  const result = useMemo<Layout>(() => panLayout(still, pan ?? { x: 0, y: 0 }), [still, pan]);
  return [result, inPlace] as const;
}

/**
 * A DRAG IS NOT A TRANSITION, AND A WHEEL IS A HAND TOO.
 *
 * Every pointer move writes a new view state, and easing toward each one
 * over half a second made the scene chase the pointer — panning felt
 * laggy because it literally lagged, by design meant for navigation. While
 * a drag owns the pointer the picture snaps to it; the tween is for the
 * moves you did not make with your own hand.
 *
 * Zooming and panning by wheel arrive as a stream of small moves; tweening
 * each one lagged the picture behind the fingers the way a tweened drag
 * did. While the wheel is turning, and for a beat after, the picture snaps
 * to it.
 *
 * AND A HAND ON THE SCENE IS NOT STATE. Whether a hand or a wheel is moving
 * the picture was React state, so the first move of every drag re-rendered
 * the whole scene — every card, every line, every plot — to draw the same
 * picture with a different cursor, and letting go rendered it all once more
 * to say the hand had gone. It is a ref the renders read: the render that
 * commits the gesture's pan reads that a hand made it, and cuts to it rather
 * than tweening. What a person sees of the hand — the grabbing cursor, no
 * text selected under it, the signs at the edge put away while the picture
 * is between places — is written on the ground itself (`markHand`), outside
 * React, as the transform the hand paints is.
 */
function useSteering(ground: RefObject<HTMLDivElement | null>, motion: { set(moving: boolean): void }) {
  const dragging = useRef(false);
  const steering = useRef(false);
  const steeringUntil = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Whether a transition is running, as of the last render: told to `motion` once the hand is off. */
  const tweening = useRef(false);
  const mark = useCallback(() => {
    markHand(ground.current, { dragging: dragging.current, steering: steering.current });
    motion.set(dragging.current || steering.current || tweening.current);
  }, [ground, motion]);
  const setDragging = useCallback(
    (on: boolean) => {
      if (dragging.current === on) return;
      dragging.current = on;
      mark();
    },
    [mark],
  );
  /*
   * A WHEEL LETS GO TOO, and this is how it says so: the live shift's
   * `settle`, wired by the scene once the shift exists — it needs the
   * layout, which needs the view, and `steer` is needed before it.
   */
  const settleLive = useRef<() => boolean>(() => false);
  const steer = useCallback(() => {
    if (!steering.current) {
      steering.current = true;
      mark();
    }
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
      steering.current = false;
      mark();
    }, 160);
  }, [mark]);
  // The gesture ends with the world already where the hand left it, so nothing tweens there afterwards.
  const settled = useCallback(() => {
    dragging.current = false;
    steering.current = false;
    mark();
  }, [mark]);
  return { dragging, steering, tweening, setDragging, steer, settleLive, settled };
}

/**
 * THE HAND, SAID ON THE GROUND. `data-graview-hand` while a hand or a wheel
 * moves the picture (the theme puts the signs at the edge away under it:
 * they name what lies past the edge of a picture that has not landed yet),
 * and the grabbing cursor and no text selection while a drag owns the
 * pointer. The scene's own style says `cursor: grab` and never changes it,
 * so React never writes over what is written here.
 */
function markHand(ground: HTMLElement | null, { dragging, steering }: { readonly dragging: boolean; readonly steering: boolean }) {
  if (!ground) return;
  if (dragging || steering) ground.setAttribute("data-graview-hand", dragging ? "drag" : "wheel");
  else ground.removeAttribute("data-graview-hand");
  ground.style.cursor = dragging ? "grabbing" : "grab";
  ground.style.userSelect = dragging ? "none" : "";
}

/**
 * THE FIRST PICTURE IS A CUT. Before its box is measured the city is laid
 * out for no box at all — as wide as a desk — and tweening from that to
 * the box it has flew the whole city in from off its edge: in a 480px
 * embed the first frames stood the districts hundreds of pixels outside
 * it. The picture measured for the first time arrives where it is.
 */
function useFirstMeasured(size: unknown): boolean {
  const measured = useRef(false);
  const first = size !== null && !measured.current;
  useEffect(() => {
    if (size !== null) measured.current = true;
  }, [size]);
  return first;
}

/**
 * WHERE IS: the scene lends the context its live frame. A ref, so the
 * answer is the frame being drawn right now — mid-tween, mid-pan — and
 * asking costs nobody a render.
 */
function useLentWhereIs<S extends AnySchema>(
  { registerScene, scheme, views }: Pick<GraviewContextValue<S>, "registerScene" | "scheme" | "views">,
  frame: InterpolatedLayout,
  stage: RefObject<HTMLDivElement | null>,
) {
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useEffect(() => {
    registerScene({
      whereIs: (id) => whereIsIn(frameRef.current, stage.current, scheme, views, id),
    });
    return () => registerScene(null);
  }, [registerScene, scheme, views]);
}

/**
 * THE POINTER, only while somebody is listening. The store tells the
 * scene when its first subscriber arrives and its last leaves; between
 * those two moments there is a listener, and outside them there is none.
 */
function usePointerReport(pointer: PointerStore, stage: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    // What the last listener attached takes off again when nobody is listening.
    let detach: (() => void) | undefined;
    return pointer.onActive((active) => {
      const element = stage.current;
      if (!element) return;
      const report = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect();
        pointer.set({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      };
      /*
       * NOT WHILE A HAND HOLDS THE GROUND: what listens waits for the hand
       * to let go (`subject.ts`), and asking where the ground is on every
       * move of a drag laid the page out again under each frame the hand
       * painted. Where the hand let go is said when it does.
       */
      const move = (event: PointerEvent) => {
        if (event.buttons !== 0) return;
        report(event);
      };
      const leave = () => pointer.set(null);
      if (active) {
        element.addEventListener("pointermove", move);
        element.addEventListener("pointerup", report);
        element.addEventListener("pointerleave", leave);
        detach = () => {
          element.removeEventListener("pointermove", move);
          element.removeEventListener("pointerup", report);
          element.removeEventListener("pointerleave", leave);
        };
      } else {
        detach?.();
        detach = undefined;
      }
    });
  }, [pointer]);
}

/**
 * The renderer is handed the FRAME, not the target.
 *
 * Two reasons, both of which were bugs before: the DOM holds the tween,
 * so a host for a node that has not entered yet does not exist to be
 * captured; and drawing the target during a transition would snap every
 * view to its final position while the DOM animated underneath it.
 * A group is stale when any of its members changed, since its own view
 * is a summary of them.
 */
function useAttachedRenderer(
  attachRenderer: SceneProps["attachRenderer"] | null,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  frame: InterpolatedLayout,
  touched: ReadonlySet<string>,
  drawOnDom: (ids: ReadonlySet<string>) => void,
  blur: boolean,
  scheme: "light" | "dark",
  fallBack: () => void,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !attachRenderer) return;
    const dirty = new Set<string>();
    for (const node of frame.nodes) {
      if (touched.has(node.id)) dirty.add(node.id);
      else if (node.aggregate?.memberIds.some((id) => touched.has(id))) dirty.add(node.id);
    }

    const detach = attachRenderer({
      canvas,
      layout: frame,
      dirty,
      // In the canvas, or on the DOM path beside it.
      hostOf: (id) =>
        (canvas.parentElement ?? canvas).querySelector<HTMLElement>(`[data-graview-view="${CSS.escape(id)}"]`),
      drawOnDom,
      blur,
      scheme,
      fallBack,
    });
    return () => {
      detach?.();
    };
  }, [attachRenderer, frame, touched, drawOnDom, blur, scheme, fallBack]);
}

/** The capture path, fetched only once a page is to draw on it. */
const gpuPath = retryingImport(() => import("@graview/render/gpu"));

/**
 * WHICH PATH THIS PAGE DRAWS ON. Decided once, before anything is fetched:
 * the host's ask, an operator's `?renderer=`, and whether the browser can
 * capture at all. A page that can is drawn on the DOM path while the
 * capture path arrives, and moves onto the canvas when it has; a page whose
 * GPU then fails its first frames falls back for good. Nothing is said
 * either way — the picture is the same.
 */
function useRendererPath(renderer: NonNullable<SceneProps["renderer"]>, attachRenderer: SceneProps["attachRenderer"]) {
  const [startsOn] = useState<RendererPath>(() => {
    const operator = rendererAsked();
    // A host's own renderer is the capture path it chose, attached as it is.
    if (attachRenderer) return renderer === "dom" || (renderer === "auto" && operator === "dom") ? "dom" : "gpu";
    return chooseRenderer(renderer, { operator, present: gpuCapturePresent() });
  });
  const [fellBack, setFellBack] = useState(false);
  const fallBack = useCallback(() => setFellBack(true), []);
  const [own, setOwn] = useState<SceneProps["attachRenderer"] | null>(null);
  const fetches = startsOn === "gpu" && !attachRenderer && !fellBack && own === null;
  useEffect(() => {
    if (!fetches) return;
    let live = true;
    gpuPath().then(
      (gpu) => {
        if (live) setOwn(() => gpu.attachGpu());
      },
      () => {
        if (live) setFellBack(true);
      },
    );
    return () => {
      live = false;
    };
  }, [fetches]);
  const attach = startsOn === "gpu" && !fellBack ? (attachRenderer ?? own) : null;
  return { attach: attach ?? null, fallBack };
}

/**
 * The views a renderer handed to the DOM path, as state. A set equal to the
 * last one is not a new render: only a change of hands should cost one.
 */
function useDrawnOnDom(): [ReadonlySet<string>, (ids: ReadonlySet<string>) => void] {
  const [onDom, setOnDom] = useState<ReadonlySet<string>>(() => new Set());
  const drawOnDom = useCallback((ids: ReadonlySet<string>) => {
    setOnDom((current) => (current.size === ids.size && [...ids].every((id) => current.has(id)) ? current : new Set(ids)));
  }, []);
  return [onDom, drawOnDom];
}

/**
 * What just happened, resolved onto whatever is DRAWN.
 *
 * The op log names node ids, and a node is not always on screen as itself:
 * above the stack a duty is inside the Runs card, and inside the stack it
 * may be its own panel. An edit should land on whichever of those the eye
 * can actually see, which is the same rule the connectors follow — the
 * node if it is placed, otherwise the group standing in for it.
 */
function useActivityOf<S extends AnySchema>() {
  const activity = useActivity<S>();
  return (node: SceneNode | undefined): ActivityMark | undefined => {
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
}

/** The selection with `id` taken out if it was in, and put in if it was not. */
const toggled = (current: readonly string[], id: string) =>
  current.includes(id) ? current.filter((other) => other !== id) : [...current, id];

/**
 * WHAT A CARD'S GESTURES DO: a click selects or raises, a pick chooses a
 * mark, a double click travels or jacks in. One set for every card, so a
 * gesture means the same thing wherever it lands — handed to each card's
 * host as its own.
 */
function useCardActs<S extends AnySchema>() {
  const { views, view, setView, setSelection } = useGraview<S>();
  const found = useFound();
  // Whether a panel beside the map lists a district opened from altitude.
  const besideTheMap = useContext(BesideTheMap);
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
  return (node: SceneNode) => ({
    onSelect: (additive: boolean) => {
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
        setSelection((current) => (additive ? toggled(current, node.id) : [node.id]));
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
    },
    /*
     * Picking a thing SELECTS it, and leaves the picture where it is.
     *
     * It used to travel, which is the wrong default: most of the time you
     * want to act on the thing where it is — substitute a player without
     * leaving the formation, move an event without leaving the week — and
     * being thrown into a detail view to do it costs you the context that
     * made the decision obvious. Travel is the deliberate second gesture.
     */
    onPick: (id: string, additive: boolean, joins?: readonly string[]) =>
      setSelection((current) =>
        /* A mark of a relation chooses what it joins (FR-111): a coverage cell, its row, its column and the records between. */
        joins
          ? additive
            ? [...new Set([...current, ...joins])]
            : [...joins]
          : additive
            ? toggled(current, id)
            : [id],
      ),
    /*
     * Double click means GO DEEPER, whatever it lands on: into the node a
     * view nominated, or — where a view nominated nothing — into the view
     * itself as a full page. One gesture, one meaning.
     */
    onTravel: (id: string) => {
      setView((current) => ({ ...withFocus(current, id), relation: null }));
      setSelection([id]);
    },
    /*
     * Jacking in ZOOMS: the same scene, the focus grown to most of it,
     * shelf and relations receded but present. On the node already zoomed
     * the same gesture zooms back out — in and out are one motion.
     */
    onJackIn: () => {
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
      /*
       * A DISTRICT WITH NO PICTURE OF ITS OWN, OPENED FROM ALTITUDE, OPENS
       * TO ITS STOP BESIDE THE MAP, in the panel a lens opens in: its own
       * focus, at altitude, so it takes the place of a lens or another
       * kind's stop open there (one panel at a time), the address says so,
       * and Back returns to what was open before. It used to be chosen,
       * which listed it beside the map only when nothing was open — with a
       * lens open, the lens stayed and the district opened behind it.
       */
      if (besideTheMap && card !== null && view.overview && !ownPictureOf(node) && !(lit && view.q)) {
        setView((current) => withWithin({ ...withFocus(current, `aggregate:${card}`), relation: null }, "view", null));
        setSelection([]);
        return;
      }
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
    },
  });
}

/*
 * THE RELATIONS FROM ALTITUDE, one ribbon each (`ribbons-layer.tsx`),
 * fetched the first time the city is drawn: a page that stays on the
 * ground carries none of them.
 */
const ribbonsModule = /* @__PURE__ */ lazyModule(retryingImport(() => import("./ribbons-layer.js")));
const Ribbons = /* @__PURE__ */ ribbonsModule.part(
  (module, props: Parameters<typeof import("./ribbons-layer.js").Ribbons>[0]) => <module.Ribbons {...props} />,
  { what: "The relations", quiet: true },
);

const ABOVE_KEY = "graview:map-from-above";
/** Whether this person looks at the city from straight above: their own way of looking, kept in this browser when it can be. */
function useFromAbove(): [boolean, (above: boolean) => void] {
  const [above, setAbove] = useState(() => {
    try {
      return globalThis.localStorage?.getItem(ABOVE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const choose = useCallback((next: boolean) => {
    setAbove(next);
    try {
      globalThis.localStorage?.setItem(ABOVE_KEY, next ? "1" : "0");
    } catch {
      // Not kept: it holds for this visit.
    }
  }, []);
  return [above, choose];
}

/*
 * THE GROUND OF THE CITY — its plots, their blocks, the roads and their
 * rules — fetched the first time the scene rises: a page that never looks
 * from altitude never carries it (`plots.tsx`).
 */
export const cityGround = lazyModule(retryingImport(() => import("./plots.js")));
const Plots = cityGround.part((module, props: PlotsProps) => <module.Plots {...props} />, { quiet: true });
/* THE APP'S WORKFLOWS ON THE MAP (`workflows-layer.tsx`), fetched with the ground they stand on. */
const Workflows = cityGround.part((module, props: Parameters<typeof import("./workflows-layer.js").WorkflowsLayer>[0]) => <module.WorkflowsLayer {...props} />, { quiet: true });

/** SCENE FURNITURE in the ground's other corner: the way a map carries its own zoom. */
function ZoomControls({ zoom, zoomBy, above, setAbove }: { readonly zoom: number; readonly zoomBy: (factor: number) => void; readonly above: boolean; readonly setAbove: (above: boolean) => void }) {
  /** One way to zoom: its sign, the step it takes, and whether the zoom has gone as far as it goes that way. */
  const button = (way: "out" | "in", sign: string, factor: number, disabled: boolean) => (
    <button
      type="button"
      className="graview-zoom-button"
      data-testid={`zoom-${way}`}
      aria-label={`Zoom ${way}`}
      title={`Zoom ${way} — or pinch, or ctrl+wheel`}
      disabled={disabled}
      onClick={() => zoomBy(factor)}
    >
      {sign}
    </button>
  );
  return (
    <div
      className="graview-zoom"
      // At the picture's foot: a notice placed there stands above it (FR-133).
      data-graview-foot=""
      role="group"
      aria-label="Zoom"
      onPointerDown={stop}
      onClick={stop}
    >
      {button("out", "−", 1 / 1.25, zoom <= ZOOM_MIN + 1e-6)}
      <span className="graview-zoom-level" data-testid="zoom-level" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      {button("in", "+", 1.25, zoom >= ZOOM_MAX - 1e-6)}
      {/* FROM ABOVE: the same ground seen straight down, every block flat and its state its shade — a person's own way of looking, kept in this browser. */}
      <button
        type="button"
        className="graview-zoom-button graview-zoom-above"
        data-testid="from-above"
        aria-pressed={above}
        title={above ? "See the city at an angle again" : "See the city from straight above"}
        onClick={() => setAbove(!above)}
      >
        From above
      </button>
    </div>
  );
}

/**
 * The spatial scene: one `<canvas layoutsubtree>` with the views as its
 * IMMEDIATE children.
 *
 * That flatness is a platform constraint, not a style: capture rejects
 * anything deeper than a direct child of the canvas. Nesting happens inside a
 * view, never between views.
 */
export function Scene<S extends AnySchema>({
  options,
  renderer = "auto",
  attachRenderer,
  blur = true,
  className,
  style,
  animate = true,
  children,
}: SceneProps) {
  const context = useGraview<S>();
  /* The app's workflows, its own or its document's: a compiled app carries them only there (`declaredWorkflows`). */
  const declaredWorkflows = context.app ? ((context.app as { workflows?: AppWorkflows }).workflows ?? (documentOf(context.app)?.workflows as AppWorkflows | undefined)) : undefined;
  const { store, scheme, views, view, setView, selection, setSelection, setMenuAt, emphasis, brand, noteMoved, robots, motion } = context;
  // A panel beside the map shows what is chosen from altitude, a record in focus among it (`mapChoice`).
  const besideTheMap = useContext(BesideTheMap);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // The box the scene is laid out for: the one it has, held while only a browser's toolbar folded away (`useBoxHeldThroughToolbars`).
  const measured = useElementSize(wrapperRef);
  const size = useBoxHeldThroughToolbars(measured);
  const unit = useRootUnit();

  // Pinch and ctrl+wheel: altitude from the ground, zoom about the pointer from above; the plain wheel pans. See scene-hand.ts.
  const { zoomAbout, panBy, pinchBy, pinchDone, pinching } = useWheelAndPinch({ stage: wrapperRef, view, setView });

  // `nodes` is a cached snapshot that only changes when the graph does, so
  // the layout is recomputed exactly when the picture could have changed.
  const nodes = useGraph<S>();
  /*
   * FLYING CLOSER. Choosing a picture from altitude brings the camera in:
   * the city's cell grows, the villages and roads with it, the billboard
   * bigger on its plot, and the camera keeps the picture in view. Derived
   * from the stop, never stored: leaving the picture flies back out.
   */
  /*
   * A PICTURE CHOSEN FROM ALTITUDE OPENS BESIDE THE MAP, at a size a person
   * reads (the lens panel), so the camera no longer flies closer to a
   * billboard on the plot: the city stays where it was, with the district
   * the picture is of lit and the rest receded.
   */
  const closer = 1;
  const [zoom, zoomLive, setZoom] = useHandZoom(view.overview);
  const [above, setAbove] = useFromAbove();
  const seenFrom = useMemo(() => (above ? { ...options, tilt: TOP_DOWN } : options), [options, above]);
  const { probe: dockProbe, dock } = useDock();
  /*
   * THE TRAIL'S ROOM. On the ground, where the picture's trail says
   * something — "zoomed in ×", "the past ×", a raised kind — the focused
   * card begins below it rather than under it: its top, 14 pixels down, and
   * a chip of the reader's text size (the tenth walk: "Shifts ×" over "Sort").
   */
  const headroom = !view.overview && (view.zoom || view.past || view.relation) ? Math.ceil(14 + (34 * unit) / 16 + 6) : 0;
  // On the ground what stands over the foot (the timeline) is the layout's to keep clear; from altitude the city is fitted above it itself.
  /*
   * AND THE SHEET HELD WITH IT. A phone's sheet is a share of the window, so
   * it grows when the toolbar folds away, and the city was fitted again to
   * what it left — drawn at another size under the finger. While the scene
   * keeps its box, it keeps the sheet it was laid out beside.
   */
  const grown = measured && size ? measured.height - size.height : 0;
  const keptDock = useRef(dock);
  if (grown <= 0) keptDock.current = dock;
  const docked = grown > 0 ? keptDock.current : dock;
  const sized = useLayoutOptions<S>(seenFrom, size, unit, closer * zoom, docked, nodes, headroom, view.overview ? 0 : docked.bottom);
  // What the picture's trail covers, for the signs at the top edge to step past.
  const trailBox = useTrailBox(wrapperRef);
  const [panned, seen, panWithin, cameraLive, setCamera] = useCamera(view);
  // A district cannot be placed by hand from altitude, so no plot wears the pinned curb for one (a pin in an old bookmark is ignored).
  const pinnedIds = useMemo(() => new Set(Object.keys(view.pins).filter((id) => kindOfCard(id) === null)), [view.pins]);
  // A district under the hand is placed here while it is dragged, and written into the view on release.
  const district = useHeldDistrict();
  const [result, inPlace] = useLaidOut(store, view, district.held, sized, nodes, seen.pan);
  const hand = useSteering(wrapperRef, motion);
  const { setDragging, steer, settleLive, settled } = hand;
  // Read as this render is drawn: the render that commits a hand's pan is drawn while the hand is still on it.
  const handOn = hand.dragging.current || hand.steering.current;
  // The picture as it is right now, part-way between the last view and this
  // one. Everything downstream draws the tween, not the destination.
  const firstMeasured = useFirstMeasured(size);
  /* THE HAND: dragging the ground to look around and a district to place it — see scene-hand.ts. */
  /** Letting go of a hand's zoom: filled in below, where the camera is known. */
  const zoomTo = useRef<(ratio: number, about: { x: number; y: number }) => void>(() => {});
  const shift = useWorldShift({
    stage: wrapperRef,
    pan: view.pan,
    zoom,
    setView,
    settled,
    zoomTo,
  });
  /*
   * A hand's pan is cut to with its offset already painted where the cut
   * puts every card, so it needs no second look; a zoom by the wheel moves
   * the geometry itself and does (`settle`, animation.ts).
   */
  const zoomed = useRef(false);
  if (!shift.settling.current) zoomed.current = false;
  const painted = shift.settling.current && !zoomed.current;
  const frame = useAnimatedLayout(result, { enabled: animate && !handOn && size !== null && !firstMeasured, settle: !painted });
  // Whether anything is moving: the hand, the wheel, or a transition not yet landed.
  // `t` is the tween's progress: a landed frame is at 1 (the frame is always a fresh object, never `result`).
  hand.tweening.current = frame.t < 1;
  // The showings a chosen district hangs, as drawn once the picture lands: the signs at the edge step past them.
  const hungShowings = useHungShowings(wrapperRef, frame.t >= 1, result);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the hand's refs are read when the frame changes
  useEffect(() => motion.set(hand.dragging.current || hand.steering.current || frame.t < 1), [motion, frame]);
  const touched = useTouched<S>();
  const seatWork = useSeatWork<S>();

  // Where the camera goes on its own: to a drive-in off the edge, and down into a village. See scene-camera.ts.
  const flights = useCameraFlights({ view, result, frame, panned, closer, screenId: null, setCamera });

  useLentWhereIs(context, frame, wrapperRef);
  usePointerReport(context.pointer, wrapperRef);
  const [onDom, drawOnDom] = useDrawnOnDom();
  const { attach, fallBack } = useRendererPath(renderer, attachRenderer);
  const blurred = usePlaneBlur(blur);
  useAttachedRenderer(attach, canvasRef, frame, touched, drawOnDom, blurred, scheme, fallBack);

  const useDom = attach === null;
  // The DOM path's blur, only while its frames keep to the budget (scene-blur.ts).
  // Judged while a transition moves blurred hosts; a hand moves the layers they are on by a transform, which repaints none of them.
  const domBlur = useDomBlurWithinBudget(blurred && useDom, frame.t < 1);

  const activityOf = useActivityOf<S>();

  // Wired here, where the shift exists; see the ref's own note in `useSteering`.
  settleLive.current = shift.settle;
  const { onGroundDown, onCardDown, onDragMove, onDragUp, onDragCancel, swallow } = useSceneDrag({
    view,
    panned,
    limit: () => cameraLimit(result),
    panWithin,
    // Both paths: on the GPU the canvas is one of the layers the hand moves, its pixels with it.
    moveByTransform: true,
    setView,
    setDragging,
    noteMoved,
    shift,
    district,
    pinching,
  });
  /* The ground answers a right-click and a resting finger with the scene's menu (FR-228). */
  const groundMenu = useGroundMenu({ swallow, setMenuAt, setSelection });
  /* A press a beat after a tap that moved the city lands on what it was aimed at (scene-aim.ts). */
  useAimedPress(wrapperRef, swallow);

  zoomAbout.current = (factor, clientX, clientY) => {
    if (!view.overview) return;
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
    zoomed.current = true;
    steer();
    setZoom(next);
    const box = wrapperRef.current?.getBoundingClientRect();
    // The middle of what the reader sees: a panel over the scene is not part of it.
    const seenBox = result.visible ?? result;
    const center = { x: seenBox.width / 2, y: seenBox.height / 2 };
    const pointer = box && clientX !== undefined && clientY !== undefined ? { x: clientX - box.left, y: clientY - box.top } : center;
    const ratio = next / current;
    setView((current) => withPan(current, panForZoom(current.pan ?? { x: 0, y: 0 }, cameraLive.current, pointer, center, ratio)));
    noteMoved();
  };
  /*
   * TWO FINGERS FROM ALTITUDE: the city zoomed about where they were and
   * moved as far as their middle moved, so what was under the fingers stays
   * under them — written as one change of the view a frame, as the wheel's
   * zoom is.
   */
  pinchBy.current = (factor, clientX, clientY, dx, dy) => {
    if (!view.overview) return;
    steer();
    const box = wrapperRef.current?.getBoundingClientRect();
    const about = box ? { x: clientX - box.left, y: clientY - box.top } : { x: 0, y: 0 };
    // Held within the zoom the controls allow, against the zoom the view has now.
    shift.zoomBy(factor, about, dx, dy, ZOOM_MIN / zoomLive.current, ZOOM_MAX / zoomLive.current);
    noteMoved();
  };
  pinchDone.current = () => {
    settleLive.current();
  };
  /*
   * A HAND'S ZOOM LET GO OF, written into the view once: the city's zoom by
   * `ratio`, and the pan that keeps the point the picture grew about where it
   * stood — the same reckoning a step of the zoom's own buttons makes.
   */
  zoomTo.current = (ratio, about) => {
    const current = zoomLive.current;
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current * ratio));
    zoomLive.current = next;
    zoomed.current = true;
    setZoom(next);
    const seenBox = result.visible ?? result;
    const center = { x: seenBox.width / 2, y: seenBox.height / 2 };
    setView((now) => withPan(now, panForZoom(now.pan ?? { x: 0, y: 0 }, cameraLive.current, about, center, next / current)));
  };
  /** The view's own pan moved by so much, held within the camera's reach. */
  const nudge = (dx: number, dy: number, limit = cameraLimit(result)) =>
    setView((current) => withPan(current, panWithin(limit, { x: (current.pan?.x ?? 0) + dx, y: (current.pan?.y ?? 0) + dy })));
  // Tab passes over a card the panel covers, and the camera brings the one it lands on into the part that is seen.
  useKeyboardKeepsToWhatIsSeen(wrapperRef, dock, (dx, dy) => nudge(dx, dy));
  panBy.current = (dx, dy) => {
    steer();
    const limit = cameraLimit(result);
    const pan = view.pan ?? { x: 0, y: 0 };
    /*
     * THE WHEEL IS A HAND TOO — so it moves the picture, and only the
     * wheel coming to rest moves the world. It was left on the old road
     * when the drag came off it: a `setView` per tick, which is a layout,
     * a render of every context consumer and a DOM re-measure for each
     * notch of a wheel.
     */
    const live = shift.offset();
    shift.shiftTo(panWithin(limit, { x: pan.x + live.x + dx, y: pan.y + live.y + dy }), pan);
    noteMoved();
  };

  const actsOn = useCardActs<S>();
  // Whether the kit draws a relation at all, for the ribbons (handed in: see ribbons-layer.tsx).
  const kit = useKit();
  const kitDraws = useCallback((edge: string) => kitConnector(kit, edge).connector.visible, [kit]);
  const drawnActivity = (id: string) => activityOf(frame.nodes.find((node) => node.id === id));
  /** How far down its card a plot's foot (`share` 1) or middle (2) stands, from the city's own origin and the pan. */
  const plotY = (city: NonNullable<Layout["city"]>, node: SceneNode, plot: NonNullable<SceneNode["plot"]>, share: number) =>
    city.originY + panned.y + toIso(plot.col + plot.side / share, plot.row + plot.side / share, city.cell, city.tilt).y - node.y;
  // The stage's extent: what the ground, its layers and its lines are all drawn over.
  const extent = { width: result.width, height: result.height };
  const stage = { position: "relative", zIndex: SCENE_LAYERS.stage, ...extent } as const;
  const whereIs = (id: string) => whereIsIn(frame, wrapperRef.current, scheme, views, id);

  /*
   * THE BILLBOARD IS NOT DRAWN. A picture chosen from altitude was its lens
   * drawn at the city's scale on its plot — eight-pixel text over the
   * districts, unreadable until it was opened. It opens beside the map now,
   * at full size (the lens panel); the stop is the same, so an address, the
   * bar and Back still name it.
   */
  // On the capture path a view the renderer handed on is drawn as the DOM path draws it.
  const hostedOnDom = (id: string) => useDom || onDom.has(id);
  // What the cards read of the context: the same, less the pan the scene moves them by (pan-free.tsx).
  const cards = usePanFreeContext(context);
  const forCards = (drawn: ReactNode) => <GraviewContext.Provider value={cards as unknown as GraviewContextValue<AnySchema>}>{drawn}</GraviewContext.Provider>;
  const hosts = frame.nodes.filter((node) => node.screenOf === undefined).map((node) => (
    <SceneViewHost
      key={node.id}
      node={node}
      crowded={crowded(node)}
      useDom={hostedOnDom(node.id)}
      blur={domBlur || (!useDom && blurred)}
      {...(node.plot && frame.city && Math.round(node.plane) === 2
        ? { frontY: plotY(frame.city, node, node.plot, 1), centerY: plotY(frame.city, node, node.plot, 2) }
        : {})}
      touched={touched.has(node.id)}
      {...withActivity(activityOf(node))}
      scheme={scheme}
      canvasWidth={result.width}
      canvasHeight={result.height}
      selected={selection.includes(node.id)}
      {...actsOn(node)}
      onMenu={setMenuAt}
      selection={selection}
      onDragStart={(event) => onCardDown(node, event)}
      onDragMove={onDragMove}
      onDragEnd={onDragUp}
      onDragCancel={onDragCancel}
      swallowClick={swallow}
    >
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
      data-graview-reach={frame.city ? reachOf(cameraLimit(result)) : undefined}
      // Nothing in motion: no tween running and no camera glide pending. A harness can wait on this rather than on a timer.
      data-graview-settled={frame.t >= 1 && !flights.gliding() ? "" : undefined}
      // The box the scene laid itself out for, so a harness can tell a box followed from one kept (FR-165).
      data-graview-box={size ? `${size.width}x${size.height}` : undefined}
      // Which path draws this page, and whether its receded planes are blurred — for a harness, never shown.
      data-graview-renderer={useDom ? "dom" : "gpu"}
      data-graview-blur={(useDom ? domBlur : blurred) ? "" : undefined}
      onPointerDown={(event) => {
        groundMenu.onPointerDown(event);
        onGroundDown(event);
      }}
      onPointerMove={(event) => {
        groundMenu.onPointerMove(event);
        onDragMove(event);
      }}
      onPointerUp={() => {
        groundMenu.onPointerUp();
        onDragUp();
      }}
      onPointerCancel={() => {
        groundMenu.onPointerUp();
        onDragCancel();
      }}
      /*
       * RIGHT-CLICKING EMPTY GROUND opens the scene's menu, never the
       * browser's (FR-228): a card answers its own and stops the event
       * before it gets here; the browser keeps its menu with Shift held and
       * in a text field.
       */
      onContextMenu={groundMenu.onContextMenu}
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
        // The panes are labeled sections now, not asides (FR-40); chrome is chrome either way.
        if (target.closest("[data-graview-view], button, aside, section[aria-label], [data-graview-offstage], a, input, select")) return;
        setSelection([]);
        setMenuAt(null);
      }}
      style={{
        position: "relative",
        /*
         * THE SCENE FILLS THE WHOLE PICTURE; A PANEL FLOATS OVER IT. The
         * ground, the grid, the depth and the tint run under the panel and
         * show in the gap around it. What a panel takes from the map is the
         * city's fit and the camera's bounds (`useDock`, `--graview-dock`,
         * `--graview-sheet`), never the scene's own box.
         */
        width: "100%",
        height: "100%",
        // Never changed by a render: the hand writes the grabbing cursor while it holds the ground (`markHand`).
        cursor: "grab",
        touchAction: "none",
        /*
         * A LIST IN A CARD SCROLLED TO ITS END GOES NO FURTHER. Its finger's
         * scroll chained on past the ground to the page: on a phone the page
         * behind the scene pulled down to refresh, or rubber-banded.
         */
        overscrollBehavior: "contain",
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
              ["--graview-lattice-tilt" as string]: (frame.city.tilt ?? 0.5).toFixed(3),
              // The tween's own pan, not the live one: the ground moves with the cards it is under.
              ["--graview-lattice-x" as string]: `${(frame.city.originX + frame.city.pan.x).toFixed(1)}px`,
              ["--graview-lattice-y" as string]: `${(frame.city.originY + frame.city.pan.y).toFixed(1)}px`,
            }
          : {}),

        // The stage is sized to the measurement, but a stale measurement
        // during a resize can briefly exceed it. Clipping keeps the scene
        // inside its own bounds instead of pushing the page taller and
        // cutting off anything floating over it.
        overflow: "hidden",
        ...style,
      }}
    >
      {/*
        * THE FINE MEASURE, first on the ground as its ::before was: part of
        * the picture, so it stands where the world is moved to — the frame's
        * own pan, which tweens with the cards — and a hand moves it with the
        * cards while it drags (scene-hand.ts). Said on it alone: a custom
        * property on the ground is inherited by every element in the scene.
        */}
      <div
        className="graview-measure"
        aria-hidden="true"
        style={{
          ["--graview-world-x" as string]: `${(frame.pan?.x ?? 0).toFixed(1)}px`,
          ["--graview-world-y" as string]: `${(frame.pan?.y ?? 0).toFixed(1)}px`,
        }}
      />
      {/* THE RELATIONS, one ribbon each between the districts they join (see ribbons-layer.tsx): on the ground, under the districts and their buildings. */}
      {view.overview && frame.city ? (
        <Suspense fallback={null}>
          <Ribbons
            frame={frame}
            {...extent}
            pan={frame.city.pan}
            store={store}
            graphVersion={nodes}
            selection={selection}
            view={{ overview: view.overview, focusId: view.focusId, beside: besideTheMap }}
            emphasis={emphasis}
            hiddenKinds={context.hiddenKinds}
            drawn={kitDraws}
          />
        </Suspense>
      ) : null}
      {/*
        * THE GROUND: every district's plot as a tile, under the cards and
        * over the fields, from the same origin and pan the lattice rides.
        */}
      {/* Where the panel's room is read from: sized by what the panel says it takes, never seen. */}
      <div ref={dockProbe} aria-hidden="true" style={{ position: "absolute", top: 0, right: 0, width: "var(--graview-dock, 0px)", height: "var(--graview-sheet, 0px)", visibility: "hidden", pointerEvents: "none" }} />
      {frame.city ? (
      <Suspense fallback={null}>
      <Plots
        frame={frame}
        {...extent}
        // The tween's own pan: the tiles, the villages and the roads move with the cards on them.
        pan={frame.city ? frame.city.pan : panned}
        brand={brand}
        pinned={pinnedIds}
        close={closer * zoom > 1.2}
        swallowed={swallow}
        {...(view.overview ? { chosen: mapChoice(selection, { overview: view.overview, focusId: view.focusId, beside: besideTheMap }, (id) => store.graph.getNode(id)?.kind as string | undefined).records } : {})}
        // A tile is its district: focusing it means the kind's aggregate, never the card's own id.
        onFocus={(id) => {
          const kind = kindOfCard(id);
          if (kind !== null) setView((current) => withFocus(current, aggregateId(kind)));
        }}
      />
      </Suspense>
      ) : null}
      {/* THE APP'S WORKFLOWS, each in the street beside the district it writes, wired to what it reads and writes (see workflows-layer.tsx). */}
      {view.overview && frame.city && declaredWorkflows ? (
        <Suspense fallback={null}>
          <Workflows
            frame={frame}
            {...extent}
            pan={frame.city.pan}
            app={context.app as unknown as GraviewApp<AnySchema>}
            workflows={declaredWorkflows}
            acts={store.allMutations() as never}
            runs={context.workflowRuns}
            graphVersion={nodes}
            hiddenKinds={context.hiddenKinds}
          />
        </Suspense>
      ) : null}
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
          style={{ ...stage, overflow: "hidden" }}
        >
          {forCards(hosts)}
        </div>
      ) : (
        /*
         * One of the layers the hand moves as a unit (`liveShift`): a pan
         * moves the canvas and what is under it by a transform, as it moves
         * the DOM path's stage, and the GPU redraws nothing until it lands.
         */
        <div data-graview-world="" style={stage}>
          {/*
           * THE DOM PATH UNDER THE CANVAS: the views the renderer handed
           * on, drawn at the same transform. The canvas clears to
           * transparent, so they show wherever the GPU drew nothing — and a
           * view the GPU draws over one of them is nearer, as it should be.
           */}
          <div
            data-graview-stage="dom"
            data-graview-under-canvas=""
            style={{ position: "absolute", left: 0, top: 0, ...extent, overflow: "hidden" }}
          >
            {forCards(hosts.filter((host) => onDom.has(String(host.key))))}
          </div>
          <canvas
            ref={canvasRef}
            data-graview-stage="gpu"
            // Both spellings: `content="drawable"` (Chromium 158) and `layoutsubtree` (154).
            {...{ content: "drawable", layoutsubtree: "" }}
            {...extent}
            style={{ display: "block", position: "relative", ...extent }}
          >
            {forCards(hosts.filter((host) => !onDom.has(String(host.key))))}
          </canvas>
        </div>
      )}
      {view.overview ? (
        /* What the window does not reach, named on the edge it lies past (see edge-signs.tsx). */
        <EdgeSigns
          result={result}
          schema={store.schema as AnySchema}
          chrome={[...(sized.chrome ?? []), ...(trailBox ? [trailBox] : []), ...hungShowings]}
          onGo={(by) => {
            nudge(by.x, by.y);
            noteMoved();
          }}
        />
      ) : null}
      {view.overview ? <ZoomControls zoom={zoom} zoomBy={(factor) => zoomAbout.current(factor)} above={above} setAbove={setAbove} /> : null}
      <Lines
        frame={frame}
        focusId={view.focusId}
        beside={besideTheMap}
        holding={inPlace}
        {...extent}
        scheme={scheme}
        overview={!!view.overview}
        selection={selection}
        emphasis={emphasis}
        stageRef={wrapperRef}
        store={store}
        graphNodes={nodes}
        // Links made less than sure and not yet kept by a person, drawn as such (FR-172).
        {...((provisional) => (provisional ? { provisional } : {}))(provisionalLines(store))}
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
          const from = drawnActivity(connector.from);
          const to = drawnActivity(connector.to);
          return from?.wrote && to?.wrote ? (from.at > to.at ? from : to) : undefined;
        }}
      />
      {/*
        * THE OCCUPANTS — the robots — over the stage on both paths, placed
        * from the frame being drawn. Never in layout(): a body stands where
        * the fold says, at the box whereIs answers.
        */}
      <Occupants width={result.width} whereIs={whereIs} />
      {/* What the seat just wrote, marked where it is — the attribution the figure used to carry. */}
      <SeatMarks
        marks={seatWork.marks}
        questions={[...robots.values()]
          .filter((one) => one.mode === "asking" && one.at !== null && one.say)
          .map((one) => ({ id: one.at!, who: one.who, asks: one.say! }))}
        whereIs={whereIs}
        stageRef={wrapperRef}
        {...extent}
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
      {/* THE LATTICE, last on the ground as its ::after was: the theme draws it, anchored by the ground's --graview-lattice-x/-y, and a hand moves it (scene-hand.ts). */}
      <div className="graview-lattice" aria-hidden="true" />
    </div>
  );
}
