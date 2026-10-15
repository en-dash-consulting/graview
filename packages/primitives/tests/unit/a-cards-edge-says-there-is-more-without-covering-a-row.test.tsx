// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Panel, themeCss } from "../../src/index.js";

/*
 * A CARD'S EDGE SAYS THERE IS MORE, AND NOTHING COVERS A ROW (Nick,
 * 2026-10-15). A module's card cut its last row of findings under a strip
 * of its own ground that stayed stuck to the bottom however far the card
 * was scrolled, and once scrolled drew a dark band across its middle, over
 * its description and its summary. The edge past which there is more now
 * says so, measured: the bottom while rows stand below, the top once
 * scrolled from it, neither at an end it is scrolled to — and the theme
 * paints nothing over the rows or in the scroller's ground.
 *
 * jsdom lays nothing out, so the sizes are stated rather than measured.
 */
type Sizes = { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number; scrollTop: number };

const sized = (sizes: Sizes) => {
  const original = new Map<string, PropertyDescriptor | undefined>();
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const [name, value] of Object.entries(sizes)) {
    const owner = name === "scrollTop" ? Element.prototype : HTMLElement.prototype;
    original.set(name, Object.getOwnPropertyDescriptor(owner, name));
    Object.defineProperty(owner, name, { configurable: true, get: () => value, set: () => {} });
  }
  return () => {
    for (const [name, descriptor] of original) {
      const owner = name === "scrollTop" ? Element.prototype : HTMLElement.prototype;
      if (descriptor) Object.defineProperty(owner, name, descriptor);
      else delete proto[name];
    }
  };
};

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

const edgesAt = async (sizes: Sizes) => {
  const restore = sized(sizes);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <Panel title="Hospital Services" subtitle="One part of the hospital's systems.">
        <p>Ten findings.</p>
      </Panel>,
    );
  });
  const scroller = host.querySelector(".graview-scroll")!;
  const edges = { above: scroller.hasAttribute("data-graview-more-above"), below: scroller.hasAttribute("data-graview-more-below") };
  await act(async () => root.unmount());
  restore();
  return edges;
};

describe("a card's edge", () => {
  it("says there is more below at its top, and nothing above", async () => {
    expect(await edgesAt({ scrollHeight: 500, clientHeight: 300, scrollWidth: 300, clientWidth: 300, scrollTop: 0 })).toEqual({ above: false, below: true });
  });

  it("says there is more on both sides when scrolled part way", async () => {
    expect(await edgesAt({ scrollHeight: 500, clientHeight: 300, scrollWidth: 300, clientWidth: 300, scrollTop: 100 })).toEqual({ above: true, below: true });
  });

  it("says nothing is below once scrolled to its end", async () => {
    expect(await edgesAt({ scrollHeight: 500, clientHeight: 300, scrollWidth: 300, clientWidth: 300, scrollTop: 200 })).toEqual({ above: true, below: false });
  });

  it("says nothing where everything fits", async () => {
    expect(await edgesAt({ scrollHeight: 300, clientHeight: 300, scrollWidth: 300, clientWidth: 300, scrollTop: 0 })).toEqual({ above: false, below: false });
  });

  it("is painted by the theme as a shadow under the rows, never over them or across the card's ground", () => {
    for (const scheme of ["light", "dark"] as const) {
      const css = themeCss(scheme);
      const rules = [...css.matchAll(/([^{}]*\.graview-scroll[^{}]*)\{([^}]*)\}/g)].map(([, selector, body]) => ({ selector: selector!.trim(), body: body! }));
      expect(rules.length).toBeGreaterThan(0);
      // No strip stuck over the last row.
      expect(rules.filter((rule) => /::?after|::?before/.test(rule.selector))).toEqual([]);
      // No shadows painted in the scroller's own ground, where a scrolled card showed them as a band across its middle.
      expect(rules.filter((rule) => /background/.test(rule.body))).toEqual([]);
      // The edge that says there is more casts its shadow inward, under the rows.
      expect(rules.some((rule) => /data-graview-more-below/.test(rule.selector) && /box-shadow:\s*inset/.test(rule.body))).toBe(true);
    }
  });
});
