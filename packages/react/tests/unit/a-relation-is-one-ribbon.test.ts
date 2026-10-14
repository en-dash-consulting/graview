import { createSchema, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { districtOf, mapChoice, ribbonSentence, ribbonsOf } from "../../src/map-choice.js";
import { ribbonWidth, RIBBON_WIDTH } from "../../src/ribbon-width.js";
import { toIso } from "@graview/core/scene";
import { loopPoints, midpointOf, routeOnTheGround, type Box, type PlotLike } from "../../src/ribbons.js";

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
   * Four districts in a row as the city lays one out — along one of the
   * ground's axes, upstream to downstream — a fifth in the next row beside
   * the first, each with its name card under its front corner.
   */
  const cell = 20;
  const plots = new Map<string, PlotLike>([
    ["a", { col: 0, row: 0, side: 3 }],
    ["b", { col: 0, row: -8, side: 2 }],
    ["c", { col: 0, row: -16, side: 3 }],
    ["d", { col: 0, row: -24, side: 3 }],
    ["e", { col: 8, row: 0, side: 3 }],
  ]);
  const labels: Box[] = [...plots.values()].map((plot) => {
    const front = toIso(plot.col + plot.side, plot.row + plot.side, cell);
    return { x: front.x - 30, y: front.y + 2, width: 60, height: 20 };
  });
  const route = (...pairs: [string, string, number?][]) =>
    routeOnTheGround({ ribbons: pairs.map(([from, to, width]) => ({ key: `${from}${to}`, from, to, width: width ?? 4 })), plots, cell, labels });
  // Back from the canvas to the lattice, at the default tilt.
  const lattice = (p: { x: number; y: number }) => ({ col: p.x / cell + (2 * p.y) / cell, row: (2 * p.y) / cell - p.x / cell });
  const onAPlot = (p: { x: number; y: number }, except: string[]) => {
    const { col, row } = lattice(p);
    return [...plots].some(([key, plot]) => !except.includes(key) && col > plot.col + 0.05 && col < plot.col + plot.side - 0.05 && row > plot.row + 0.05 && row < plot.row + plot.side - 0.05);
  };
  const under = (p: { x: number; y: number }) => labels.some((box) => p.x > box.x && p.x < box.x + box.width && p.y > box.y && p.y < box.y + box.height);
  const sampled = (run: readonly { x: number; y: number }[]) =>
    run.flatMap((p, i) => (i === 0 ? [p] : Array.from({ length: 20 }, (_, k) => ({ x: run[i - 1]!.x + ((p.x - run[i - 1]!.x) * (k + 1)) / 20, y: run[i - 1]!.y + ((p.y - run[i - 1]!.y) * (k + 1)) / 20 }))));
  const onTheAxes = (run: readonly { x: number; y: number }[]) =>
    run.every((p, i) => {
      if (i === 0) return true;
      const a = lattice(run[i - 1]!);
      const b = lattice(p);
      return Math.abs(a.col - b.col) < 1e-6 || Math.abs(a.row - b.row) < 1e-6;
    });

  it("runs on the ground's own axes, straight between neighbors in a row and with one bend between rows", () => {
    const along = route(["a", "b"]).get("ab")!;
    expect(onTheAxes(along)).toBe(true);
    expect(along).toHaveLength(2);
    const across = route(["e", "b"]).get("eb")!;
    expect(onTheAxes(across)).toBe(true);
    expect(across.length).toBeLessThanOrEqual(5);
  });

  it("runs a row's street straight past the districts between, one bend out of a curb and one in", () => {
    const run = route(["d", "a"]).get("da")!;
    expect(onTheAxes(run)).toBe(true);
    expect(run.length).toBeLessThanOrEqual(4);
  });

  it("crosses no district and passes behind no name card, however far it goes", () => {
    for (const [from, to] of [["a", "d"], ["e", "d"], ["a", "c"]] as const) {
      const run = route([from, to]).get(`${from}${to}`)!;
      expect(onTheAxes(run)).toBe(true);
      for (const p of sampled(run)) {
        expect(onAPlot(p, [from, to]), `${from}${to} on a plot at ${JSON.stringify(lattice(p))}`).toBe(false);
        expect(under(p), `${from}${to} under a card at ${JSON.stringify(lattice(p))} ${JSON.stringify(run.map(lattice))}`).toBe(false);
      }
    }
  });

  it("keeps to the streets between the districts rather than the open ground beyond them", () => {
    const run = route(["a", "d"]).get("ad")!;
    const near = (p: { x: number; y: number }) => {
      const { col, row } = lattice(p);
      return Math.min(...[...plots.values()].map((plot) => Math.max(0, plot.col - col, col - (plot.col + plot.side)) + Math.max(0, plot.row - row, row - (plot.row + plot.side))));
    };
    for (const p of run) expect(near(p)).toBeLessThanOrEqual(3);
  });

  it("lays ribbons that share a street side by side, each its own width apart", () => {
    const runs = route(["a", "d", 6], ["a", "c", 2]);
    const ad = runs.get("ad")!;
    const ac = runs.get("ac")!;
    // Somewhere along their shared way they run parallel and apart, never on top of each other.
    const apart = ad.some((p) => ac.some((q) => Math.hypot(p.x - q.x, p.y - q.y) > 2 && Math.hypot(p.x - q.x, p.y - q.y) < 12));
    expect(apart).toBe(true);
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

  it("takes a record risen from as the record chosen, beside a panel, until something else is", () => {
    expect(mapChoice([], { overview: true, focusId: "ana", beside: true }, kindOfAny).records).toEqual(["ana"]);
    // Something chosen since is what is chosen.
    expect(mapChoice(["bo"], { overview: true, focusId: "ana", beside: true }, kindOfAny).records).toEqual(["bo"]);
    expect(mapChoice(["kind:person"], { overview: true, focusId: "ana", beside: true }, kindOfAny).records).toEqual([]);
    // Without a panel the record stands in the middle of the city, and on the ground it is the ground's.
    expect(mapChoice([], { overview: true, focusId: "ana" }, kindOfAny).records).toEqual([]);
    expect(mapChoice([], { overview: false, focusId: "ana", beside: true }, kindOfAny).records).toEqual([]);
  });
});
