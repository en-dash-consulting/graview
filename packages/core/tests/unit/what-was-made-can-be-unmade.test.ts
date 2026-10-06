import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineApp,
  defineNode,
  deriveRemoveMutations,
  mutationToolSchema,
  nodeRef,
  removeVia,
  Store,
  takesAnId,
  type Policy,
} from "../../src/index.js";
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
    { id: "t-milk", kind: "task", label: "Buy milk", done: false },
  ],
  edges: [{ kind: "holds", from: "today", to: "t-milk" }],
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
    const result = store.apply({ name: "add-task", args: { listId: "today", label: "Book the van", id: "t-van" } });
    expect(store.graph.getNode("t-van")).toMatchObject({ kind: "task", label: "Book the van" });
    expect(store.graph.outEdges("today").map((edge) => edge.to)).toContain("t-van");
    expect(result.ops[0]?.mutation?.args).toMatchObject({ id: "t-van" });
    // And without one, the label mints it as before.
    store.apply({ name: "add-task", args: { listId: "today", label: "Order boxes" } });
    expect(store.graph.getNode("task:order-boxes")).toBeDefined();
  });

  it("refuses an id the graph already has, by name, rather than suffixing it", () => {
    const store = new Store({ schema, mutations, snapshot: seed as never });
    expect(() =>
      store.apply({ name: "add-task", args: { listId: "today", label: "Buy milk again", id: "t-milk" } }),
    ).toThrow(/Id "t-milk" is already taken/);
    expect(store.graph.allNodes()).toHaveLength(2);
  });

  it("previews with the id too, so what is shown is what would land", () => {
    const store = new Store({ schema, mutations, snapshot: seed as never });
    const preview = store.preview({ name: "add-task", args: { listId: "today", label: "Van", id: "t-van" } });
    expect(preview.diff.addedNodes.map((node) => node.id)).toEqual(["t-van"]);
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
    const result = store.apply({ name: "remove-task", args: { id: "t-milk" } });
    expect(result.intent).toBe("Remove Buy milk");
    expect(store.graph.getNode("t-milk")).toBeUndefined();
    expect(store.graph.outEdges("today")).toHaveLength(0);
    store.undo(result.batch);
    expect(store.graph.getNode("t-milk")).toBeDefined();
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

    const verdict = store.permits({ name: "remove-task", args: { id: "t-milk" } }, helper);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.refusal.wouldNeed).toEqual(["owner"]);
      expect(verdict.refusal.message).toMatch(/owner can/);
    }
    expect(() => store.apply({ name: "remove-task", args: { id: "t-milk" } }, { author: helper })).toThrow(/Not permitted/);
    store.apply({ name: "remove-task", args: { id: "t-milk" } }, { author: owner });
    expect(store.graph.getNode("t-milk")).toBeUndefined();
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
