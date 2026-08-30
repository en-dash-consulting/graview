import {
  bindSchema,
  createSchema,
  defineNode,
  nodeRef,
  Store,
  type Violation,
} from "@graview/core";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  applyAffordance,
  createInAppAdapter,
  createMcpAdapter,
  createToolRuntime,
  defaultProviders,
  deriveAffordances,
  deriveWithLlm,
  lensProvider,
  previewAffordance,
} from "../../src/index.js";

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  edges: { "assigned-to": { to: ["duty"] } },
});
const duty = defineNode("duty", {
  fields: z.object({ label: z.string(), day: z.string(), at: z.number() }),
  plural: "Runs",
});
const rule = defineNode("rule", {
  fields: z.object({ label: z.string(), cap: z.number() }),
  edges: { "applies-to": { to: ["person"] } },
  requiresInvariant: () => "duty-cap",
});
const schema = createSchema([person, duty, rule]);
const bound = bindSchema(schema);

const reassign = bound.defineMutation("reassign", {
  title: "Reassign run",
  description: "Move a run to a different person.",
  subject: { kinds: ["duty"], arg: "dutyId" },
  input: z.object({ dutyId: nodeRef(["duty"]), toPersonId: nodeRef(["person"]) }),
  describe: (args) => `Reassign ${args.dutyId} to ${args.toPersonId}`,
  apply(ctx, args) {
    ctx.setSingleSource("assigned-to", args.dutyId, args.toPersonId);
  },
});

const reday = bound.defineMutation("reday", {
  title: "Move run to another day",
  subject: { kinds: ["duty"], arg: "dutyId" },
  input: z.object({ dutyId: nodeRef(["duty"]), day: z.string() }),
  describe: (args) => `Move ${args.dutyId} to ${args.day}`,
  apply(ctx, args) {
    ctx.patchNode(args.dutyId, { day: args.day });
  },
});

