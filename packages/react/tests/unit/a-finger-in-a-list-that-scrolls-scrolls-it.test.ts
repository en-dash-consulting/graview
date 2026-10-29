// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { inScroller } from "../../src/scene-hand.js";

/**
 * A FINGER IN A LIST THAT SCROLLS SCROLLS IT.
 *
 * On a phone a focused district's list could not be scrolled without the
 * district moving under the same finger: the card's drag began first, the
 * browser took the touch to scroll, and the card was pinned wherever the
 * scroll left it. A press inside something of the card's that scrolls is
 * the list's, and the card's drag is not begun.
 */
function list(overflow: string, content: number, height: number) {
  const element = document.createElement("div");
  element.style.overflowY = overflow;
  Object.defineProperties(element, { scrollHeight: { value: content }, clientHeight: { value: height }, scrollWidth: { value: 0 }, clientWidth: { value: 0 } });
  return element;
}

describe("a finger in a list that scrolls scrolls it", () => {
  it("finds the list a press landed in, inside the card", () => {
    const card = document.createElement("div");
    const scroller = list("auto", 1200, 150);
    const row = document.createElement("span");
    scroller.append(row);
    card.append(scroller);
    expect(inScroller(row, card)).toBe(true);
  });

  it("finds none where the list holds all it has, or does not scroll, or the press is outside it", () => {
    const card = document.createElement("div");
    const short = list("auto", 150, 150);
    const clipped = list("hidden", 1200, 150);
    const shortRow = document.createElement("span");
    const clippedRow = document.createElement("span");
    short.append(shortRow);
    clipped.append(clippedRow);
    const title = document.createElement("h3");
    card.append(short, clipped, title);
    expect(inScroller(shortRow, card)).toBe(false);
    expect(inScroller(clippedRow, card)).toBe(false);
    expect(inScroller(title, card)).toBe(false);
  });

  it("does not look past the card: a page that scrolls behind the scene is not the card's list", () => {
    const page = list("auto", 4000, 800);
    const card = document.createElement("div");
    const title = document.createElement("h3");
    card.append(title);
    page.append(card);
    expect(inScroller(title, card)).toBe(false);
  });
});
