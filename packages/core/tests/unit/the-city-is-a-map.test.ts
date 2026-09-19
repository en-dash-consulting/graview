import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  BLOCK,
  checkApp,
  cityExtent,
  cityMap,
  createSchema,
  defineApp,
  defineNode,
  describeApp,
  plotsOverlap,
  roadsOf,
  sideFor,
  toIso,
} from "../../src/index.js";

/**
 * THE CITY IS A MAP DRAWN FROM THE DECLARATION.
 *
 * Same declaration, same plots. Adding a kind moves nothing that was
 * there. Population changes a plot's side and never its corner. A kind
 * that declares where it stands is put exactly there, and two on one
 * block are reported. All of it pure, so a test can hold it — and so
 * `graview describe` can read the map out with no browser at all.
 */
const zone = defineNode("zone", {
  fields: z.object({ label: z.string() }),
  plural: "Zones",
  edges: { within: { to: ["zone"], description: "inside" } },
});
const feature = defineNode("feature", {
  fields: z.object({ label: z.string() }),
  plural: "Features",
  edges: { stands: { to: ["zone"], description: "where it stands" } },
});
const concern = defineNode("concern", {
  fields: z.object({ label: z.string() }),
  plural: "Concerns",
  edges: { shows: { to: ["zone"], description: "where it shows" }, about: { to: ["feature"], description: "what it is about" } },
});
const practice = defineNode("practice", {
  fields: z.object({ label: z.string() }),
  plural: "Practices",
  edges: { helps: { to: ["concern"], description: "what it addresses" } },
});
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });

const schema = createSchema([zone, feature, concern, practice, note]);
const order = ["zone", "feature", "concern", "practice", "note"];

describe("the map", () => {
  it("is the same map for the same declaration, and every plot is on its own block", () => {
    const a = cityMap(schema, { order });
    const b = cityMap(schema, { order });
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect(a.get("zone")).toEqual({ col: 0, row: 0, side: 1 });
    /* Each next kind stands next to the placed kind it shares the most edges with. */
    const at = (kind: string) => a.get(kind)!;
    const adjacent = (x: string, y: string) => Math.abs(at(x).col - at(y).col) + Math.abs(at(x).row - at(y).row) === BLOCK;
    expect(adjacent("feature", "zone")).toBe(true);
    expect(adjacent("concern", "zone") || adjacent("concern", "feature")).toBe(true);
    expect(adjacent("practice", "concern")).toBe(true);
    const blocks = [...a.values()].map((plot) => `${plot.col / BLOCK},${plot.row / BLOCK}`);
    expect(new Set(blocks).size).toBe(blocks.length);
  });

  it("leaves every existing plot unmoved when a kind is added", () => {
    const before = cityMap(createSchema([zone, feature, concern, practice]), { order });
    const after = cityMap(schema, { order });
    for (const [kind, plot] of before) expect(after.get(kind)).toEqual(plot);
    expect(after.has("note")).toBe(true);
  });

  it("lets population change a plot's side and never its corner", () => {
    const empty = cityMap(schema, { order });
    const busy = cityMap(schema, { order, counts: { zone: 7, feature: 1, concern: 40 } });
    expect(busy.get("zone")).toEqual({ ...empty.get("zone")!, side: 3 });
    expect(busy.get("feature")).toEqual(empty.get("feature"));
    /* Capped: a thousand concerns still fit on the largest block. */
    expect(busy.get("concern")!.side).toBe(4);
    expect(sideFor(undefined)).toBe(1);
    expect(sideFor(2)).toBe(2);
    expect(sideFor(1000)).toBe(4);
  });

  it("puts a kind that declares its plot exactly there, and walks the rest around it", () => {
    const laid = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones", plot: { col: 10, row: 10 } });
    const map = cityMap(createSchema([laid, feature]), { order: ["zone", "feature"] });
    expect(map.get("zone")).toEqual({ col: 10, row: 10, side: 1 });
    expect(Math.abs(map.get("feature")!.col - 10) + Math.abs(map.get("feature")!.row - 10)).toBe(BLOCK);
    const hinted = cityMap(createSchema([zone, feature]), { plots: { feature: { col: 5, row: 0 } } });
    expect(hinted.get("feature")).toEqual({ col: 5, row: 0, side: 1 });
  });

  it("falls back to sorted ids when no order is given, and is still deterministic", () => {
    expect([...cityMap(schema).keys()]).toEqual(["concern", "feature", "note", "practice", "zone"]);
    expect(cityMap(schema).get("concern")).toEqual({ col: 0, row: 0, side: 1 });
  });

  it("names the roads: one per pair of kinds joined by a declared edge", () => {
    const roads = roadsOf(schema, cityMap(schema, { order }));
    expect(roads).toEqual([
      { from: "concern", to: "feature", edges: ["about"] },
      { from: "concern", to: "practice", edges: ["helps"] },
      { from: "concern", to: "zone", edges: ["shows"] },
      { from: "feature", to: "zone", edges: ["stands"] },
    ]);
  });

  it("projects a cell onto the 2:1 lattice, and knows its own extent", () => {
    expect(toIso(0, 0, 40)).toEqual({ x: 0, y: 0 });
    expect(toIso(1, 0, 40)).toEqual({ x: 20, y: 10 });
    expect(toIso(0, 1, 40)).toEqual({ x: -20, y: 10 });
    const extent = cityExtent(cityMap(schema, { order, counts: { zone: 9 } }));
    expect(extent.minCol).toBeLessThanOrEqual(0);
    expect(extent.maxCol - extent.minCol).toBeGreaterThanOrEqual(BLOCK + 3);
  });
});

describe("the checker and describe", () => {
  it("reports two kinds hand-laid on one block as plot-overlap", () => {
    const a = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones", plot: { col: 0, row: 0 } });
    const b = defineNode("feature", { fields: z.object({ label: z.string() }), plural: "Features", plot: { col: 2, row: 1 } });
    const c = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes", plot: { col: 10, row: 0 } });
    const findings = checkApp(defineApp({ name: "g", schema: createSchema([a, b, c]) })).findings;
    const overlaps = findings.filter((finding) => finding.code === "plot-overlap");
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]!.message).toContain("zone");
    expect(overlaps[0]!.message).toContain("feature");
    expect(plotsOverlap({ col: 0, row: 0 }, { col: 5, row: 0 })).toBe(false);
  });

  it("describe reads the map out: each kind's plot and its roads", () => {
    const said = describeApp(defineApp({ name: "grounds", schema }));
    expect(said).toContain("## The city");
    expect(said).toMatch(/zone at \(-?\d+, -?\d+\)/);
    expect(said).toContain("feature — zone by stands");
  });
});
