import { describe, expect, it } from "vitest";
import { z } from "zod";
import { attachFriction, createSchema, defineNode, Store, type Principal } from "@graview/core";
import { answerHere } from "../../src/inline-ai.js";
import type { HostAi, ThinkingProvider, ThinkingRequest } from "../../src/ai.js";

/**
 * A QUICK ASK THAT FINDS NOTHING SAYS WHAT THE APP LACKS (Roadmap
 * f-quick-ask-friction-hint). With Jev in the Fast slot and the light and
 * full models behind it (0.1.65), a quick ask's open answer goes through the
 * framework's own prompts, which a host cannot add to; Graview Cloud used to
 * add a hint that a question nothing in the app answers is said as what the
 * app lacks, and kept in its friction log. `HostAi.couldNotFind` is that
 * hint, worded by the framework: the model is asked to say what the app does
 * not keep, the card says it, and the friction log learns it — the
 * question, with what the app lacks — and so does the host's callback.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const make = () => new Store({ schema, snapshot: { nodes: [{ id: "t-1", kind: "task", label: "Book the van" }], edges: [] } });
const me: Principal = { kind: "human", id: "u-mo" };
const target = { on: "record", id: "t-1" } as const;
const ASK = "How much is the budget for this?";

/** A model that says what the app lacks only when it is asked to, and else that it found nothing. */
function thinkingThatLacks(asked: ThinkingRequest[]): ThinkingProvider {
  return {
    model: "stub-light",
    async think(request) {
      asked.push(request);
      const prompt = JSON.parse(request.prompt) as { not_found?: string };
      return { text: JSON.stringify(prompt.not_found ? { lacks: "This app keeps no budgets.", need: { field: { on: "task", called: "budget", type: "number" } } } : { answer: "I could not find a budget for Book the van." }) };
    },
  };
}

describe("a quick ask that finds nothing", () => {
  it("with couldNotFind, asks the model what the app lacks, says it, and records it in the friction log and to the host", async () => {
    const store = make();
    const heard: unknown[] = [];
    attachFriction(store, (draft) => heard.push(draft));
    const asked: ThinkingRequest[] = [];
    const told: unknown[] = [];
    const ai: HostAi = { thinking: thinkingThatLacks(asked), couldNotFind: (missed) => told.push(missed) };
    const result = await answerHere(ai, { store, target, principal: me, said: ASK });
    expect(JSON.parse(asked[0]!.prompt).not_found).toMatch(/lacks/);
    expect(result.answer).toBe("This app keeps no budgets.");
    expect(heard).toEqual([{ type: "unanswered", question: ASK, lacks: "This app keeps no budgets." }]);
    expect(told).toEqual([{ said: ASK, lacks: "This app keeps no budgets.", need: { field: { on: "task", called: "budget", type: "number" } } }]);
  });

  it("with couldNotFind true, does the same with no callback", async () => {
    const store = make();
    const heard: unknown[] = [];
    attachFriction(store, (draft) => heard.push(draft));
    const result = await answerHere({ thinking: thinkingThatLacks([]), couldNotFind: true }, { store, target, principal: me, said: ASK });
    expect(result.answer).toBe("This app keeps no budgets.");
    expect(heard).toHaveLength(1);
  });

  it("without it, asks as it did and records nothing for an answer in words", async () => {
    const store = make();
    const heard: unknown[] = [];
    attachFriction(store, (draft) => heard.push(draft));
    const asked: ThinkingRequest[] = [];
    const result = await answerHere({ thinking: thinkingThatLacks(asked) }, { store, target, principal: me, said: ASK });
    expect(JSON.parse(asked[0]!.prompt)).not.toHaveProperty("not_found");
    expect(result.answer).toBe("I could not find a budget for Book the van.");
    expect(heard).toEqual([]);
  });
});
