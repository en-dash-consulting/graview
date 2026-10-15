import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EMPTY_VIEW, layout } from "../../src/index.js";

/**
 * A FOCUSED CARD BEGINS BELOW THE TRAIL (the tenth walk, carried). The
 * picture's trail stands over the ground's top corner — "zoomed in ×", a
 * raised kind's "Shifts ×" — and a zoomed place began at 3% of the height,
 * under it: the rota's raised chip stood over its week's "Sort". Told the
 * room the trail takes, the card begins below it and gives that much of
 * its height back; told nothing, nothing moves.
 */
const shift = defineNode("shift", { fields: z.object({ label: z.string() }), plural: "Shifts" });
const schema = createSchema([shift]);
const graph = () => Graph.from(schema, { nodes: [1, 2, 3].map((n) => ({ id: `s${n}`, kind: "shift", label: `Shift ${n}` })) as never, edges: [] });
const view = { ...EMPTY_VIEW, focusId: "aggregate:shift", zoom: true, relation: "shift" };
const focused = (headroom?: number) =>
  layout(graph(), schema, view, { width: 1440, height: 788, unit: 16, ...(headroom !== undefined ? { headroom } : {}) }).nodes.find((node) => node.id === "aggregate:shift")!;

describe("a focused card and the trail over the ground's corner", () => {
  it("begins below the room the trail takes, and gives that height back", () => {
    const under = focused();
    expect(under.y, "told nothing, it begins under the trail").toBeLessThan(48);
    const below = focused(54);
    expect(below.y).toBeGreaterThanOrEqual(54 - 0.5);
    expect(below.y + below.height).toBeCloseTo(under.y + under.height, 0);
  });
});
