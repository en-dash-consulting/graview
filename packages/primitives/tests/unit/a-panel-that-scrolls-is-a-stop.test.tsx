// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Panel } from "../../src/index.js";

/**
 * A PANEL THAT SCROLLS IS A PLACE THE KEYBOARD CAN GO.
 *
 * The scroller becomes a tab stop only when there is something to scroll to
 * — a stop in front of every card would be noise — and the question was
 * asked of the height alone. The scroller is `overflow: auto`, so at a
 * phone's width a panel overflows ACROSS, scrolls, and was never reachable:
 * axe's `scrollable-region-focusable`, twice, at 390px, on a real product.
 *
 * jsdom lays nothing out, so the overflow is stated rather than measured.
 * What is under test is which question gets asked, which is the whole bug.
 */
type Sizes = { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };

const sized = (sizes: Sizes) => {
  const original = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries(sizes)) {
    original.set(name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name));
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: () => value });
  }
  return () => {
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
    }
  };
};

/** Enough of one to run the check: observing calls back straight away. */
class Immediate {
  constructor(private readonly ran: () => void) {}
  observe() {
    this.ran();
  }
  disconnect() {}
}

let host: HTMLDivElement;
let restoreObserver: (() => void) | undefined;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  const had = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, writable: true, value: Immediate });
  restoreObserver = () => {
    if (had) Object.defineProperty(globalThis, "ResizeObserver", had);
    else delete (globalThis as unknown as Record<string, unknown>)["ResizeObserver"];
  };
});
afterEach(() => {
  restoreObserver?.();
  host.remove();
});

const draw = async () => {
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <Panel title="The week">
        <p>Seven days of it.</p>
      </Panel>,
    );
  });
  const scroller = host.querySelector(".graview-scroll");
  await act(async () => root.unmount());
  return scroller;
};

describe("a panel whose content does not fit", () => {
  it("is a named tab stop when it overflows downward", async () => {
    const restore = sized({ scrollHeight: 400, clientHeight: 200, scrollWidth: 300, clientWidth: 300 });
    const scroller = await draw();
    restore();
    expect(scroller?.getAttribute("tabindex")).toBe("0");
    expect(scroller?.getAttribute("role")).toBe("region");
    expect(scroller?.getAttribute("aria-label")).toBe("The week");
  });

  it("is a named tab stop when it overflows sideways, which is what a phone does", async () => {
    const restore = sized({ scrollHeight: 200, clientHeight: 200, scrollWidth: 620, clientWidth: 390 });
    const scroller = await draw();
    restore();
    expect(scroller?.getAttribute("tabindex")).toBe("0");
    expect(scroller?.getAttribute("role")).toBe("region");
  });

  it("is no stop at all when everything fits", async () => {
    const restore = sized({ scrollHeight: 200, clientHeight: 200, scrollWidth: 300, clientWidth: 300 });
    const scroller = await draw();
    restore();
    expect(scroller?.hasAttribute("tabindex")).toBe(false);
    expect(scroller?.hasAttribute("role")).toBe(false);
  });
});
