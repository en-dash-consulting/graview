import { checkApp, createSchema, DARK, defineApp, defineInvariant, defineMutation, defineNode, LIGHT, nodeRef, Store, type GraphSnapshot, type Principal, type Violation } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio, declarationFiles, declarationToGraph, graphToDeclaration, migrationBetween, studioApp } from "../../src/index.js";

/*
 * A small garden, declared by hand the way a checkout declares one, so the
 * studio can be held to reading it in, giving it back, and moving it.
 */
const gardener = defineNode("gardener", {
  description: "Someone who looks after plots.",
  fields: z.object({ label: z.string().min(1), phone: z.string().optional() }),
  plural: "gardeners",
  label: (node) => node.label,
});
const plot = defineNode("plot", {
  description: "A bed of ground.",
  fields: z.object({ label: z.string().min(1), size: z.number(), status: z.enum(["open", "retired"]) }),
  edges: {
    "tended-by": { to: ["gardener"], description: "who looks after it", inverse: "what they look after" },
  },
  plural: "plots",
  label: (node) => node.label,
  lifecycle: { field: "status", retired: ["retired"] },
});
const schema = createSchema([gardener, plot]);

const tend = defineMutation("tend", {
  title: "Tend",
  description: "Put a gardener on a plot.",
  subject: { kinds: ["plot"], arg: "plot" },
  connects: ["tended-by"],
  input: z.object({ plot: nodeRef(["plot"]), gardener: nodeRef(["gardener"]) }),
  describe: (args) => `${args.plot} tended by ${args.gardener}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "tended-by", from: args.plot, to: args.gardener });
  },
});
const untend = defineMutation("untend", {
  title: "Leave it",
  description: "Take a gardener off a plot.",
  subject: { kinds: ["plot"], arg: "plot" },
  severs: ["tended-by"],
  input: z.object({ plot: nodeRef(["plot"]), gardener: nodeRef(["gardener"]) }),
  describe: (args) => `${args.plot} no longer tended by ${args.gardener}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "tended-by", from: args.plot, to: args.gardener });
  },
});
const addPlot = defineMutation("add-plot", {
  title: "Add a plot",
  description: "Mark out a bed.",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "plot"), kind: "plot", label: args.label, size: 4, status: "open" });
  },
});
const everyPlotTended = defineInvariant("every-plot-tended", {
  label: "Every plot has someone",
  description: "An open plot with nobody tending it is a gap.",
  scope: { kind: "plot" },
  repairs: ["tend"],
  evaluate({ graph, subject }): Violation[] {
    if (subject.status !== "open" || graph.out(subject.id, "tended-by").length > 0) return [];
    return [{ invariant: "every-plot-tended", subjectId: subject.id, label: subject.label, message: `Nobody tends ${subject.label}`, nodeIds: [subject.id], repairs: [{ mutation: "tend", args: { plot: subject.id }, missing: ["gardener"], label: "Find a gardener" }] }];
  },
});
const garden = defineApp({
  name: "Garden",
  schema,
  mutations: [tend, untend, addPlot],
  invariants: [everyPlotTended],
  policy: { roles: ["coordinator", "gardener"], grants: [{ roles: ["coordinator"], mutations: "*" }, { roles: ["gardener"], mutations: ["tend", "untend"], kinds: ["plot"], describe: "a gardener may tend" }] },
  lenses: [{ name: "coverage", requiredRoles: ["coordinator"] }],
  brand: { name: "Garden", schemes: { dark: DARK, light: LIGHT } },
  version: 1,
});
const seed: GraphSnapshot = {
  nodes: [
    { id: "june", kind: "gardener", label: "June" },
    { id: "plot-1", kind: "plot", label: "Plot 1", size: 4, status: "open" },
    { id: "plot-2", kind: "plot", label: "Plot 2", size: 6, status: "open" },
  ],
  edges: [{ kind: "tended-by", from: "plot-1", to: "june" }],
};
const june: Principal = { kind: "human", id: "june", roles: ["coordinator"] };
const planner: Principal = { kind: "agent", id: "planner" };

