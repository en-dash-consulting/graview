import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { editableFields } from "../../src/index.js";

/**
 * Editing where a value is shown, when the writer does not take the value:
 * `done` is set by "Mark it done" and "Put it back", declared through
 * `writes`, and the control offers those acts rather than a text box.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean(), notes: z.string().optional() }),
  fixed: { notes: "kept as first written" },
});
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  description: "Say it is finished.",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { done: true });
  },
});
const reopen = defineMutation("reopen", {
  title: "Put it back",
  description: "Say it is not finished after all.",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { done: false });
  },
});
const store = () =>
  new Store({
    schema,
    mutations: [finish, reopen],
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Milk", done: false, notes: "2%" }], edges: [] } as never,
  });

describe("a writer that takes no value", () => {
  it("is offered as the act, with its alternatives, and runs by title", () => {
    const done = editableFields(store(), "t1").find((field) => field.field === "done")!;
    expect(done.mutation).toBe("finish");
    expect(done.takesValue).toBe(false);
    expect(done.alternatives.map((alt) => alt.mutation)).toEqual(["reopen"]);
    expect(done.call(undefined)).toEqual({ name: "finish", args: { taskId: "t1" } });
    expect(done.alternatives[0]!.call(undefined)).toEqual({ name: "reopen", args: { taskId: "t1" } });
  });

  it("applies through the mutation like any other edit", () => {
    const live = store();
    const done = editableFields(live, "t1").find((field) => field.field === "done")!;
    live.apply(done.call(undefined));
    expect((live.graph.getNode("t1") as { done: boolean }).done).toBe(true);
    live.apply(done.alternatives[0]!.call(undefined));
    expect((live.graph.getNode("t1") as { done: boolean }).done).toBe(false);
  });
});

describe("the derived edit and the fixed field", () => {
  it("covers the label through edit-task, and leaves the fixed notes read-only", () => {
    const fields = editableFields(store(), "t1");
    expect(fields.find((field) => field.field === "label")?.mutation).toBe("edit-task");
    expect(fields.find((field) => field.field === "notes")).toBeUndefined();
  });
});
