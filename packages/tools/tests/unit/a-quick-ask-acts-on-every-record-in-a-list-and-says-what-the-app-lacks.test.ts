import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { acceptGhost, answerHere } from "../../src/inline-ai.js";
import type { ThinkingProvider } from "../../src/ai.js";

/**
 * AN ASK ABOUT A LIST (Roadmap f-menu-type-anything). "Mark all the tasks in
 * this list done" comes back as one act over every record the list shows,
 * each previewed, accepted as one batch and taken back with one undo. And
 * where no act can do it because the app lacks a field, a link or a kind,
 * the answer says what is missing plainly, the traits that would bring it,
 * and whom the words name — the face composes the plan from it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), status: z.enum(["todo", "done"]).optional() }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const setStatus = defineMutation("set-status", {
  title: "Set the status",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["task"]), status: z.enum(["todo", "done"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: args.status });
  },
});
const make = () =>
  new Store({
    schema,
    mutations: [setStatus],
    snapshot: { nodes: ["t-1", "t-2", "t-3"].map((id, at) => ({ id, kind: "task", label: `Task ${at + 1}` })) as never, edges: [] },
  });
const me: Principal = { kind: "human", id: "u-mo" };
const answering = (reply: object) => {
  const told: { members?: { id: string }[]; member_acts?: { name: string; asks: string[] }[] }[] = [];
  const thinking: ThinkingProvider = { model: "fake-thinking", think: async ({ prompt }) => (told.push(JSON.parse(prompt)), { text: JSON.stringify(reply) }) };
  return { thinking, told };
};

describe("an ask about a list", () => {
  it("acts on every record the list shows as one change, previewed whole, with one undo", async () => {
    const store = make();
    const { thinking, told } = answering({ answer: "Marking them done.", each: { act: "set-status", args: { status: "done" } } });
    const result = await answerHere({ thinking }, { store, target: { on: "list", kind: "task" }, principal: me, said: "mark these done", members: ["t-1", "t-3"] });
    expect(told[0]!.members!.map((one) => one.id)).toEqual(["t-1", "t-3"]);
    expect(told[0]!.member_acts).toContainEqual({ name: "set-status", title: "Set the status", asks: ["status"] });
    expect(result.ghost?.proposals.map((one) => one.id)).toEqual(["each:set-status:t-1", "each:set-status:t-3"]);
    // Proposed, not made; accepted as one batch; one undo takes both back.
    expect(store.graph.getNode("t-1")).not.toHaveProperty("status");
    const kept = acceptGhost(store, result.ghost!, { author: me });
    expect(kept.ok).toBe(true);
    expect(["t-1", "t-2", "t-3"].map((id) => store.graph.getNode(id)?.["status"])).toEqual(["done", undefined, "done"]);
    store.undo((kept as { batch: string }).batch, { author: me });
    expect(["t-1", "t-3"].map((id) => store.graph.getNode(id)?.["status"])).toEqual([undefined, undefined]);
  });

  it("says what the app lacks, the need named — a link, by what it is called and what it points to — and whom the words name, where no act can do it", async () => {
    const { thinking } = answering({ answer: "", lacks: "Tasks have no one to assign them to.", need: { link: { on: "task", called: "assigned to", to: "person" } }, who: "Nick" });
    const result = await answerHere({ thinking }, { store: make(), target: { on: "list", kind: "task" }, principal: me, said: "assign these to nick", members: ["t-1"] });
    expect(result.missing).toEqual({ said: "Tasks have no one to assign them to.", need: { link: { on: "task", called: "assigned to", to: "person" } }, who: "Nick" });
    expect(result.answer).toBe("Tasks have no one to assign them to.");
    expect(result.interaction.outcome).toBe("offered");
  });
});
