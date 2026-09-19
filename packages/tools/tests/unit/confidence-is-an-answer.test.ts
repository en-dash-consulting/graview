import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { offerOf, replyFromRun, runFrom, type Answer, type Decide } from "../../src/index.js";

/**
 * CONFIDENCE IS A FIRST-CLASS ANSWER, NOT A NUMBER IN A LOG.
 *
 * Every answer reaches a surface with its confidence. A split distribution
 * — "turf 0.5, bed 0.45" — is a question for a person, not an answer with
 * a low number beside it, and is offered at the node it is about with its
 * options as presses; a confident one is still a plan before it is a
 * change; and all of it travels the seat's own reply.
 */
const zone = defineNode("zone", {
  fields: z.object({ label: z.string(), surface: z.enum(["turf", "bed", "hard"]).optional(), shaded: z.boolean().optional() }),
  plural: "Zones",
});
const schema = createSchema([zone]);
const { defineMutation } = bindSchema(schema);
const setSurface = defineMutation("set-surface", {
  title: "Say what the surface is",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), surface: z.enum(["turf", "bed", "hard"]) }),
  apply: (ctx, args) => ctx.patchNode(args.zoneId, { surface: args.surface }),
});
const setShaded = defineMutation("set-shaded", {
  title: "Say whether it is shaded",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), shaded: z.boolean() }),
  apply: (ctx, args) => ctx.patchNode(args.zoneId, { shaded: args.shaded }),
});
const store = () =>
  new Store({
    schema,
    mutations: [setSurface, setShaded],
    snapshot: {
      nodes: [
        { id: "lawn", kind: "zone", label: "Back Lawn" },
        { id: "border", kind: "zone", label: "Long Border" },
      ] as never,
      edges: [],
    },
  });

const answering =
  (by: (key: string) => Answer): Decide =>
  async (_state, questions) => ({
    answers: Object.fromEntries(Object.keys(questions).map((key) => [key, by(key)])),
    usage: { inputTokens: 0, outputTokens: 0 },
  });

describe("what is an answer and what is a question", () => {
  it("reads a split as a question, a shrug as a question, and the rest as an answer", () => {
    expect(offerOf({ type: "choice", choice: "turf", confidence: 0.4, probabilities: { turf: 0.5, bed: 0.45, hard: 0.05 } })).toBe("split");
    expect(offerOf({ type: "choice", choice: "turf", confidence: 0.3, probabilities: { turf: 0.4, bed: 0.2, hard: 0.4 } })).toBe("split");
    expect(offerOf({ type: "choice", choice: "turf", confidence: 0.45, probabilities: { turf: 0.6, bed: 0.3, hard: 0.1 } })).toBe("unsure");
    expect(offerOf({ type: "choice", choice: "turf", confidence: 0.9, probabilities: { turf: 0.9, bed: 0.05, hard: 0.05 } })).toBeUndefined();
    expect(offerOf({ type: "noul", noul: 0.55 })).toBe("split");
    expect(offerOf({ type: "noul", noul: 0.7 })).toBe("unsure");
    expect(offerOf({ type: "noul", noul: 0.95 })).toBeUndefined();
    expect(offerOf({ type: "noul", noul: 0.7 }, { floor: 0.3 })).toBeUndefined();
  });
});

describe("a run that was not sure", () => {
  it("offers a split at the node it is about, each option carrying the call it would be, and does not propose it", async () => {
    const decide = answering((key) =>
      key.endsWith(".surface")
        ? { type: "choice", choice: "turf", confidence: 0.4, probabilities: { turf: 0.5, bed: 0.45, hard: 0.05 } }
        : { type: "noul", noul: 0.95 },
    );
    const result = await runFrom(store(), { name: "fill", steps: [{ fill: "zone" }] }, { decide });
    const [step] = result.steps;
    /* The confident truth is proposed; the split choice is asked. */
    expect(step!.proposals.map((call) => [call.mutation, call.args["zoneId"], call.confidence])).toEqual([
      ["set-shaded", "lawn", 0.9],
      ["set-shaded", "border", 0.9],
    ]);
    expect(step!.questions).toHaveLength(2);
    const asked = step!.questions[0]!;
    expect(asked).toMatchObject({ id: "field:zone.surface", nodeId: "lawn", nodeLabel: "Back Lawn", because: "split", confidence: 0.4 });
    expect(asked.options.map((option) => [option.value, option.probability])).toEqual([
      ["turf", 0.5],
      ["bed", 0.45],
      ["hard", 0.05],
    ]);
    expect(asked.options[1]!.call).toEqual({
      mutation: "set-surface",
      args: { zoneId: "lawn", surface: "bed" },
      why: "surface of Back Lawn: bed",
      confidence: 0.45,
    });
    /* And the answer itself is kept, with its whole distribution. */
    const answered = step!.answered.find((a) => a.question.id === "field:zone.surface" && a.nodeId === "lawn")!;
    expect(answered.answer).toMatchObject({ probabilities: { turf: 0.5, bed: 0.45 } });
    expect(answered.offered).toBe(asked);
  });

  it("offers a truth that came back near even as yes or nothing", async () => {
    const decide = answering(() => ({ type: "noul", noul: 0.52 }));
    const result = await runFrom(store(), { name: "fill", steps: [{ fill: "zone", fields: ["shaded"] }] }, { decide });
    const [asked] = result.questions;
    expect(asked).toMatchObject({ nodeLabel: "Back Lawn", because: "split" });
    expect(asked!.options.map((option) => [option.value, option.call?.args["shaded"]])).toEqual([
      ["yes", true],
      ["no", false],
    ]);
  });

  it("speaks the run as the seat's own reply: proposals for the sure, questions for the rest", async () => {
    const decide = answering((key) =>
      key.endsWith(".surface")
        ? { type: "choice", choice: "turf", confidence: 0.4, probabilities: { turf: 0.5, bed: 0.45, hard: 0.05 } }
        : { type: "noul", noul: 0.95 },
    );
    const reply = replyFromRun(await runFrom(store(), { name: "fill", steps: [{ fill: "zone" }] }, { decide }));
    expect(reply.say).toBe("Asked 4 questions over 1 step. 2 changes proposed. 2 questions for you.");
    expect(reply.proposals).toHaveLength(2);
    expect(reply.proposals.every((call) => (call as { confidence?: number }).confidence === 0.9)).toBe(true);
    expect(reply.questions?.map((q) => q.nodeLabel)).toEqual(["Back Lawn", "Long Border"]);
    const refused = replyFromRun(await runFrom(store(), { name: "fill", steps: [{ fill: "zone" }], budget: { questions: 1 } }, { decide }));
    expect(refused.say).toContain("did not begin");
    expect(refused.proposals).toEqual([]);
  });
});
