import { createSchema, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { districtOf, mapChoice, ribbonSentence, ribbonsOf } from "../../src/map-choice.js";
import { ribbonWidth, RIBBON_WIDTH } from "../../src/ribbon-width.js";
import { crossesAny, loopPoints, midpointOf, routeRibbons, tileOf, type Tile } from "../../src/ribbons.js";

/*
 * FROM ALTITUDE, ONE RIBBON PER RELATION BETWEEN TWO DISTRICTS, as wide as
 * the links along it and saying what it is in the declaring kind's words —
 * where the map used to draw a road per pair of districts that said
 * nothing about which relation, which way or how many.
 */
const area = defineNode("area", { fields: z.object({ name: z.string() }), plural: "areas", noun: "area" });
const feature = defineNode("feature", {
  fields: z.object({ name: z.string() }),
  plural: "features",
  noun: "feature",
  edges: {
    partOf: { to: ["area"], description: "the part it lives in", inverse: "what this part does" },
    dependsOn: { to: ["feature"], description: "what has to ship first" },
  },
});
const schema = createSchema([area, feature]);
const kinds: Record<string, string> = { a1: "area", a2: "area", f1: "feature", f2: "feature", f3: "feature" };
const kindOf = (id: string) => kinds[id];
const edges = [
  { kind: "partOf", from: "f1", to: "a1" },
  { kind: "partOf", from: "f2", to: "a1" },
  { kind: "partOf", from: "f3", to: "a2" },
  { kind: "dependsOn", from: "f2", to: "f1" },
];

describe("a relation is one ribbon", () => {
  it("counts each relation between two kinds once, with its links and both ends", () => {
    const ribbons = ribbonsOf(edges, kindOf);
    expect(ribbons.map((ribbon) => ribbon.key)).toEqual(["dependsOn|feature|feature", "partOf|feature|area"]);
    const partOf = ribbons.find((ribbon) => ribbon.edge === "partOf")!;
    expect(partOf).toMatchObject({ from: "feature", to: "area", links: 3, fromCount: 3, toCount: 2 });
  });

  it("draws nothing for a relation nobody has made, and nothing for a record the graph does not hold", () => {
    expect(ribbonsOf([], kindOf)).toEqual([]);
    expect(ribbonsOf([{ kind: "partOf", from: "gone", to: "a1" }], kindOf)).toEqual([]);
  });

  it("says what it is in the declaring kind's words, and how many of each end", () => {
    const [dependsOn, partOf] = ribbonsOf(edges, kindOf);
    expect(ribbonSentence(schema, partOf!)).toBe("3 features → 2 areas, the part it lives in");
    expect(ribbonSentence(schema, dependsOn!)).toBe("1 feature → 1 feature of their own, what has to ship first");
  });

  it("is as wide as its share of the busiest relation's links, within a floor and a ceiling", () => {
    expect(ribbonWidth(146, 146)).toBe(RIBBON_WIDTH.max);
    expect(ribbonWidth(0, 146)).toBe(RIBBON_WIDTH.min);
    expect(ribbonWidth(73, 146)).toBeCloseTo((RIBBON_WIDTH.min + RIBBON_WIDTH.max) / 2, 6);
    expect(ribbonWidth(4, 146)).toBeLessThan(ribbonWidth(90, 146));
  });

  /*
   * Four districts in a row at the city's own spacing, a fifth below the
   * first: the shape the map lays a left-to-right city out in.
   */
  const at = (col: number, row: number) => ({ col, row, side: 4 });
  const tiles = new Map<string, Tile>([
    ["a", tileOf(at(0, 6), 20)],
    ["b", tileOf(at(6, 0), 20)],
    ["c", tileOf(at(12, -6), 20)],
    ["d", tileOf(at(18, -12), 20)],
    ["e", tileOf(at(6, 12), 20)],
  ]);
  const others = (...not: string[]) => [...tiles].filter(([key]) => !not.includes(key)).map(([, tile]) => tile);
  const lengthOf = (points: readonly { x: number; y: number }[]) => points.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y)), 0);

  it("runs straight between neighbors, from the corner of one to the corner of the other that faces it", () => {
    const run = routeRibbons([{ key: "ab", from: "a", to: "b", width: 4 }], tiles).get("ab")!;
    expect(run).toHaveLength(2);
    const a = tiles.get("a")!;
    const b = tiles.get("b")!;
    expect(run[0]).toEqual({ x: a.cx + a.hw, y: a.cy });
    expect(run[1]).toEqual({ x: b.cx - b.hw, y: b.cy });
  });

  it("goes along the row's street between two with others between, crossing none and bowing nowhere", () => {
    const run = routeRibbons([{ key: "ad", from: "a", to: "d", width: 4 }], tiles).get("ad")!;
    expect(crossesAny(run, others("a", "d"))).toBe(false);
    const a = tiles.get("a")!;
    const d = tiles.get("d")!;
    // Never higher than the districts it joins, nor further below them than their fronts and a little: no V up the window.
    for (const p of run) {
      expect(p.y).toBeGreaterThanOrEqual(Math.min(a.cy, d.cy) - 1);
      expect(p.y).toBeLessThanOrEqual(a.cy + a.hh + 20);
    }
    // And hardly longer than the way across.
    expect(lengthOf(run)).toBeLessThan(1.2 * Math.hypot(d.cx - a.cx, d.cy - a.cy) + 2 * a.hh);
  });

  it("bends once to reach a district in another row and column, crossing none", () => {
    const run = routeRibbons([{ key: "ed", from: "e", to: "d", width: 4 }], tiles).get("ed")!;
    expect(crossesAny(run, others("e", "d"))).toBe(false);
    expect(run.length).toBeLessThanOrEqual(5);
  });

  it("lays ribbons that share a street side by side, each its own width apart", () => {
    const runs = routeRibbons(
      [
        { key: "ad", from: "a", to: "d", width: 6 },
        { key: "ac", from: "a", to: "c", width: 2 },
      ],
      tiles,
    );
    const street = (key: string) => runs.get(key)![1]!.y;
    expect(Math.abs(street("ad") - street("ac"))).toBeGreaterThanOrEqual(4);
  });

  it("draws a relation of a kind to itself as a loop off its own curb, each further one further out", () => {
    const plot = { col: 4, row: 4, side: 2 };
    const first = loopPoints(plot, 0);
    const second = loopPoints(plot, 1);
    expect(first[0]!.col).toBe(plot.col + plot.side);
    expect(first[first.length - 1]!.col).toBe(plot.col + plot.side);
    expect(second[1]!.col).toBeGreaterThan(first[1]!.col);
  });

  it("says its words at the middle of its length", () => {
    expect(midpointOf([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toEqual({ x: 10, y: 0 });
  });
});

describe("what the map is asked", () => {
  const kindOfAny = (id: string) => (id === "ana" || id === "bo" ? "person" : undefined);

  it("reads a district, a record, and a lens open beside the map", () => {
    expect(districtOf("kind:person")).toBe("person");
    expect(districtOf("aggregate:person")).toBe("person");
    expect(districtOf("aggregate:person|duty")).toBeNull();
    expect(districtOf("ana")).toBeNull();
    expect(mapChoice(["kind:person", "ana"], { overview: true, focusId: null }, kindOfAny)).toEqual({ districts: ["person"], records: ["ana"], lens: null });
    expect(mapChoice([], { overview: true, focusId: "aggregate:duty" }, kindOfAny).lens).toBe("duty");
    // On the ground a focused group is a place, not a lens beside the map.
    expect(mapChoice([], { overview: false, focusId: "aggregate:duty" }, kindOfAny).lens).toBeNull();
    // An edge chosen, or an id the graph has not got, is neither.
    expect(mapChoice(["edge:x", "nobody"], { overview: true, focusId: null }, kindOfAny)).toEqual({ districts: [], records: [], lens: null });
  });
});
