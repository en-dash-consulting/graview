import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { acceptedEntry, acceptGhost, fastOf, fillHere, ghostOf, panelHere, proposalOf, recordHere, stubFast, stubThinking, suggestHere, thinkingOf } from "../../src/inline-ai.js";
import { draftSight, isDraftFailure, recipeDraft } from "../../src/draft.js";
import { keepLens } from "../../src/keep.js";
import { inlineAiOn, type HostAi } from "../../src/ai.js";

/**
 * THE INLINE AI (Roadmap f-ai-candidate-catalog): stub Fast and Thinking
 * providers drive a suggestion, a ghost of fills accepted as one batch with
 * lineage `interaction`, and a panel kept as a real lens — and each call
 * reports its tier, model and tokens.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const task = defineNode("task", {
  fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]).optional(), size: z.enum(["small", "large"]).optional() }),
  plural: "Tasks",
  edges: { owner: { to: ["person"], cardinality: "one", description: "who owns it", inverse: "what they own" } },
});
const schema = createSchema([person, task]);
const { defineMutation } = bindSchema(schema);
const setStatus = defineMutation("set-status", {
  title: "Set the status",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["task"]), status: z.enum(["todo", "doing", "done"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: args.status });
  },
});
const setSize = defineMutation("set-size", {
  title: "Size it",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["size"],
  input: z.object({ id: nodeRef(["task"]), size: z.enum(["small", "large"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { size: args.size });
  },
});
const addTask = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label });
  },
});
const make = () =>
  new Store({
    schema,
    mutations: [setStatus, setSize, addTask],
    snapshot: { nodes: [{ id: "t-1", kind: "task", label: "Book the van" }, { id: "p-ann", kind: "person", label: "Ann" }], edges: [] },
  });
const me: Principal = { kind: "human", id: "u-mo" };
const target = { on: "record", id: "t-1" } as const;

describe("the slots", () => {
  it("are the host's fast and thinking models, else its decide and complete, and none when AI is off", () => {
    const fast = stubFast();
    expect(fastOf({ fast })).toBe(fast);
    expect(fastOf({ decide: fast.decide, name: "jev" })?.model).toBe("jev");
    expect(thinkingOf({ complete: async () => "{}" })?.model).toBe("model");
    expect(fastOf({ off: true, fast })).toBeUndefined();
    expect(inlineAiOn({ off: true, fast })).toBe(false);
    expect(inlineAiOn({ fast })).toBe(true);
    expect(inlineAiOn({})).toBe(false);
  });
});

describe("a suggestion", () => {
  it("is the Fast slot's pick among what one press takes, metered", async () => {
    const meter = vi.fn();
    const ai: HostAi = { fast: stubFast({ model: "jev-latest", prefer: [/Status: done/] }), meter };
    const result = await suggestHere(ai, { store: make(), target, principal: me, interaction: "ai-1" });
    expect(result.offers[0]?.id).toBe("fill:t-1:status:done");
    expect(result.offers).toHaveLength(3);
    expect(result.interaction).toMatchObject({ id: "ai-1", targetLabel: "Book the van", ask: { kind: "suggest" }, outcome: "offered" });
    expect(result.interaction.offered[0]).toMatchObject({ id: "fill:t-1:status:done", type: "fill", confidence: 0.9 });
    expect(result.interaction.usage).toEqual([expect.objectContaining({ tier: "fast", model: "jev-latest", inputTokens: expect.any(Number), costUsd: expect.any(Number) })]);
    expect(meter).toHaveBeenCalledWith(expect.objectContaining({ tier: "fast", interaction: "ai-1" }));
  });

  it("is the Thinking slot's when there is no Fast one, and fails in a sentence with neither", async () => {
    const thought = await suggestHere({ thinking: stubThinking() }, { store: make(), target, principal: me });
    expect(thought.offers.length).toBeGreaterThan(0);
    expect(thought.interaction.usage?.[0]).toMatchObject({ tier: "thinking", model: "stub-thinking" });
    const none = await suggestHere({}, { store: make(), target, principal: me });
    expect(none.interaction).toMatchObject({ outcome: "failed", failed: "AI isn't on here." });
  });
});

describe("a ghost", () => {
  it("proposes a value per field, previewed in the act's own words, and accepted in part as one batch with its lineage", async () => {
    const store = make();
    const result = await fillHere({ fast: stubFast({ prefer: [/done/, /large/] }) }, { store, target, principal: me, interaction: "ai-2" });
    expect(result.ghost?.proposals.map((proposal) => proposal.id)).toEqual(["fill:t-1:status:done", "fill:t-1:size:large"]);
    expect(store.graph.getNode("t-1")).not.toHaveProperty("status");
    const kept = acceptGhost(store, result.ghost!, { author: me, ids: ["fill:t-1:status:done"] });
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(store.graph.getNode("t-1")).toMatchObject({ status: "done" });
    expect(store.graph.getNode("t-1")).not.toHaveProperty("size");
    const ops = store.log.all().filter((op) => op.batch === kept.batch);
    expect(ops.every((op) => op.lineage?.interaction === "ai-2" && op.via === "ai:ai-2")).toBe(true);
    expect(acceptedEntry(result.interaction, kept.accepted, kept.batch)).toMatchObject({ outcome: "partly", accepted: ["fill:t-1:status:done"], batches: [kept.batch] });
    store.undo(kept.batch, { author: me });
    expect(store.graph.getNode("t-1")).not.toHaveProperty("status");
  });

  it("drops a proposal the person could not make, rather than drawing it", () => {
    const store = make();
    const ghost = ghostOf(store, { interaction: "ai-3", target, basis: "Fill in", proposals: [{ id: "x", label: "x", said: "x", call: { name: "set-status", args: { id: "t-1", status: "lost" } } }, proposalOf({ type: "fill", id: "fill:t-1:size:small", label: "Size: small", description: "Size it", record: "t-1", field: "size", value: "small", call: { name: "set-size", args: { id: "t-1", size: "small" } } })!] }, me);
    expect(ghost.proposals.map((proposal) => [proposal.id, proposal.said])).toEqual([["fill:t-1:size:small", expect.stringMatching(/./)]]);
  });
});

describe("a record", () => {
  it("is an act that makes one, its words written by the Thinking slot, previewed as a ghost and kept as one batch", async () => {
    const store = make();
    const result = await recordHere({ thinking: stubThinking() }, { store, target: { on: "list", kind: "task" }, principal: me, interaction: "ai-4" });
    expect(result.ghost?.proposals.map((proposal) => proposal.call)).toEqual([{ name: "add-task", args: { label: "A new label, as drafted" } }]);
    expect(result.interaction).toMatchObject({ ask: { kind: "record" }, outcome: "offered" });
    const kept = acceptGhost(store, result.ghost!, { author: me });
    expect(kept.ok).toBe(true);
    expect(store.graph.nodesOfKind("task").map((node) => node.label)).toContain("A new label, as drafted");
  });

  it("is never made by a model with no thinking slot, nor where no act makes one", async () => {
    expect((await recordHere({ fast: stubFast() }, { store: make(), target: { on: "list", kind: "task" }, principal: me })).interaction.failed).toBe("AI isn't on here.");
    expect((await recordHere({ thinking: stubThinking() }, { store: make(), target: { on: "list", kind: "person" }, principal: me })).interaction.failed).toBe("Nothing here makes a record.");
  });
});

describe("a panel", () => {
  it("is a recipe the draft draws and a real lens keeps", async () => {
    const store = make();
    const result = await panelHere({ thinking: stubThinking() }, { store, target: { on: "list", kind: "task" }, principal: me, said: "Show tasks by status" });
    expect(result.panel?.recipe).toMatchObject({ lens: "blocks", kind: "task", group: "status" });
    expect(result.interaction.outcome).toBe("drawn");
    const app = defineApp({ name: "Moves", schema, mutations: [setStatus, setSize] });
    const draft = recipeDraft(result.panel!.recipe as never, { app, sight: draftSight(app, me) });
    expect(isDraftFailure(draft)).toBe(false);
    if (isDraftFailure(draft)) return;
    const kept = await keepLens({ app }, draft.edit);
    expect(kept.ok).toBe(true);
    if (kept.ok) expect(kept.place?.title).toBe(result.panel!.title);
  });
});
