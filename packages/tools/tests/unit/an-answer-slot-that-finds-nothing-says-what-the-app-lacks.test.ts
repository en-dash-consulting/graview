import { describe, expect, it } from "vitest";
import { z } from "zod";
import { attachFriction, createSchema, defineNode, Store, type Principal } from "@graview/core";
import { answerHere } from "../../src/inline-ai.js";
import type { AnswerProvider, AnswerRequest } from "../../src/ai.js";

/**
 * AN ANSWER SLOT THAT FINDS NOTHING SAYS WHAT THE APP LACKS (Roadmap
 * f-answer-slot-could-not-find). `HostAi.couldNotFind` reached only the
 * Thinking slot; a host answering the quick ask itself (`HostAi.answer`) was
 * never told, and could not say back, what the app does not keep. Now the
 * request carries the framework's own instruction (`couldNotFind`), and a
 * reply's `lacks` is said on the card, kept in the friction log and told to
 * the host as the Thinking path's is.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const make = () => new Store({ schema, snapshot: { nodes: [{ id: "t-1", kind: "task", label: "Book the van" }], edges: [] } });
const me: Principal = { kind: "human", id: "u-mo" };
const target = { on: "record", id: "t-1" } as const;
const ASK = "How much is the budget for this?";

/** A host's answer that says what the app lacks only when it is told how, and else that it found nothing. */
function answerThatLacks(asked: AnswerRequest[]): AnswerProvider {
  return {
    model: "host-answer",
    async answer(request) {
      asked.push(request);
      return request.couldNotFind ? { text: "", lacks: "This app keeps no budgets.", need: { field: { on: "task", called: "budget", type: "number" } } } : { text: "I could not find a budget for Book the van." };
    },
  };
}

describe("an answer slot that finds nothing", () => {
  it("with couldNotFind, is told how to say what the app lacks, and its lacks is said, recorded as friction and told to the host", async () => {
    const store = make();
    const heard: unknown[] = [];
    attachFriction(store, (draft) => heard.push(draft));
    const asked: AnswerRequest[] = [];
    const told: unknown[] = [];
    const result = await answerHere({ answer: answerThatLacks(asked), couldNotFind: (missed) => told.push(missed) }, { store, target, principal: me, said: ASK });
    expect(asked[0]!.couldNotFind).toMatch(/lacks/);
    expect(result.answer).toBe("This app keeps no budgets.");
    expect(heard).toEqual([{ type: "unanswered", question: ASK, lacks: "This app keeps no budgets." }]);
    expect(told).toEqual([{ said: ASK, lacks: "This app keeps no budgets.", need: { field: { on: "task", called: "budget", type: "number" } } }]);
  });

  it("without couldNotFind, is asked as it was and records nothing", async () => {
    const store = make();
    const heard: unknown[] = [];
    attachFriction(store, (draft) => heard.push(draft));
    const asked: AnswerRequest[] = [];
    const result = await answerHere({ answer: answerThatLacks(asked) }, { store, target, principal: me, said: ASK });
    expect(asked[0]).not.toHaveProperty("couldNotFind");
    expect(result.answer).toBe("I could not find a budget for Book the van.");
    expect(heard).toEqual([]);
  });
});
