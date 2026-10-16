import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Policy, type Principal } from "../../src/index.js";
import { aiContextOf, aiTargetOf, catalogOf, interactionBy, interactionCost, interactionTouches, mergeInteractions, schemaDigestOf, type AiInteraction } from "../../src/catalog.js";

/**
 * THE INLINE AI PICKS FROM WHAT THE APP ALREADY KNOWS (Roadmap
 * f-ai-candidate-catalog): for a target, the acts the viewer may run there,
 * the panels its kind can be drawn as, the places and records next to it
 * and the values its fields may take — and the state a model reads beside
 * them. Both are read as the viewer sees the store: nothing the viewer may
 * not see or run is a candidate, or said.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const secret = defineNode("secret", { fields: z.object({ label: z.string() }), plural: "Secrets" });
const task = defineNode("task", {
  fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]).optional(), due: z.iso.date().optional(), points: z.number().optional() }),
  plural: "Tasks",
  edges: { owner: { to: ["person"], cardinality: "one", description: "who owns it", inverse: "what they own" }, about: { to: ["secret"], description: "what it is about" } },
});
const schema = createSchema([person, secret, task]);
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
const assign = defineMutation("assign", {
  title: "Give it to someone",
  subject: { kinds: ["task"], arg: "id" },
  connects: ["owner"],
  input: z.object({ id: nodeRef(["task"]), to: nodeRef(["person"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "owner", from: args.id, to: args.to });
  },
});
const addTask = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label });
  },
});
const close = defineMutation("close", {
  title: "Close it",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "done" });
  },
});
const policy: Policy = {
  grants: [{ roles: ["member"], mutations: ["set-status", "assign", "add-task"] }, { roles: ["lead"], mutations: "*" }],
  sees: [{ roles: "*", kinds: ["task", "person"] }, { roles: ["lead"], kinds: ["secret"] }],
};
const make = () =>
  new Store({
    schema,
    mutations: [setStatus, assign, addTask, close],
    policy,
    snapshot: {
      nodes: [
        { id: "t-1", kind: "task", label: "Book the van" },
        { id: "t-2", kind: "task", label: "Pack the books", status: "doing" },
        { id: "p-ann", kind: "person", label: "Ann" },
        { id: "p-bo", kind: "person", label: "Bo" },
        { id: "s-1", kind: "secret", label: "The surprise party" },
      ],
      edges: [
        { kind: "owner", from: "t-2", to: "p-ann" },
        { kind: "about", from: "t-1", to: "s-1" },
      ],
    },
  });
const member: Principal = { kind: "human", id: "u-mo", roles: ["member"] };
const lead: Principal = { kind: "human", id: "u-li", roles: ["lead"] };
const ids = (catalog: { candidates: readonly { id: string }[] }) => catalog.candidates.map((candidate) => candidate.id);
const PLACES = [
  { as: "the-board", title: "The board", kind: "task" },
  { as: "the-vault", title: "The vault", kind: "secret" },
];

describe("the catalog for a record", () => {
  it("offers the acts the viewer may run on it, and never one it may not", () => {
    const catalog = catalogOf(make(), { on: "record", id: "t-1" }, { principal: member, places: PLACES });
    const acts = catalog.candidates.filter((candidate) => candidate.type === "act").map((candidate) => (candidate as { mutation: string }).mutation);
    expect(acts).toContain("set-status");
    expect(acts).toContain("assign");
    expect(acts).not.toContain("close");
    expect(catalogOf(make(), { on: "record", id: "t-1" }, { principal: lead }).candidates.some((candidate) => candidate.id === "act:close:t-1")).toBe(true);
  });

  it("offers each value a field may take, and each record a relation may link, as the call the viewer's own act would make", () => {
    const catalog = catalogOf(make(), { on: "record", id: "t-1" }, { principal: member });
    const fills = catalog.candidates.filter((candidate) => candidate.type === "fill");
    expect(fills.map((fill) => fill.id)).toEqual(expect.arrayContaining(["fill:t-1:status:todo", "fill:t-1:status:doing", "fill:t-1:status:done", "fill:t-1:owner:p-ann", "fill:t-1:owner:p-bo"]));
    expect(fills.find((fill) => fill.id === "fill:t-1:status:done")).toMatchObject({ call: { name: "set-status", args: { id: "t-1", status: "done" } }, description: "Set status of Book the van to done" });
    // The secret it is about is not the member's to see, link or be told of.
    expect(JSON.stringify(catalog)).not.toContain("surprise");
  });

  it("offers a field's other values on a field, and not the one it holds", () => {
    const catalog = catalogOf(make(), { on: "field", id: "t-2", field: "status" }, { principal: member });
    expect(catalog.candidates.filter((candidate) => candidate.type === "fill").map((fill) => fill.id)).toEqual(["fill:t-2:status:todo", "fill:t-2:status:done"]);
  });

  it("offers the panels its kind can be drawn as, the places that picture it and the records next to it", () => {
    const catalog = catalogOf(make(), { on: "record", id: "t-2" }, { principal: member, places: PLACES });
    expect(ids(catalog)).toEqual(expect.arrayContaining(["panel:task:list", "panel:task:group:status", "panel:task:columns:status", "panel:task:sort:points", "panel:task:calendar:due", "place:the-board", "record:p-ann"]));
    expect(ids(catalog)).not.toContain("place:the-vault");
    expect(catalog.candidates.find((candidate) => candidate.id === "record:p-ann")).toMatchObject({ relation: "owner", description: "Who owns it: Ann" });
  });

  it("offers nothing at all about a record the viewer may not see", () => {
    expect(catalogOf(make(), { on: "record", id: "s-1" }, { principal: member }).candidates).toEqual([]);
    expect(catalogOf(make(), { on: "list", kind: "secret" }, { principal: member }).candidates).toEqual([]);
  });

  it("takes the acts a derivation offers, and still holds each to the policy", () => {
    const catalog = catalogOf(make(), { on: "record", id: "t-1" }, {
      principal: member,
      acts: [
        { mutation: "close", label: "Close it", args: { id: "t-1" } },
        { mutation: "set-status", label: "Set the status", args: { id: "t-1" }, open: [{ name: "status" }] },
      ],
    });
    expect(catalog.candidates.filter((candidate) => candidate.type === "act")).toEqual([
      { type: "act", id: "act:set-status:t-1", label: "Set the status", description: "Set the status", mutation: "set-status", args: { id: "t-1" }, asks: ["status"] },
    ]);
  });
});

describe("the catalog for a list, a lens and a place", () => {
  it("offers the acts that make a record of the kind, its panels and its records", () => {
    const catalog = catalogOf(make(), { on: "list", kind: "task" }, { principal: member, places: PLACES });
    expect(ids(catalog)).toEqual(expect.arrayContaining(["act:add-task", "panel:task:list", "place:the-board", "record:t-1", "record:t-2"]));
    expect(catalog.candidates.find((candidate) => candidate.id === "act:add-task")).toMatchObject({ asks: ["label"] });
  });

  it("reads a menu opened on a district, a field, a selection and nothing as the target it is", () => {
    const has = (id: string) => ["t-1", "t-2"].includes(id);
    expect(aiTargetOf({ on: "aggregate:task", about: ["aggregate:task"] }, has)).toEqual({ on: "list", kind: "task" });
    expect(aiTargetOf({ on: "t-1", about: ["t-1"], field: "status" }, has)).toEqual({ on: "field", id: "t-1", field: "status" });
    expect(aiTargetOf({ on: "t-1", about: ["t-1", "t-2"] }, has)).toEqual({ on: "selection", ids: ["t-1", "t-2"] });
    expect(aiTargetOf({ about: [], place: "the-board" }, has)).toEqual({ on: "lens", place: "the-board" });
    expect(aiTargetOf({ about: [] }, has)).toEqual({ on: "place", place: "home" });
  });

  it("is the same catalog for the same store, target and viewer", () => {
    const store = make();
    expect(catalogOf(store, { on: "place", place: "home" }, { principal: member, places: PLACES })).toEqual(catalogOf(store, { on: "place", place: "home" }, { principal: member, places: PLACES }));
  });
});

describe("the state a model reads", () => {
  it("says the target, its neighbors and what was done lately, as the viewer sees them", () => {
    const store = make();
    store.apply({ name: "set-status", args: { id: "t-1", status: "doing" } }, { author: member });
    const state = aiContextOf(store, { on: "record", id: "t-1" }, { principal: member, place: "the-board", selection: ["t-2", "s-1"] });
    expect(state.place).toBe("the-board");
    expect(state.target).toEqual({ on: "record", record: { id: "t-1", kind: "task", label: "Book the van", fields: { status: "doing" } } });
    expect(state.selection.map((one) => one.id)).toEqual(["t-2"]);
    expect(state.recent).toEqual([expect.objectContaining({ by: "u-mo" })]);
    expect(state.schema.kinds.map((kind) => kind.kind).sort()).toEqual(["person", "task"]);
    expect(state.schema.kinds.find((kind) => kind.kind === "task")?.fields["status"]).toBe("enum:todo|doing|done");
    expect(JSON.stringify(state)).not.toContain("surprise");
    expect(JSON.stringify(aiContextOf(store, { on: "record", id: "t-1" }, { principal: lead }))).toContain("surprise");
  });

  it("caches the declaration's digest per declaration and seat", () => {
    const store = make();
    expect(schemaDigestOf(store, member)).toBe(schemaDigestOf(store, member));
    expect(schemaDigestOf(store, member).version).not.toBe(schemaDigestOf(store, lead).version);
  });
});

describe("what an interaction leaves behind", () => {
  const entry = (id: string, at: string, extra: Partial<AiInteraction> = {}): AiInteraction => ({
    id,
    at,
    by: { kind: "human", id: "u-mo" },
    target: { on: "record", id: "t-1" },
    targetLabel: "Book the van",
    ask: { kind: "suggest", said: "Suggest" },
    offered: [{ id: "fill:t-1:status:done", type: "fill", label: "Status: done" }],
    outcome: "offered",
    ...extra,
  });

  it("is one entry when a host's copy and the page's meet, newest first", () => {
    const merged = mergeInteractions([entry("a", "2026-10-16T10:00:00Z"), entry("b", "2026-10-16T11:00:00Z")], [entry("a", "2026-10-16T10:00:00Z", { outcome: "accepted" })]);
    expect(merged.map((one) => [one.id, one.outcome])).toEqual([
      ["b", "offered"],
      ["a", "accepted"],
    ]);
  });

  it("is about the records it names and the person who asked it, and says what it cost", () => {
    const one = entry("a", "2026-10-16T10:00:00Z", { usage: [{ tier: "fast", model: "jev-latest", inputTokens: 200, costUsd: 0.001 }, { tier: "thinking", model: "stub", costUsd: 0.002 }] });
    expect(interactionTouches(one, "t-1")).toBe(true);
    expect(interactionTouches(one, "t-2")).toBe(false);
    expect(interactionTouches(one, "t-2", () => ["t-2"])).toBe(false);
    expect(interactionTouches({ ...one, batches: ["b1"] }, "t-2", () => ["t-2"])).toBe(true);
    expect(interactionBy(one, "u-mo")).toBe(true);
    expect(interactionCost(one)).toBeCloseTo(0.003);
  });
});
