// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { placePane } from "../../src/popover.js";

/**
 * A PANE IN THE TOP LAYER IS DRAWN WHERE IT WAS PLACED. In Safari 18.0 a
 * right-click on a card in the scene opened the menu at (0, 852), under the
 * scene at the window's left edge, while its left and top said (544, 343):
 * the engine had not laid the box out again after it went into the top
 * layer, and writing its left and top again did not make it. Changing its
 * position and back did. A pane here stands where Safari stood it until its
 * position is changed, as the engine did.
 */
type Box = { left: number; top: number; width: number; height: number };
const rect = (box: Box) => ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({}) }) as DOMRect;

function safariPane(inTopLayer: boolean) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1440 });
  const pane = document.createElement("section");
  Object.assign(pane.style, { position: "fixed", inset: "auto", margin: "0" });
  let laidOut = false;
  let writtenPosition = pane.style.position;
  const style = pane.style;
  // The engine lays the box out again only when its position changes.
  Object.defineProperty(style, "position", {
    configurable: true,
    get: () => writtenPosition,
    set: (value: string) => {
      if (value !== writtenPosition) laidOut = true;
      writtenPosition = value;
    },
  });
  pane.getBoundingClientRect = () => (laidOut ? rect({ left: Number.parseFloat(style.left), top: Number.parseFloat(style.top), width: 300, height: 291 }) : rect({ left: 0, top: 852, width: 300, height: 291 }));
  pane.matches = (selector: string) => selector === ":popover-open" && inTopLayer;
  document.body.append(pane);
  return pane;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a pane in the top layer is drawn where it was placed", () => {
  it("stands at the pointer, not where it falls in the page's flow, where the engine kept its old box", () => {
    const pane = safariPane(true);
    placePane(pane, () => ({ x: 544, y: 337 }), { align: "start" });
    const box = pane.getBoundingClientRect();
    expect([box.left, box.top]).toEqual([544, 343]);
    expect(pane.style.position).toBe("fixed");
  });

  it("is left alone where it is drawn where it was placed already", () => {
    const pane = safariPane(true);
    pane.getBoundingClientRect = () => rect({ left: Number.parseFloat(pane.style.left) || 0, top: Number.parseFloat(pane.style.top) || 0, width: 300, height: 291 });
    let changed = 0;
    const style = pane.style;
    const position = Object.getOwnPropertyDescriptor(style, "position")!;
    Object.defineProperty(style, "position", { configurable: true, get: position.get, set: (value: string) => ((changed += 1), position.set!(value)) });
    placePane(pane, () => ({ x: 544, y: 337 }), { align: "start" });
    expect(changed).toBe(0);
  });

  it("is not moved by its box where it is not in the top layer, whose box its container decides", () => {
    const pane = safariPane(false);
    placePane(pane, () => ({ x: 544, y: 337 }), { align: "start" });
    expect(pane.getBoundingClientRect().top).toBe(852);
  });
});
