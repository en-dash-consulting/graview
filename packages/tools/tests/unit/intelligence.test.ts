import { bindSchema, createSchema, defineNode, isoDate, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  deriveAffordances,
  insightProvider,
  intelligenceProvider,
  llmIntelligence,
  templateIntelligence,
  validateProposals,
} from "../../src/index.js";

/**
 * One seam, three suppliers: the graph's own structure, a model behind a
 * completion function, and (elsewhere) an external agent over the tool
 * surface. All of them produce proposed calls to declared mutations.
 */

const gardener = defineNode("gardener", {
  fields: z.object({ label: z.string() }),
  plural: "Gardeners",
});
const plot = defineNode("plot", {
  fields: z.object({ label: z.string(), beds: z.number().int().min(1) }),
  plural: "Plots",
  edges: { "tended-by": { to: ["gardener"], description: "who looks after it" } },
});
const schema = createSchema([gardener, plot]);
const bound = bindSchema(schema);

const addGardener = bound.defineMutation("add-gardener", {
  title: "Welcome a gardener",
  description: "Add someone.",
  creates: ["gardener"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "g"), kind: "gardener", label: args.label } as never);
  },
});
const addPlot = bound.defineMutation("add-plot", {
  title: "Stake out a plot",
  description: "Add ground.",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1), beds: z.number().int().min(1), noted: isoDate.optional() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "p"), kind: "plot", label: args.label, beds: args.beds } as never);
  },
});
const tend = bound.defineMutation("tend", {
  title: "Name a caretaker",
  description: "Who looks after a plot.",
  subject: { kinds: ["plot"], arg: "plotId" },
  input: z.object({ plotId: nodeRef(["plot"]), gardenerId: nodeRef(["gardener"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "tended-by", from: args.plotId, to: args.gardenerId });
  },
});

const empty = () => new Store({ schema, mutations: [addGardener, addPlot, tend], invariants: [] });

describe("the starter intelligence proposes from the declaration alone", () => {
  it("offers a creator per empty kind, with honest arguments off the form", async () => {
    const proposals = await templateIntelligence({ today: "2026-09-01" }).propose(empty());
    expect(proposals.map((p) => p.mutation).sort()).toEqual(["add-gardener", "add-plot"]);
    const plotCall = proposals.find((p) => p.mutation === "add-plot")!;
    expect(plotCall.args["beds"]).toBe(1);
    expect(plotCall.args["label"]).toBe("First plot");
    expect(plotCall.args["noted"]).toBe("2026-09-01");
  });

  it("says nothing about kinds that already have members", async () => {
    const store = empty();
    store.apply({ name: "add-gardener", args: { label: "June" } });
    const proposals = await templateIntelligence().propose(store);
    expect(proposals.map((p) => p.mutation)).toEqual(["add-plot"]);
  });
});

describe("a model is one completion function", () => {
  it("parses proposals out of the answer and validates them", async () => {
    const model = llmIntelligence({
      name: "fake",
      may: ["add-gardener"],
      complete: async (prompt) => {
        // The prompt states the declaration — that is the model's context.
        expect(prompt).toContain("add-plot");
        expect(prompt).toContain("Gardeners");
        return `Sure! [
          {"mutation": "add-gardener", "args": {"label": "Ravi"}, "why": "someone must dig"},
          {"mutation": "add-plot", "args": {"label": "x", "beds": 2}, "why": "not allowed"},
          {"mutation": "drop-tables", "args": {}, "why": "nice try"}
        ]`;
      },
    });
    const proposals = await model.propose(empty());
    // The allowlist and the registry both filtered: one proposal survives.
    expect(proposals).toEqual([
      { mutation: "add-gardener", args: { label: "Ravi" }, why: "someone must dig" },
    ]);
  });

  it("answers nothing on an unparseable reply rather than guessing", async () => {
    const model = llmIntelligence({ name: "fake", complete: async () => "I refuse." });
    expect(await model.propose(empty())).toEqual([]);
  });
});

describe("validateProposals", () => {
  it("drops unknown mutations, disallowed mutations, and non-object args", () => {
    const store = empty();
    const kept = validateProposals(
      store,
      [
        { mutation: "add-gardener", args: { label: "a" } },
        { mutation: "nope", args: {} },
        { mutation: "add-plot", args: null as never },
      ],
      ["add-gardener", "add-plot"],
    );
    expect(kept).toHaveLength(1);
  });
});

describe("the graph itself is the first intelligence", () => {
  it("notices an island, a concentration, and a gap", () => {
    const store = new Store({
      schema,
      mutations: [addGardener, addPlot, tend],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "june", kind: "gardener", label: "June" },
          { id: "alone", kind: "gardener", label: "Moss" },
          { id: "p1", kind: "plot", label: "One", beds: 1 },
          { id: "p2", kind: "plot", label: "Two", beds: 1 },
          { id: "p3", kind: "plot", label: "Three", beds: 1 },
          { id: "p4", kind: "plot", label: "Four", beds: 1 },
        ] as never,
        edges: [
          { kind: "tended-by", from: "p1", to: "june" },
          { kind: "tended-by", from: "p2", to: "june" },
          { kind: "tended-by", from: "p3", to: "june" },
          { kind: "tended-by", from: "p4", to: "june" },
        ],
      },
    });
    const provider = insightProvider();
    const said = (selection: string[], kinds: string[] = []) =>
      (provider.derive({
        store,
        selection,
        nodes: selection.map((id) => store.graph.getNode(id)!),
        kindSelection: kinds,
        violations: [],
        context: {},
      }).observations ?? []).map((o) => o.text);

    expect(said(["alone"])[0]).toMatch(/connected to nothing/);
    expect(said(["june"])[0]).toMatch(/holds 4 of 4/);

    const bare = new Store({ schema, mutations: [], invariants: [] });
    const gap = (insightProvider().derive({
      store: bare,
      selection: ["kind:gardener"],
      nodes: [],
      kindSelection: ["gardener"],
      violations: [],
      context: {},
    }).observations ?? []).map((o) => o.text);
    expect(gap[0]).toMatch(/Plots expect to connect/);
  });

  /*
   * A scaffolded project's first kind has one edge, and it points at itself.
   * On the empty graph that made the only district say "Nothing here yet,
   * though Items expect to connect to these" — naming the absent kind as the
   * party waiting for it, which is nobody.
   */
  it("says nothing about a gap only the missing kind itself expects", () => {
    const item = defineNode("item", {
      fields: z.object({ label: z.string() }),
      plural: "Items",
      edges: { "depends-on": { to: ["item"], description: "what comes first" } },
    });
    const alone = createSchema([item]);
    const bare = new Store({ schema: alone, mutations: [], invariants: [] });
    const said = (
      insightProvider().derive({
        store: bare,
        selection: ["kind:item"],
        nodes: [],
        kindSelection: ["item"],
        violations: [],
        context: {},
      }).observations ?? []
    ).map((o) => o.text);
    expect(said).toEqual([]);
  });
});

describe("an intelligence surfaces as an ordinary provider", () => {
  it("caches per log position, refreshes in the background, and labels its provider", async () => {
    const store = empty();
    let woken = 0;
    const provider = intelligenceProvider(templateIntelligence(), { notify: () => (woken += 1) });
    // First derive: nothing yet, the proposal is in flight.
    const first = deriveAffordances(store, [], { providers: [provider] });
    expect(first.affordances).toHaveLength(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(woken).toBe(1);
    // Second derive: the cached proposals arrive as labelled affordances.
    const second = deriveAffordances(store, [], { providers: [provider] });
    expect(second.affordances.map((a) => a.provider)).toEqual(["llm", "llm"]);
    expect(second.affordances[0]?.why).toContain("starter:");
  });
});