describe("the declaration is a graph", () => {
  it("reads every kind, field, edge, act, rule, role, grant, lens and brand in as a node with a stable id", () => {
    const graph = declarationToGraph(garden);
    const ids = graph.nodes.map((node) => node.id);
    expect(ids).toEqual(expect.arrayContaining(["kind:gardener", "kind:plot", "field:plot.label", "field:plot.size", "field:plot.status", "edge:plot.tended-by", "act:tend", "act:untend", "act:add-plot", "rule:every-plot-tended", "role:coordinator", "role:gardener", "grant:1", "grant:2", "lens:coverage", "brand"]));
    expect(graph.nodes.find((node) => node.id === "field:plot.status")).toMatchObject({ type: "enum", required: true, options: ["open", "retired"] });
    expect(graph.nodes.find((node) => node.id === "field:gardener.phone")).toMatchObject({ type: "string", required: false });
    expect(graph.nodes.find((node) => node.id === "kind:plot")).toMatchObject({ lifecycleField: "status", retired: ["retired"] });
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { kind: "of", from: "field:plot.size", to: "kind:plot" },
        { kind: "from-kind", from: "edge:plot.tended-by", to: "kind:plot" },
        { kind: "to-kind", from: "edge:plot.tended-by", to: "kind:gardener" },
        { kind: "on", from: "act:tend", to: "kind:plot" },
        { kind: "connects", from: "act:tend", to: "edge:plot.tended-by" },
        { kind: "severs", from: "act:untend", to: "edge:plot.tended-by" },
        { kind: "creates", from: "act:add-plot", to: "kind:plot" },
        { kind: "over", from: "rule:every-plot-tended", to: "kind:plot" },
        { kind: "repairs", from: "rule:every-plot-tended", to: "act:tend" },
        { kind: "lets", from: "grant:2", to: "role:gardener" },
        { kind: "may", from: "grant:2", to: "act:tend" },
        { kind: "over", from: "grant:2", to: "kind:plot" },
        { kind: "requires", from: "lens:coverage", to: "role:coordinator" },
      ]),
    );
    expect(graph.nodes.find((node) => node.id === "grant:1")).toMatchObject({ allActs: true, everyone: false, allKinds: true });
  });

  it("is itself an app graview check passes: the studio is held to what it holds everyone to", () => {
    const result = checkApp(studioApp());
    expect(result.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("gives the declaration back: the same kinds, edges and acts, with the checkout's own bodies kept", () => {
    const back = graphToDeclaration(declarationToGraph(garden), { base: garden });
    expect(checkApp(back).errors).toBe(0);
    expect([...back.schema.kinds].sort()).toEqual(["gardener", "plot"]);
    expect(back.schema.definition("plot").edges["tended-by"]).toMatchObject({ to: ["gardener"], description: "who looks after it", inverse: "what they look after" });
    expect(back.schema.definition("plot").lifecycle).toEqual({ field: "status", retired: ["retired"] });
    expect(back.policy).toEqual(garden.policy);
    expect(back.lenses).toEqual([{ name: "coverage", requiredRoles: ["coordinator"] }]);
    expect(back.version).toBe(1);
    // The kept body runs: tending plot-2 makes the edge the checkout's act makes.
    const store = new Store({ schema: back.schema, mutations: back.mutations ?? [], invariants: back.invariants ?? [], snapshot: seed } as never);
    store.apply({ name: "tend", args: { plot: "plot-2", gardener: "june" } });
    expect(store.graph.out("plot-2", "tended-by").map((node) => node.id)).toEqual(["june"]);
    expect(store.violations()).toEqual([]);
  });
});

describe("a change to the declaration is a mutation", () => {
  it("has an author, an intent and an inverse, and undo takes it back", () => {
    const studio = createStudio(garden);
    studio.store.apply({ name: "add-field", args: { kind: "kind:plot", label: "soil", type: "enum", required: true, options: ["clay", "loam"] } }, { author: june, intent: "Plots have soil" });
    const [change] = studio.changes();
    expect(change).toMatchObject({ author: june, intent: "Plots have soil", undone: false });
    expect(studio.store.graph.getNode("field:plot.soil")).toMatchObject({ type: "enum", options: ["clay", "loam"] });
    expect(studio.declaration().schema.definition("plot").fields.shape).toHaveProperty("soil");
    studio.store.undo(change!.id);
    expect(studio.store.graph.getNode("field:plot.soil")).toBeUndefined();
    expect(studio.declaration().schema.definition("plot").fields.shape).not.toHaveProperty("soil");
  });

  it("an act the studio declares gets a body from what it says, and the interface can run it", () => {
    const studio = createStudio(garden);
    studio.store.apply({ name: "add-act", args: { kind: "kind:plot", label: "resize", title: "Resize", description: "Change the plot's size.", writes: ["size"] } });
    studio.store.apply({ name: "add-kind", args: { label: "shed", plural: "sheds", description: "Where the tools live." } });
    studio.store.apply({ name: "add-act", args: { kind: "kind:shed", label: "build-shed", title: "Build a shed" } });
    studio.store.apply({ name: "edit-act", args: { id: "act:build-shed", description: "Put up a shed." } });
    const declared = studio.declaration();
    const store = new Store({ schema: declared.schema, mutations: declared.mutations ?? [], invariants: declared.invariants ?? [], snapshot: seed } as never);
    store.apply({ name: "resize", args: { id: "plot-1", size: 9 } });
    expect(store.graph.getNode("plot-1")).toMatchObject({ size: 9 });
    expect(declared.mutations?.find((m) => m.name === "build-shed")).toMatchObject({ title: "Build a shed", description: "Put up a shed.", subject: { kinds: ["shed"] } });
  });

  it("is checked before it is applied: an error refuses, the fix goes through, and a stored graph gets its migration", () => {
    const studio = createStudio(garden);
    // The horizon reads a field that is not there.
    studio.store.apply({ name: "edit-kind", args: { id: "kind:gardener", lifecycleField: "status", retired: ["gone"] } });
    const refused = studio.apply();
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.check.findings.some((f) => f.code === "lifecycle-missing-field")).toBe(true);
    // Give gardeners the field, required, so every stored gardener needs a start.
    studio.store.apply({ name: "add-field", args: { kind: "kind:gardener", label: "status", type: "enum", required: true, options: ["here", "gone"] } });
    const applied = studio.apply();
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.migration).toMatchObject({ from: 1, to: 2 });
    expect(applied.migration!.title).toContain("gardener.status starts");
    expect(applied.app.version).toBe(2);
    expect(checkApp(applied.app).errors).toBe(0);
    const primitives = applied.migration!.apply(seed);
    expect(primitives).toEqual([{ op: "patch-node", id: "june", before: { status: expect.any(String) }, after: { status: "here" } }]);
    // Migrated, the stored graph is a graph of the new declaration.
    const migrated: GraphSnapshot = { nodes: seed.nodes.map((node) => (node.id === "june" ? { ...node, status: "here" } : node)), edges: seed.edges };
    const store = new Store({ schema: applied.app.schema, mutations: applied.app.mutations ?? [], invariants: applied.app.invariants ?? [], snapshot: migrated } as never);
    expect(store.graph.getNode("june")).toMatchObject({ status: "here" });
    // And nothing to migrate when nothing moved.
    expect(migrationBetween(garden, graphToDeclaration(declarationToGraph(garden), { base: garden }))).toBeNull();
  });

  it("removing a kind is a migration that takes its records and their edges", () => {
    const studio = createStudio(garden);
    studio.store.apply({ name: "remove-kind", args: { id: "kind:gardener" } });
    studio.store.apply({ name: "remove-edge", args: { id: "edge:plot.tended-by" } });
    studio.store.apply({ name: "remove-act", args: { id: "act:tend" } });
    studio.store.apply({ name: "remove-act", args: { id: "act:untend" } });
    studio.store.apply({ name: "remove-rule", args: { id: "rule:every-plot-tended" } });
    const applied = studio.apply();
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.migration!.apply(seed).map((p) => p.op)).toEqual(["remove-edge", "remove-node"]);
  });
});

