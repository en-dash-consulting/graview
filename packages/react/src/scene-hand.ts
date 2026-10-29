import { kindOfCard, withOverview, type ViewState } from "@graview/layout/view";
import { withPan, withPin } from "@graview/layout/view-moves";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { SceneNode } from "./scene-node.js";

/*
 * THE HAND ON THE SCENE: dragging the ground to look around, and dragging a
 * district to place it.
 *
 * Two gestures, one mechanism. Drag the ground and the camera moves; drag a
 * card and it stays where you put it. Both are ordinary view state — a pan
 * and a pin — so both go in the URL, both interpolate, and both come back
 * when someone opens the link. Neither is a mode: there is nothing to turn
 * on and nothing to turn off.
 *
 * And neither is written into the view until the hand lets go. The view is
 * part of the Graview context, so writing it on every pointer move redrew
 * every reader of the context — every lens in the city — sixty times a
 * second to show the same picture somewhere else.
 */

/** A district where the hand has put it, in the unpanned space a pin is stored in. */
export interface Held {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/**
 * THE DISTRICT UNDER THE HAND, placed in the scene while it is dragged —
 * at most once a frame, since pointer events arrive faster than frames are
 * drawn — and handed back on release to be written into the view once.
 */
/**
 * WHAT A PANEL FLOATING OVER THE SCENE COVERS, in pixels. The panel says how
 * wide it docks, or how tall its sheet stands, in `--graview-dock` and
 * `--graview-sheet` on the box it floats in; a probe in the scene, sized by
 * those, is how the scene reads them as numbers. The scene itself is not
 * narrowed by it: the ground is painted under the panel, and only the city's
 * fit and the camera's bounds are for what is left.
 */
export function useDock(): { readonly probe: RefObject<HTMLDivElement | null>; readonly dock: { readonly right: number; readonly bottom: number } } {
  const probe = useRef<HTMLDivElement | null>(null);
  const [dock, setDock] = useState({ right: 0, bottom: 0 });
  useLayoutEffect(() => {
    const element = probe.current;
    if (!element) return;
    const read = () => {
      const box = element.getBoundingClientRect();
      const next = { right: Math.round(box.width), bottom: Math.round(box.height) };
      setDock((now) => (now.right === next.right && now.bottom === next.bottom ? now : next));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(read);
    watch.observe(element);
    return () => watch.disconnect();
  }, []);
  return { probe, dock };
}

export function useHeldDistrict() {
  const [held, setHeld] = useState<Held | null>(null);
  const placing = useRef<Held | null>(null);
  const frame = useRef(0);
  const place = useCallback((next: Held) => {
    placing.current = next;
    if (frame.current !== 0) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setHeld(placing.current);
    });
  }, []);
  /** Letting go: where the hand last put it, if it put it anywhere. */
  const release = useCallback((): Held | null => {
    if (frame.current !== 0) cancelAnimationFrame(frame.current);
    frame.current = 0;
    const put = placing.current;
    placing.current = null;
    if (put) setHeld(null);
    return put;
  }, []);
  return { held, place, release };
}

/**
 * THE HAND MOVES THE PICTURE; ONLY LETTING GO MOVES THE WORLD.
 *
 * While a hand is on it, the offset it has made is painted straight onto
 * the world's layers as a transform, once per animation frame, outside
 * React entirely. Letting go writes it into the view as a pan, and the
 * transform is cleared once that has been committed, so the picture never
 * jumps back for a frame. `settled` is told when the gesture is over — the
 * world already where the hand left it, so nothing tweens its way there.
 *
 * The GPU path keeps the old road: its stage is a `layoutsubtree` canvas,
 * and combining that with CSS transforms crashes the renderer. It is not
 * the default path and it is not the measured one.
 */
