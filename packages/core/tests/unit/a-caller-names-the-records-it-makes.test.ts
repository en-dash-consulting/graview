import { describe, expect, it } from "vitest";
import { z } from "zod";
import { compileDocument } from "../../src/check.js";
import { bindSchema, createSchema, defineNode, nodeRef, seatMark, Store, type AnySchema, type GraviewApp, type Policy } from "../../src/index.js";

/**
 * A CALLER NAMES THE RECORDS IT MAKES (Roadmap f-1-0-client-ids).
 *
 * Ids stay readable slugs when nobody asks; but every act that creates —
 * an app's own in code, a document's — takes an `id` a caller brings, so
 * an offline batch or an agent's chain can name its records up front and
 * refer to them before any server answers. A free, well-formed id is
 * honored exactly; a taken one is refused in a sentence, never renamed.
 */
const list = defineNode("list", { fields: z.object({ label: z.string().min(1) }), edges: { holds: { to: ["task"] } } });
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }) });
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);
const addList = defineMutation("add-list", {
  title: "Add a list",
  creates: ["list"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "list"), kind: "list", label: args.label });
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
const file = defineMutation("file", {
  title: "File a task on a list",
  input: z.object({ listId: nodeRef(["list"]), taskId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "holds", from: args.listId, to: args.taskId });
  },
});
const fixed = defineMutation("add-inbox", {
  title: "Add the inbox",
  creates: ["list"],
  input: z.object({}),
  apply(ctx) {
    ctx.addNode({ id: "list:inbox", kind: "list", label: "Inbox" });
  },
});
const mutations = [addList, addTask, file, fixed];
const open = (policy?: Policy) => new Store({ schema, mutations, ...(policy ? { policy } : {}), snapshot: { nodes: [], edges: [] } as never });

describe("a caller names the records it makes", () => {
  it("lets an agent's chain make two records and link them by its own ids, in one batch", () => {
    const store = open();
    const result = store.applyAll([
      { name: "add-list", args: { id: "list-7f3a", label: "Groceries" } },
      { name: "add-task", args: { id: "task-0b91", label: "Buy milk" } },
      { name: "file", args: { listId: "list-7f3a", taskId: "task-0b91" } },
    ]);
    expect(store.graph.out("list-7f3a", "holds").map((node) => node.id)).toEqual(["task-0b91"]);
    expect(result.minted).toEqual(["list-7f3a", "task-0b91", undefined]);
    // One gesture, one undo: the chain comes back out whole.
    store.undo(result.batch);
    expect(store.graph.size).toEqual({ nodes: 0, edges: 0 });
  });

  it("refuses a taken id in a sentence and keeps none of the batch, rather than renaming the record", () => {
    const store = open();
    store.apply({ name: "add-task", args: { id: "task-0b91", label: "Buy milk" } });
    expect(() =>
      store.applyAll([
        { name: "add-list", args: { id: "list-7f3a", label: "Groceries" } },
        { name: "add-task", args: { id: "task-0b91", label: "Buy bread" } },
      ]),
    ).toThrow(/Id "task-0b91" is already taken/);
    expect(store.graph.allNodes().map((node) => node.id)).toEqual(["task-0b91"]);
  });

  it("takes a client's own id as a hint: made under it when free, minted as ever when taken, and a later call of the change follows it", () => {
    const store = open();
    store.apply({ name: "add-list", args: { label: "Groceries" }, mintedHint: "list-local-1" });
    expect(store.graph.getNode("list-local-1")).toBeDefined();
    store.apply({ name: "add-task", args: { label: "Buy milk" } });
    const result = store.applyAll([
      { name: "add-task", args: { label: "Buy milk" }, mintedHint: "task:buy-milk" },
      { name: "file", args: { listId: "list-local-1", taskId: "task:buy-milk" } },
    ]);
    expect(result.minted?.[0]).toBe("task:buy-milk-2");
    expect(store.graph.out("list-local-1", "holds").map((node) => node.id)).toEqual(["task:buy-milk-2"]);
    // The log keeps the calls as the store read them: no hint, and the later call naming the record made.
    expect(result.ops.map((op) => op.mutation)).toEqual([
      { name: "add-task", args: { label: "Buy milk" } },
      { name: "file", args: { listId: "list-local-1", taskId: "task:buy-milk-2" } },
    ]);
  });

  it("refuses an id that is not one: empty, too long, or with a space in it", () => {
    const store = open();
    for (const id of ["", "two words", "x".repeat(201), "tab\there"]) {
      expect(() => store.apply({ name: "add-task", args: { id, label: "Odd" } })).toThrow(/1–200 characters with no space/);
    }
    expect(store.graph.size.nodes).toBe(0);
  });

  it("says so when an act that names its records itself is asked for an id, rather than dropping it", () => {
    const store = open();
    expect(() => store.apply({ name: "add-inbox", args: { id: "list:mine" } })).toThrow(/did not make a record with id "list:mine"/);
    expect(store.graph.size.nodes).toBe(0);
  });

  it("is honored by a document app's creating act, and its connect names the records by those ids", () => {
    const compiled = compileDocument(
      {
        format: "graview-document",
        formatVersion: 1,
        name: "Plans",
        kinds: {
          feature: { noun: "feature", plural: "Features", fields: { name: { type: "string", required: true } }, edges: { tier: { to: ["plan"], cardinality: "one", inverse: "features" } } },
          plan: { noun: "plan", plural: "Plans", fields: { name: { type: "string", required: true } } },
        },
        acts: {
          "add-plan": { title: "Add a plan", creates: "plan" },
          "add-feature": { title: "Add a feature", creates: "feature" },
          "set-tier": { title: "Set the tier", on: "feature", connects: "tier" },
        },
      },
      { today: () => "2026-10-23" },
    );
    if (!compiled.ok) throw new Error("the document compiles");
    const app = compiled.app as GraviewApp<AnySchema>;
    const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } as never });
    store.applyAll([
      { name: "add-plan", args: { id: "plan-pro", name: "Pro" } },
      { name: "add-feature", args: { id: "feature-seats", name: "Seats" } },
      { name: "set-tier", args: { id: "feature-seats", to: "plan-pro" } },
    ]);
    expect(store.graph.out("feature-seats", "tier").map((node) => node.id)).toEqual(["plan-pro"]);
    expect(() => store.apply({ name: "add-plan", args: { id: "plan-pro", name: "Pro again" } })).toThrow(/already taken/);
  });

  it("lets a seat that does not see everything ask for an id of its own, and no other", () => {
    const sight: Policy = {
      roles: ["helper"],
      grants: [{ roles: "*", mutations: "*" }],
      sees: [
        { roles: ["helper"], kinds: ["list"] },
        { roles: ["helper"], kinds: ["task"], own: true },
      ],
    };
    const store = open(sight);
    const helper = { kind: "human" as const, id: "gus", roles: ["helper"] };
    const own = `task:milk.${seatMark("gus")}`;
    store.apply({ name: "add-task", args: { id: own, label: "Milk" } }, { author: helper });
    expect(store.graph.getNode(own)).toBeDefined();
    expect(() => store.apply({ name: "add-task", args: { id: "task:bread", label: "Bread" } }, { author: helper })).toThrow(/makes its own id here/);
  });
});
