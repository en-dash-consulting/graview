import { bindSchema, nodeRef, type AnyMutationDefinition, type GraphReader } from "@graview/core";
import { z } from "zod";
import { isoDate } from "@graview/core";
import { todoSchema, type TodoSchema } from "./schema.js";

const { defineMutation } = bindSchema(todoSchema);
type M = AnyMutationDefinition<TodoSchema>;
type Reader = GraphReader<{ id: string; kind: string } & Record<string, unknown>>;

const nameOf = (graph: Reader, id: string): string => {
  const node = graph.getNode(id);
  return typeof node?.["label"] === "string" ? (node["label"] as string) : id;
};

/**
 * Every change is a named act.
 *
 * Not `updateTask`. The title is the label a person reads in the actions strip
 * AND the instruction an agent reads in its tool schema, so an opaque one costs
 * twice — which is why `graview check` refuses a mutation without one.
 */

export const addTask = defineMutation("add-task", {
  title: "Add a task",
  description: "Put something new on a list.",
  subject: { kinds: ["list"], arg: "listId" },
  input: z.object({
    listId: nodeRef(["list"]),
    label: z.string().min(1),
    due: isoDate.optional(),
  }),
  describe: (args, graph) => `Add "${args.label}" to ${nameOf(graph as Reader, args.listId)}`,
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "task");
    ctx.addNode({
      id,
      kind: "task",
      label: args.label,
      done: false,
      ...(args.due ? { due: args.due } : {}),
    } as never);
    ctx.addEdge({ kind: "holds", from: args.listId, to: id });
  },
}) as M;

export const finish = defineMutation("finish", {
  title: "Mark it done",
  description: "Say a task is finished. Reversible, like everything here.",
  subject: { kinds: ["task"], arg: "taskId" },
  input: z.object({ taskId: nodeRef(["task"]) }),
  describe: (args, graph) => `Finish "${nameOf(graph as Reader, args.taskId)}"`,
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { done: true });
  },
}) as M;

export const reopen = defineMutation("reopen", {
  title: "Put it back",
  description: "Undo finishing something, when it turns out not to be finished.",
  subject: { kinds: ["task"], arg: "taskId" },
  input: z.object({ taskId: nodeRef(["task"]) }),
  describe: (args, graph) => `Reopen "${nameOf(graph as Reader, args.taskId)}"`,
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { done: false });
  },
}) as M;

export const reschedule = defineMutation("reschedule", {
  title: "Move the date",
  description: "Change when something is due, or give it a date for the first time.",
  subject: { kinds: ["task"], arg: "taskId" },
  input: z.object({ taskId: nodeRef(["task"]), due: isoDate }),
  describe: (args, graph) => `Move "${nameOf(graph as Reader, args.taskId)}" to ${args.due}`,
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { due: args.due });
  },
}) as M;

/**
 * Blocking time for something.
 *
 * A due date says when it is needed; this says when you intend to do it. The
 * two are different facts and a week can only be drawn from the second.
 */
export const planIt = defineMutation("plan-it", {
  title: "Block time for it",
  description: "Put a task on a day at a time, so the week says what it actually holds.",
  subject: { kinds: ["task"], arg: "taskId" },
  input: z.object({
    taskId: nodeRef(["task"]),
    day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    plannedAt: z.number().int().min(0).max(1439),
    minutes: z.number().int().min(5).max(480),
  }),
  describe: (args, graph) =>
    `Plan "${nameOf(graph as Reader, args.taskId)}" for ${args.day}, ${args.minutes} minutes`,
  apply(ctx, args) {
    ctx.patchNode(args.taskId, {
      day: args.day,
      plannedAt: args.plannedAt,
      plannedUntil: Math.min(1440, args.plannedAt + args.minutes),
    });
  },
}) as M;

export const waitFor = defineMutation("wait-for", {
  title: "This has to happen first",
  description: "Record that one task cannot start until another is done.",
  subject: { kinds: ["task"], arg: "taskId" },
  input: z.object({ taskId: nodeRef(["task"]), blockerId: nodeRef(["task"]) }),
  describe: (args, graph) =>
    `"${nameOf(graph as Reader, args.taskId)}" waits for "${nameOf(graph as Reader, args.blockerId)}"`,
  apply(ctx, args) {
    if (args.taskId === args.blockerId) {
      throw new Error("A task cannot wait for itself");
    }
    ctx.addEdge({ kind: "waits-for", from: args.taskId, to: args.blockerId });
  },
}) as M;

export const moveToList = defineMutation("move-to-list", {
  title: "Move it to another list",
  description: "Take a task off one list and put it on another.",
  subject: { kinds: ["task"], arg: "taskId" },
  input: z.object({ taskId: nodeRef(["task"]), listId: nodeRef(["list"]) }),
  describe: (args, graph) =>
    `Move "${nameOf(graph as Reader, args.taskId)}" to ${nameOf(graph as Reader, args.listId)}`,
  apply(ctx, args) {
    // `setSingleTarget` would be wrong here: the edge runs list → task, so the
    // thing that must be unique is the SOURCE.
    ctx.setSingleSource("holds", args.taskId, args.listId);
  },
}) as M;

export const rename = defineMutation("rename", {
  title: "Rename",
  description: "Change what something is called. Ids are stable, so history still points here.",
  subject: { kinds: ["task", "list", "rule"], arg: "id" },
  input: z.object({ id: nodeRef(["task", "list", "rule"]), label: z.string().min(1) }),
  describe: (args) => `Rename to "${args.label}"`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
}) as M;

export const explain = defineMutation("explain", {
  title: "Note why this is here",
  description:
    "Attach a reason to a task or a list, so the argument for it outlives whoever made it.",
  subject: { kinds: ["task", "list"], arg: "aboutId" },
  input: z.object({ aboutId: nodeRef(["task", "list"]), text: z.string().min(1) }),
  describe: (args, graph) => `Why ${nameOf(graph as Reader, args.aboutId)} is here`,
  apply(ctx, args) {
    const id = ctx.freshId(args.text.slice(0, 24), "reason");
    ctx.addNode({ id, kind: "reason", text: args.text } as never);
    ctx.addEdge({ kind: "explains", from: id, to: args.aboutId });
  },
}) as M;

export const drop = defineMutation("drop", {
  title: "Drop it",
  description: "Remove a task entirely, along with anything waiting on it.",
  destructive: true,
  subject: { kinds: ["task"], arg: "taskId" },
  input: z.object({ taskId: nodeRef(["task"]) }),
  describe: (args, graph) => `Drop "${nameOf(graph as Reader, args.taskId)}"`,
  apply(ctx, args) {
    const node = ctx.graph.getNode(args.taskId);
    if (!node) throw new Error(`No task "${args.taskId}"`);
    ctx.removeNode(args.taskId);
  },
}) as M;

export const todoMutations: M[] = [
  addTask,
  finish,
  reopen,
  reschedule,
  planIt,
  waitFor,
  moveToList,
  rename,
  explain,
  drop,
];
