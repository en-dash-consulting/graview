import { withOverview, withPan, withPin, type ViewState } from "@graview/layout/view";
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
  setView,
  settled,
}: {
  readonly stage: RefObject<HTMLElement | null>;
  /** The view's pan: the transform comes off when this has taken the offset. */
  readonly pan: ViewState["pan"];
  readonly setView: (update: (current: ViewState) => ViewState) => void;
  readonly settled: () => void;
}) {
  const live = useRef({ x: 0, y: 0 });
  const painting = useRef(0);
  const settling = useRef(false);
  const settledLive = useRef(settled);
  settledLive.current = settled;
  const layers = useCallback(() => [...(stage.current?.querySelectorAll<HTMLElement>("[data-graview-world]") ?? [])], [stage]);
  const paint = useCallback(() => {
    if (painting.current !== 0) return;
    painting.current = requestAnimationFrame(() => {
      painting.current = 0;
      const { x, y } = live.current;
      const move = x === 0 && y === 0 ? "" : `translate3d(${x}px, ${y}px, 0)`;
      for (const layer of layers()) layer.style.transform = move;
    });
  }, [layers]);
  const clear = useCallback(() => {
    settling.current = false;
    for (const layer of layers()) layer.style.transform = "";
    settledLive.current();
  }, [layers]);

  /** Where the hand has taken the picture, against where the view says it is. */
  const shiftTo = useCallback(
    (wanted: { x: number; y: number }, from: { x: number; y: number }) => {
      live.current = { x: wanted.x - from.x, y: wanted.y - from.y };
      paint();
    },
    [paint],
  );

  /** Letting go: the offset becomes the view's own pan. False when there was none. */
  const settle = useCallback((): boolean => {
    const { x, y } = live.current;
    if (x === 0 && y === 0) return false;
    live.current = { x: 0, y: 0 };
    settling.current = true;
    setView((current) => {
      const at = current.pan ?? { x: 0, y: 0 };
      return withPan(current, { x: at.x + x, y: at.y + y });
    });
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
  }, [setView, clear]);

  /*
   * CLEARED ONLY ONCE THE WORLD HAS ACTUALLY MOVED. Clearing the transform
   * in the same breath as the state change put the picture back where it
   * started for one frame, because React had not committed the new pan yet.
   */
  useLayoutEffect(() => {
    if (settling.current) clear();
  }, [pan, clear]);

  /** The offset the hand has made so far, not yet in the view. */
  const offset = useCallback(() => live.current, []);
  return { shiftTo, settle, settling, offset };
}

/** How far a pointer has to travel before a press is a drag: below it, a click is a click. */
const DRAG_THRESHOLD = 4;

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
    if (event.button !== 0) return;
    // Only the ground itself. A card, a chip or anything a view drew keeps
    // whatever meaning it already had.
    if ((event.target as HTMLElement).closest("[data-graview-view]")) return;
    panFrom(event);
  };

  const onCardDown = (node: SceneNode, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
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
       * Capture only once it IS a drag. Taken on pointer-down it redirected
       * the click and double-click that followed to the host, and
       * double-clicking a task opened the card instead of traveling into it.
       */
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
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

  return { onGroundDown, onCardDown, onDragMove, onDragUp, swallow };
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
        // A mouse notch (a hundred) is a step and a half; a trackpad's few units are a nudge.
        zoomAbout.current(Math.exp(-event.deltaY * 0.004), event.clientX, event.clientY);
        return;
      }
      if (!up) return;
      // Over the ground only: a lens, a scroll region or a pane keeps its own wheel.
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-graview-view], .graview-scroll, [data-graview-overlay], .graview-zoom")) return;
      event.preventDefault();
      panBy.current(-event.deltaX, -event.deltaY);
    };
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      altitude.current.lastScale = 1;
    };
    const onGesture = (event: Event) => {
      event.preventDefault();
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
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("gesturestart", onGestureStart);
      element.removeEventListener("gesturechange", onGesture);
    };
  }, [setView, stage]);
  return { zoomAbout, panBy };
}
