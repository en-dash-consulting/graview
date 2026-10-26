import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, recordsOf, Store, type Policy, type Principal } from "../../src/index.js";
import { importRows } from "../../src/import/index.js";

/**
 * Who made a record is read from the log: the first add of its id. So an id
 * the log once held is never handed out again — not minted from a label,
 * not asked for, not hinted, not minted by an import — or the seat that
 * made and removed the first record would be taken for the maker of the
 * next one, and could remove, archive or edit it ("only on what you made"),
 * or see it by an `own` sight, while its real maker could not.
 */
const person = defineNode("person", { fields: z.object({ label: z.string().min(1) }), label: (n) => n.label, people: true });
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }), label: (n) => n.label });
const schema = createSchema([person, task]);
const { defineMutation } = bindSchema(schema);
const addTask = defineMutation("add-task", {
  title: "Add task",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label }),
});
const people = { nodes: [{ id: "person:carol", kind: "person", label: "Carol" }, { id: "person:dave", kind: "person", label: "Dave" }] as never, edges: [] };
const carol: Principal = { kind: "human", id: "person:carol", roles: ["worker"] };
const dave: Principal = { kind: "human", id: "person:dave", roles: ["worker"] };
const policy: Policy = { roles: ["worker", "admin"], grants: [{ roles: "*", mutations: ["add-task"] }, { roles: ["admin"], mutations: "*" }], sees: [{ roles: "*", kinds: ["person", "task"] }] };
const make = () => new Store({ schema, mutations: [addTask], policy, snapshot: structuredClone(people) });

describe("an id the log once held is never made again", () => {
  it("refuses an id asked for that a removed record held", () => {
    const store = make();
    store.apply({ name: "add-task", args: { id: "task:x1", label: "Mine" } as never }, { author: carol });
    store.apply({ name: "remove-task", args: { id: "task:x1" } }, { author: carol });
    expect(() => store.apply({ name: "add-task", args: { id: "task:x1", label: "Daves" } as never }, { author: dave })).toThrow(/already taken/);
    expect(store.graph.has("task:x1")).toBe(false);
  });

  it("mints past a removed record's id, so the new record is its own maker's", () => {
    const store = make();
    store.apply({ name: "add-task", args: { label: "Plan" } }, { author: carol });
    expect(store.graph.has("task:plan")).toBe(true);
    store.apply({ name: "remove-task", args: { id: "task:plan" } }, { author: carol });
    store.apply({ name: "add-task", args: { label: "Plan" } }, { author: dave });
    expect(store.graph.has("task:plan")).toBe(false);
    expect(store.graph.has("task:plan-2")).toBe(true);
    expect(recordsOf(store.log).creatorOf("task:plan-2")).toBe("person:dave");
    expect(store.permits({ name: "archive-task", args: { id: "task:plan-2" } }, carol).ok).toBe(false);
    expect(store.permits({ name: "edit-task", args: { id: "task:plan-2", label: "z" } }, carol).ok).toBe(false);
    expect(store.permits({ name: "archive-task", args: { id: "task:plan-2" } }, dave).ok).toBe(true);
    expect(store.permits({ name: "edit-task", args: { id: "task:plan-2", label: "z" } }, dave).ok).toBe(true);
  });

  it("takes no hint at a removed record's id", () => {
    const store = make();
    store.apply({ name: "add-task", args: { id: "task:x1", label: "Mine" } as never }, { author: carol });
    store.apply({ name: "remove-task", args: { id: "task:x1" } }, { author: carol });
    store.apply({ name: "add-task", args: { label: "Daves" }, mintedHint: "task:x1" } as never, { author: dave });
    expect(store.graph.has("task:x1")).toBe(false);
    expect(store.graph.has("task:daves")).toBe(true);
  });

  it("puts a removed record back at its own id when the removal is undone", () => {
    const store = make();
    store.apply({ name: "add-task", args: { label: "Plan" } }, { author: carol });
    const removed = store.apply({ name: "remove-task", args: { id: "task:plan" } }, { author: carol });
    store.undo(removed.batch, { author: carol });
    expect(store.graph.getNode("task:plan")?.label).toBe("Plan");
    expect(recordsOf(store.log).creatorOf("task:plan")).toBe("person:carol");
  });

  it("an import mints past a removed record's id", () => {
    const store = make();
    store.apply({ name: "add-task", args: { label: "Plan" } }, { author: carol });
    store.apply({ name: "remove-task", args: { id: "task:plan" } }, { author: carol });
    importRows(store, "task", [{ Label: "Plan" }], { Label: "label" } as never, { by: dave });
    expect(store.graph.has("task:plan")).toBe(false);
    expect(store.graph.has("task:plan-2")).toBe(true);
    expect(recordsOf(store.log).creatorOf("task:plan-2")).toBe("person:dave");
  });
});
