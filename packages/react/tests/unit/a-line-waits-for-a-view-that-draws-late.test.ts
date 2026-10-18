// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectorStrands, type SceneNode } from "../../src/index.js";
import { watchDrawnLate } from "../../src/drawn-late.js";

/**
 * A LINE WAITS FOR A VIEW THAT DRAWS LATE.
 *
 * A group in focus draws its members — the week, its entries — and a line
 * lands on a drawing of the thing or is not drawn. The lines are measured
 * once a frame lands, and again on a scroll, a resize, a new selection or a
 * caption that moved. A view whose picture is fetched as it is first drawn
 * (FR-57) draws its entries in a commit of its own, after the frame landed,
 * at the same size: none of those come. On a CPU four times slower the
 * week's lens arrived a few milliseconds after the last measurement, and
 * the nine entries stood on the week with no line to the lists holding them
 * until something else happened to move the page.
 *
 * So a measurement says which members it looked for in a view and found no
 * drawing of, and the lines are measured again when one of them is drawn.
 */

type Rect = { x: number; y: number; width: number; height: number };
const boxes = new WeakMap<Element, Rect>();
const at = (el: Element, rect: Rect) => (boxes.set(el, rect), el);
let restore: () => void;

beforeEach(() => {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const r = boxes.get(this) ?? { x: 0, y: 0, width: 0, height: 0 };
    return { ...r, left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height, toJSON: () => r } as DOMRect;
  };
  restore = () => (Element.prototype.getBoundingClientRect = original);
});
afterEach(() => {
  restore();
  document.body.innerHTML = "";
});

const node = (id: string, x: number, y: number, plane: 0 | 1 | 2, extra: Partial<SceneNode> = {}): SceneNode =>
  ({ id, kind: "k", plane, x, y, width: 200, height: 120, pinned: false, opacity: 1, ...extra }) as SceneNode;

/** The week in focus holding one entry, and the list that holds it raised in the band below. */
const nodes = [
  node("aggregate:task", 0, 0, 0, { aggregate: { kind: "task", memberIds: ["t-deposit"], label: "Tasks" } }),
  node("today", 300, 500, 1),
];
const holds = {
  id: "holds:today:aggregate:task",
  kind: "holds",
  from: "today",
  to: "aggregate:task",
  edges: [{ from: "today", to: "t-deposit" }],
  x1: 0,
  y1: 0,
  x2: 0,
  y2: 0,
};

function stage() {
  const stageEl = at(document.createElement("div"), { x: 0, y: 0, width: 1400, height: 900 }) as HTMLElement;
  const week = at(document.createElement("div"), { x: 100, y: 100, width: 1000, height: 400 });
  week.setAttribute("data-graview-view", "aggregate:task");
  const list = at(document.createElement("div"), { x: 300, y: 600, width: 200, height: 120 });
  list.setAttribute("data-graview-view", "today");
  stageEl.append(week, list);
  document.body.append(stageEl);
  /* The week's lens arriving: its entry drawn inside the week, at the week's own size. */
  const drawEntry = () => {
    const entry = at(document.createElement("span"), { x: 200, y: 200, width: 150, height: 24 });
    entry.setAttribute("data-graview-pick", "t-deposit");
    week.append(entry);
  };
  return { stageEl, drawEntry };
}

describe("a line to a member a view has not drawn yet", () => {
  it("is owed by the measurement, which names the view and the member", () => {
    const { stageEl } = stage();
    const owed = new Map<string, Set<string>>();
    expect(connectorStrands(nodes, [holds], stageEl, false, "light", owed)).toHaveLength(0);
    expect([...(owed.get("aggregate:task") ?? [])]).toContain("t-deposit");
  });

  it("is measured again once the view draws it, with nothing else moving", async () => {
    const { stageEl, drawEntry } = stage();
    const owed = new Map<string, Set<string>>();
    connectorStrands(nodes, [holds], stageEl, false, "light", owed);
    const again = vi.fn();
    const stop = watchDrawnLate(stageEl, owed, again);
    // Armed and checked once: nothing has been drawn yet, so nothing is asked.
    await new Promise((settle) => setTimeout(settle, 30));
    expect(again).not.toHaveBeenCalled();
    drawEntry();
    await vi.waitFor(() => expect(again).toHaveBeenCalledTimes(1));
    // And the measurement it asks for has the line.
    expect(connectorStrands(nodes, [holds], stageEl, false, "light")).toHaveLength(1);
    stop();
  });

  it("is measured again when the view drew it between the measurement and the watch", async () => {
    const { stageEl, drawEntry } = stage();
    const owed = new Map<string, Set<string>>();
    connectorStrands(nodes, [holds], stageEl, false, "light", owed);
    drawEntry();
    const again = vi.fn();
    const stop = watchDrawnLate(stageEl, owed, again);
    await vi.waitFor(() => expect(again).toHaveBeenCalledTimes(1));
    stop();
  });

  it("is not asked for by a change that draws none of what is owed", async () => {
    const { stageEl } = stage();
    const owed = new Map<string, Set<string>>();
    connectorStrands(nodes, [holds], stageEl, false, "light", owed);
    const again = vi.fn();
    const stop = watchDrawnLate(stageEl, owed, again);
    const other = at(document.createElement("span"), { x: 400, y: 200, width: 150, height: 24 });
    other.setAttribute("data-graview-pick", "t-someone-else");
    stageEl.querySelector('[data-graview-view="aggregate:task"]')!.append(other);
    await new Promise((settle) => setTimeout(settle, 60));
    expect(again).not.toHaveBeenCalled();
    stop();
  });

  it("watches nothing when nothing is owed", () => {
    const { stageEl } = stage();
    const observe = vi.spyOn(MutationObserver.prototype, "observe");
    watchDrawnLate(stageEl, new Map(), () => {})();
    expect(observe).not.toHaveBeenCalled();
    observe.mockRestore();
  });
});
