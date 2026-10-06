import { bindSchema, createSchema, defineApp, defineMutation, defineNode, nodeRef, Store, type AnySchema, type GraviewApp } from "@graview/core";
import { FIXTURES } from "@graview/core/conformance";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";

/**
 * FR-10, the derived half. A tool says what it does — reads, changes,
 * loses something, can be repeated — in the hints every MCP directory
 * asks for; its name is one every model's tool layer accepts; an act that
 * happens to be named like a read tool is still the act; and a host lists
 * the surface without building a store, with a hash that says when it moved.
 */
const vendors = FIXTURES.find((fixture) => fixture.id === "document:vendors")!;
const compiled = compileDocument(vendors.document);
if (!compiled.ok) throw new Error("the vendors fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
// The vendors' policy lets owners and planners act; the seat is a planner's.
const planner = { kind: "agent" as const, roles: ["planner"] };
const storeOf = (of: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({ schema: of.schema, mutations: of.mutations ?? [], ...(of.policy ? { policy: of.policy } : {}) });

describe("every derived tool says what it does", () => {
  it("every ToolDefinition carries readOnly, destructive and idempotent hints", () => {
    const { definitions } = createToolRuntime(storeOf(app), { author: planner });
    for (const tool of definitions) {
      expect(typeof tool.annotations.readOnlyHint, tool.name).toBe("boolean");
      expect(typeof tool.annotations.destructiveHint, tool.name).toBe("boolean");
      expect(typeof tool.annotations.idempotentHint, tool.name).toBe("boolean");
      expect(tool.annotations.openWorldHint, tool.name).toBe(false);
      expect(tool.title.length, tool.name).toBeGreaterThan(0);
      expect(tool.annotations.title).toBe(tool.title);
    }
    const hints = (name: string) => definitions.find((tool) => tool.name === name)!.annotations;
    expect(hints("get_node")).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(hints("search_graph")).toMatchObject({ readOnlyHint: true });
    expect(hints("preview_mutation")).toMatchObject({ readOnlyHint: true });
    expect(hints("undo_batch")).toMatchObject({ readOnlyHint: false });
    // Removing and severing lose something; setting a status twice is setting it once.
    expect(hints("remove-vendor")).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
    expect(hints("unfile")).toMatchObject({ destructiveHint: true });
    expect(hints("book")).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
    expect(hints("edit-vendor")).toMatchObject({ destructiveHint: false, idempotentHint: true });
    // Making a record twice makes two.
    expect(hints("add-vendor")).toMatchObject({ destructiveHint: false, idempotentHint: false });
  });

  it("an act named get_node runs as the act", async () => {
    const note = defineNode("note", { fields: z.object({ label: z.string(), pinned: z.boolean().optional() }) });
    const schema = createSchema([note]);
    const getNode = defineMutation("get_node", {
      title: "Get the note out",
      subject: { kinds: ["note"], arg: "noteId" },
      input: z.object({ noteId: nodeRef(["note"]) }),
      apply(ctx, args) {
        ctx.patchNode(args.noteId, { pinned: true });
      },
    });
    const store = new Store({ schema, mutations: [getNode] as never, snapshot: { nodes: [{ id: "n1", kind: "note", label: "Milk" }] as never, edges: [] } });
    const runtime = createToolRuntime(store);
    const listed = runtime.definitions.filter((tool) => tool.act === "get_node");
    expect(listed).toHaveLength(1);
    const act = listed[0]!;
    expect(act.name).not.toBe("get_node");
    expect(act.title).toBe("Get the note out");
    const result = await runtime.call(act.name, { noteId: "n1" });
    expect(result.ok).toBe(true);
    expect(store.graph.getNode("n1")).toMatchObject({ pinned: true });
    // The read tool is still the read tool.
    const read = await runtime.call("get_node", { id: "n1" });
    expect(read.ok && (read.data as { node: { id: string } }).node.id).toBe("n1");
  });

  it("toolDefinitions(app, principal) needs no store, and returns a surface hash", () => {
    const listed = toolDefinitions(app, planner);
    expect(listed.definitions).toEqual(createToolRuntime(storeOf(app), { author: planner }).definitions);
    expect(listed.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(toolDefinitions(app, planner).hash).toBe(listed.hash);
    expect(createToolRuntime(storeOf(app), { author: planner }).hash).toBe(listed.hash);
    // A read-only seat is a different surface, and says so.
    expect(toolDefinitions(app, planner, { readOnly: true }).hash).not.toBe(listed.hash);
    // So is a declaration with one more act.
    const more = { ...app, mutations: [...(app.mutations ?? []), defineMutation("shout", { title: "Shout", input: z.object({}), apply() {} })] } as GraviewApp<AnySchema>;
    expect(toolDefinitions(more, planner).hash).not.toBe(listed.hash);
  });

  it("narrows to what the principal may run, as the runtime does", () => {
    const note = defineNode("note", { fields: z.object({ label: z.string() }) });
    const schema = createSchema([note]);
    const add = bindSchema(schema).defineMutation("add-note", { title: "Add a note", creates: ["note"], input: z.object({ label: z.string() }), apply(ctx, args) { ctx.addNode({ id: ctx.freshId(args.label, "note"), kind: "note", label: args.label }); } });
    const guarded = defineApp({ name: "Notes", schema, mutations: [add], policy: { grants: [{ roles: ["editor"], mutations: ["add-note"] }] } });
    const reader = toolDefinitions(guarded, { kind: "agent", roles: [] });
    const editor = toolDefinitions(guarded, { kind: "agent", roles: ["editor"] });
    expect(reader.definitions.map((tool) => tool.name)).not.toContain("add-note");
    expect(editor.definitions.map((tool) => tool.name)).toEqual(expect.arrayContaining(["add-note", "remove-note"]));
    expect(editor.definitions).toEqual(createToolRuntime(storeOf(guarded), { author: { kind: "agent", roles: ["editor"] } }).definitions);
  });

  it("tool names are MCP-safe, with deterministic collision handling", async () => {
    const note = defineNode("note", { fields: z.object({ label: z.string() }) });
    const schema = createSchema([note]);
    const act = (name: string) => defineMutation(name, { title: name, input: z.object({}), apply() {} });
    const awkward = ["Tidy up!", "tidy-up_", "Tidy_up?", "2nd pass", "café.au.lait", "x".repeat(80), "x".repeat(81)];
    const store = new Store({ schema, mutations: awkward.map(act) as never });
    const names = createToolRuntime(store).definitions.map((tool) => tool.name);
    for (const name of names) expect(name).toMatch(/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/);
    expect(new Set(names).size).toBe(names.length);
    // The same declaration names its tools the same way every time.
    expect(createToolRuntime(new Store({ schema, mutations: awkward.map(act) as never })).definitions.map((tool) => tool.name)).toEqual(names);
    const byAct = Object.fromEntries(createToolRuntime(store).definitions.filter((tool) => tool.act).map((tool) => [tool.act, tool.name]));
    expect(byAct["Tidy up!"]).toBe("Tidy_up_");
    expect(byAct["Tidy_up?"]).toBe("Tidy_up__2");
    expect(byAct["2nd pass"]).toBe("act_2nd_pass");
    expect(byAct["café.au.lait"]).toBe("cafe_au_lait");
    // Names already safe are left alone: add-vendor is still add-vendor.
    expect(createToolRuntime(storeOf(app), { author: planner }).definitions.map((tool) => tool.name)).toEqual(expect.arrayContaining(["add-vendor", "remove-vendor", "book"]));
    // An act is still reached by the name it was declared with.
    const ran = await createToolRuntime(store).call("Tidy up!", {});
    expect(ran.ok).toBe(true);
  });
});
