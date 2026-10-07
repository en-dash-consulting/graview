import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EMPTY_VIEW, layout, SCREEN_LEASH_CELLS, withWithin } from "../../src/index.js";

/**
 * A BILLBOARD CAN BE MOVED, AND ONLY SO FAR.
 *
 * Its home is the back curb of its own plot, which is where it belongs: a
 * picture of a kind, standing on that kind's land. A board planted to the
 * millimeter is furniture, though, and a person wants to nudge it off
 * whatever it is covering — so a pin moves it, and the leash is what keeps
 * it a picture OF this village rather than a sheet floating over the city.
 *
 * In city cells, not pixels, so the same pin holds at every zoom. Held
 * here rather than where the drag is made, because a pin arrives from a
 * pasted link as readily as from a hand, and a leash only the hand respects
 * is not a leash.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People", edges: { does: { to: ["duty"], description: "what they do" } } });
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Duties" });
const week = defineNode("week", { fields: z.object({ label: z.string() }), plural: "Weeks" });
const schema = createSchema([person, duty, week]);
const graph = () =>
  Graph.from(schema, {
    nodes: [
      { id: "w1", kind: "week", label: "This week" },
      { id: "ana", kind: "person", label: "Ana" },
      { id: "m", kind: "duty", label: "Morning" },
    ] as never,
    edges: [{ kind: "does", from: "ana", to: "m" }],
  });
const screens = { duty: [{ as: "the-week", title: "The week" }] };
const options = { width: 1280, height: 800, cityOrder: ["week", "duty", "person"], screens };
const aloft = withWithin({ ...EMPTY_VIEW, overview: true, focusId: "aggregate:duty" }, "view", "the-week");

const board = (pins: Record<string, { x: number; y: number }> = {}) => {
  const result = layout(graph(), schema, { ...aloft, pins }, options);
  const node = result.nodes.find((one) => one.screenOf === "duty")!;
  return { node, cell: result.city!.cell };
};

describe("the billboard is on a leash", () => {
  it("stands on its own plot when nobody has moved it", () => {
    expect(board().node.pinned).toBe(false);
  });

  it("goes where a hand puts it, while that is within reach", () => {
    const { node: home, cell } = board();
    const nudge = { x: home.x + cell * 0.5, y: home.y - cell * 0.5 };
    const { node: moved } = board({ "aggregate:duty": nudge });
    expect(moved.x).toBeCloseTo(nudge.x, 6);
    expect(moved.y).toBeCloseTo(nudge.y, 6);
    // And says a hand put it there, so the scene can mark it.
    expect(moved.pinned).toBe(true);
  });

  it("is pulled up short of a pin that would take it off its village", () => {
    const { node: home, cell } = board();
    // Straight up, ten cells: far past anything this board is a picture of.
    const far = { x: home.x, y: home.y - cell * 10 };
    const { node: moved } = board({ "aggregate:duty": far });
    expect(home.y - moved.y).toBeCloseTo(SCREEN_LEASH_CELLS * cell, 6);
    expect(moved.x).toBeCloseTo(home.x, 6);
  });

  it("clamps the distance, not each direction on its own", () => {
    // A leash is a radius. Clamping x and y separately would let a diagonal
    // pin reach √2 times as far as a straight one, which is a board further
    // from its village in the one direction nobody checked.
    const { node: home, cell } = board();
    const corner = { x: home.x + cell * 10, y: home.y + cell * 10 };
    const { node: moved } = board({ "aggregate:duty": corner });
    const reach = Math.hypot(moved.x - home.x, moved.y - home.y);
    expect(reach).toBeCloseTo(SCREEN_LEASH_CELLS * cell, 6);
  });

  it("holds the same pin at every zoom, because the leash is in cells", () => {
    // Flown closer the city's cell grows; a leash in pixels would let the
    // board wander further exactly when there is less room for it to.
    const close = layout(graph(), schema, { ...aloft, pins: {} }, { ...options, cityZoom: 1.5 });
    const near = close.nodes.find((one) => one.screenOf === "duty")!;
    const pinned = layout(
      graph(),
      schema,
      { ...aloft, pins: { "aggregate:duty": { x: near.x, y: near.y - close.city!.cell * 10 } } },
      { ...options, cityZoom: 1.5 },
    );
    const moved = pinned.nodes.find((one) => one.screenOf === "duty")!;
    expect(near.y - moved.y).toBeCloseTo(SCREEN_LEASH_CELLS * close.city!.cell, 6);
  });
});