export function useWorldShift({
  stage,
  pan,
  zoom,
  setView,
  settled,
  zoomTo,
}: {
  readonly stage: RefObject<HTMLElement | null>;
  /** The view's pan: the transform comes off when this has taken the offset. */
  readonly pan: ViewState["pan"];
  /** The city's zoom: the transform comes off when this has taken a hand's zoom, too. */
  readonly zoom: number;
  readonly setView: (update: (current: ViewState) => ViewState) => void;
  readonly settled: () => void;
  /** Letting go of a zoom: the city zoomed by `ratio` about `about` (in the ground's pixels), written into the view once. */
  readonly zoomTo: RefObject<(ratio: number, about: { x: number; y: number }) => void>;
}) {
  /*
   * WHAT THE HAND HAS DONE TO THE PICTURE: moved it by (x, y), and — a pinch
   * or a ctrl+wheel from altitude — grown it by `s` about the ground's
   * corner. A zoom was a new layout per frame, thirty milliseconds of work
   * each on a thousand records at a phone's speed; the picture grows under
   * the fingers now, and only letting go draws the city at its new size.
   */
  const live = useRef({ x: 0, y: 0, s: 1 });
  const painting = useRef(0);
  const settling = useRef(false);
  const settledLive = useRef(settled);
  settledLive.current = settled;
  const layers = useCallback(() => [...(stage.current?.querySelectorAll<HTMLElement>("[data-graview-world]") ?? [])], [stage]);
  const put = useCallback(
    ({ x, y, s }: { x: number; y: number; s: number }) => {
      const move = s !== 1 ? `translate3d(${x}px, ${y}px, 0) scale(${s})` : x === 0 && y === 0 ? "" : `translate3d(${x}px, ${y}px, 0)`;
      for (const layer of layers()) {
        layer.style.transform = move;
        layer.style.transformOrigin = s !== 1 ? "0 0" : "";
      }
      handOnTheGround(stage.current, x, y, s);
    },
    [layers, stage],
  );
  const paint = useCallback(() => {
    if (painting.current !== 0) return;
    painting.current = requestAnimationFrame(() => {
      painting.current = 0;
      put(live.current);
    });
  }, [put]);
  const clear = useCallback(() => {
    settling.current = false;
    for (const layer of layers()) {
      layer.style.transform = "";
      layer.style.transformOrigin = "";
    }
    handOnTheGround(stage.current, 0, 0, 1);
    settledLive.current();
  }, [layers, stage]);

  /** Where the hand has taken the picture, against where the view says it is. */
  const shiftTo = useCallback(
    (wanted: { x: number; y: number }, from: { x: number; y: number }) => {
      live.current = { x: wanted.x - from.x, y: wanted.y - from.y, s: live.current.s };
      paint();
    },
    [paint],
  );

  /**
   * The picture grown by `ratio` about `about` (the ground's pixels) and moved by (dx, dy) — held to `least`…`most`
   * of the size the view has — painted, and not yet in the view.
   */
  const zoomBy = useCallback(
    (ratio: number, about: { x: number; y: number }, dx: number, dy: number, least: number, most: number) => {
      const { x, y, s } = live.current;
      const next = Math.max(least, Math.min(most, s * ratio));
      const r = next / s;
      live.current = { x: x * r + about.x * (1 - r) + dx, y: y * r + about.y * (1 - r) + dy, s: next };
      paint();
    },
    [paint],
  );

  /** Letting go: the offset becomes the view's own pan. False when there was none. */
  const settle = useCallback((): boolean => {
    const { x, y, s } = live.current;
    if (x === 0 && y === 0 && s === 1) return false;
    /*
     * WHERE THE HAND LAST WAS, PAINTED NOW: a move after the last frame is
     * part of the pan, and the render that commits it measures its lines
     * from the DOM as it stands — which is then exactly where the pan puts
     * every card, so it needs no second look (`settle` in animation.ts).
     */
    if (painting.current !== 0) cancelAnimationFrame(painting.current);
    painting.current = 0;
    put({ x, y, s });
    live.current = { x: 0, y: 0, s: 1 };
    settling.current = true;
    if (Math.abs(s - 1) > 1e-4) {
      // A picture grown by s and moved by (x, y) is the city zoomed by s about the one point that stayed where it was.
      zoomTo.current(s, { x: x / (1 - s), y: y / (1 - s) });
    } else {
      setView((current) => {
        const at = current.pan ?? { x: 0, y: 0 };
        return withPan(current, { x: at.x + x, y: at.y + y });
      });
    }
    /*
     * AND IF THE VIEW NEVER ARRIVES, LET GO ANYWAY. A scene whose view is
     * controlled from outside may decline the change, and then nothing
     * would clear the transform. LATE ON PURPOSE: a `requestAnimationFrame`
     * here beat React to the commit, and every release flashed the whole
     * city back to where the drag had started for one frame.
     */
    window.setTimeout(() => {
      if (settling.current) clear();
    }, 300);
    return true;
  }, [setView, clear, put, zoomTo]);

  /*
   * CLEARED ONLY ONCE THE WORLD HAS ACTUALLY MOVED. Clearing the transform
   * in the same breath as the state change put the picture back where it
   * started for one frame, because React had not committed the new pan yet.
   */
  useLayoutEffect(() => {
    if (settling.current) clear();
  }, [pan, zoom, clear]);

  /*
   * THE BROWSER TOOK THE HAND. A `pointercancel` says the touch became the
   * browser's — a list inside a card scrolling under the finger — and what
   * the hand had moved so far was never meant: the picture goes back to
   * where the view has it, and nothing is written.
   */
  const drop = useCallback(() => {
    if (painting.current !== 0) cancelAnimationFrame(painting.current);
    painting.current = 0;
    live.current = { x: 0, y: 0, s: 1 };
    clear();
  }, [clear]);

  /** The offset the hand has made so far, not yet in the view. */
  const offset = useCallback(() => live.current, []);
  return { shiftTo, zoomBy, settle, drop, settling, offset };
}

