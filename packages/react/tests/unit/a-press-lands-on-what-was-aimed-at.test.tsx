// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAimedPress } from "../../src/scene-aim.js";

/**
 * A PRESS LANDS ON WHAT WAS AIMED AT.
 *
 * A tap that chose a district moved the city on a phone, and the next tap,
 * aimed at the picture as it stood, found whatever had slid under the
 * finger: the zoom's "+" for the second tap of a double-tap, the wrong
 * district for a quick tap on the next one. A press a beat after a tap is
 * the card it was aimed at; a finger's second tap on the card the first
 * one chose is the double-tap that goes in. A press after the beat, or one
 * whose target never moved, is left alone.
 */
let root: Root;
let ground: HTMLDivElement;
const heard: string[] = [];
const swallow = { current: false };

function Scene() {
  const ref = useRef<HTMLDivElement | null>(ground);
  useAimedPress(ref, swallow);
  return null;
}

/** A card standing at (x, y), w × h. */
function card(id: string, box: { x: number; y: number; w: number; h: number }) {
  const element = ground.querySelector<HTMLElement>(`[data-graview-view="${id}"]`) ?? document.createElement("div");
  element.setAttribute("data-graview-view", id);
  element.getBoundingClientRect = () => ({ x: box.x, y: box.y, left: box.x, top: box.y, width: box.w, height: box.h, right: box.x + box.w, bottom: box.y + box.h, toJSON: () => ({}) });
  ground.append(element);
  return element;
}
const at = (id: string) => ground.querySelector<HTMLElement>(`[data-graview-view="${id}"]`)!;

/** A press on `target` at (x, y), as a finger or a mouse, `stamp` milliseconds in: down, up, click. */
function press(target: Element, x: number, y: number, stamp: number, pointerType = "touch") {
  const down = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperties(down, { pointerType: { value: pointerType }, isPrimary: { value: true }, timeStamp: { value: stamp } });
  target.dispatchEvent(down);
  const up = new MouseEvent("pointerup", { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperties(up, { timeStamp: { value: stamp + 40 } });
  target.dispatchEvent(up);
  const click = new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperties(click, { timeStamp: { value: stamp + 50 } });
  target.dispatchEvent(click);
}

beforeEach(() => {
  ground = document.createElement("div");
  document.body.append(ground);
  for (const type of ["click", "dblclick", "pointerdown"]) {
    ground.addEventListener(type, (event) => {
      const on = (event.target as Element).closest("[data-graview-view]")?.getAttribute("data-graview-view") ?? (event.target as Element).getAttribute("aria-label") ?? "ground";
      heard.push(`${type} ${on}`);
    });
  }
  heard.length = 0;
  swallow.current = false;
  root = createRoot(document.createElement("div"));
  act(() => root.render(<Scene />));
});
afterEach(() => {
  act(() => root.unmount());
  ground.remove();
});

describe("a press lands on what was aimed at", () => {
  it("gives a quick second tap to the district it was aimed at, after the first tap moved the city", () => {
    card("kind:album", { x: 100, y: 300, w: 80, h: 40 });
    card("kind:artist", { x: 20, y: 380, w: 80, h: 40 });
    press(at("kind:album"), 140, 320, 1000);
    // The sheet came up and the city moved up by eighty: the album now stands where the artist was aimed.
    card("kind:album", { x: 100, y: 220, w: 80, h: 40 });
    card("kind:artist", { x: 20, y: 300, w: 80, h: 40 });
    const slid = card("kind:era", { x: 20, y: 380, w: 80, h: 40 });
    heard.length = 0;
    press(slid, 60, 400, 1150);
    expect(heard).toEqual(["click kind:artist"]);
  });

  it("makes a finger's second tap on the chosen district the double-tap that goes in, whatever slid under it", () => {
    card("kind:album", { x: 100, y: 300, w: 80, h: 40 });
    press(at("kind:album"), 140, 320, 1000);
    card("kind:album", { x: 100, y: 220, w: 80, h: 40 });
    const zoom = document.createElement("button");
    zoom.setAttribute("aria-label", "Zoom in");
    ground.append(zoom);
    heard.length = 0;
    press(zoom, 140, 320, 1100);
    expect(heard).toEqual(["dblclick kind:album"]);
  });

  it("hears a finger's double-tap where nothing moved, and a double-click the browser says after it goes unheard", () => {
    card("kind:album", { x: 100, y: 300, w: 80, h: 40 });
    press(at("kind:album"), 140, 320, 1000);
    heard.length = 0;
    press(at("kind:album"), 140, 320, 1200);
    const browsers = new MouseEvent("dblclick", { bubbles: true, cancelable: true });
    Object.defineProperty(browsers, "timeStamp", { value: 1260 });
    at("kind:album").dispatchEvent(browsers);
    expect(heard).toEqual(["dblclick kind:album"]);
  });

  it("leaves a mouse's second press alone where nothing moved: the browser's own double-click is the one", () => {
    card("kind:album", { x: 100, y: 300, w: 80, h: 40 });
    press(at("kind:album"), 140, 320, 1000, "mouse");
    heard.length = 0;
    press(at("kind:album"), 140, 320, 1100, "mouse");
    expect(heard).toEqual(["pointerdown kind:album", "click kind:album"]);
  });

  it("leaves a press after the beat alone, on whatever is under it now", () => {
    card("kind:album", { x: 100, y: 300, w: 80, h: 40 });
    press(at("kind:album"), 140, 320, 1000);
    card("kind:album", { x: 100, y: 220, w: 80, h: 40 });
    const slid = card("kind:era", { x: 100, y: 300, w: 80, h: 40 });
    heard.length = 0;
    press(slid, 140, 320, 2000);
    expect(heard).toEqual(["pointerdown kind:era", "click kind:era"]);
  });

  it("notes nothing for a press on a control: pressing a button twice is pressing it twice", () => {
    const plus = document.createElement("button");
    plus.setAttribute("aria-label", "Zoom in");
    ground.append(plus);
    card("kind:album", { x: 0, y: 0, w: 400, h: 400 });
    press(plus, 140, 320, 1000);
    heard.length = 0;
    press(plus, 140, 320, 1100);
    expect(heard).toEqual(["pointerdown Zoom in", "click Zoom in"]);
  });
});
