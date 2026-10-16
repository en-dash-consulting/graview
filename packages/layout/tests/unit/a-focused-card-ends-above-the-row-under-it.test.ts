import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EMPTY_VIEW, layout } from "../../src/index.js";

/**
 * A FOCUSED CARD ENDS ABOVE THE ROW UNDER IT (W-224). A district card in
 * the row under a focused list is never shorter than its floor, and at a
 * reader's largest text on a phone the floor is taller than the row's
 * band: the card grew up from the band's baseline, into the focused card,
 * whose last rows stood over the folded districts' "+3 more". The focused
 * card ends above where the row is drawn, at every text size.
 */
const names = ["list", "task", "reason", "rule", "place"];
const schema = createSchema(names.map((kind) => defineNode(kind, { fields: z.object({ label: z.string() }), plural: `${kind[0]!.toUpperCase()}${kind.slice(1)}s` })));
const graph = () =>
  Graph.from(schema, {
    nodes: names.flatMap((kind, k) => [1, 2, 3].map((n) => ({ id: `${k}-${n}`, kind, label: `${kind} ${n}` }))) as never,
    edges: [],
  });
const view = { ...EMPTY_VIEW, focusId: "aggregate:list" };

describe("a focused card and the row of districts under it", () => {
  for (const unit of [16, 24, 32]) {
    it(`ends above every card of the row on a phone at ${unit}px text`, () => {
      const nodes = layout(graph(), schema, view, { width: 390, height: 751, unit }).nodes;
      const focused = nodes.find((node) => node.id === "aggregate:list")!;
      const row = nodes.filter((node) => node.id !== "aggregate:list" && node.y > focused.y);
      expect(row.length).toBeGreaterThan(0);
      for (const card of row) expect(focused.y + focused.height, card.id).toBeLessThanOrEqual(card.y);
    });
  }
});