/**
 * THE GROUND MOVES WITH THE PICTURE. The lattice the city stands on is
 * drawn on the ground (`.graview-lattice`), anchored where the city's cell
 * (0,0) meets the canvas (`--graview-lattice-x`/`-y`, from the committed
 * pan), and it is not one of the world's layers: while a hand moved the
 * layers, the grid stood still under the cards and jumped to meet them when
 * the pan was let go. So the offset the hand has made is said on the
 * lattice too, in the same frame as the transform (`--graview-hand-x`/`-y`,
 * which the theme adds to the anchor), and taken off in the same commit
 * that moves the anchor by as much.
 *
 * ON THE LATTICE ALONE: a custom property is inherited, and said on the
 * ground it recalculated the style of every element in the scene each
 * frame — six hundred milliseconds of a forty-move drag at a quarter speed.
 */
function handOnTheGround(ground: HTMLElement | null, x: number, y: number, s: number) {
  // Both grids under the picture: the lattice from altitude and the fine measure on the ground (`.graview-measure`).
  for (const grid of ground?.querySelectorAll<HTMLElement>(":scope > .graview-lattice, :scope > .graview-measure") ?? []) {
    /*
     * A ZOOM GROWS THE LATTICE WITH THE CITY: its cell by as much, and its
     * anchor — where cell (0,0) meets the canvas — carried where the
     * transform carries that point. Said on the lattice alone, as the move is.
     */
    const lattice = s !== 1 && grid.classList.contains("graview-lattice") && ground ? latticeOf(ground) : null;
    if (lattice) grid.style.setProperty("--graview-lattice-cell", `${(lattice.cell * s).toFixed(2)}px`);
    else grid.style.removeProperty("--graview-lattice-cell");
    const hx = lattice ? lattice.x * (s - 1) + x : x;
    const hy = lattice ? lattice.y * (s - 1) + y : y;
    if (hx === 0 && hy === 0) {
      grid.style.removeProperty("--graview-hand-x");
      grid.style.removeProperty("--graview-hand-y");
      continue;
    }
    grid.style.setProperty("--graview-hand-x", `${hx}px`);
    grid.style.setProperty("--graview-hand-y", `${hy}px`);
  }
}

