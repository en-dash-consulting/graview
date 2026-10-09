// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNoticeBoard, Notices } from "../../src/frame.js";
import { placeAtTheFoot } from "../../src/pages.js";

/**
 * NOTICES FLOAT, AND NEVER MOVE THE PAGE (FR-133).
 *
 * Toasts stood at the middle of the picture's foot at every size, over
 * whatever stood there. A notice stands at the foot's middle on a phone,
 * above the safe area, and at its left on a desk; it stands above a short
 * control at that foot (the pages' Ask, the way back) and beside a tall
 * one (the seat), and never in the page's flow. The browser harness
 * (`pnpm verify quiet`) measures that nothing moves; this holds where they
 * are put, with the boxes a browser would report.
 */
type Rect = { left: number; top: number; width: number; height: number };
const boxes = new Map<Element, Rect>();
const sized = new Map<string, { width: number; height: number }>();
const original = HTMLElement.prototype.getBoundingClientRect;

function rectOf(element: Element): DOMRect {
  const set = boxes.get(element);
  if (set) return { ...set, x: set.left, y: set.top, right: set.left + set.width, bottom: set.top + set.height, toJSON: () => ({}) } as DOMRect;
  const testId = element.getAttribute("data-testid") ?? "";
  const size = sized.get(testId) ?? { width: 0, height: 0 };
  return { left: 0, top: 0, x: 0, y: 0, right: size.width, bottom: size.height, width: size.width, height: size.height, toJSON: () => ({}) } as DOMRect;
}

function screen(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: width });
}

let root: Root | undefined;
let picture: HTMLElement;
beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    return rectOf(this);
  };
  picture = document.createElement("div");
  document.body.appendChild(picture);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  HTMLElement.prototype.getBoundingClientRect = original;
  boxes.clear();
  sized.clear();
  document.body.innerHTML = "";
});

const px = (value: string) => Number.parseFloat(value);
/** The `bottom` a notice was given, less the safe area it adds. */
const lift = (element: HTMLElement) => Number(/calc\((\d+)px \+ env\(safe-area-inset-bottom/.exec(element.style.bottom)?.[1] ?? Number.NaN);

async function toast(sentence = "Take back “Mark done: Could Val lead the Thursday shift while Sam is away”") {
  const board = createNoticeBoard();
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<Notices board={board} anchor={() => picture} />));
  await act(async () => void board.notify({ kind: "toast", sentence, action: { label: "Undo", onSelect: () => {} } }));
  return { board, stack: () => document.querySelector<HTMLElement>('[data-testid="notices-toasts"]')! };
}

