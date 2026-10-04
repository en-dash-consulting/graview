import { bindSchema, checkApp, createSchema, DARK, defineApp, defineInvariant, defineNode, LIGHT, nodeRef, Store, type GraphSnapshot, type Principal, type Violation } from "@graview/core";
import { EMPTY_VIEW, KIND_PREFIX, kindCardId, layout } from "@graview/layout";
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
const bound = bindSchema(schema);

const tend = bound.defineMutation("tend", {
  title: "Tend",
  // Read from the gardener's end: the round trip has to carry it, or a
  // checkout that was clean comes back warning act-without-far-end-reading.
  fromTheOtherEnd: "Take on a plot",
  description: "Put a gardener on a plot.",
  subject: { kinds: ["plot"], arg: "plot" },
  connects: ["tended-by"],
  input: z.object({ plot: nodeRef(["plot"]), gardener: nodeRef(["gardener"]) }),
  describe: (args) => `${args.plot} tended by ${args.gardener}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "tended-by", from: args.plot, to: args.gardener });
  },
});
const untend = bound.defineMutation("untend", {
  title: "Leave it",
  fromTheOtherEnd: "Leave a plot",
  description: "Take a gardener off a plot.",
  subject: { kinds: ["plot"], arg: "plot" },
  severs: ["tended-by"],
  input: z.object({ plot: nodeRef(["plot"]), gardener: nodeRef(["gardener"]) }),
  describe: (args) => `${args.plot} no longer tended by ${args.gardener}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "tended-by", from: args.plot, to: args.gardener });
  },
});
const addPlot = bound.defineMutation("add-plot", {
  title: "Add a plot",
  description: "Mark out a bed.",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "plot"), kind: "plot", label: args.label, size: 4, status: "open" });
  },
});
const everyPlotTended = bound.defineInvariant("every-plot-tended", {
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
  // A coverage grid asks for rows, columns and the edge between — SLOTS,
  // not seats. The fixture used to ask it for "coordinator", which made the
  // studio's own conflation of the two look correct.
  lenses: [
    {
      name: "coverage",
      binds: "entities",
      requiredRoles: ["rows", "columns", "link"],
      bindings: { rows: { kind: "plot" }, columns: { kind: "gardener" }, link: { edge: "tended-by" } },
    },
  ],
  brand: { name: "Garden", schemes: { dark: DARK, light: LIGHT } },
  version: 1,
});
/*
 * The studio's readers (graphToDeclaration, declarationFiles, migrationBetween)
 * take a declaration whose kinds they do not know; a typed app does not
 * assign to GraviewApp<AnySchema>, so it crosses that boundary here once,
 * as createStudio does inside.
 */
