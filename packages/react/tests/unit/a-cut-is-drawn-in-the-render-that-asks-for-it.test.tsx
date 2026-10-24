// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { InterpolatedLayout, Layout } from "@graview/layout";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAnimatedLayout } from "../../src/index.js";

/**
 * A CUT IS DRAWN IN THE RENDER THAT ASKS FOR IT, AND NOTHING FLIES TO
 * WHERE IT ALREADY IS.
 *
 * With motion off — a hand on the picture, reduced motion — the new layout
 * went into state from an effect after the render that brought it: every
 * cut drew the whole scene twice. And turning motion back on with the
 * layout it had just cut to flew a half-second tween from that layout to
 * itself, thirty-odd renders of the same picture after every drag.
 */
const at = (x: number): Layout =>
  ({
    nodes: [{ id: "a", kind: "note", x, y: 10, width: 100, height: 40, plane: 1, opacity: 1 }],
    connectors: [],
    width: 800,
    height: 600,
  }) as unknown as Layout;

let renders = 0;
let shown: InterpolatedLayout | null = null;
function Picture({ target, enabled, settle }: { readonly target: Layout; readonly enabled: boolean; readonly settle?: boolean }) {
  renders += 1;
  shown = useAnimatedLayout(target, { enabled, ...(settle === undefined ? {} : { settle }) });
  return null;
}

/** A frame clock jsdom does not have, turned by hand. */
let queued: FrameRequestCallback[] = [];
let clock = 0;
const frames = (n: number) => {
  for (let i = 0; i < n; i++) {
    const now = [...queued];
    queued = [];
    // Sixteen milliseconds a frame, from the moment the frames are first turned.
    clock = Math.max(clock, performance.now()) + 16;
    act(() => now.forEach((call) => call(clock)));
  }
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  queued = [];
  clock = 0;
  globalThis.requestAnimationFrame = (call) => queued.push(call);
  globalThis.cancelAnimationFrame = () => undefined;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  renders = 0;
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("useAnimatedLayout", () => {
  it("draws a cut in the render that asks for it, once", () => {
    const first = at(0);
    act(() => root.render(<Picture target={first} enabled={false} settle={false} />));
    const before = renders;
    const second = at(300);
    act(() => root.render(<Picture target={second} enabled={false} settle={false} />));
    expect(shown!.nodes[0]!.x).toBe(300);
    frames(3);
    expect(renders - before).toBe(1);
  });

  it("draws a cut once more on the next frame when asked to settle", () => {
    act(() => root.render(<Picture target={at(0)} enabled={false} />));
    const before = renders;
    act(() => root.render(<Picture target={at(300)} enabled={false} />));
    frames(2);
    expect(shown!.nodes[0]!.x).toBe(300);
    expect(renders - before).toBe(2);
  });

  it("does not fly to the layout it has just cut to when motion comes back", () => {
    const target = at(300);
    act(() => root.render(<Picture target={target} enabled={false} settle={false} />));
    const before = renders;
    act(() => root.render(<Picture target={target} enabled={true} settle={false} />));
    frames(40);
    expect(shown!.nodes[0]!.x).toBe(300);
    expect(shown!.t).toBe(1);
    expect(renders - before).toBe(1);
  });

  it("draws a scene's first layout once more on the next frame, for the lines measured before its cards stood", () => {
    act(() => root.render(<Picture target={at(300)} enabled={true} />));
    const before = renders;
    frames(40);
    expect(shown!.nodes[0]!.x).toBe(300);
    expect(shown!.t).toBe(1);
    expect(renders - before).toBe(1);
  });

  it("still flies to a new place", () => {
    act(() => root.render(<Picture target={at(0)} enabled={true} />));
    act(() => root.render(<Picture target={at(300)} enabled={true} />));
    frames(1);
    expect(shown!.t).toBeLessThan(1);
    frames(60);
    expect(shown!.t).toBe(1);
    expect(shown!.nodes[0]!.x).toBe(300);
  });
});