/** The lattice as the ground says it: its cell and its anchor, in pixels; none when the ground draws no city. */
function latticeOf(ground: HTMLElement): { cell: number; x: number; y: number } | null {
  const cell = parseFloat(ground.style.getPropertyValue("--graview-lattice-cell"));
  if (!Number.isFinite(cell)) return null;
  return { cell, x: parseFloat(ground.style.getPropertyValue("--graview-lattice-x")) || 0, y: parseFloat(ground.style.getPropertyValue("--graview-lattice-y")) || 0 };
}

/** How far a pointer has to travel before a press is a drag: below it, a click is a click. */
const DRAG_THRESHOLD = 4;

/**
 * WHETHER A PRESS LANDED IN SOMETHING OF A CARD'S THAT SCROLLS ON ITS OWN —
 * a focused district's list, a long preview. A finger there scrolls it, and
 * the browser takes the touch to do so; the card began to move under the
 * same finger first, and was pinned wherever the scroll left it.
 */
export function inScroller(target: Element | null, card: Element): boolean {
  for (let at = target; at && at !== card; at = at.parentElement) {
    const style = getComputedStyle(at);
    if (/(auto|scroll)/.test(style.overflowY) && at.scrollHeight > at.clientHeight + 1) return true;
    if (/(auto|scroll)/.test(style.overflowX) && at.scrollWidth > at.clientWidth + 1) return true;
  }
  return false;
}

/**
 * THE GESTURES THEMSELVES. The threshold is what keeps a click a click:
 * below it nothing has happened and the pointer-up is an ordinary
 * selection; above it the gesture owns the pointer and the click that
 * follows is swallowed.
 */
