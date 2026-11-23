import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { attachFriction, bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { answerHere, fillHere, suggestHere } from "../../src/inline-ai.js";
import { FAST_ONLY_PICKED, FAST_ONLY_SAID, PICK_FLOOR, pickFloorOf, type FastProvider, type HostAi } from "../../src/ai.js";
import type { Answer } from "../../src/fast.js";

/**
 * JEV'S QUICK AI, POLISHED (Roadmap f-jev-fast-polish). With the Thinking
 * slot off, the Fast slot is the only AI most people meet, so it says only
 * what it is sure of: a pick or a fill under the floor is not shown; and a
 * question in words it cannot answer is said to be beyond it, with Find
 * offered for the words — never "These fit", nor that the AI had no answer.
 * (The menu's Suggested rows skip the call for three or fewer: held by the
 * primitives' own test.)
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]).optional(), size: z.enum(["small", "large"]).optional() }),
  plural: "Tasks",
});
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([task, note]);
const { defineMutation } = bindSchema(schema);
const setStatus = defineMutation("set-status", {
  title: "Set the status",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["task"]), status: z.enum(["todo", "doing", "done"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.id, { status: args.status }),
});
const setSize = defineMutation("set-size", {
  title: "Size it",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["size"],
  input: z.object({ id: nodeRef(["task"]), size: z.enum(["small", "large"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.id, { size: args.size }),
});
const make = (mutations = [setStatus, setSize]) => new Store({ schema, mutations, snapshot: { nodes: [{ id: "t-1", kind: "task", label: "Book the van" }, { id: "n-1", kind: "note", label: "Gate code" }], edges: [] } });
const me: Principal = { kind: "human", id: "u-mo" };
const target = { on: "record", id: "t-1" } as const;

/** A Fast slot that is this sure of its first choice and spreads the rest evenly, counting its calls. */
function unsure(first: number) {
  const calls = { n: 0 };
  const fast: FastProvider = {
    model: "jev-latest",
    decide: async (_state, questions) => {
      calls.n += 1;
      const answers: Record<string, Answer> = {};
      for (const [key, question] of Object.entries(questions)) {
        if (question.type !== "choice") continue;
        const names = Object.keys(question.criteria);
        const rest = names.length > 1 ? (1 - first) / (names.length - 1) : 0;
        answers[key] = { type: "choice", choice: names[0]!, confidence: first, probabilities: Object.fromEntries(names.map((name, at) => [name, at === 0 ? first : rest])) };
      }
      return { answers, usage: { inputTokens: 10, outputTokens: 0 } };
    },
  };
  return { calls, fast };
}

describe("the Fast slot shows only what it is sure of", () => {
  it("holds a pick and a fill to a floor the host may move", () => {
    expect(PICK_FLOOR).toBeGreaterThan(0);
    expect(pickFloorOf({})).toBe(PICK_FLOOR);
    expect(pickFloorOf({ pickFloor: 0.5 })).toBe(0.5);
    expect(pickFloorOf({ pickFloor: 7 })).toBe(1);
  });

  it("does not show a suggestion under the floor, however few that leaves", async () => {
    const { fast } = unsure(0.5);
    const result = await suggestHere({ fast }, { store: make(), target, principal: me });
    // Five candidates: the first at 0.5, the other four at 0.125 each, under the floor.
    expect(result.offers).toHaveLength(1);
    expect(result.interaction.offered).toEqual([expect.objectContaining({ confidence: 0.5 })]);
    const doubtful = await suggestHere({ fast: unsure(0.15).fast }, { store: make(), target, principal: me });
    expect(doubtful.offers).toEqual([]);
    expect(doubtful.interaction.outcome).toBe("offered");
    // A host that asks for more certainty gets fewer.
    const strict = await suggestHere({ fast, pickFloor: 0.6 }, { store: make(), target, principal: me });
    expect(strict.offers).toEqual([]);
  });

  it("does not propose a fill under the floor", async () => {
    const sure = await fillHere({ fast: unsure(0.8).fast }, { store: make(), target, principal: me });
    expect(sure.ghost?.proposals.map((proposal) => proposal.field)).toEqual(["status", "size"]);
    const guess = await fillHere({ fast: unsure(0.8).fast, pickFloor: 0.9 }, { store: make(), target, principal: me });
    expect(guess.ghost).toBeUndefined();
  });
});

describe("the AI section's own suggestion", () => {
  it("is still ranked where three or fewer fit, so the hover chip has a confidence to judge by", async () => {
    // The Suggested rows skip the call for three or fewer (`useSuggested`); the AI section and the chip share this one, which ranks.
    const { calls, fast } = unsure(0.9);
    const result = await suggestHere({ fast }, { store: make(), target: { on: "list", kind: "note" }, principal: me });
    expect(calls.n).toBe(1);
    expect(result.interaction.offered[0]?.confidence).toBe(0.9);
  });

  it("still says AI is not on where there is no model at all", async () => {
    expect((await suggestHere({}, { store: make(), target: { on: "list", kind: "note" }, principal: me })).interaction).toMatchObject({ outcome: "failed" });
  });
});

describe("a quick ask the Fast slot alone cannot answer", () => {
  it("says what it can do and offers Find for the words, never “These fit”", async () => {
    const store = make();
    const heard: unknown[] = [];
    attachFriction(store, (draft) => heard.push(draft));
    const ai: HostAi = { fast: unsure(0.1).fast };
    const result = await answerHere(ai, { store, target, principal: me, said: "Why is this one late?" });
    expect(result.interaction.outcome).not.toBe("failed");
    expect(result.answer).toBe(FAST_ONLY_SAID);
    expect(result.answer).not.toMatch(/These fit|had no answer/);
    expect(result.findInstead).toBe("Why is this one late?");
    expect(result.offers).toEqual([]);
    // Kept as a question the seat could not answer.
    expect(heard).toEqual([expect.objectContaining({ type: "unanswered", question: "Why is this one late?" })]);
  });

  it("says so beside what it is sure acts on the words", async () => {
    const result = await answerHere({ fast: unsure(0.7).fast }, { store: make(), target, principal: me, said: "What is the status?" });
    expect(result.answer).toBe(FAST_ONLY_PICKED);
    expect(result.offers).toHaveLength(1);
    expect(result.findInstead).toBe("What is the status?");
  });

  it("is answered by the Thinking slot where there is one, with no Find offered", async () => {
    const think = vi.fn(async () => ({ text: JSON.stringify({ answer: "It waits on the van hire." }) }));
    const result = await answerHere({ fast: unsure(0.1).fast, thinking: { model: "t", think } }, { store: make(), target, principal: me, said: "Why is this one late?" });
    expect(result.answer).toBe("It waits on the van hire.");
    expect(result.findInstead).toBeUndefined();
  });
});
