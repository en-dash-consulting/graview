// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { placePane } from "../../src/popover.js";

/**
 * A PANE STAYS IN ITS EMBED WHEN IT FITS THERE. graview.dev's hero, on a
 * 1024 desk, puts the garden in a box 526 px wide at x 457; on Pages the
 * place control stands at the box's left, and the place list, hung from the
 * control's right edge, opened 240 px out of the box, over the page's own
 * heading and copy. A pane whose anchor is in an embed is kept inside the
 * embed's box where it fits in it; one wider than the box keeps to the window.
 */
type Box = { left: number; top: number; width: number; height: number };
const rect = (box: Box) => ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({}) }) as DOMRect;

function setUp(embedBox: Box, anchorBox: Box, paneSize: { width: number; height: number }) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1024 });
  const embed = document.createElement("section");
  embed.setAttribute("data-graview-embed", "pages");
  embed.getBoundingClientRect = () => rect(embedBox);
  const anchor = document.createElement("button");
  anchor.getBoundingClientRect = () => rect(anchorBox);
  embed.append(anchor);
  const pane = document.createElement("div");
  pane.getBoundingClientRect = () => rect({ left: 0, top: 0, ...paneSize });
  document.body.append(embed, pane);
  return { anchor, pane };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a pane stays in its embed", () => {
  it("hangs from the anchor's start rather than out of the embed's box when its end would leave it", () => {
    const { anchor, pane } = setUp({ left: 457, top: 161, width: 526, height: 660 }, { left: 466, top: 216, width: 72, height: 32 }, { width: 320, height: 400 });
    placePane(pane, { current: anchor });
    expect(Number.parseFloat(pane.style.left)).toBe(466);
  });

  it("keeps its end where it fits inside the box", () => {
    const { anchor, pane } = setUp({ left: 457, top: 161, width: 526, height: 660 }, { left: 900, top: 170, width: 72, height: 32 }, { width: 320, height: 400 });
    placePane(pane, { current: anchor });
    expect(Number.parseFloat(pane.style.left)).toBe(972 - 320);
  });

  it("keeps to the window, as before, when it is wider than the box", () => {
    const { anchor, pane } = setUp({ left: 457, top: 161, width: 300, height: 660 }, { left: 466, top: 216, width: 72, height: 32 }, { width: 320, height: 400 });
    placePane(pane, { current: anchor });
    expect(Number.parseFloat(pane.style.left)).toBe(538 - 320);
  });
});
