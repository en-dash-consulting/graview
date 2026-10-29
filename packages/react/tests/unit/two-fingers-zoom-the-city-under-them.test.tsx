// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { EMPTY_VIEW, type ViewState } from "@graview/layout/view";
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWheelAndPinch } from "../../src/scene-hand.js";

/**
 * TWO FINGERS ZOOM THE CITY UNDER THEM.
 *
 * Chrome on a phone hands a pinch over as two touches and nothing else — no
 * ctrl+wheel, no GestureEvent — so with `touch-action: none` on the ground
 * a pinch did not zoom at all: the first finger panned the city. The two
 * pointers are read now: fingers twice as far apart zoom twice, about their
 * middle, and Safari's GestureEvent said beside them is not read a second
 * time. What they owe the view is kept while the listeners are attached
 * again, which the pinch's own first change of the view can bring about.
 */
type Pinch = (factor: number, x: number, y: number, dx: number, dy: number) => void;
let root: Root;
let host: HTMLDivElement;
let stage: HTMLDivElement;
let pinched: ReturnType<typeof vi.fn<Pinch>>;
let done: ReturnType<typeof vi.fn<() => void>>;
let pinching: { current: boolean };
const overview: ViewState = { ...EMPTY_VIEW, overview: true };

function Scene({ setView }: { readonly setView: (next: ViewState) => void }) {
  const ref = useRef<HTMLDivElement | null>(stage);
  const hands = useWheelAndPinch({ stage: ref, view: overview, setView });
  hands.pinchBy.current = pinched;
  hands.pinchDone.current = done;
  pinching = hands.pinching;
  return null;
}

/** A finger as the browser says it: a pointer event of type touch. */
const finger = (type: string, id: number, x: number, y: number, primary = id === 1) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: "touch" }, isPrimary: { value: primary } });
  stage.dispatchEvent(event);
};
const frames: FrameRequestCallback[] = [];
/** The next frame: every payment owed runs. */
const frame = () => {
  for (const pay of frames.splice(0)) pay(0);
};
const show = (setView = vi.fn()) => act(() => root.render(<Scene setView={setView} />));

beforeEach(() => {
  host = document.createElement("div");
  stage = document.createElement("div");
  document.body.append(stage);
  root = createRoot(host);
  pinched = vi.fn<Pinch>();
  done = vi.fn<() => void>();
  // Frames come when the test says so (`frame()`): what the fingers owe is paid once a frame.
  frames.length = 0;
  vi.stubGlobal("requestAnimationFrame", (pay: FrameRequestCallback) => frames.push(pay));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames[id - 1] = () => {};
  });
});
afterEach(() => {
  act(() => root.unmount());
  stage.remove();
  vi.unstubAllGlobals();
});

describe("two fingers zoom the city under them", () => {
  it("zooms by how far apart the fingers went, about where they were, and says when the last one lifts", () => {
    show();
    finger("pointerdown", 1, 100, 200);
    finger("pointerdown", 2, 160, 200);
    expect(pinching.current).toBe(true);
    finger("pointermove", 1, 70, 200);
    frame();
    finger("pointermove", 2, 190, 200);
    frame();
    const product = pinched.mock.calls.reduce((all, [factor]) => all * factor, 1);
    expect(product).toBeCloseTo(2, 6);
    expect(pinched.mock.calls[0]![1]).toBe(130);
    expect(pinched.mock.calls[0]![2]).toBe(200);
    finger("pointerup", 1, 70, 200);
    expect(pinching.current).toBe(true);
    expect(done).not.toHaveBeenCalled();
    finger("pointerup", 2, 190, 200);
    expect(pinching.current).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("moves the city as far as the fingers' middle moved", () => {
    show();
    finger("pointerdown", 1, 100, 200);
    finger("pointerdown", 2, 160, 200);
    finger("pointermove", 1, 130, 240);
    finger("pointermove", 2, 190, 240);
    frame();
    // Both moves, paid once in the one frame.
    expect(pinched).toHaveBeenCalledTimes(1);
    const dx = pinched.mock.calls.reduce((all, call) => all + call[3], 0);
    const dy = pinched.mock.calls.reduce((all, call) => all + call[4], 0);
    expect([dx, dy]).toEqual([30, 40]);
  });

  it("keeps the fingers when the listeners are attached again in the middle of a pinch", () => {
    show();
    finger("pointerdown", 1, 100, 200);
    finger("pointerdown", 2, 160, 200);
    finger("pointermove", 2, 220, 200);
    // A new setView, as the scene's own can be after the pinch's first change of the view.
    show(vi.fn());
    finger("pointermove", 1, 40, 200);
    frame();
    const product = pinched.mock.calls.reduce((all, [factor]) => all * factor, 1);
    expect(product).toBeCloseTo(3, 6);
  });

  it("reads Safari's GestureEvent not at all while two fingers are down, so the city is not zoomed twice", () => {
    const setView = vi.fn();
    show(setView);
    finger("pointerdown", 1, 100, 200);
    finger("pointerdown", 2, 160, 200);
    const gesture = new Event("gesturechange", { cancelable: true });
    Object.assign(gesture, { scale: 0.5, clientX: 130, clientY: 200 });
    stage.dispatchEvent(gesture);
    expect(setView).not.toHaveBeenCalled();
    expect(pinched).not.toHaveBeenCalled();
  });

  it("leaves one finger alone: a drag is the hand's, not a pinch", () => {
    show();
    finger("pointerdown", 1, 100, 200);
    finger("pointermove", 1, 160, 260);
    finger("pointerup", 1, 160, 260);
    expect(pinching.current).toBe(false);
    expect(pinched).not.toHaveBeenCalled();
  });
});
