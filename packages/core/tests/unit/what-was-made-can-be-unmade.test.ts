import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineApp,
  defineNode,
  deriveRemoveMutations,
  nodeRef,
  removeVia,
  Store,
  takesAnId,
  type Policy,
} from "../../src/index.js";
import { mutationToolSchema } from "../../src/schema/json-schema.js";
import { checkApp } from "../../src/check.js";

/**
 * Two things an agent redesigning a live graph needs and no app declared:
 * a create that can NAME the node it makes, and a way to lose one. Both
 * come from the framework — the id as an argument every creating act
 * takes, the remove as a derived act per kind — and both flow through the
 * policy, the log and undo like everything else.
 */

const list = defineNode("list", { fields: z.object({ label: z.string().min(1) }), edges: { holds: { to: ["task"] } } });
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }) });
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);

const addTask = defineMutation("add-task", {
  title: "Add a task",
  description: "Put something on a list.",
  subject: { kinds: ["list"], arg: "listId" },
  creates: ["task"],
  input: z.object({ listId: nodeRef(["list"]), label: z.string().min(1) }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "task");
    ctx.addNode({ id, kind: "task", label: args.label, done: false });
    ctx.addEdge({ kind: "holds", from: args.listId, to: id });
  },
});
const finish = defineMutation("finish", {
  title: "Mark it done",
  description: "Say a task is finished.",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { done: true });
  },
});
const mutations = [addTask, finish];
const seed = {
  nodes: [
    { id: "today", kind: "list", label: "Today" },
    { id: "task:milk", kind: "task", label: "Buy milk", done: false },
  ],
  edges: [{ kind: "holds", from: "today", to: "task:milk" }],
};

describe("a create can name its id", () => {
  it("takes the framework's id argument only when it creates and has no id of its own", () => {
    expect(takesAnId(addTask)).toBe(true);
    expect(takesAnId(finish)).toBe(false);
    const own = defineMutation("add-list", {
      title: "Add a list",
      description: "A list, by its own id.",
      creates: ["list"],
      input: z.object({ id: z.string(), label: z.string() }),
      apply(ctx, args) {
        ctx.addNode({ id: args.id, kind: "list", label: args.label });
      },
    });
    expect(takesAnId(own)).toBe(false);
  });

  it("says so in the tool schema", () => {
    const tool = mutationToolSchema(addTask);
    const properties = tool.inputSchema["properties"] as Record<string, { description?: string }>;
    expect(properties["id"]?.description).toMatch(/the id for the task this makes/);
    expect((tool.inputSchema["required"] as string[] | undefined) ?? []).not.toContain("id");
    expect((mutationToolSchema(finish).inputSchema["properties"] as Record<string, unknown>)["id"]).toBeUndefined();
  });

  it("makes the node with exactly that id, and the call carries it into the log", () => {
    const store = new Store({ schema, mutations, snapshot: seed as never });
    const result = store.apply({ name: "add-task", args: { listId: "today", label: "Book the van", id: "task:van" } });
    expect(store.graph.getNode("task:van")).toMatchObject({ kind: "task", label: "Book the van" });
    expect(store.graph.outEdges("today").map((edge) => edge.to)).toContain("task:van");
    expect(result.ops[0]?.mutation?.args).toMatchObject({ id: "task:van" });
    // And without one, the label mints it as before.
    store.apply({ name: "add-task", args: { listId: "today", label: "Order boxes" } });
    expect(store.graph.getNode("task:order-boxes")).toBeDefined();
  });

  it("refuses an id the graph already has, by name, rather than suffixing it", () => {
    const store = new Store({ schema, mutations, snapshot: seed as never });
    expect(() =>
      store.apply({ name: "add-task", args: { listId: "today", label: "Buy milk again", id: "task:milk" } }),
    ).toThrow(/Id "task:milk" is already taken/);
    expect(store.graph.allNodes()).toHaveLength(2);
  });

  it("previews with the id too, so what is shown is what would land", () => {
    const store = new Store({ schema, mutations, snapshot: seed as never });
    const preview = store.preview({ name: "add-task", args: { listId: "today", label: "Van", id: "task:van" } });
    expect(preview.diff.addedNodes.map((node) => node.id)).toEqual(["task:van"]);
  });
});