const declared = garden;
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
    expect(ids).toEqual(expect.arrayContaining(["declared:gardener", "declared:plot", "field:plot.label", "field:plot.size", "field:plot.status", "edge:plot.tended-by", "act:tend", "act:untend", "act:add-plot", "rule:every-plot-tended", "role:coordinator", "role:gardener", "grant:1", "grant:2", "lens:coverage", "brand"]));
    expect(graph.nodes.find((node) => node.id === "field:plot.status")).toMatchObject({ type: "enum", required: true, options: ["open", "retired"] });
    expect(graph.nodes.find((node) => node.id === "act:tend")).toMatchObject({ fromTheOtherEnd: "Take on a plot", targetArg: "gardener" });
    expect(graph.nodes.find((node) => node.id === "field:gardener.phone")).toMatchObject({ type: "string", required: false });
    expect(graph.nodes.find((node) => node.id === "declared:plot")).toMatchObject({ lifecycleField: "status", retired: ["retired"] });
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { kind: "of", from: "field:plot.size", to: "declared:plot" },
        { kind: "from-kind", from: "edge:plot.tended-by", to: "declared:plot" },
        { kind: "to-kind", from: "edge:plot.tended-by", to: "declared:gardener" },
        { kind: "on", from: "act:tend", to: "declared:plot" },
        { kind: "connects", from: "act:tend", to: "edge:plot.tended-by" },
        { kind: "severs", from: "act:untend", to: "edge:plot.tended-by" },
        { kind: "creates", from: "act:add-plot", to: "declared:plot" },
        { kind: "over", from: "rule:every-plot-tended", to: "declared:plot" },
        { kind: "repairs", from: "rule:every-plot-tended", to: "act:tend" },
        { kind: "lets", from: "grant:2", to: "role:gardener" },
        { kind: "may", from: "grant:2", to: "act:tend" },
        { kind: "allows-on", from: "grant:2", to: "declared:plot" },
      ]),
    );
    expect(graph.nodes.find((node) => node.id === "grant:1")).toMatchObject({ allActs: true, everyone: false, allKinds: true });
  });

  it("a lens's binding slots are not seats: the roles are who may act, and only that", () => {
    const graph = declarationToGraph(garden);
    const roles = graph.nodes.filter((node) => node.kind === "role").map((node) => node["label"]);
    /*
     * The garden declares two seats and a lens that asks for three slots.
     * Reading both into `role` said the garden had five roles, three of
     * which nobody could ever hold — and wrote them into the policy it
     * handed back, where `permits` would have treated "columns" as a seat
     * somebody could be granted.
     */
    expect(roles.sort()).toEqual(["coordinator", "gardener"]);
    expect(graph.edges.filter((edge) => edge.kind === "requires")).toEqual([]);
    expect(graph.nodes.find((node) => node.id === "lens:coverage")).toMatchObject({
      requires: ["rows", "columns", "link"],
    });

    // And it survives the trip back, on the lens rather than in the policy.
    const back = graphToDeclaration(graph, { base: declared });
    expect(back.policy?.roles).toEqual(["coordinator", "gardener"]);
    expect(back.lenses?.[0]?.requiredRoles).toEqual(["rows", "columns", "link"]);
    const written = declarationFiles(graph, { base: declared, name: garden.name }).find((file) => file.path.endsWith("policy.ts"));
    expect(written?.contents).toContain('roles: ["coordinator", "gardener"]');
  });

  it("mints its ids outside the layout's own namespace, so a kind is never its own district", () => {
    /*
     * `kind:` belongs to the LAYOUT: it is where a district card's id comes
     * from. The studio minted `kind:rule` for an app's own kind called
     * "rule", which is the same string as the RULES district's card — and
     * every app in this repository declares a kind called "rule".
     *
     * So the edge from a rule to the kind it judges resolved to the district
     * it started from, and the scene drew it as a loop: a dotted circle
     * labelled OVER, saying a rule judges a rule.
     */
    const ruleKind = defineNode("rule", {
      fields: z.object({ label: z.string().min(1), spec: z.object({ type: z.literal("all-tended") }) }),
      plural: "Rules",
      label: (node) => node.label,
      requiresInvariant: (node) => node.spec.type,
    });
    const judged = defineInvariant<ReturnType<typeof createSchema>, "rule">("all-tended", {
      scope: { kind: "rule" },
      label: "Everything is tended",
      repairs: [],
      evaluate: () => [],
    } as never);
    const rulesAsNodes = defineApp({
      name: "Rules as nodes",
      schema: createSchema([gardener, ruleKind]) as never,
      mutations: [],
      invariants: [judged as never],
    });

    const graph = declarationToGraph(rulesAsNodes as never);
    const ids = graph.nodes.map((node) => node.id);
    expect(ids).toContain("declared:rule");
    expect(ids.some((id) => id.startsWith(KIND_PREFIX))).toBe(false);

    // And the edge lands on the kinds, not back on the rules.
    const scene = layout(
      new Store({ schema: studioApp().schema, mutations: [], invariants: [], snapshot: graph as never } as never).graph as never,
      studioApp().schema as never,
      { ...EMPTY_VIEW, overview: true },
    );
    expect(scene.connectors.filter((connector) => connector.loop)).toEqual([]);
    expect(scene.connectors.filter((connector) => connector.kind === "over").map((c) => [c.from, c.to])).toEqual([
      [kindCardId("rule"), kindCardId("kind")],
    ]);
  });

  it("is itself an app graview check passes: the studio is held to what it holds everyone to", () => {
    const result = checkApp(studioApp());
    expect(result.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("gives the declaration back: the same kinds, edges and acts, with the checkout's own bodies kept", () => {
    const back = graphToDeclaration(declarationToGraph(garden), { base: declared });
    expect(checkApp(back).errors).toBe(0);
    expect([...back.schema.kinds].sort()).toEqual(["gardener", "plot"]);
    expect(back.schema.tryDefinition("plot")?.edges["tended-by"]).toMatchObject({ to: ["gardener"], description: "who looks after it", inverse: "what they look after" });
    expect(back.schema.tryDefinition("plot")?.lifecycle).toEqual({ field: "status", retired: ["retired"] });
    expect(back.policy).toEqual(garden.policy);
    expect(back.mutations?.find((m) => m.name === "tend")?.fromTheOtherEnd).toBe("Take on a plot");
    expect(checkApp(back).findings.map((f) => f.code)).not.toContain("act-without-far-end-reading");
    expect(back.lenses).toEqual([
      {
        name: "coverage",
        binds: "entities",
        requiredRoles: ["rows", "columns", "link"],
        bindings: { rows: { kind: "plot" }, columns: { kind: "gardener" }, link: { edge: "tended-by" } },
      },
    ]);
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
    studio.store.apply({ name: "add-field", args: { kind: "declared:plot", label: "soil", type: "enum", required: true, options: ["clay", "loam"] } }, { author: june, intent: "Plots have soil" });
    const [change] = studio.changes();
    expect(change).toMatchObject({ author: june, intent: "Plots have soil", undone: false });
    expect(studio.store.graph.getNode("field:plot.soil")).toMatchObject({ type: "enum", options: ["clay", "loam"] });
    expect(studio.declaration().schema.tryDefinition("plot")?.fields.shape).toHaveProperty("soil");
    studio.store.undo(change!.id);
    expect(studio.store.graph.getNode("field:plot.soil")).toBeUndefined();
    expect(studio.declaration().schema.tryDefinition("plot")?.fields.shape).not.toHaveProperty("soil");
  });

  it("an act the studio declares gets a body from what it says, and the interface can run it", () => {
    const studio = createStudio(garden);
    studio.store.apply({ name: "add-act", args: { kind: "declared:plot", label: "resize", title: "Resize", description: "Change the plot's size.", writes: ["size"] } });
    studio.store.apply({ name: "add-kind", args: { label: "shed", plural: "sheds", description: "Where the tools live." } });
    studio.store.apply({ name: "add-act", args: { kind: "declared:shed", label: "build-shed", title: "Build a shed" } });
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
    studio.store.apply({ name: "edit-kind", args: { id: "declared:gardener", lifecycleField: "status", retired: ["gone"] } });
    const refused = studio.apply();
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.check.findings.some((f) => f.code === "lifecycle-missing-field")).toBe(true);
    // Give gardeners the field, required, so every stored gardener needs a start.
    studio.store.apply({ name: "add-field", args: { kind: "declared:gardener", label: "status", type: "enum", required: true, options: ["here", "gone"] } });
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
    expect(migrationBetween(garden, graphToDeclaration(declarationToGraph(garden), { base: declared }))).toBeNull();
  });

  it("removing a kind is a migration that takes its records and their edges", () => {
    const studio = createStudio(garden);
    studio.store.apply({ name: "remove-kind", args: { id: "declared:gardener" } });
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
    expect(studio.store.graph.getNode("declared:bed")).toBeDefined();
    expect(studio.declaration().schema.kinds).toContain("bed");
    expect(studio.decline(studio.proposals()[0]!.id)).toBe(true);
    expect(studio.proposals()).toHaveLength(0);
    expect(studio.store.graph.getNode("declared:bed")).toBeUndefined();
    const refused = studio.propose({ name: "add-field", args: { kind: "declared:nowhere", label: "x", type: "string", required: true } }, planner);
    expect(refused.ok).toBe(false);
  });
});

