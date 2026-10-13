import { createSchema, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { districtOf, mapChoice, ribbonSentence, ribbonsOf } from "../../src/map-choice.js";
import { ribbonWidth, RIBBON_WIDTH } from "../../src/ribbon-width.js";
import { curbToCurb, loopPoints, midpointOf, ribbonLanes, streetPoints } from "../../src/ribbons.js";

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

  it("lays two relations between the same two districts side by side in their gutter", () => {
    const lanes = ribbonLanes([
      { key: "about|request|area", from: "request", to: "area" },
      { key: "partOf|feature|area", from: "feature", to: "area" },
      { key: "made|area|request", from: "area", to: "request" },
    ]);
    // Request and area share a gutter both ways round: two lanes, apart, inside the one cell.
    const a = lanes.get("about|request|area")!;
    const b = lanes.get("made|area|request")!;
    expect(a).not.toBe(b);
    expect(Math.abs(a)).toBeLessThan(0.5);
    expect(Math.abs(b)).toBeLessThan(0.5);
    // Alone between its two districts, a ribbon keeps to the gutter's middle.
    expect(lanes.get("partOf|feature|area")).toBe(0);
  });

  it("runs from curb to curb along lattice lines, moved sideways whole by its lane", () => {
    const from = { col: 0, row: 0, side: 2 };
    const to = { col: 10, row: 0, side: 2 };
    const middle = curbToCurb(streetPoints(from, to, 0), from, to);
    const moved = curbToCurb(streetPoints(from, to, 0.2), from, to);
    for (const street of [middle, moved]) {
      for (let i = 1; i < street.length; i++) {
        const p = street[i - 1]!;
        const q = street[i]!;
        expect(Math.abs(p.col - q.col) < 1e-9 || Math.abs(p.row - q.row) < 1e-9).toBe(true);
      }
    }
    // The lane moves the run along the gutter by its own amount.
    expect(moved[1]!.row - middle[1]!.row).toBeCloseTo(0.2, 6);
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