export function useSceneDrag({
  view,
  panned,
  limit,
  panWithin,
  moveByTransform,
  setView,
  setDragging,
  noteMoved,
  shift,
  district,
  pinching,
}: {
  readonly view: ViewState;
  /** The pan baked into the drawn cards: a card's pin is stored without it. */
  readonly panned: { readonly x: number; readonly y: number };
  /** How far the camera may go, for the frame as it is now. */
  readonly limit: () => { readonly x: number; readonly y: number };
  readonly panWithin: (limit: { x: number; y: number }, wanted: { x: number; y: number }) => { x: number; y: number };
  /** The DOM path paints the pan as a transform; the GPU path writes the view. */
  readonly moveByTransform: boolean;
  readonly setView: (update: (current: ViewState) => ViewState) => void;
  readonly setDragging: (dragging: boolean) => void;
  readonly noteMoved: () => void;
  readonly shift: ReturnType<typeof useWorldShift>;
  readonly district: ReturnType<typeof useHeldDistrict>;
  /** Two fingers are on the scene (`useWheelAndPinch`): they zoom, and no one finger's drag is begun or carried on. */
  readonly pinching: RefObject<boolean>;
}) {
  /** Set for the click a drag is about to produce, so a drag that ends on a card does not also select it. */
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
  const panFrom = (event: ReactPointerEvent<HTMLElement>) => {
    const pan = view.pan ?? { x: 0, y: 0 };
    gesture.current = { kind: "pan", fromX: event.clientX, fromY: event.clientY, baseX: pan.x, baseY: pan.y, moved: false };
  };

  const onGroundDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || pinching.current) return;
    // Only the ground itself. A card, a chip or anything a view drew keeps
    // whatever meaning it already had.
    if ((event.target as HTMLElement).closest("[data-graview-view]")) return;
    panFrom(event);
  };

  const onCardDown = (node: SceneNode, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || pinching.current) return;
    /*
     * A FINGER IN A LIST THAT SCROLLS SCROLLS IT. The card moving under the
     * same finger, and pinned where the scroll left it, was a focused
     * district's list that could not be read on a phone without dragging
     * the district about. A mouse keeps its drag: it scrolls with the wheel.
     */
    if (event.pointerType !== "mouse" && inScroller(event.target as Element, event.currentTarget)) return;
    /*
     * A PICTURE IS NOT A THING YOU REARRANGE — you look around it. A drag
     * that starts on a billboard moves the view, unless it started on the
     * rail, which is the one part of a billboard that means "move the
     * board". A district's own card keeps its drag, because placing a
     * district by hand is a real gesture with a dashed curb to show for it.
     */
    if (node.screenOf !== undefined && !(event.target as HTMLElement).closest("[data-graview-grip]")) {
      panFrom(event);
      return;
    }
    /*
     * A DISTRICT IS WHERE THE DATA PUTS IT, from altitude. The city is laid
     * out by what the kinds point at, upstream to downstream, and a name
     * stands under its own plot; a name dragged off its plot — and pinned
     * there, in the address — is the geometry that compensates for the
     * layout instead of reading from it. So a drag that starts on a district
     * is the ground's own gesture, the one empty ground makes: it pans the
     * city. The card is still pressed to be chosen and double-pressed to go
     * in, and a record's card is still moved by hand.
     */
    if (view.overview && kindOfCard(node.id) !== null) {
      panFrom(event);
      return;
    }
    gesture.current = {
      kind: "card",
      id: node.id,
      fromX: event.clientX,
      fromY: event.clientY,
      // Unpanned, because that is the space a pin is stored in.
      baseX: node.x - panned.x,
      baseY: node.y - panned.y,
      moved: false,
    };
  };

  /*
   * A GESTURE LET GO OF WITHOUT ENDING: a second finger came down, and the
   * two of them zoom (`keep` — what the first finger panned stays panned),
   * or the browser took the touch (`pointercancel`), and nothing it moved
   * is kept. Either way no click that follows chooses anything.
   */
  const abandon = (keep: boolean) => {
    const drag = gesture.current;
    gesture.current = null;
    district.release();
    if (keep) shift.settle();
    else shift.drop();
    if (drag) {
      swallow.current = true;
      setTimeout(() => (swallow.current = false), 0);
    }
    if (!shift.settling.current) setDragging(false);
  };

  const onDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = gesture.current;
    if (!drag) return;
    if (pinching.current) {
      abandon(true);
      return;
    }
    const dx = event.clientX - drag.fromX;
    const dy = event.clientY - drag.fromY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      setDragging(true);
      /*
       * Capture only once it IS a drag. Taken on pointer-down it redirected
       * the click and double-click that followed to the host, and
       * double-clicking a task opened the card instead of traveling into it.
       */
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        // A pointer the browser no longer holds (lifted already, or never its own): the drag goes on without the capture.
      }
    }
    if (drag.kind === "pan") {
      // A little way over a picture that fits, and as far as the city reaches when it is bigger.
      const wanted = panWithin(limit(), { x: drag.baseX + dx, y: drag.baseY + dy });
      if (moveByTransform) shift.shiftTo(wanted, view.pan ?? { x: 0, y: 0 });
      else setView((current) => withPan(current, wanted));
    } else if (drag.id) {
      district.place({ id: drag.id, x: drag.baseX + dx, y: drag.baseY + dy });
    }
  };

  const onDragUp = () => {
    shift.settle();
    // The district that was under the hand goes into the view, once, where the hand last put it.
    const put = district.release();
    if (put) setView((current) => withPin(current, put.id, { x: put.x, y: put.y }));
    if (gesture.current?.moved) {
      swallow.current = true;
      setTimeout(() => (swallow.current = false), 0);
      // And say a hand moved something, so the bar can offer to put it back.
      noteMoved();
    }
    gesture.current = null;
    /*
     * THE COMMIT A HAND MADE IS NOT A TRANSITION EITHER. The drag stays open
     * until the pan it made has been drawn — the world shift closes it, in
     * the same commit that moves the cards — or the whole city would fly
     * from where the drag started to where it ended, after the hand had
     * already put it there.
     */
    if (shift.settling.current) return;
    setDragging(false);
  };

  /** The browser took the touch: whatever the hand moved goes back, and nothing is written. */
  const onDragCancel = () => {
    if (gesture.current) abandon(false);
  };

  return { onGroundDown, onCardDown, onDragMove, onDragUp, onDragCancel, swallow };
}

