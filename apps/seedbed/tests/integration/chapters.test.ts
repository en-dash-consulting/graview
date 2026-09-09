import { checkApp, permits, Store } from "@graview/core";
import { EMPTY_VIEW, kindCardId, layout } from "@graview/layout";
import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterFromSearch } from "../../src/domain/chapters.js";

/**
 * The progression is a claim per chapter, and each claim is checked here
 * against the chapter's own declaration and seed — so a docs page built
 * from these chapters teaches nothing the framework does not do.
 */
const storeOf = (n: number) => {
  const chapter = CHAPTERS[n - 1]!;
  return new Store({
    schema: chapter.app.schema,
    mutations: chapter.app.mutations ?? [],
    invariants: chapter.app.invariants ?? [],
    snapshot: chapter.seed as never,
    ...(chapter.app.policy ? { policy: chapter.app.policy } : {}),
    ...(chapter.principal ? { principal: chapter.principal } : {}),
  } as never);
};

describe("the garden, grown a chapter at a time", () => {
  it("passes its own check at every chapter", () => {
    for (const chapter of CHAPTERS) {
      const result = checkApp(chapter.app);
      expect(result.findings.filter((f) => f.severity === "error"), chapter.slug).toEqual([]);
    }
  });

  it("only ever grows: no chapter loses a kind, an act or a rule the last one had", () => {
    for (let i = 1; i < CHAPTERS.length; i++) {
      const before = CHAPTERS[i - 1]!.app;
      const after = CHAPTERS[i]!.app;
      for (const kind of before.schema.kinds) expect(after.schema.kinds, `${CHAPTERS[i]!.slug} keeps ${kind}`).toContain(kind);
      for (const m of before.mutations ?? []) expect((after.mutations ?? []).map((x) => x.name)).toContain(m.name);
      for (const inv of before.invariants ?? []) expect((after.invariants ?? []).map((x) => x.name)).toContain(inv.name);
    }
    expect(CHAPTERS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("1 · a single kind already has a city, a district and a derived beginning", () => {
    const store = storeOf(1);
    const scene = layout(store.graph, CHAPTERS[0]!.app.schema, { ...EMPTY_VIEW, overview: true });
    expect(scene.nodes.map((n) => n.id)).toContain(kindCardId("plot"));
    expect((CHAPTERS[0]!.app.mutations ?? []).find((m) => m.name === "add-plot")?.creates).toEqual(["plot"]);
  });

  it("2 · the edge is declared once and the act that makes it says so", () => {
    const store = storeOf(2);
    expect(store.graph.out("plot-1", "tended-by").map((n) => n.id)).toEqual(["june"]);
    const tend = (CHAPTERS[1]!.app.mutations ?? []).find((m) => m.name === "tend")!;
    expect(tend.connects).toEqual(["tended-by"]);
    expect(tend.severs).toEqual(["tended-by"]);
  });

  it("3 · the rule lands as data and fires on the untended plot, naming real repairs", () => {
    const store = storeOf(3);
    const violations = store.violations();
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toBe("Nobody tends Plot 2");
    expect(violations[0]?.repairs.map((r) => r.mutation)).toEqual(["tend", "tend"]);
    const repair = violations[0]!.repairs[0]!;
    store.apply({ name: repair.mutation, args: { ...repair.args } });
    expect(store.violations()).toEqual([]);
  });

  it("4 · a harvested planting is behind the horizon, not gone", () => {
    const store = storeOf(4);
    const scene = layout(store.graph, CHAPTERS[3]!.app.schema, { ...EMPTY_VIEW, overview: true });
    const card = scene.nodes.find((n) => n.id === kindCardId("planting"));
    expect(card?.aggregate?.memberIds).toEqual(["beans"]);
    expect(card?.aggregate?.retired).toBe(1);
    expect(store.graph.getNode("tomatoes")).toBeDefined();
    expect(store.violations()).toEqual([]);
  });

  it("5 · the seat is declared on the app, with an allowlist the check can read", () => {
    const seam = CHAPTERS[4]!.app.intelligence?.[0];
    expect(seam?.kind).toBe("graph");
    expect(seam?.may).toContain("add-gardener");
    expect(CHAPTERS[4]!.seat).toBe(true);
    expect(CHAPTERS[3]!.seat).toBe(false);
  });

  it("6 · remembering is a main.tsx decision, not a declaration change", () => {
    expect(CHAPTERS[5]!.app).toBe(CHAPTERS[4]!.app);
    expect(CHAPTERS[5]!.remembers).toBe(true);
    expect(CHAPTERS[4]!.remembers).toBe(false);
  });

  it("7 · a gardener may work the ground and may not redraw the map", () => {
    const { app, principal } = CHAPTERS[6]!;
    expect(permits(app.policy!, principal!, "sow", "planting").ok).toBe(true);
    expect(permits(app.policy!, principal!, "add-plot", "plot").ok).toBe(false);
    const store = storeOf(7);
    expect(() => store.apply({ name: "add-plot", args: { label: "Plot 9", beds: 1 } })).toThrow();
  });

  it("is reached by ?chapter=N, and the finished example is the default", () => {
    expect(chapterFromSearch("?chapter=3")?.slug).toBe("the-agreement");
    expect(chapterFromSearch("?chapter=99")).toBeNull();
    expect(chapterFromSearch("")).toBeNull();
  });
});
