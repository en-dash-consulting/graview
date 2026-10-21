import { GUEST_GESTURES, type GuestDomEvent, type GuestGesture, type GuestGestureBinding } from "../protocol.js";

/*
 * A WHEEL, A DRAG AND A PINCH, FORWARDED (0.1.42): what a worker view whose
 * manifest says `gestures: true` hears over what it listens on.
 *
 * Only a click, a key, a field's input and change, and a drop crossed into
 * a view's worker; a map drawn there could be selected and opened but
 * never panned or zoomed. This module, which `mountWorkerView` fetches only
 * for a view that opted in, listens on the view's shadow root for
 *
 *   wheel                    → `wheel` (deltaX, deltaY, deltaMode, ctrlKey, metaKey),
 *                              or `pinch` when Control is held (a trackpad's pinch) and the view listens for one
 *   pointerdown, move, up    → `drag` (phase start, move, end; pointerId, button, pressure, dx, dy)
 *   gesturestart, change, end → `pinch` (Safari's: phase, scale, rotation)
 *
 * each with where the pointer is from the top left of the element the
 * view's selector matched (`x`, `y`) and that element's size, and sends at
 * most one of each an animation frame, the deltas between summed (a
 * pinch's scale multiplied). A start and an end go at once, after whatever
 * of the same pointer was waiting. A wheel and a gesture are taken from
 * the page — `preventDefault` — only over an element the view listens on
 * for it; anywhere else in the view, and anywhere outside it, the page
 * scrolls and zooms as it always did. A drag takes nothing from the page:
 * a view that drags on a phone says `touch-action: none` in its stylesheet.
 */

export interface GuestGesturesOptions {
  /** The view's drawing, under the shadow root: where a selector is matched, and nothing above it. */
  readonly root: () => Element | undefined;
  /** The view's id for a node the host drew. */
  readonly idOf: (node: Node) => string | undefined;
  /** Tell the view. */
  readonly send: (message: GuestDomEvent) => void;
  /** The next animation frame: `requestAnimationFrame` by default. */
  readonly frame?: (run: () => void) => unknown;
}

export interface GuestGestures {
  /** Where the view listens now, as its runtime last said it: a gesture this host knows and a selector of at most 200 characters, and nothing else. */
  bind(bound: readonly unknown[]): void;
  dispose(): void;
}

/** What a view that listens for a gesture without `gestures: true` in its manifest is told, in its console and by the host. */
export const unheardWords = (view: string) => `The view "${view}" listens for a wheel, a drag or a pinch, and its manifest does not say "gestures": true: the host forwards none.`;

/** A trackpad's pinch, said as a wheel with Control held, made a scale: 100 pixels of it is a factor of e. */
const PINCH_PIXELS = 100;

interface Waiting {
  readonly event: GuestGesture;
  readonly bound: Element;
  target: Element;
  clientX: number;
  clientY: number;
  /** A wheel's. */
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
  /** A drag's. */
  pointerId: number;
  button: number;
  pressure: number;
  dx: number;
  dy: number;
  /** A pinch's. */
  scale: number;
  rotation: number;
  phase?: "start" | "move" | "change" | "end";
}

/** What Safari's gesture events carry, which no other engine has a type for. */
interface SafariGesture extends UIEvent {
  readonly scale: number;
  readonly rotation: number;
  readonly clientX?: number;
  readonly clientY?: number;
}