describe("an agent proposes and a person decides", () => {
  it("a proposal is the agent's own batch; declining undoes it, accepting is applying", () => {
    const studio = createStudio(garden, { principal: june });
    const proposed = studio.propose({ name: "add-kind", args: { label: "bed", description: "A raised bed." } }, planner, "The planner wants beds");
    expect(proposed.ok).toBe(true);
    expect(studio.proposals()).toHaveLength(1);
    expect(studio.proposals()[0]).toMatchObject({ author: planner, intent: "The planner wants beds" });
    expect(studio.store.graph.getNode("kind:bed")).toBeDefined();
    expect(studio.declaration().schema.kinds).toContain("bed");
    expect(studio.decline(studio.proposals()[0]!.id)).toBe(true);
    expect(studio.proposals()).toHaveLength(0);
    expect(studio.store.graph.getNode("kind:bed")).toBeUndefined();
    const refused = studio.propose({ name: "add-field", args: { kind: "kind:nowhere", label: "x", type: "string", required: true } }, planner);
    expect(refused.ok).toBe(false);
  });
});

describe("the declaration is written back as the files graview create writes", () => {
  it("writes schema, mutations, invariants and policy in the checkout's own shape", () => {
    const studio = createStudio(garden);
    studio.store.apply({ name: "add-field", args: { kind: "kind:plot", label: "soil", type: "enum", required: false, options: ["clay", "loam"] } });
    const files = Object.fromEntries(declarationFiles(studio.store.snapshot(), { name: "Garden", schemaVar: "gardenSchema" }).map((file) => [file.path, file.contents]));
    expect(Object.keys(files)).toEqual(["src/domain/schema.ts", "src/domain/mutations.ts", "src/domain/invariants.ts", "src/domain/policy.ts"]);
    expect(files["src/domain/schema.ts"]).toContain('export const plot = defineNode("plot", {');
    expect(files["src/domain/schema.ts"]).toContain('soil: z.enum(["clay", "loam"]).optional(),');
    expect(files["src/domain/schema.ts"]).toContain('"tended-by": {');
    expect(files["src/domain/schema.ts"]).toContain('lifecycle: { field: "status", retired: ["retired"] },');
    expect(files["src/domain/schema.ts"]).toContain("export const gardenSchema = createSchema([gardener, plot]);");
    expect(files["src/domain/mutations.ts"]).toContain('export const tend = defineMutation("tend", {');
    expect(files["src/domain/mutations.ts"]).toContain('connects: ["tended-by"],');
    expect(files["src/domain/mutations.ts"]).toContain('ctx.addEdge({ kind: "tended-by", from: args.plot, to: args.to });');
    expect(files["src/domain/invariants.ts"]).toContain('defineInvariant("every-plot-tended", {');
    expect(files["src/domain/invariants.ts"]).toContain('repairs: ["tend"],');
    expect(files["src/domain/policy.ts"]).toContain('{ roles: ["gardener"], mutations: ["tend", "untend"], kinds: ["plot"], describe: "a gardener may tend" },');
  });
});
