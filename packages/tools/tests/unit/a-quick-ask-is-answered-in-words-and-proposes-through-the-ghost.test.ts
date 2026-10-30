import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { attachFriction, bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { acceptGhost, answerHere, answerOf, stubFast, stubThinking } from "../../src/inline-ai.js";
import { inlineAiOn, type AnswerProvider, type HostAi } from "../../src/ai.js";

/**
 * THE QUICK ASK (Roadmap f-quick-ask-framework): words asked about a target
 * are answered in a few sentences, with the catalog's candidates that act on
 * the answer. A change among them is a ghost, never made until accepted; a
 * follow-up carries the ask before it and nothing older; the host's Answer
 * slot answers in place of the Thinking slot; with AI off nothing answers.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]).optional() }),
  plural: "Tasks",
});
const schema = createSchema([task]);
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
const make = () => new Store({ schema, mutations: [setStatus], snapshot: { nodes: [{ id: "t-1", kind: "task", label: "Book the van" }], edges: [] } });
const me: Principal = { kind: "human", id: "u-mo" };
const target = { on: "record", id: "t-1" } as const;

describe("a quick ask", () => {
  it("asked a question, answers in words and offers its changes beside it as suggestions — never a ghost", async () => {
    const result = await answerHere({ thinking: stubThinking() }, { store: make(), target, principal: me, said: "What is left here?", interaction: "ai-q" });
    expect(result.answer).toBe("About Book the van: an answer to “What is left here?”, as drafted.");
    expect(result.ghost).toBeUndefined();
    expect(result.offers.some((offer) => offer.type === "act")).toBe(true);
  });

  it("is answered in words by the Thinking slot, its picked changes a ghost the store has not made", async () => {
    const store = make();
    const result = await answerHere({ thinking: stubThinking() }, { store, target, principal: me, said: "Do what is left here", interaction: "ai-q" });
    // Told to do something, the changes it picked are said as they will happen, in the app's words, not the model's.
    expect(result.answer).toMatch(/“Book the van”/);
    expect(result.answer).not.toMatch(/as drafted/);
    expect(result.interaction).toMatchObject({ id: "ai-q", ask: { kind: "ask", said: "Do what is left here" }, outcome: "offered", answer: result.answer });
    expect(result.interaction.usage?.[0]).toMatchObject({ tier: "thinking", model: "stub-thinking" });
    expect(result.ghost?.proposals.length).toBeGreaterThan(0);
    // Proposed, not made.
    expect(store.graph.getNode("t-1")).not.toHaveProperty("status");
    const kept = acceptGhost(store, result.ghost!, { author: me, ids: [result.ghost!.proposals[0]!.id] });
    expect(kept.ok).toBe(true);
    expect(store.log.all().at(-1)?.lineage).toMatchObject({ interaction: "ai-q", basis: "Asked “Do what is left here”" });
  });

  it("is the host's Answer slot's when given: handed the words, the follow-up's one step back and the catalog, an unknown id dropped", async () => {
    const answer = vi.fn<AnswerProvider["answer"]>(async (request) => ({ text: `Asked about ${request.targetLabel}.`, pick: ["no-such-candidate", request.catalog.candidates[0]!.id], usage: { inputTokens: 10, outputTokens: 4 } }));
    const meter = vi.fn();
    const ai: HostAi = { answer: { model: "host-answer", answer }, thinking: stubThinking(), meter };
    expect(answerOf(ai)?.model).toBe("host-answer");
    const result = await answerHere(ai, { store: make(), target, principal: me, said: "and then?", follows: { said: "What is left?", answer: "One task." } });
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer.mock.calls[0]![0]).toMatchObject({ said: "and then?", targetLabel: "Book the van", follows: { said: "What is left?", answer: "One task." } });
    expect(result.answer).toBe("Asked about Book the van.");
    expect(result.interaction.offered).toHaveLength(1);
    expect(meter).toHaveBeenCalledWith(expect.objectContaining({ tier: "thinking", model: "host-answer", inputTokens: 10 }));
  });

  it("is the Fast slot's pick among the candidates when there is no Thinking one", async () => {
    const result = await answerHere({ fast: stubFast({ prefer: [/Status: done/] }) }, { store: make(), target, principal: me, said: "mark it done" });
    expect(result.answer).toMatch(/^Set the status of “Book the van” to “done”\./);
    expect(result.ghost?.proposals[0]?.id).toBe("fill:t-1:status:done");
  });

  it("is not answered with AI off or no model, and the quick ask is not drawn", async () => {
    const off: HostAi = { off: true, answer: { model: "x", answer: async () => ({ text: "no" }) } };
    expect(inlineAiOn(off)).toBe(false);
    expect(answerOf(off)).toBeUndefined();
    expect(inlineAiOn({ answer: { model: "x", answer: async () => ({ text: "yes" }) } })).toBe(true);
    const none = await answerHere({}, { store: make(), target, principal: me, said: "anything" });
    expect(none.interaction).toMatchObject({ outcome: "failed", failed: "AI isn't on here." });
  });

  it("records a question the seat had no answer to as what somebody could not find out, and not one AI was off for", async () => {
    const store = make();
    const heard: unknown[] = [];
    attachFriction(store, (draft, by) => heard.push([draft, by]));
    const empty: HostAi = { answer: { model: "host-answer", answer: async () => ({ text: "", pick: [] }) } };
    await answerHere(empty, { store, target: { on: "place", place: "home" }, principal: me, said: "Who is free on Friday?" });
    await answerHere({}, { store, target, principal: me, said: "anything" });
    expect(heard).toEqual([[{ type: "unanswered", question: "Who is free on Friday?", place: "home" }, me]]);
  });
});
