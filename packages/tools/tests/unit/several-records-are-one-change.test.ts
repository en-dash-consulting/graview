import { readFileSync } from "node:fs";
import { ActRefusal, bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { actOnSeveral, actsForSeveral, createToolRuntime } from "../../src/index.js";
import { createTodoStore } from "../../../../apps/todo/src/domain/app.js";

/**
 * SEVERAL RECORDS, ONE CHANGE.
 *
 * Every act on a page was on one record, so marking six tasks done was six
 * rounds and six undos. A selection of several is offered the acts every
 * record in it shares — the derivation's own, in its order, and a choice
 * field's values — each asked once for all and run as ONE batch with one
 * undo. A record the act may not run on is named with why, and the rest
 * still apply. The seat does the same with `act_on_several`.
 */

const example = JSON.parse(readFileSync(new URL("../../../../apps/todo/src/data/example.json", import.meta.url), "utf8"));
const keeper: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const todo = () => createTodoStore({ snapshot: example });
const openTasks = (store: ReturnType<typeof todo>) => store.graph.nodesOfKind("task").filter((task) => !(task as { done?: boolean }).done);

const offer = defineNode("offer", {
  description: "An offer to a client.",
  fields: z.object({ label: z.string(), stage: z.enum(["open", "declined", "signed"]) }),
  plural: "Offers",
  label: (node) => node.label,
});
const schema = createSchema([offer]);
const { defineMutation } = bindSchema(schema);
const decline = defineMutation("decline", {
  title: "Decline it",
  subject: { kinds: ["offer"], arg: "id" },
  writes: ["stage"],
  sets: { stage: "declined" },
  input: z.object({ id: nodeRef(["offer"]) }),
  apply(ctx, args) {
    if (ctx.graph.getNode(args.id)?.stage === "signed") throw new ActRefusal("A signed offer stays signed.");
    ctx.patchNode(args.id, { stage: "declined" });
  },
});
const setStage = defineMutation("set-stage", {
  title: "Change the stage",
  subject: { kinds: ["offer"], arg: "id" },
  writes: ["stage"],
  input: z.object({ id: nodeRef(["offer"]), stage: z.enum(["open", "declined", "signed"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { stage: args.stage });
  },
});
const offers = () => {
  const nodes = [
    { id: "o-1", kind: "offer", label: "Roof", stage: "open" },
    { id: "o-2", kind: "offer", label: "Porch", stage: "signed" },
    { id: "o-3", kind: "offer", label: "Fence", stage: "open" },
  ];
  return new Store({ schema, mutations: [decline, setStage], invariants: [], snapshot: { nodes, edges: [] } as never });
};

describe("the acts several records share", () => {
  it("are the derivation's own, once, without a count: three open tasks are offered Mark it done, and neither a rename nor the whole-record edit", () => {
    const store = todo();
    const ids = openTasks(store).slice(0, 3).map((task) => task.id);
    const { acts } = actsForSeveral(store, ids, { principal: keeper });
    const labels = acts.map((act) => act.label);
    expect(labels[0]).toBe("Mark it done");
    expect(labels).toContain("Move the date");
    expect(labels).not.toContain("Rename");
    expect(labels).not.toContain("Change the task");
    expect(labels.every((label) => !/\(\d+\)/.test(label))).toBe(true);
    // What sets a record aside or removes it is kept behind More, after the rest.
    const more = acts.filter((act) => act.more).map((act) => act.label);
    expect(more).toEqual(expect.arrayContaining(["Archive the task", "Remove the task"]));
    expect(acts.findIndex((act) => act.more)).toBeGreaterThan(acts.findIndex((act) => act.label === "Move the date"));
  });

  it("offers one record alone its act even where a rule offers it as a repair: every open task, chosen alone, can be marked done", () => {
    const store = todo();
    const flagged = new Set(store.violations().flatMap((violation) => violation.nodeIds));
    const tasks = openTasks(store);
    expect(tasks.some((task) => flagged.has(task.id))).toBe(true);
    for (const task of tasks) {
      const labels = actsForSeveral(store, [task.id], { principal: keeper }).acts.map((act) => act.label);
      expect(labels, task.id).toContain("Mark it done");
      expect(new Set(labels).size, task.id).toBe(labels.length);
    }
  });

  it("asks what is left to ask once, for every record: Move the date asks one date", () => {
    const store = todo();
    const ids = openTasks(store).slice(0, 3).map((task) => task.id);
    const move = actsForSeveral(store, ids, { principal: keeper }).acts.find((act) => act.label === "Move the date")!;
    expect(move.open.map((parameter) => parameter.name)).toEqual(["due"]);
    expect(move.subject).toBe("taskId");
  });

  it("include where they stand, moved as a board moves a card: a named step under its own title, a free act told the value", () => {
    const store = offers();
    const labels = actsForSeveral(store, ["o-1", "o-3"]).acts.map((act) => act.label);
    expect(labels).toContain("Decline it");
    expect(labels).toContain("Move to Signed");
    // Every one is already open: there is nothing to set it to.
    expect(labels).not.toContain("Move to Open");
    expect(labels.filter((label) => label === "Decline it")).toHaveLength(1);
  });
});

describe("one act over several records", () => {
  it("is one batch with one undo: three tasks marked done, and one undo puts all three back", () => {
    const store = todo();
    const ids = openTasks(store).slice(0, 3).map((task) => task.id);
    const before = store.batches().length;
    const outcome = actOnSeveral(store, { mutation: "finish", subject: "taskId" }, ids, { author: keeper });
    expect(outcome.applied).toEqual(ids);
    expect(outcome.refused).toEqual([]);
    expect(store.batches().length).toBe(before + 1);
    expect(outcome.intent).toBe("Mark it done — 3 tasks");
    for (const id of ids) expect((store.graph.getNode(id) as { done?: boolean }).done).toBe(true);
    // Attributed as any act is: every op is the keeper's, under the gesture's words.
    for (const op of outcome.result!.ops) {
      expect(op.author.id).toBe("user-nora");
      expect(op.batchIntent).toBe("Mark it done — 3 tasks");
    }
    store.undo([outcome.batch!], { author: keeper });
    for (const id of ids) expect((store.graph.getNode(id) as { done?: boolean }).done).toBe(false);
  });

  it("names a record the act refuses, in its own words, and still applies the rest", () => {
    const store = offers();
    const outcome = actOnSeveral(store, { mutation: "decline", subject: "id" }, ["o-1", "o-2", "o-3"]);
    expect(outcome.applied).toEqual(["o-1", "o-3"]);
    expect(outcome.refused).toEqual([{ id: "o-2", label: "Porch", message: "A signed offer stays signed.", reason: "refused" }]);
    expect(store.graph.getNode("o-2")?.stage).toBe("signed");
    expect(store.batches()).toHaveLength(1);
  });

  it("names a record the policy keeps from this seat", () => {
    const store = todo();
    const stranger: Principal = { kind: "human", id: "user-new", roles: [] };
    // The stranger's own task, which the grant to every seat lets them set aside; the others are somebody else's.
    store.apply({ name: "add-task", args: { label: "Water the plants", listId: store.graph.nodesOfKind("list")[0]!.id } }, { author: stranger });
    const mine = store.graph.nodesOfKind("task").find((task) => (task as { label?: string }).label === "Water the plants")!.id;
    const theirs = openTasks(store).filter((task) => task.id !== mine).slice(0, 2).map((task) => task.id);
    const outcome = actOnSeveral(store, { mutation: "archive-task", subject: "id" }, [mine, ...theirs], { author: stranger });
    expect(outcome.applied).toEqual([mine]);
    expect(outcome.refused.map((one) => one.id)).toEqual(theirs);
    expect(outcome.refused.every((one) => one.reason === "forbidden" && one.message.length > 0 && one.label !== one.id)).toBe(true);
  });

  it("counts a record already so apart from one it changed", () => {
    const store = todo();
    const [first, second] = openTasks(store).map((task) => task.id) as [string, string];
    store.apply({ name: "finish", args: { taskId: first } }, { author: keeper });
    const outcome = actOnSeveral(store, { mutation: "finish", subject: "taskId" }, [first, second], { author: keeper });
    expect(outcome.applied).toEqual([second]);
    expect(outcome.unchanged).toEqual([first]);
  });
});

describe("the seat does the same", () => {
  it("runs act_on_several by records' names, as one batch undo_batch takes back", async () => {
    const store = todo();
    const tasks = openTasks(store).slice(0, 3);
    const runtime = createToolRuntime(store, { author: keeper });
    expect(runtime.definitions.map((tool) => tool.name)).toContain("act_on_several");
    const result = await runtime.call("act_on_several", { act: "finish", records: tasks.map((task) => (task as { label: string }).label) });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const data = (result as { data: { batch: string; applied: string[]; refused: unknown[] } }).data;
    expect(data.applied).toEqual(tasks.map((task) => task.id));
    expect(data.refused).toEqual([]);
    for (const task of tasks) expect((store.graph.getNode(task.id) as { done?: boolean }).done).toBe(true);
    const undone = await runtime.call("undo_batch", { batch: data.batch });
    expect(undone.ok).toBe(true);
    for (const task of tasks) expect((store.graph.getNode(task.id) as { done?: boolean }).done).toBe(false);
  });

  it("names the records it refused and applies the rest", async () => {
    const store = offers();
    const runtime = createToolRuntime(store, { author: { kind: "agent", id: "agent-1" } });
    const result = await runtime.call("act_on_several", { act: "decline", records: ["Roof", "Porch", "Fence"] });
    const data = (result as { data: { applied: string[]; refused: { record: string; label: string; error: string }[] } }).data;
    expect(data.applied).toEqual(["o-1", "o-3"]);
    expect(data.refused).toEqual([{ record: "o-2", label: "Porch", error: "A signed offer stays signed.", reason: "refused" }]);
  });

  it("is not listed for a read-only seat", () => {
    const runtime = createToolRuntime(todo(), { readOnly: true });
    expect(runtime.definitions.map((tool) => tool.name)).not.toContain("act_on_several");
  });
});