describe("the derived remove act", () => {
  it("exists per kind, destructive, taking the node and its ties", () => {
    const derived = deriveRemoveMutations(schema, mutations);
    expect(derived.map((m) => m.name)).toEqual(["remove-list", "remove-task"]);
    const remove = derived[1]!;
    expect(remove.title).toBe("Remove the task");
    expect(remove.destructive).toBe(true);
    expect(remove.derived).toEqual({ kind: "task", act: "remove" });

    const store = new Store({ schema, mutations, snapshot: seed as never });
    const result = store.apply({ name: "remove-task", args: { id: "task:milk" } });
    expect(result.intent).toBe("Remove Buy milk");
    expect(store.graph.getNode("task:milk")).toBeUndefined();
    expect(store.graph.outEdges("today")).toHaveLength(0);
    store.undo(result.batch);
    expect(store.graph.getNode("task:milk")).toBeDefined();
    expect(store.graph.outEdges("today")).toHaveLength(1);
  });

  it("stands aside for an app's own act of the same name", () => {
    const own = defineMutation("remove-task", {
      title: "Bin it",
      description: "The app's own way.",
      subject: { kinds: ["task"], arg: "taskId" },
      input: z.object({ taskId: nodeRef(["task"]) }),
      apply(ctx, args) {
        ctx.removeNode(args.taskId);
      },
    });
    const derived = deriveRemoveMutations(schema, [...mutations, own]);
    expect(derived.map((m) => m.name)).toEqual(["remove-list"]);
    const store = new Store({ schema, mutations: [...mutations, own], snapshot: seed as never });
    expect(store.mutation("remove-task").title).toBe("Bin it");
  });

  it("is permitted through the acts that create the kind, and refused with who could", () => {
    const policy: Policy = {
      grants: [
        { roles: ["owner"], mutations: ["add-task", "finish"], describe: "Owners run their own lists." },
        { roles: ["helper"], mutations: ["finish"] },
      ],
    };
    expect(removeVia(mutations, "task")).toEqual(["add-task"]);
    // Nothing creates a list, so nobody may remove one — and it says so.
    expect(removeVia(mutations, "list")).toEqual([]);

    const store = new Store({ schema, mutations, policy, snapshot: seed as never });
    const owner = { kind: "human" as const, id: "o", roles: ["owner"] };
    const helper = { kind: "human" as const, id: "h", roles: ["helper"] };
    expect(store.permittedMutations(owner).map((m) => m.name)).toContain("remove-task");
    expect(store.permittedMutations(helper).map((m) => m.name)).not.toContain("remove-task");
    expect(store.permittedMutations(owner).map((m) => m.name)).not.toContain("remove-list");

    const verdict = store.permits({ name: "remove-task", args: { id: "task:milk" } }, helper);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.refusal.wouldNeed).toEqual(["owner"]);
      expect(verdict.refusal.message).toMatch(/owner can/);
    }
    expect(() => store.apply({ name: "remove-task", args: { id: "task:milk" } }, { author: helper })).toThrow(/Not permitted/);
    // Riding the act that makes a task, an owner removes the tasks they made, not the rest (W-201).
    const theirs = store.permits({ name: "remove-task", args: { id: "task:milk" } }, owner);
    expect(theirs.ok).toBe(false);
    if (!theirs.ok) expect(theirs.refusal.message).toMatch(/only on what you made/);
    store.apply({ name: "add-task", args: { listId: "today", label: "Eggs" } }, { author: owner });
    const eggs = store.graph.nodesOfKind("task").find((task) => task.label === "Eggs")!;
    store.apply({ name: "remove-task", args: { id: eggs.id } }, { author: owner });
    expect(store.graph.getNode(eggs.id)).toBeUndefined();
    // A grant that names the act reaches every task.
    const named = new Store({ schema, mutations, policy: { grants: [{ roles: ["owner"], mutations: ["remove-task"] }] }, snapshot: seed as never });
    named.apply({ name: "remove-task", args: { id: "task:milk" } }, { author: owner });
    expect(named.graph.getNode("task:milk")).toBeUndefined();
  });

  it("is counted by the checker as an act a grant may name", () => {
    const app = defineApp({
      name: "lists",
      schema,
      mutations,
      invariants: [],
      policy: { grants: [{ roles: ["cleaner"], mutations: ["remove-task"] }, { roles: ["owner"], mutations: "*" }] },
    });
    const result = checkApp(app);
    expect(result.findings.map((f) => f.code)).not.toContain("role-may-do-nothing");
    expect(result.findings.filter((f) => f.code === "grant-names-unknown-mutation")).toEqual([]);
  });
});