/**
 * THE WHEEL AND THE PINCH. `zoomAbout` and `panBy` are filled in by the
 * scene once it knows its city; the listeners call through them, so they
 * are attached once rather than on every zoom.
 */
export function useWheelAndPinch({
  stage,
  view,
  setView,
}: {
  readonly stage: RefObject<HTMLElement | null>;
  readonly view: ViewState;
  readonly setView: (next: ViewState) => void;
}) {
  /*
   * PINCH IS ALTITUDE. The camera has one axis, so the universal zoom
   * gesture maps to it: fingers together rises to the Graview, fingers
   * apart descends — one discrete step per gesture, with a cooldown so a
   * long pinch does not bounce. Chromium and Firefox hand a trackpad
   * pinch over as ctrl+wheel; Safari speaks GestureEvent. Both are
   * claimed here so the browser's own page zoom never fires on the scene.
   */
  const altitude = useRef({ view, charge: 0, coolUntil: 0, lastScale: 1 });
  altitude.current.view = view;
  /*
   * FROM ALTITUDE, PINCH AND CTRL+WHEEL ZOOM THE CITY — continuously, about
   * the pointer, the way every map does — and the plain wheel pans the
   * ground. Stepping the altitude once per gesture with a cooldown read as
   * a zoom that sticks. From the ground, fingers together still rise: the
   * way up is a gesture, the way down is the picture's own control.
   */
  const zoomAbout = useRef<(factor: number, clientX?: number, clientY?: number) => void>(() => {});
  const panBy = useRef<(dx: number, dy: number) => void>(() => {});
  /** Two fingers' move from altitude: zoomed by `factor` about where they were, then moved as far as their middle moved. */
  const pinchBy = useRef<(factor: number, clientX: number, clientY: number, dx: number, dy: number) => void>(() => {});
  /** The last finger lifted: what the fingers did to the picture goes into the view. */
  const pinchDone = useRef<() => void>(() => {});
  /** Whether two fingers are on the scene, from the second one down until the last one lifts. */
  const pinching = useRef(false);
  /** The fingers on the scene, where they last were, and what their moves owe the view this frame. */
  const touch = useRef<{
    readonly fingers: Map<number, { x: number; y: number }>;
    pinch: { from: number; last: number; mid: { x: number; y: number } } | null;
    owed: { factor: number; x: number; y: number; dx: number; dy: number } | null;
    owing: number;
  }>({ fingers: new Map(), pinch: null, owed: null, owing: 0 });
  useEffect(() => {
    const element = stage.current;
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
      const held = altitude.current;
      const up = held.view.overview ?? false;
      if (event.ctrlKey) {
        event.preventDefault();
        if (!up) {
          held.charge += event.deltaY;
          if (Math.abs(held.charge) < 60) return;
          if (held.charge > 0) step(true, performance.now());
          else held.charge = 0;
          return;
        }
        // A mouse notch (a hundred) is a step and a half; a trackpad's few units are a nudge. Held as the hand's until the wheel rests.
        pinchBy.current(Math.exp(-event.deltaY * 0.004), event.clientX, event.clientY, 0, 0);
        return;
      }
      if (!up) return;
      // Over the ground only: a lens, a scroll region or a pane keeps its own wheel.
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-graview-view], .graview-scroll, [data-graview-overlay], .graview-zoom")) return;
      event.preventDefault();
      panBy.current(-event.deltaX, -event.deltaY);
    };
    /*
     * TWO FINGERS ON A TOUCH SCREEN, read from their pointers. Chrome on a
     * phone hands a pinch over as nothing but two touches — no ctrl+wheel,
     * no GestureEvent — so with `touch-action: none` on the ground a pinch
     * did not zoom at all: the first finger panned the city, and a second
     * finger coming down re-based the pan under it. Safari speaks
     * GestureEvent as well as the pointers; while two fingers are down the
     * pointers are the one reading, so the city is not zoomed twice.
     *
     * Read here, on the stage itself, so it is heard before React's own
     * handlers on the cards and the ground: by the time a card hears the
     * second finger, `pinching` already says it is a pinch.
     */
    /*
     * KEPT ACROSS THE LISTENERS BEING ATTACHED AGAIN: the effect runs again
     * when the scene's `setView` does, which the pinch's own first change of
     * the view can bring about, and fingers held in the effect were then
     * forgotten after the first frame of a pinch.
     */
    const hand = touch.current;
    const fingers = hand.fingers;
    const pay = () => {
      hand.owing = 0;
      const due = hand.owed;
      hand.owed = null;
      if (due) pinchBy.current(due.factor, due.x, due.y, due.dx, due.dy);
    };
    const spread = () => {
      const [a, b] = [...fingers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      return { apart: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };
    const onFingerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      // The first finger of a new touch: whatever an earlier touch left behind (a lift never heard) is gone.
      if (event.isPrimary) {
        fingers.clear();
        hand.pinch = null;
        pinching.current = false;
      }
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.size !== 2) return;
      const { apart, mid } = spread();
      hand.pinch = { from: apart, last: apart, mid };
      pinching.current = true;
    };
    const onFingerMove = (event: PointerEvent) => {
      if (!fingers.has(event.pointerId)) return;
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pinch = hand.pinch;
      if (!pinch || fingers.size !== 2) return;
      const { apart, mid } = spread();
      const held = altitude.current;
      if (!(held.view.overview ?? false)) {
        // From the ground, fingers together rise, as the trackpad's pinch does.
        if (apart / pinch.from < 0.72) step(true, performance.now());
      } else {
        const owed = (hand.owed ??= { factor: 1, x: pinch.mid.x, y: pinch.mid.y, dx: 0, dy: 0 });
        owed.factor *= apart / pinch.last;
        owed.dx += mid.x - pinch.mid.x;
        owed.dy += mid.y - pinch.mid.y;
        if (hand.owing === 0) hand.owing = requestAnimationFrame(pay);
      }
      pinch.last = apart;
      pinch.mid = mid;
    };
    const onFingerUp = (event: PointerEvent) => {
      if (!fingers.delete(event.pointerId)) return;
      if (fingers.size < 2) hand.pinch = null;
      if (fingers.size > 0) return;
      // The last finger lifted: what is owed lands now, and the next finger down is a drag again.
      if (hand.owing !== 0) cancelAnimationFrame(hand.owing);
      pay();
      pinching.current = false;
      pinchDone.current();
    };
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      altitude.current.lastScale = 1;
    };
    const onGesture = (event: Event) => {
      event.preventDefault();
      // Two fingers on a touch screen are read from their pointers (above).
      if (pinching.current || fingers.size > 1) return;
      const held = altitude.current;
      const scale = (event as Event & { scale?: number; clientX?: number; clientY?: number }).scale ?? 1;
      if (!(held.view.overview ?? false)) {
        if (scale < 0.72) step(true, performance.now());
        return;
      }
      const ratio = scale / (held.lastScale || 1);
      held.lastScale = scale;
      const at = event as Event & { clientX?: number; clientY?: number };
      zoomAbout.current(ratio, at.clientX, at.clientY);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("gesturestart", onGestureStart);
    element.addEventListener("gesturechange", onGesture);
    element.addEventListener("pointerdown", onFingerDown);
    element.addEventListener("pointermove", onFingerMove);
    element.addEventListener("pointerup", onFingerUp);
    element.addEventListener("pointercancel", onFingerUp);
    return () => {
      // What the fingers owe still lands: the next listeners pick up the same hand.
      if (hand.owing !== 0) {
        cancelAnimationFrame(hand.owing);
        pay();
      }
      element.removeEventListener("pointerdown", onFingerDown);
      element.removeEventListener("pointermove", onFingerMove);
      element.removeEventListener("pointerup", onFingerUp);
      element.removeEventListener("pointercancel", onFingerUp);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("gesturestart", onGestureStart);
      element.removeEventListener("gesturechange", onGesture);
    };
  }, [setView, stage]);
  return { zoomAbout, panBy, pinchBy, pinchDone, pinching };
}
