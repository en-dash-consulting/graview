import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EMPTY_VIEW, layout } from "../../src/index.js";

/**
 * FR-143. Graview Cloud's workshop at 1280 wide: eight kinds, a workshop
 * part selected Down in its district. The row of districts holds three and
 * "+5 more", and it kept the first three in its order — Date options,
 * Decisions, Deliverables, all empty — while the district the reader stood
 * in went behind "+5 more". The focused kind is kept first; the row still
 * reads in its own order.
 */
const fields = z.object({ label: z.string() });
const kinds = ["date-option", "decision", "deliverable", "open-item", "person", "segment", "topic", "workstream"];
const schema = createSchema(
  kinds.map((kind) =>
    defineNode(kind, {
      fields,
      plural: kind === "segment" ? "Workshop parts" : `${kind}s`,
      ...(kind === "topic" ? { edges: { partOf: { to: ["segment"], cardinality: "one" as const, inverse: "covers" } } } : {}),
    }),
  ),
);
const graph = () =>
  Graph.from(schema, {
    nodes: [
      { id: "ongoing", kind: "segment", label: "Ongoing support" },
      ...[1, 2, 3, 4].map((n) => ({ id: `t${n}`, kind: "topic", label: `Topic ${n}` })),
    ] as never,
    edges: [1, 2, 3, 4].map((n) => ({ kind: "partOf", from: `t${n}`, to: "ongoing" })),
  });

describe("the district you are in stays in the row", () => {
  for (const width of [1016, 760]) {
    it(`keeps the focused record's district in a row that sheds, at ${width}`, () => {
      const view = { ...EMPTY_VIEW, focusId: "ongoing", zoom: true, selection: ["ongoing"] };
      const row = layout(graph(), schema, view, { width, height: 752, unit: 16 }).nodes.filter((node) => node.plane === 2);
      const beyond = row.find((node) => node.beyond)?.beyond ?? [];
      expect(beyond.length, "the row sheds at this width").toBeGreaterThan(0);
      expect(beyond).not.toContain("segment");
      const drawn = row.filter((node) => !node.beyond).map((node) => node.id.replace(/^kind:/, ""));
      expect(drawn).toContain("segment");
      // The rest keep the row's own order.
      const order = drawn.map((kind) => kinds.indexOf(kind));
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });
  }
});
