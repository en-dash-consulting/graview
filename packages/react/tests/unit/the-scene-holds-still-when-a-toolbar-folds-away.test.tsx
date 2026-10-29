// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TOOLBAR_HEIGHT, useBoxHeldThroughToolbars } from "../../src/scene-helpers.js";

/**
 * THE SCENE HOLDS STILL WHEN SAFARI'S TOOLBAR FOLDS AWAY. On a touch
 * screen the window grows by the toolbar's height, its width the same, and
 * the scene laid itself out again for the taller box: the city slid down by
 * half of it under the finger. That growth keeps the box the scene was laid
 * out for; anything else is followed.
 */
type Box = { width: number; height: number } | null;
let root: Root;
let host: HTMLDivElement;
let laid: Box = null;
function Scene({ size }: { readonly size: Box }) {
  laid = useBoxHeldThroughToolbars(size);
  return null;
}
const show = (size: Box, screen: number) => {
  Object.defineProperty(window, "innerHeight", { value: screen, configurable: true });
  act(() => root.render(<Scene size={size} />));
  return laid;
};
const touch = (points: number) => Object.defineProperty(navigator, "maxTouchPoints", { value: points, configurable: true });

beforeEach(() => {
  host = document.createElement("div");
  root = createRoot(host);
  laid = null;
  touch(5);
});
afterEach(() => {
  act(() => root.unmount());
  touch(0);
});

describe("the scene holds still when a toolbar folds away", () => {
  it("keeps the box it was laid out for while the window grows by the toolbar alone, and the same box when it comes back", () => {
    const first = show({ width: 834, height: 1146 }, 1194);
    expect(show({ width: 834, height: 1216 }, 1264)).toBe(first);
    expect(show({ width: 834, height: 1146 }, 1194)).toBe(first);
  });

  it("follows a box that grew by more than a toolbar, or more than the window did, or on a desk with no touch", () => {
    show({ width: 834, height: 1146 }, 1194);
    expect(show({ width: 834, height: 1146 + TOOLBAR_HEIGHT + 1 }, 1194 + TOOLBAR_HEIGHT + 1)).toEqual({ width: 834, height: 1146 + TOOLBAR_HEIGHT + 1 });
    // A line over the scene put away: the box grew, the window did not.
    show({ width: 834, height: 1000 }, 1194);
    expect(show({ width: 834, height: 1046 }, 1194)).toEqual({ width: 834, height: 1046 });
    touch(0);
    show({ width: 1280, height: 700 }, 800);
    expect(show({ width: 1280, height: 770 }, 870)).toEqual({ width: 1280, height: 770 });
  });

  it("follows a box that shrank, and a turn, at once", () => {
    show({ width: 834, height: 1146 }, 1194);
    expect(show({ width: 834, height: 1076 }, 1124)).toEqual({ width: 834, height: 1076 });
    expect(show({ width: 1194, height: 786 }, 834)).toEqual({ width: 1194, height: 786 });
  });
});
