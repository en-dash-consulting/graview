import { checkApp } from "@graview/core";
import { deriveAffordances, createToolRuntime, llmIntelligence, templateIntelligence } from "@graview/tools";
import { EMPTY_VIEW, kindCardId, layout } from "@graview/layout";
import { GraviewProvider, Scene } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seedbedApp } from "../../src/domain/app.js";
import { seedbedSchema } from "../../src/domain/schema.js";
import { createSeedbedUiStore, INITIAL_VIEW } from "../../src/ui/app.js";
import { seedbedViews } from "../../src/ui/views.js";

/**
 * The empty app, held to the standard the empty state never gets: every
 * claim here is about a graph with NOTHING in it, because that is the screen
 * everyone meets first and nobody designs.
 */

describe("a declared schema with nothing in it", () => {
  it("passes its own check with zero data", () => {
    const result = checkApp(seedbedApp);
    expect(result.ok).toBe(true);
  });

  it("lays out a complete map at zero: every kind a card, nothing raised", () => {
    const store = createSeedbedUiStore();
    const result = layout(store.graph, seedbedSchema, { ...EMPTY_VIEW, overview: true });
    const cards = result.nodes.filter((node) => node.aggregate).map((node) => node.id);
    expect(cards.sort()).toEqual(
      ["gardener", "planting", "plot", "rotation", "rule"].map((kind) => kindCardId(kind)).sort(),
    );
    for (const node of result.nodes) {
      expect(node.aggregate?.memberIds ?? []).toEqual([]);
    }
  });

  it("renders the whole shell against an empty graph without throwing", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider store={createSeedbedUiStore()} views={seedbedViews()} initialView={INITIAL_VIEW}>
        <Scene renderer="dom" />
      </GraviewProvider>,
    );
    expect(html).toContain("none yet");
  });
});

describe("the empty state is generative", () => {
  it("offers a kind its own beginnings, through creates", () => {
    const store = createSeedbedUiStore();
    const { affordances } = deriveAffordances(store, [kindCardId("gardener")], {
      kindSelection: ["gardener"],
    });
    expect(affordances.map((a) => a.mutation)).toContain("add-gardener");
  });

  it("does not offer what cannot honestly be asked for yet", () => {
    // Sowing needs a plot; with zero plots there is no honest picker, so the
    // planting card must not offer a button whose every answer fails.
    const store = createSeedbedUiStore();
    const { affordances } = deriveAffordances(store, [kindCardId("planting")], {
      kindSelection: ["planting"],
    });
    expect(affordances.map((a) => a.mutation)).not.toContain("sow");
  });
});

describe("the intelligence seam, at zero", () => {
  it("proposes starter data from the declaration alone — no model, no key", async () => {
    const proposals = await templateIntelligence().propose(createSeedbedUiStore());
    const names = proposals.map((p) => p.mutation).sort();
    // A creator per empty kind whose form can honestly be filled; sowing
    // waits for a plot to exist rather than faking a reference.
    expect(names).toEqual(["add-gardener", "add-plot", "adopt-rule"]);
  });

  it("takes a model's proposals through the same validation gate", async () => {
    const model = llmIntelligence({
      name: "fake",
      may: ["add-gardener"],
      complete: async () => '[{"mutation":"add-gardener","args":{"label":"Wren"},"why":"a garden needs hands"}]',
    });
    const proposals = await model.propose(createSeedbedUiStore());
    expect(proposals).toEqual([
      { mutation: "add-gardener", args: { label: "Wren" }, why: "a garden needs hands" },
    ]);
  });
});

describe("populating the graph IS the onboarding", () => {
  const seeded = async () => {
    const store = createSeedbedUiStore();
    /*
     * The starter garden, planted the way the seat plants it: ordinary
     * mutations through the derived tool surface, attributed and logged.
     */
    const runtime = createToolRuntime(store, {
      author: { kind: "agent", id: "claude", session: "test" },
    });
    const call = async (name: string, args: Record<string, unknown>) => {
      const tool = runtime.definitions.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`no tool ${name}`);
      return runtime.call(name, args);
    };
    await call("add-gardener", { label: "June" });
    await call("add-gardener", { label: "Ravi" });
    await call("add-plot", { label: "Plot 1", beds: 4 });
    await call("add-plot", { label: "Plot 2", beds: 3 });
    await call("adopt-rule", {});
    return store;
  };

  it("lets the rule land as data, and fire immediately", async () => {
    const store = await seeded();
    const violations = store.violations();
    expect(violations).toHaveLength(2);
    expect(violations[0]?.message).toMatch(/Nobody tends/);
    // The repairs name real gardeners — the next click is already derived.
    expect(violations[0]?.repairs.length).toBe(2);
  });

  it("attributes every proposal to the seat, in the log", async () => {
    const store = await seeded();
    const ops = store.log.all();
    expect(ops.length).toBeGreaterThanOrEqual(5);
    for (const op of ops) {
      expect(op.author.kind).toBe("agent");
    }
  });

  it("resolves through the named repair, and the horizon works from day one", async () => {
    const store = await seeded();
    const repair = store.violations()[0]!.repairs[0]!;
    store.apply({ name: repair.mutation, args: { ...repair.args } });
    expect(store.violations()).toHaveLength(1);

    // Sow, then harvest: the planting leaves the counts but not the graph.
    const plot = store.graph.nodesOfKind("plot")[0]!;
    store.apply({ name: "sow", args: { label: "Beans", plotId: plot.id, sown: "2026-04-04" } });
    const planting = store.graph.nodesOfKind("planting")[0]!;
    // Harvesting says WHEN, so the season calendar can draw the planting
    // across the days it was in the ground rather than a dot on the day it
    // went in.
    store.apply({ name: "harvest", args: { plantingId: planting.id, on: "2026-07-20" } });
    const scene = layout(store.graph, seedbedSchema, EMPTY_VIEW);
    const card = scene.nodes.find((node) => node.id === kindCardId("planting"));
    expect(card?.aggregate?.memberIds).toEqual([]);
    expect(card?.aggregate?.retired).toBe(1);
    expect(store.graph.getNode(planting.id)).toBeDefined();
  });
});