describe("the declaration is written back as the files graview create writes", () => {
  it("writes schema, mutations, invariants and policy in the checkout's own shape", () => {
    const studio = createStudio(garden);
    studio.store.apply({ name: "add-field", args: { kind: "declared:plot", label: "soil", type: "enum", required: false, options: ["clay", "loam"] } });
    const files = Object.fromEntries(declarationFiles(studio.store.snapshot(), { name: "Garden", schemaVar: "gardenSchema" }).map((file) => [file.path, file.contents]));
    expect(Object.keys(files)).toEqual(["src/domain/schema.ts", "src/domain/mutations.ts", "src/domain/invariants.ts", "src/domain/policy.ts"]);
    expect(files["src/domain/schema.ts"]).toContain('export const plot = defineNode("plot", {');
    expect(files["src/domain/schema.ts"]).toContain('soil: z.enum(["clay", "loam"]).optional(),');
    expect(files["src/domain/schema.ts"]).toContain('"tended-by": {');
    expect(files["src/domain/schema.ts"]).toContain('lifecycle: { field: "status", retired: ["retired"] },');
    expect(files["src/domain/schema.ts"]).toContain("export const gardenSchema = createSchema([gardener, plot]);");
    expect(files["src/domain/mutations.ts"]).toContain('export const tend = defineMutation("tend", {');
    expect(files["src/domain/mutations.ts"]).toContain('connects: ["tended-by"],');
    expect(files["src/domain/mutations.ts"]).toContain('fromTheOtherEnd: "Take on a plot",');
    expect(files["src/domain/invariants.ts"]).toContain('defineInvariant("every-plot-tended", {');
    expect(files["src/domain/invariants.ts"]).toContain('repairs: ["tend"],');
    expect(files["src/domain/policy.ts"]).toContain('{ roles: ["gardener"], mutations: ["tend", "untend"], kinds: ["plot"], describe: "a gardener may tend" },');
  });
});