export function createGuestGestures(shadow: ShadowRoot, options: GuestGesturesOptions): GuestGestures {
  const view = shadow.ownerDocument.defaultView;
  const frame = options.frame ?? ((run: () => void) => (view?.requestAnimationFrame ? view.requestAnimationFrame(() => run()) : setTimeout(run, 16)));
  let bound: readonly GuestGestureBinding[] = [];

  /** The nearest element the view drew, at or above where it happened. */
  const drawnAt = (event: Event): Element | undefined => {
    const root = options.root();
    for (let at = event.composedPath()[0] as Node | null | undefined; at && at !== root && at !== shadow; at = at.parentNode) {
      if (at.nodeType === 1 && options.idOf(at) !== undefined) return at as Element;
    }
    return undefined;
  };
  /** The element a view's selector for `event` matches, at or above `at`: what it listens on there. */
  const boundAt = (at: Element, event: GuestGesture): Element | undefined => {
    const root = options.root();
    const selectors = bound.filter((one) => one.event === event).map((one) => one.selector);
    if (selectors.length === 0 || !root) return undefined;
    for (let on: Element | null = at; on && on !== root; on = on.parentElement) {
      for (const selector of selectors) {
        try {
          if (on.matches(selector)) return on;
        } catch {
          /* A selector the page cannot read matches nothing. */
        }
      }
    }
    return undefined;
  };

  const say = (one: Waiting) => {
    const target = options.idOf(one.target) ?? options.idOf(one.bound);
    if (target === undefined || !one.bound.isConnected) return;
    const box = one.bound.getBoundingClientRect();
    const where = { x: one.clientX - box.left, y: one.clientY - box.top, width: box.width, height: box.height };
    if (one.event === "wheel") options.send({ type: "dom-event", target, event: "wheel", ...where, deltaX: one.deltaX, deltaY: one.deltaY, deltaMode: one.deltaMode, ctrlKey: one.ctrlKey, metaKey: one.metaKey });
    else if (one.event === "drag") options.send({ type: "dom-event", target, event: "drag", ...where, phase: one.phase!, pointerId: one.pointerId, button: one.button, pressure: one.pressure, dx: one.dx, dy: one.dy });
    else options.send({ type: "dom-event", target, event: "pinch", ...where, phase: one.phase!, scale: one.scale, rotation: one.rotation });
  };

  /* What waits for the next frame: a wheel, a pinch, and a drag's move for each pointer. */
  const waiting = new Map<string, Waiting>();
  let due = false;
  const flush = (key?: string) => {
    for (const [at, one] of [...waiting]) {
      if (key !== undefined && at !== key) continue;
      waiting.delete(at);
      say(one);
    }
  };
  const later = () => {
    if (due) return;
    due = true;
    frame(() => {
      due = false;
      flush();
    });
  };
  const fresh = (event: GuestGesture, on: Element, target: Element, clientX: number, clientY: number): Waiting => ({ event, bound: on, target, clientX, clientY, deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, pointerId: 0, button: 0, pressure: 0, dx: 0, dy: 0, scale: 1, rotation: 0 });

  const onWheel = (raw: Event) => {
    const event = raw as WheelEvent;
    const at = drawnAt(event);
    if (!at) return;
    const pinchOn = event.ctrlKey ? boundAt(at, "pinch") : undefined;
    const on = pinchOn ?? boundAt(at, "wheel");
    if (!on) return;
    event.preventDefault();
    if (pinchOn) {
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1);
      let one = waiting.get("pinch");
      if (one && one.bound !== on) flush("pinch");
      one = waiting.get("pinch") ?? fresh("pinch", on, at, event.clientX, event.clientY);
      one.phase = "change";
      one.scale *= Math.exp(-pixels / PINCH_PIXELS);
      Object.assign(one, { target: at, clientX: event.clientX, clientY: event.clientY });
      waiting.set("pinch", one);
      return later();
    }
    let one = waiting.get("wheel");
    if (one && (one.bound !== on || one.deltaMode !== event.deltaMode || one.ctrlKey !== event.ctrlKey || one.metaKey !== event.metaKey)) flush("wheel");
    one = waiting.get("wheel") ?? { ...fresh("wheel", on, at, event.clientX, event.clientY), deltaMode: event.deltaMode, ctrlKey: event.ctrlKey, metaKey: event.metaKey };
    one.deltaX += event.deltaX;
    one.deltaY += event.deltaY;
    Object.assign(one, { target: at, clientX: event.clientX, clientY: event.clientY });
    waiting.set("wheel", one);
    later();
  };

  /* Each pointer a drag holds: what it went down on, and where it was when the view last heard of it. */
  const dragging = new Map<number, { readonly bound: Element; readonly button: number; lastX: number; lastY: number }>();
  const onPointer = (raw: Event) => {
    const event = raw as PointerEvent;
    const key = `drag:${event.pointerId}`;
    if (event.type === "pointerdown") {
      const at = drawnAt(event);
      const on = at && boundAt(at, "drag");
      if (!at || !on) return;
      try {
        on.setPointerCapture?.(event.pointerId);
      } catch {
        /* A pointer the engine will not hand over still moves over the view. */
      }
      dragging.set(event.pointerId, { bound: on, button: event.button, lastX: event.clientX, lastY: event.clientY });
      flush(key);
      say({ ...fresh("drag", on, at, event.clientX, event.clientY), phase: "start", pointerId: event.pointerId, button: event.button, pressure: event.pressure ?? 0 });
      return;
    }
    const held = dragging.get(event.pointerId);
    if (!held) return;
    const dx = event.clientX - held.lastX;
    const dy = event.clientY - held.lastY;
    held.lastX = event.clientX;
    held.lastY = event.clientY;
    const at = drawnAt(event) ?? held.bound;
    if (event.type === "pointermove") {
      const one = waiting.get(key) ?? { ...fresh("drag", held.bound, at, event.clientX, event.clientY), phase: "move" as const, pointerId: event.pointerId, button: held.button };
      one.dx += dx;
      one.dy += dy;
      Object.assign(one, { target: at, clientX: event.clientX, clientY: event.clientY, pressure: event.pressure ?? 0 });
      waiting.set(key, one);
      return later();
    }
    /* Up, or canceled: what was waiting goes first, then the end. */
    dragging.delete(event.pointerId);
    const one = waiting.get(key);
    if (one) {
      one.dx += dx;
      one.dy += dy;
      Object.assign(one, { clientX: event.clientX, clientY: event.clientY });
      flush(key);
    }
    say({ ...fresh("drag", held.bound, at, event.clientX, event.clientY), phase: "end", pointerId: event.pointerId, button: held.button, pressure: 0, ...(one ? {} : { dx, dy }) });
  };

  /* Safari's pinch: its scale counts from the start, the view's from what it last heard. */
  let gesture: { readonly bound: Element; scale: number; rotation: number } | undefined;
  const onGesture = (raw: Event) => {
    const event = raw as SafariGesture;
    const clientX = event.clientX ?? 0;
    const clientY = event.clientY ?? 0;
    if (event.type === "gesturestart") {
      const at = drawnAt(event);
      const on = at && boundAt(at, "pinch");
      if (!at || !on) return;
      event.preventDefault();
      gesture = { bound: on, scale: 1, rotation: 0 };
      flush("pinch");
      say({ ...fresh("pinch", on, at, clientX, clientY), phase: "start" });
      return;
    }
    if (!gesture) return;
    event.preventDefault();
    const at = drawnAt(event) ?? gesture.bound;
    const scale = Number.isFinite(event.scale) && event.scale > 0 ? event.scale : gesture.scale;
    const rotation = Number.isFinite(event.rotation) ? event.rotation : gesture.rotation;
    const one = waiting.get("pinch") ?? { ...fresh("pinch", gesture.bound, at, clientX, clientY), phase: "change" as const };
    one.scale *= scale / gesture.scale;
    one.rotation += rotation - gesture.rotation;
    gesture.scale = scale;
    gesture.rotation = rotation;
    Object.assign(one, { target: at, ...(event.clientX !== undefined ? { clientX, clientY } : {}) });
    waiting.set("pinch", one);
    if (event.type === "gesturechange") return later();
    const ended = gesture;
    gesture = undefined;
    flush("pinch");
    say({ ...fresh("pinch", ended.bound, at, one.clientX, one.clientY), phase: "end" });
  };

  const wheel = { passive: false } as const;
  shadow.addEventListener("wheel", onWheel, wheel);
  for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) shadow.addEventListener(type, onPointer);
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) shadow.addEventListener(type, onGesture);

  return {
    bind(given) {
      bound = given.filter((one): one is GuestGestureBinding => (GUEST_GESTURES as readonly unknown[]).includes((one as GuestGestureBinding | null)?.event) && typeof (one as GuestGestureBinding).selector === "string" && (one as GuestGestureBinding).selector.length <= 200).map(({ event, selector }) => ({ event, selector }));
    },
    dispose() {
      shadow.removeEventListener("wheel", onWheel);
      for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) shadow.removeEventListener(type, onPointer);
      for (const type of ["gesturestart", "gesturechange", "gestureend"]) shadow.removeEventListener(type, onGesture);
      waiting.clear();
      dragging.clear();
    },
  };
}
