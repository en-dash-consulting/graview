// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { useWidth } from "../../src/primitives/measure.js";

/*
 * A LENS IS DRAWN IN THE ROOM IT HAS, FROM ITS FIRST FRAME. The coverage
 * matrix in a 225-pixel card on graview.dev at 360 wide painted one frame
 * laid out for a desk: its first render drew no box to measure, and a
 * resize the browser reported was rendered after the paint. The width is
 * read of the box the ref holds now, and a resize is rendered at once.
 */
let boxes = new Map<Element, number>();
const observers: { callback: () => void; watched: Element[] }[] = [];
class FakeResizeObserver {
  readonly watched: Element[] = [];
  constructor(readonly callback: () => void) {
    observers.push(this);
  }
  observe(element: Element) {
    this.watched.push(element);
  }
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
const realRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  const width = boxes.get(this) ?? 0;
  return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: 20, width, height: 20, toJSON: () => ({}) } as DOMRect;
};
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
});
afterEach(() => {
  boxes = new Map();
  observers.length = 0;
});

let show: (on: boolean) => void = () => {};
function Lens() {
  const box = useRef<HTMLDivElement | null>(null);
  const [drawn, setDrawn] = useState(false);
  show = setDrawn;
  const width = useWidth(box);
  return drawn ? (
    <div ref={(el) => {
      box.current = el;
      if (el && !boxes.has(el)) boxes.set(el, 640);
    }} data-shape={width === null ? "unmeasured" : width < 420 ? "stacked" : "matrix"} />
  ) : (
    <p>summary</p>
  );
}

describe("a lens's width", () => {
  it("is read of the box drawn after a first render that drew none, and a resize is drawn at once", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<Lens />));
    act(() => show(true));
    const box = host.querySelector<HTMLElement>("[data-shape]")!;
    expect(box.dataset.shape).toBe("matrix");
    // The scene gives the card its size: the browser reports the box 193 wide, and the next paint has it stacked.
    boxes.set(box, 193);
    const observer = observers.find((one) => one.watched.includes(box))!;
    expect(observer, "the box drawn second is the one observed").toBeDefined();
    observer.callback();
    expect(box.dataset.shape).toBe("stacked");
    act(() => root.unmount());
    host.remove();
  });

  /*
   * AN UNCHANGED WIDTH DRAWS NOTHING AT ONCE. The observer reports every
   * box once as it is first watched, and a flushSync renders whatever else
   * is waiting too: on the org app's Pages home a board that had just
   * measured its own room had its new shape drawn inside the browser's
   * round of resize reports, and Firefox said "ResizeObserver loop
   * completed with undelivered notifications".
   */
  it("does not draw another view's waiting change inside a report of the width it already had", () => {
    let reshape: (shape: string) => void = () => {};
    function Board() {
      const [shape, setShape] = useState("square");
      reshape = setShape;
      return <span data-board={shape} />;
    }
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<><Lens /><Board /></>));
    act(() => show(true));
    const box = host.querySelector<HTMLElement>("[data-shape]")!;
    const observer = observers.find((one) => one.watched.includes(box))!;
    // The board measured its room and asked to be drawn again; the lens's box is reported, as wide as it was.
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    reshape("by-width");
    observer.callback();
    expect(host.querySelector("[data-board]")?.getAttribute("data-board"), "drawn later, outside the report").toBe("square");
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    act(() => root.unmount());
    host.remove();
  });
});