describe("renaming a kind", () => {
  it("carries the lenses bound to it, rather than leaving them pointed at a name nobody declares", () => {
    const studio = createStudio(garden);
    studio.store.apply({ name: "rename-kind", args: { id: "declared:plot", label: "bed" } });
    const back = studio.declaration();
    /*
     * The bindings come from the checkout, because no act writes one —
     * carried verbatim, this left the coverage grid bound to "plot" after
     * the rename, and the checker refused to apply it with an error about
     * a lens nobody had touched.
     */
    expect(back.lenses?.[0]?.bindings).toMatchObject({ rows: { kind: "bed" }, columns: { kind: "gardener" } });
    expect(checkApp(back).errors).toBe(0);
  });

  it("is a migration that carries every record and its edges under the new name", () => {
    const studio = createStudio(garden);
    studio.store.apply({ name: "rename-kind", args: { id: "declared:plot", label: "bed" } });
    const applied = studio.apply();
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.app.schema.kinds).toContain("bed");
    expect(applied.migration!.title).toContain("plot records become bed");
    const ops = applied.migration!.apply(seed);
    expect(ops.map((p) => p.op)).toEqual(["remove-node", "add-node", "add-edge", "remove-node", "add-node"]);
    expect(ops[1]).toMatchObject({ op: "add-node", node: { id: "plot-1", kind: "bed", label: "Plot 1" } });
    expect(ops[2]).toMatchObject({ op: "add-edge", edge: { kind: "tended-by", from: "plot-1", to: "june" } });
    // Kept acts on the renamed kind now act on bed; the store accepts the migrated graph.
    const migrated: GraphSnapshot = { nodes: seed.nodes.map((node) => (node.kind === "plot" ? { ...node, kind: "bed" } : node)), edges: seed.edges };
    const store = new Store({ schema: applied.app.schema, mutations: applied.app.mutations ?? [], invariants: applied.app.invariants ?? [], snapshot: migrated } as never);
    store.apply({ name: "tend", args: { plot: "plot-2", gardener: "june" } });
    expect(store.graph.out("plot-2", "tended-by")).toHaveLength(1);
  });
});