describe("a notice at the foot of the picture", () => {
  it("stands at the foot's left on a desk, out of the page's flow", async () => {
    screen(1280, 800);
    boxes.set(picture, { left: 0, top: 56, width: 1280, height: 744 });
    sized.set("notices-toasts", { width: 420, height: 52 });
    const { stack } = await toast();
    expect(stack().style.position).toBe("fixed");
    expect(px(stack().style.left)).toBe(16);
    expect(stack().style.translate).toBe("none");
    expect(lift(stack())).toBe(16);
  });

  it("stands at the foot's middle on a phone, above the safe area", async () => {
    screen(390, 844);
    boxes.set(picture, { left: 0, top: 56, width: 390, height: 788 });
    sized.set("notices-toasts", { width: 358, height: 72 });
    const { stack } = await toast();
    expect(px(stack().style.left)).toBe(16);
    expect(px(stack().style.maxWidth)).toBe(358);
    expect(stack().style.bottom).toContain("env(safe-area-inset-bottom");
  });

  it("is at the middle of a narrow notice on a phone", async () => {
    screen(390, 844);
    boxes.set(picture, { left: 0, top: 56, width: 390, height: 788 });
    sized.set("notices-toasts", { width: 200, height: 52 });
    const { stack } = await toast("Saved.");
    expect(px(stack().style.left)).toBe(95);
  });

  it("stands above a short control at the same foot rather than over it", async () => {
    screen(1280, 800);
    boxes.set(picture, { left: 0, top: 56, width: 1280, height: 744 });
    sized.set("notices-toasts", { width: 420, height: 52 });
    const ask = document.createElement("button");
    ask.setAttribute("data-graview-foot", "");
    document.body.appendChild(ask);
    boxes.set(ask, { left: 16, top: 744, width: 80, height: 40 });
    const { stack } = await toast();
    // The Ask's top is 56 px above the screen's foot: the notice stands 8 px above that.
    expect(lift(stack())).toBe(64);
  });

  it("stands beside the open seat at the picture's foot-left on a desk", async () => {
    screen(1440, 900);
    boxes.set(picture, { left: 0, top: 56, width: 1440, height: 844 });
    sized.set("notices-toasts", { width: 420, height: 52 });
    // The seat, open: a tall panel grown up from its field, marked as standing at the foot.
    const seat = document.createElement("section");
    seat.setAttribute("data-graview-foot", "");
    document.body.appendChild(seat);
    boxes.set(seat, { left: 0, top: 356, width: 300, height: 544 });
    const { stack } = await toast();
    expect(px(stack().style.left)).toBe(316);
    expect(lift(stack())).toBe(16);
  });

  it("is not drawn over the host's page while its picture is scrolled out of the window", () => {
    screen(1280, 800);
    const notice = document.createElement("div");
    document.body.appendChild(notice);
    boxes.set(notice, { left: 16, top: 0, width: 300, height: 52 });
    boxes.set(picture, { left: 100, top: 1400, width: 700, height: 600 });
    placeAtTheFoot(notice, picture);
    expect(notice.style.visibility).toBe("hidden");
    boxes.set(picture, { left: 100, top: 100, width: 700, height: 600 });
    placeAtTheFoot(notice, picture);
    expect(notice.style.visibility).toBe("");
  });

  it("stands above another notice at the foot, so several never overlap", () => {
    screen(1280, 800);
    boxes.set(picture, { left: 0, top: 56, width: 1280, height: 744 });
    const first = document.createElement("div");
    first.setAttribute("data-graview-foot", "");
    document.body.appendChild(first);
    boxes.set(first, { left: 16, top: 730, width: 300, height: 54 });
    const second = document.createElement("div");
    document.body.appendChild(second);
    boxes.set(second, { left: 16, top: 0, width: 420, height: 52 });
    placeAtTheFoot(second, picture);
    expect(px(second.style.left)).toBe(16);
    expect(lift(second)).toBe(800 - 730 + 8);
  });

  it("has its act as a real button, reached by the keyboard, and takes nothing's focus when it comes", async () => {
    screen(1280, 800);
    boxes.set(picture, { left: 0, top: 56, width: 1280, height: 744 });
    const field = document.createElement("input");
    document.body.appendChild(field);
    field.focus();
    const { stack } = await toast();
    const act_ = stack().querySelector<HTMLButtonElement>('[data-testid="notice-action"]')!;
    expect(act_.tagName).toBe("BUTTON");
    expect(act_.tabIndex).toBe(0);
    expect(document.activeElement).toBe(field);
  });

  it("wraps its sentence rather than cutting it", async () => {
    screen(390, 844);
    boxes.set(picture, { left: 0, top: 56, width: 390, height: 788 });
    const { stack } = await toast();
    const sentence = [...stack().querySelectorAll("span")].find((one) => one.textContent?.startsWith("Take back"))!;
    expect(sentence.style.whiteSpace).not.toBe("nowrap");
    expect(sentence.style.textOverflow).not.toBe("ellipsis");
    expect(sentence.style.overflow).not.toBe("hidden");
  });
});

describe("a banner", () => {
  it("lies over the picture directly under the bar, at its middle", async () => {
    screen(1280, 800);
    boxes.set(picture, { left: 0, top: 56, width: 1280, height: 744 });
    sized.set("notices-banners", { width: 480, height: 44 });
    const board = createNoticeBoard();
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<Notices board={board} anchor={() => picture} />));
    await act(async () => void board.notify({ kind: "banner", sentence: "Offline — changes will be sent when you reconnect.", tone: "warn" }));
    const stack = document.querySelector<HTMLElement>('[data-testid="notices-banners"]')!;
    expect(stack.style.position).toBe("fixed");
    expect(px(stack.style.top)).toBe(64);
    expect(px(stack.style.left)).toBe(400);
  });
});
