import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineApp, defineNode } from "../../src/index.js";
import {
  BLOCK,
  cityExtent,
  cityMap,
  districtBlocks,
  districtState,
  MAX_SIDE,
  plotsOverlap,
  roadsOf,
  sideFor,
  TIER_HEIGHT,
  toIso,
} from "../../src/scene.js";
import { checkApp, describeApp } from "../../src/check.js";

/**
 * THE CITY IS A MAP DRAWN FROM THE DECLARATION.
 *
 * Same declaration, same plots. The kinds stand upstream to downstream,
 * left to right — each one column past the furthest kind it points at —
 * and a kind tied to nothing stands in the margin under the rest.
 * Population changes a plot's side, never its corner, and never past three
 * cells: the biggest kind does not take the map. A kind that declares
 * where it stands is put exactly there, and two on one block are reported.
 * All of it pure, so a test can hold it — and so `graview describe` can read
 * the map out with no browser at all.
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
/** Where a plot's middle meets the screen, at one pixel a cell. */
const onScreen = (map: ReturnType<typeof cityMap>, kind: string) => {
  const plot = map.get(kind)!;
  return toIso(plot.col + plot.side / 2, plot.row + plot.side / 2, 1);
};

describe("the map", () => {
  it("is the same map for the same declaration, and every plot is on its own block", () => {
    const a = cityMap(schema, { order });
    const b = cityMap(schema, { order });
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect(a.get("zone")).toEqual({ col: 0, row: 0, side: 2 });
    for (const [kind, plot] of a) for (const [other, there] of a) if (kind !== other) expect(plotsOverlap(plot, there), `${kind} and ${other}`).toBe(false);
  });

  it("stands each kind left of the kinds that point at it: upstream to downstream, a column each", () => {
    const map = cityMap(schema, { order });
    // practice → concern → feature → zone, and concern → zone: four columns.
    const x = (kind: string) => onScreen(map, kind).x;
    expect(x("zone")).toBeLessThan(x("feature"));
    expect(x("feature")).toBeLessThan(x("concern"));
    expect(x("concern")).toBeLessThan(x("practice"));
    // One column apart is one block across the screen, whatever the kind's size.
    expect(x("feature") - x("zone")).toBe(BLOCK);
    expect(x("practice") - x("concern")).toBe(BLOCK);
  });

  it("stands a kind tied to nothing in the margin, under the map", () => {
    const map = cityMap(schema, { order });
    const y = (kind: string) => onScreen(map, kind).y;
    for (const kind of ["zone", "feature", "concern", "practice"]) expect(y("note"), kind).toBeGreaterThan(y(kind));
  });

  it("stands the kinds of one column one above the other, and the same columns top to bottom when it is turned upright", () => {
    const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
    const place = defineNode("place", { fields: z.object({ label: z.string() }), plural: "Places" });
    const visit = defineNode("visit", { fields: z.object({ label: z.string() }), plural: "Visits", edges: { by: { to: ["person"], description: "who" }, at: { to: ["place"], description: "where" } } });
    const app = createSchema([person, place, visit]);
    const wide = cityMap(app, { order: ["person", "place", "visit"] });
    expect(onScreen(wide, "person").x).toBe(onScreen(wide, "place").x);
    expect(onScreen(wide, "place").y).toBeGreaterThan(onScreen(wide, "person").y);
    expect(onScreen(wide, "visit").x).toBeGreaterThan(onScreen(wide, "person").x);
    const upright = cityMap(app, { order: ["person", "place", "visit"], upright: true });
    expect(onScreen(upright, "person").y).toBe(onScreen(upright, "place").y);
    expect(onScreen(upright, "visit").y).toBeGreaterThan(onScreen(upright, "person").y);
  });

  it("breaks a cycle where the walk meets it, and still gives every kind a plot", () => {
    const a = defineNode("a", { fields: z.object({ label: z.string() }), edges: { to: { to: ["b"], description: "b" } } });
    const b = defineNode("b", { fields: z.object({ label: z.string() }), edges: { to: { to: ["a"], description: "a" } } });
    const map = cityMap(createSchema([a, b]), { order: ["a", "b"] });
    expect(map.size).toBe(2);
    expect(plotsOverlap(map.get("a")!, map.get("b")!)).toBe(false);
  });

  it("lets population change a plot's side and never its corner, and caps it so the biggest kind does not take the map", () => {
    const empty = cityMap(schema, { order });
    const busy = cityMap(schema, { order, counts: { zone: 7, feature: 1, concern: 400 } });
    expect(busy.get("zone")).toEqual({ ...empty.get("zone")!, side: 3 });
    expect(busy.get("feature")).toEqual(empty.get("feature"));
    expect(busy.get("concern")!.side).toBe(MAX_SIDE);
    expect(MAX_SIDE).toBe(3);
    expect(sideFor(undefined)).toBe(2);
    expect(sideFor(4)).toBe(2);
    expect(sideFor(5)).toBe(3);
    expect(sideFor(1000)).toBe(3);
  });

  it("puts a kind that declares its plot exactly there, and stands the rest clear of it", () => {
    const laid = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones", plot: { col: 0, row: 0 } });
    const map = cityMap(createSchema([laid, feature]), { order: ["zone", "feature"] });
    expect(map.get("zone")).toEqual({ col: 0, row: 0, side: 2 });
    expect(plotsOverlap(map.get("zone")!, map.get("feature")!)).toBe(false);
    const hinted = cityMap(createSchema([zone, feature]), { plots: { feature: { col: 5, row: 0 } } });
    expect(hinted.get("feature")).toEqual({ col: 5, row: 0, side: 2 });
  });

  it("falls back to sorted ids when no order is given, and is still deterministic", () => {
    expect([...cityMap(schema).entries()]).toEqual([...cityMap(schema).entries()]);
    expect(cityMap(schema).get("zone")).toEqual({ col: 0, row: 0, side: 2 });
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

  it("projects a cell onto the 2:1 lattice — or from straight above — and knows its own extent", () => {
    expect(toIso(0, 0, 40)).toEqual({ x: 0, y: 0 });
    expect(toIso(1, 0, 40)).toEqual({ x: 20, y: 10 });
    expect(toIso(0, 1, 40)).toEqual({ x: -20, y: 10 });
    expect(toIso(1, 0, 40, 1)).toEqual({ x: 20, y: 20 });
    const extent = cityExtent(cityMap(schema, { order, counts: { zone: 9 } }));
    expect(extent.minCol).toBeLessThanOrEqual(0);
    expect(extent.maxCol - extent.minCol).toBeGreaterThanOrEqual(BLOCK + 3);
  });
});

describe("the state a district shows", () => {
  const task = defineNode("task", {
    fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]).default("todo"), priority: z.enum(["low", "high"]) }),
  });
  const item = defineNode("item", {
    fields: z.object({ label: z.string(), phase: z.enum(["draft", "live", "gone"]) }),
    lifecycle: { field: "phase", retired: ["gone"] },
  });
  const plain = defineNode("plain", { fields: z.object({ label: z.string(), priority: z.enum(["low", "high"]) }) });
  const app = createSchema([task, item, plain]);

  it("reads a kind's main choice — its lifecycle's, else one called status, stage, state or phase — in declared order, done, active or waiting", () => {
    expect(districtState(app, "task")).toEqual({ field: "status", values: ["todo", "doing", "done"], tiers: ["waiting", "active", "done"] });
    expect(districtState(app, "item")).toEqual({ field: "phase", values: ["draft", "live", "gone"], tiers: ["waiting", "waiting", "done"] });
    expect(districtState(app, "plain")).toBeUndefined();
  });

  it("stands a row of blocks per value, back row first, every block one size, the rest of a full row counted where it begins", () => {
    const plot = { col: 0, row: 0, side: 3 };
    const ids = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`);
    const { blocks, rests } = districtBlocks(plot, [ids(9, "open"), ids(8, "doing"), ids(14, "done")], [TIER_HEIGHT.waiting, TIER_HEIGHT.active, TIER_HEIGHT.done]);
    const lane = (n: number) => blocks.filter((b) => b.lane === n);
    expect(lane(0)).toHaveLength(9);
    expect(lane(1)).toHaveLength(8);
    expect(lane(2)).toHaveLength(12);
    expect(rests).toEqual([{ lane: 2, count: 2, col: -0.15, row: 2.5 }]);
    // Rows in declared order down the plot's depth, each inside its own third.
    for (const b of lane(1)) expect(b.row).toBeGreaterThan(1);
    for (const b of lane(1)) expect(b.row).toBeLessThan(2);
    expect(new Set(blocks.map((b) => b.footprint)).size).toBe(1);
    // Done lies flat; active stands tallest.
    expect(lane(2)[0]!.height).toBeLessThan(lane(0)[0]!.height);
    expect(lane(1)[0]!.height).toBeGreaterThan(lane(0)[0]!.height);
    // Back to front.
    for (let i = 1; i < blocks.length; i++) expect(blocks[i]!.col + blocks[i]!.row).toBeGreaterThanOrEqual(blocks[i - 1]!.col + blocks[i - 1]!.row - 1e-9);
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