const rename = bound.defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["person", "duty"], arg: "id" },
  input: z.object({ id: nodeRef(["person", "duty"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

/** Nobody may run more than `cap` duties. Its repair names `reassign`. */
const dutyCap = bound.defineInvariant("duty-cap", {
  scope: { kind: "rule" },
  repairs: ["reassign"],
  evaluate({ graph, subject }) {
    const violations: Violation[] = [];
    for (const target of graph.out(subject.id, "applies-to")) {
      const duties = graph.out(target.id, "assigned-to");
      if (duties.length <= subject.cap) continue;
      violations.push({
        invariant: "duty-cap",
        subjectId: subject.id,
        label: subject.label,
        message: `${target.label} runs ${duties.length}, over the cap of ${subject.cap}`,
        nodeIds: [target.id, ...duties.map((d) => d.id)],
        repairs: duties.map((d) => ({
          mutation: "reassign",
          args: { dutyId: d.id },
          missing: ["toPersonId"],
          label: `Give "${(d as { label: string }).label}" to someone else`,
        })),
      });
    }
    return violations;
  },
});

function store() {
  return new Store({
    schema,
    mutations: [reassign, reday, rename],
    invariants: [dutyCap],
    snapshot: {
      nodes: [
        { id: "ana", kind: "person", label: "Ana" },
        { id: "bo", kind: "person", label: "Bo" },
        { id: "d1", kind: "duty", label: "Mon run", day: "mon", at: 480 },
        { id: "d2", kind: "duty", label: "Mon pickup", day: "mon", at: 780 },
        { id: "d3", kind: "duty", label: "Wed run", day: "wed", at: 480 },
        { id: "cap", kind: "rule", label: "Two runs each", cap: 2 },
      ],
      edges: [
        { kind: "assigned-to", from: "ana", to: "d1" },
        { kind: "assigned-to", from: "ana", to: "d2" },
        { kind: "assigned-to", from: "ana", to: "d3" },
        { kind: "applies-to", from: "cap", to: "ana" },
      ],
    },
  });
}

describe("derived affordances", () => {
  it("surfaces legal mutations with no per-selection code written", () => {
    const derived = deriveAffordances(store(), ["d1", "d2"]);
    const names = derived.affordances.map((a) => a.mutation);
    // reassign, reday and rename all accept duties, so all three apply.
    expect(names).toEqual(expect.arrayContaining(["reassign", "reday", "rename"]));
    const reassignAction = derived.affordances.find(
      (a) => a.mutation === "reassign" && a.provider === "schema",
    )!;
    expect(reassignAction.why).toBe("all 2 selected nodes are duty");
    // Every selected node gets the action, as one gesture.
    expect(reassignAction.batch).toEqual([{ dutyId: "d1" }, { dutyId: "d2" }]);
    // The open argument arrives with real candidates, so no picker is wired
    // up per mutation.
    expect(reassignAction.open).toEqual([
      {
        name: "toPersonId",
        kinds: ["person"],
        candidates: ["ana", "bo"],
        shape: { type: "text" },
      },
    ]);
  });

  it("says what sort of answer each unanswered argument wants", () => {
    // Without this an interface can only offer candidate ids, so every
    // action needing a name or a date is a dead end that looks live.
    const derived = deriveAffordances(store(), ["d1"]);
    const reday = derived.affordances.find((a) => a.mutation === "reday")!;
    expect(reday.open).toEqual([{ name: "day", shape: { type: "text" } }]);
  });

  it("offers nothing kind-inappropriate for a mixed selection", () => {
    const derived = deriveAffordances(store(), ["d1", "ana"]);
    const schemaActions = derived.affordances.filter((a) => a.provider === "schema");
    // Only `rename` accepts both a person and a duty.
    expect(schemaActions.map((a) => a.mutation)).toEqual(["rename"]);
  });

  it("ranks repairs above ordinary actions", () => {
    const derived = deriveAffordances(store(), ["ana", "d1", "d2", "d3"]);
    const first = derived.affordances[0]!;
    expect(first.provider).toBe("invariant");
    expect(first.why).toContain("over the cap of 2");
    const bestSchema = derived.affordances.find((a) => a.provider === "schema")!;
    expect(first.score).toBeGreaterThan(bestSchema.score);
  });

  it("names the violation as the reason, so an action explains itself", () => {
    const derived = deriveAffordances(store(), ["ana"]);
    expect(derived.observations.map((o) => o.text)).toContain(
      "Ana runs 3, over the cap of 2",
    );
  });
});

describe("suggestions nobody wrote a rule to produce", () => {
  it("notices the odd one out and offers to align it", () => {
    // Three runs, two on Monday and one on Wednesday. No rule anywhere
    // mentions days, alignment, or majorities.
    const derived = deriveAffordances(store(), ["d1", "d2", "d3"]);
    const align = derived.affordances.find((a) => a.id.startsWith("structure:align"));
    expect(align).toBeDefined();
    expect(align!.mutation).toBe("reday");
    expect(align!.args).toEqual({ dutyId: "d3", day: "mon" });
    expect(align!.why).toBe('2 of 3 share day "mon"');
    expect(align!.label).toBe('Align "Wed run" day with the other 2');
  });

  it("says what is true about a selection, not only what can be done", () => {
    const derived = deriveAffordances(store(), ["d1", "d2", "d3"]);
    const texts = derived.observations.map((o) => o.text);
    expect(texts).toContain('all 3 share "Ana" via assigned-to');
    expect(texts).toContain('2 share day "mon"; "Wed run" does not');
  });

  it("spots the node missing a connection all the others have", () => {
    const s = store();
    s.apply({ name: "reassign", args: { dutyId: "d3", toPersonId: "bo" } });
    const derived = deriveAffordances(s, ["d1", "d2", "d3"]);
    expect(derived.observations.map((o) => o.text)).toContain(
      'all but "Wed run" share "Ana" via assigned-to',
    );
    const join = derived.affordances.find((a) => a.id.startsWith("structure:join"));
    expect(join?.args).toEqual({ dutyId: "d3", toPersonId: "ana" });
  });

  it("only claims an alignment when there is exactly one hold-out", () => {
    const s = store();
    s.apply({ name: "reday", args: { dutyId: "d2", day: "tue" } });
    // mon / tue / wed — three groups, no majority, so nothing to align to.
    const derived = deriveAffordances(s, ["d1", "d2", "d3"]);
    expect(derived.affordances.find((a) => a.id.startsWith("structure:align"))).toBeUndefined();
  });

  it("stays cheap enough to run on every selection change", () => {
    const s = store();
    const derived = deriveAffordances(s, ["d1", "d2", "d3", "ana"]);
    // One frame is 16.7ms and a selection change must not cost a frame.
    expect(derived.ms).toBeLessThan(16);
  });
});

describe("lens and LLM providers", () => {
  it("adds what the active lens can do to the same ranked set", () => {
    const timeline = lensProvider<typeof schema>({
      name: "timeline",
      actions: [
        {
          id: "align-times",
          label: "Line these up at 08:00",
          mutation: "reday",
          applies: (nodes) => nodes.every((node) => node.kind === "duty"),
          args: (nodes) => ({ dutyId: nodes[0]!.id, day: "mon" }),
        },
      ],
    });
    const derived = deriveAffordances(store(), ["d1", "d2"], {
      providers: [...defaultProviders<typeof schema>(), timeline],
    });
    expect(derived.affordances.some((a) => a.provider === "lens")).toBe(true);
  });

  it("consults an LLM only when the others come up short", async () => {
    const propose = vi.fn(async () => []);
    const s = store();
    const rich = deriveAffordances(s, ["d1", "d2"]);
    expect(rich.affordances.length).toBeGreaterThan(2);
    await deriveWithLlm(
      { propose },
      { store: s, selection: ["d1"], nodes: [], violations: [], context: {} },
      rich.affordances,
    );
    expect(propose).not.toHaveBeenCalled();
  });

  it("drops an LLM proposal naming a mutation that does not exist", async () => {
    const s = store();
    const affordances = await deriveWithLlm(
      {
        async propose() {
          return [
            { label: "Real", mutation: "reday", args: { dutyId: "d1", day: "tue" }, why: "why" },
            { label: "Invented", mutation: "teleport-run", args: {}, why: "hallucination" },
          ];
        },
      },
      { store: s, selection: ["d1"], nodes: [], violations: [], context: {} },
      [],
    );
    expect(affordances.map((a) => a.mutation)).toEqual(["reday"]);
  });
});

describe("applying an affordance", () => {
  it("previews as a diff before it applies", () => {
    const s = store();
    const derived = deriveAffordances(s, ["d1", "d2", "d3"]);
    const align = derived.affordances.find((a) => a.id.startsWith("structure:align"))!;
    const preview = previewAffordance(s, align);
    expect(preview.diff.changedNodes[0]?.after).toMatchObject({ id: "d3", day: "mon" });
    // Still not applied.
    expect(s.graph.getNode("d3")).toMatchObject({ day: "wed" });
  });

  it("applies to a whole selection as one undoable gesture", () => {
    const s = store();
    const derived = deriveAffordances(s, ["d1", "d2"]);
    const action = derived.affordances.find(
      (a) => a.mutation === "reassign" && a.provider === "schema",
    )!;
    const result = applyAffordance(s, action, { toPersonId: "bo" });
    expect(result.ops).toHaveLength(2);
    expect(new Set(result.ops.map((op) => op.batch)).size).toBe(1);
    expect(s.graph.in("d1", "assigned-to").map((n) => n.id)).toEqual(["bo"]);
    s.undo(result.batch);
    expect(s.graph.in("d1", "assigned-to").map((n) => n.id)).toEqual(["ana"]);
  });
});

describe("one tool surface, two transports", () => {
  it("generates a tool per mutation from the same declaration as the types", () => {
    const runtime = createToolRuntime(store());
    const names = runtime.definitions.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["reassign", "reday", "rename"]));
    expect(names).toEqual(expect.arrayContaining(["get_graph", "get_affordances", "preview_mutation"]));
    const reassignTool = runtime.definitions.find((t) => t.name === "reassign")!;
    const properties = (reassignTool.inputSchema as { properties: Record<string, { description?: string }> })
      .properties;
    expect(properties["toPersonId"]?.description).toContain("person");
  });

  it("produces the same diff whether a human or an agent acts", async () => {
    const humanStore = store();
    const human = humanStore.apply(
      { name: "reassign", args: { dutyId: "d3", toPersonId: "bo" } },
      { author: { kind: "human", id: "nick" } },
    );

    const agentStore = store();
    const runtime = createToolRuntime(agentStore, {
      author: { kind: "agent", id: "claude", session: "s1" },
    });
    const agent = await runtime.call("reassign", { dutyId: "d3", toPersonId: "bo" });

    expect(agent.ok).toBe(true);
    if (!agent.ok) throw new Error(agent.error);
    expect(agent.diff).toEqual(human.diff);
    // The attribution differs; the change does not.
    expect(agentStore.log.all()[0]?.author).toEqual({
      kind: "agent",
      id: "claude",
      session: "s1",
    });
  });

  it("streams every change to a watcher, whoever caused it", async () => {
    const s = store();
    const runtime = createToolRuntime(s, { author: { kind: "agent" } });
    const agent = createInAppAdapter(runtime);
    const seen: string[][] = [];
    agent.watch((diff) => seen.push([...diff.touched]));

    await agent.run("reday", { dutyId: "d3", day: "tue" });
    s.apply({ name: "reday", args: { dutyId: "d1", day: "tue" } });

    expect(seen).toEqual([["d3"], ["d1"]]);
  });

  it("reports an invalid call as an error rather than throwing", async () => {
    const runtime = createToolRuntime(store());
    const missing = await runtime.call("reassign", { dutyId: "nope", toPersonId: "bo" });
    expect(missing).toMatchObject({ ok: false });
    if (missing.ok) throw new Error("expected failure");
    expect(missing.error).toContain("nope");

    const unknown = await runtime.call("teleport", {});
    if (unknown.ok) throw new Error("expected failure");
    expect(unknown.error).toContain('Unknown tool "teleport"');
  });

  it("refuses mutating tools on a read-only seat", async () => {
    const runtime = createToolRuntime(store(), { readOnly: true });
    expect(runtime.definitions.map((t) => t.name)).not.toContain("reassign");
    const result = await runtime.call("reassign", { dutyId: "d1", toPersonId: "bo" });
    if (result.ok) throw new Error("expected refusal");
    expect(result.error).toContain("Unknown tool");
  });

  it("presents the same runtime over MCP", async () => {
    const runtime = createToolRuntime(store());
    const mcp = createMcpAdapter(runtime);
    expect(mcp.listTools().map((t) => t.name)).toEqual(runtime.definitions.map((t) => t.name));

    const result = await mcp.callTool("get_affordances", { selection: ["d1", "d2", "d3"] });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain("structure:align");

    const failure = await mcp.callTool("reassign", { dutyId: "nope", toPersonId: "bo" });
    expect(failure.isError).toBe(true);
  });

  it("names the blocking operation when an agent turn cannot be undone alone", async () => {
    const s = store();
    const runtime = createToolRuntime(s, { author: { kind: "agent" } });
    const first = s.apply({ name: "reday", args: { dutyId: "d1", day: "fri" } });
    // A later op that READ d1 — the dependency that makes undo unsafe.
    s.applyAll([{ name: "rename", args: { id: "d1", label: "Friday run" } }]);

    const result = await runtime.call("undo_batch", { batch: first.batch });
    if (result.ok) throw new Error("expected a blocked undo");
    expect(result.error).toContain("later operation depends on it");
  });
});
