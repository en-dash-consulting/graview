import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EMPTY_VIEW, interpolate, layout, ROSTER_ROW, rosterHeight } from "../../src/index.js";

/**
 * AN OPENED DISTRICT LISTS WHAT THE LAYOUT KEPT ROOM FOR.
 *
 * The layout reserved 96 pixels under an opened district and the view
 * listed sixteen members in 250: a dealership's Vehicles, opened at the
 * bottom of an eight-district city, ran its roster off the scene and over
 * its neighbors. Now the layout reserves rows, says how many it kept
 * (`openedRows`), and the tween carries the number to the view.
 */
const fields = z.object({ label: z.string() });
const kinds = ["vehicle", "location", "staff", "customer", "drive", "deal", "trade", "service"].map((kind) =>
  defineNode(kind, { fields, plural: `${kind}s` }),
);
const schema = createSchema(kinds as never);
const graph = () =>
  Graph.from(schema, {
    nodes: kinds.flatMap((definition, k) =>
      Array.from({ length: k === 0 ? 291 : 12 }, (_, i) => ({ id: `${definition.kind}-${i}`, kind: definition.kind, label: `${definition.kind} ${i}` })),
    ) as never,
    edges: [],
  });

describe("an opened district", () => {
  for (const [width, height] of [[1016, 806], [1296, 886]] as const) {
    it(`at ${width} says how many rows it has room for, and they fit the card it was given`, () => {
      const view = { ...EMPTY_VIEW, overview: true, expanded: ["kind:vehicle"] };
      const result = layout(graph(), schema, view, { width, height, unit: 16 });
      const card = result.nodes.find((node) => node.id === "kind:vehicle")!;
      expect(card.opened).toBe(true);
      expect(card.openedRows, "the layout says how many rows").toBeGreaterThanOrEqual(1);
      const closed = layout(graph(), schema, { ...EMPTY_VIEW, overview: true }, { width, height, unit: 16 }).nodes.find((node) => node.id === "kind:vehicle")!;
      // The rows it names are inside what it grew by (one row of slack for the chrome at the floor).
      expect(card.openedRows! * ROSTER_ROW).toBeLessThanOrEqual(card.height - closed.height + ROSTER_ROW);
      expect(rosterHeight(8)).toBeGreaterThan(96);
      // And the tween carries it, or the view falls back to its own guess mid-flight.
      const mid = interpolate({ ...result, nodes: result.nodes } as never, result, 0.5);
      expect(mid.nodes.find((node) => node.id === "kind:vehicle")!.openedRows).toBe(card.openedRows);
    });
  }
});

describe("an opened district in a crowded city", () => {
  it("keeps four rows, so opening a district of four names all four", () => {
    const small = () =>
      Graph.from(schema, {
        nodes: kinds.flatMap((definition, k) =>
          Array.from({ length: k === 0 ? 4 : 12 }, (_, i) => ({ id: `${definition.kind}-${i}`, kind: definition.kind, label: `${definition.kind} ${i}` })),
        ) as never,
        edges: [],
      });
    const result = layout(small(), schema, { ...EMPTY_VIEW, overview: true, expanded: ["kind:vehicle"] }, { width: 1016, height: 806, unit: 16 });
    expect(result.nodes.find((node) => node.id === "kind:vehicle")!.openedRows).toBe(4);
  });
});
