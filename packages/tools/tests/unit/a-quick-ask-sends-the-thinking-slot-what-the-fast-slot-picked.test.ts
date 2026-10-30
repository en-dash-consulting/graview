import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { answerHere } from "../../src/inline-ai.js";
import type { FastProvider, HostAi, ThinkingProvider } from "../../src/ai.js";
import type { Answer, Decide } from "../../src/fast.js";

/**
 * FREE WORDS TAKE TWO STEPS (Roadmap f-menu-type-anything). Where a Fast
 * slot is given, it first picks which of the catalog's candidates (a Choice,
 * "none of these" among them) and which records around the target (a Noul
 * each) matter to the words; only those reach the
 * Thinking slot, which may pick only among them; and the entry says what was
 * sent and who chose it. With no Fast slot, the default the target is
 * scoped to is sent, and said so.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]).optional() }),
  edges: { "blocked-by": { to: ["task"], cardinality: "many" } },
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
const make = () =>
  new Store({
    schema,
    mutations: [setStatus],
    snapshot: {
      nodes: [
        { id: "t-1", kind: "task", label: "Book the van" },
        { id: "t-2", kind: "task", label: "Pack the boxes" },
        { id: "t-3", kind: "task", label: "Hire a driver" },
      ],
      edges: [
        { id: "e-1", kind: "blocked-by", from: "t-1", to: "t-2" },
        { id: "e-2", kind: "blocked-by", from: "t-1", to: "t-3" },
      ],
    } as never,
  });
const me: Principal = { kind: "human", id: "u-mo" };
const target = { on: "record", id: "t-1" } as const;

/** A Fast slot that picks, in each choice, the option whose words match — sure of it, and of nothing else. */
const picking = (wanted: RegExp): FastProvider => ({
  model: "fake-fast",
  decide: vi.fn<Decide>(async (_state, questions) => {
    const answers: Record<string, Answer> = {};
    for (const [key, question] of Object.entries(questions)) {
      if (question.type === "noul") {
        answers[key] = { type: "noul", noul: wanted.test(question.instructions) ? 0.9 : 0.05 };
        continue;
      }
      if (question.type !== "choice") continue;
      const names = Object.keys(question.criteria);
      // No act here is sure to do it: the Thinking slot is asked.
      const choice = key === "act" ? "none" : (names.find((name) => wanted.test(question.criteria[name] ?? "")) ?? names[0]!);
      answers[key] = { type: "choice", choice, confidence: 0.9, probabilities: Object.fromEntries(names.map((name) => [name, name === choice ? 0.9 : 0.01])) };
    }
    return { answers, usage: { inputTokens: 20, outputTokens: 1 } };
  }),
});
/** A Thinking slot that keeps what it was told and picks every candidate it was offered. */
const telling = () => {
  const told: { candidates: { id: string }[]; state: { neighbors: { id: string }[] } }[] = [];
  const thinking: ThinkingProvider = {
    model: "fake-thinking",
    think: async ({ prompt }) => {
      const read = JSON.parse(prompt) as (typeof told)[number];
      told.push(read);
      return { text: JSON.stringify({ answer: "Mark it doing.", pick: read.candidates.map((one) => one.id) }) };
    },
  };
  return { thinking, told };
};

describe("a quick ask with a Fast slot", () => {
  it("sends the Thinking slot only the candidates and records the Fast slot picked, and says so in its entry", async () => {
    const { thinking, told } = telling();
    const fast = picking(/doing|Pack the boxes/);
    const ai: HostAi = { fast, thinking };
    const result = await answerHere(ai, { store: make(), target, principal: me, said: "start it once the boxes are packed" });
    // One typed call over the graph (not sure of an act here), then the context the Thinking slot is told.
    expect(fast.decide).toHaveBeenCalledTimes(2);
    expect(told).toHaveLength(1);
    const sent = result.interaction.context!;
    expect(sent).toMatchObject({ by: "fast", model: "fake-fast" });
    // What the Thinking slot was told is exactly what the Fast slot picked.
    expect(told[0]!.candidates.map((one) => one.id)).toEqual(sent.candidates);
    expect(sent.candidates).toHaveLength(1);
    expect(sent.candidates[0]).toMatch(/doing/);
    expect(told[0]!.state.neighbors.map((one) => one.id)).toEqual(["t-2"]);
    expect(sent.records).toEqual(["t-2"]);
    // The usage says both steps, Fast first.
    expect(result.interaction.usage?.map((one) => `${one.tier}:${one.model}`)).toEqual(["fast:fake-fast", "fast:fake-fast", "thinking:fake-thinking"]);
    // It may pick only among what it was told.
    expect(result.ghost?.proposals.map((one) => one.id)).toEqual(sent.candidates);
  });

  it("sends the default the target is scoped to where there is no Fast slot, and says that", async () => {
    const { thinking, told } = telling();
    const result = await answerHere({ thinking }, { store: make(), target, principal: me, said: "what is left?" });
    const sent = result.interaction.context!;
    expect(sent.by).toBe("default");
    expect(told[0]!.candidates.map((one) => one.id)).toEqual(sent.candidates);
    expect(sent.candidates.length).toBeGreaterThan(1);
    expect([...sent.records].sort()).toEqual(["t-2", "t-3"]);
  });
});
