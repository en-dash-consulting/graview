// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { connectorStrands, type SceneNode } from "../../src/index.js";

/**
 * A LINE DIVES UNDER THE CARDS IT MERELY CROSSES — including the ones a
 * lens drew inside itself.
 *
 * "Card" meant a DRAWN NODE, and the things a lens draws inside itself are
 * not drawn nodes. The connector layer sits above the hosts, so a line
 * across the week did not pass behind ten shift cards, it passed over them:
 * a stroke painted across somebody's Tuesday. Going under is what the
 * clipping already does — it had nothing in there to clip against.
 */

const node = (id: string, x: number, y: number, plane: 0 | 1 | 2, extra: Partial<SceneNode> = {}): SceneNode =>
  ({ id, kind: "k", plane, x, y, width: 100, height: 60, pinned: false, opacity: 1, ...extra }) as SceneNode;

/**
 * A stage with drawings in it. `connectorStrands` asks a stage only for
 * elements and their rectangles, so this is the whole of what it needs —
 * and jsdom would answer every rectangle with zeroes.
 */
function stageOf(drawings: { id: string; x: number; y: number; width: number; height: number }[]) {
  const element = (drawing: (typeof drawings)[number]) => ({
    getAttribute: (name: string) => (name === "data-graview-pick" ? drawing.id : null),
    closest: () => null,
    getBoundingClientRect: () => ({
      left: drawing.x,
      top: drawing.y,
      width: drawing.width,
      height: drawing.height,
    }),
  });
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }),
    querySelector: () => null,
    querySelectorAll: (selector: string) =>
      selector.includes("data-graview-pick, ") || selector === "[data-graview-pick], [data-graview-slot]"
        ? drawings.map(element)
        : [],
  } as unknown as HTMLElement;
}

const nodes = [
  node("week", 0, 0, 0, { aggregate: { kind: "s", memberIds: ["tue", "thu"], label: "Sessions" } }),
  node("d-a", 0, 300, 1),
];
/*
 * A BUNDLE, kept whole: nothing inside the week is drawn as its own end, so
 * the strand runs card to card. That is the path this is about — what the
 * line must dive under on the way, which is decided before any anchor is.
 */
const connector = {
  id: "includes:week:d-a",
  kind: "includes",
  from: "week",
  to: "d-a",
  edges: [],
  x1: 0,
  y1: 0,
  x2: 0,
  y2: 0,
};

describe("what a connector must dive under", () => {
  it("counts the drawings inside a view, not only the drawn nodes", () => {
    const drawings = [
      { id: "tue", x: 10, y: 10, width: 40, height: 30 },
      { id: "wed", x: 80, y: 120, width: 40, height: 30 },
      { id: "thu", x: 150, y: 200, width: 40, height: 30 },
    ];
    const bare = connectorStrands(nodes, [connector], null, false, "light");
    const measured = connectorStrands(nodes, [connector], stageOf(drawings), false, "light");
    // Without a stage nothing inside a view can be measured, so the answer
    // is what it always was: the other drawn nodes and nothing else.
    expect(bare[0]!.obstacles).toHaveLength(0);
    // With one, every sibling drawing the line could cross is in the way.
    expect(measured[0]!.obstacles.length).toBeGreaterThan(bare[0]!.obstacles.length);
  });

  it("leaves the line's own two ends out of its way", () => {
    // A strand running week → d-a must not be clipped by either of them.
    const measured = connectorStrands(
      nodes,
      [connector],
      stageOf([
        { id: "week", x: 0, y: 0, width: 300, height: 200 },
        { id: "d-a", x: 0, y: 300, width: 100, height: 60 },
        { id: "wed", x: 80, y: 120, width: 40, height: 30 },
      ]),
      false,
      "light",
    );
    const boxes = measured[0]!.obstacles;
    expect(boxes.some((box) => box.width === 300)).toBe(false); // week, an end
    expect(boxes.some((box) => box.width === 40)).toBe(true); // wed, in the way
  });

  it("ignores a drawing the size of the stage", () => {
    /*
     * A ROTATED HEADER'S BOUNDING BOX is a huge diagonal rectangle whose
     * border is nowhere near the visible text — a matrix writes its column
     * names on the slant. Taken as an obstacle it erased every line in the
     * picture, so anything approaching the size of the stage is furniture.
     */
    const measured = connectorStrands(
      nodes,
      [connector],
      stageOf([{ id: "slanted", x: 0, y: 0, width: 900, height: 700 }]),
      false,
      "light",
    );
    expect(measured[0]!.obstacles).toHaveLength(0);
  });
});
