import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { replyFromLoop, runLoop, type Answer, type Decide, type ToolCall } from "../../src/index.js";

/**
 * A LOOP: ACT, RE-JUDGE, ACT AGAIN, AND KNOW WHEN TO STOP.
 *
 * It reads the standing, asks which of the closed set of repairs to take,
 * applies it as the declared act under one batch, re-judges, and goes
 * again — and it stops for a reason it can say: nothing left, not sure
 * enough, a state seen before, a budget spent. Every visit is announced
 * on the seat's own path, and the stop sentence is too.
 */
const zone = defineNode("zone", {
  fields: z.object({ label: z.string(), surface: z.enum(["turf", "bed", "hard"]).optional(), tidy: z.boolean().optional() }),
  plural: "Zones",
});
const schema = createSchema([zone]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const setSurface = defineMutation("set-surface", {
  title: "Say what the surface is",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), surface: z.enum(["turf", "bed", "hard"]) }),
  apply: (ctx, args) => ctx.patchNode(args.zoneId, { surface: args.surface }),
});
const tidyUp = defineMutation("tidy-up", {
  title: "Tidy it",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]) }),
  apply: (ctx, args) => ctx.patchNode(args.zoneId, { tidy: true }),
});
const flip = defineMutation("flip", {
  title: "Flip the surface",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]) }),
  apply: (ctx, args) => {
    const node = ctx.graph.getNode(args.zoneId) as { surface?: string } | undefined;
    ctx.patchNode(args.zoneId, { surface: node?.surface === "turf" ? "bed" : "turf" });
  },
});
const surfaced = defineInvariant("surfaced", {
  scope: { kind: "zone" },
  description: "Every zone says what its surface is.",
  repairs: ["set-surface"],
  evaluate: ({ subject }) =>
    subject.surface
      ? []
      : [
          {
            invariant: "surfaced",
            subjectId: subject.id,
            label: "No surface",
            message: `${subject.label} does not say what its surface is.`,
            nodeIds: [subject.id],
            repairs: [
              { mutation: "set-surface", args: { zoneId: subject.id, surface: "turf" }, label: "Call it turf" },
              { mutation: "set-surface", args: { zoneId: subject.id, surface: "bed" }, label: "Call it a bed" },
            ],
          },
        ],
});
const tidy = defineInvariant("tidy", {
  scope: { kind: "zone" },
  description: "Every zone is tidy.",
  repairs: ["tidy-up"],
  evaluate: ({ subject }) =>
    subject.tidy
      ? []
      : [{ invariant: "tidy", subjectId: subject.id, label: "Untidy", message: `${subject.label} is untidy.`, nodeIds: [subject.id], repairs: [{ mutation: "tidy-up", args: { zoneId: subject.id }, label: "Tidy it" }] }],
});
/* A rule whose only repair goes in a circle: never satisfied, always repairable. */
const restless = defineInvariant("restless", {
  scope: { kind: "zone" },
  description: "The surface is never right.",
  repairs: ["flip"],
  evaluate: ({ subject }) => [
    { invariant: "restless", subjectId: subject.id, label: "Wrong", message: `${subject.label} is wrong either way.`, nodeIds: [subject.id], repairs: [{ mutation: "flip", args: { zoneId: subject.id }, label: "Flip it" }] },
  ],
});
/* A rule that names a repair with an argument nobody settled. */
const stuck = defineInvariant("stuck", {
  scope: { kind: "zone" },
  description: "Needs a word.",
  repairs: ["set-surface"],
  evaluate: ({ subject }) => [
    { invariant: "stuck", subjectId: subject.id, label: "Stuck", message: `${subject.label} needs deciding.`, nodeIds: [subject.id], repairs: [{ mutation: "set-surface", missing: ["surface"], label: "Say what it is" }] },
  ],
});

const mutations = [setSurface, tidyUp, flip];
const app = defineApp({ name: "grounds", schema, mutations, invariants: [surfaced, tidy] });
const store = (invariants = [surfaced, tidy], policy?: Parameters<typeof defineApp>[0]["policy"]) =>
  new Store({
    schema,
    mutations,
    invariants,
    ...(policy ? { policy } : {}),
    snapshot: { nodes: [{ id: "lawn", kind: "zone", label: "Back Lawn" }, { id: "border", kind: "zone", label: "Long Border", surface: "bed" }] as never, edges: [] },
  });

const choosing = (by: (options: readonly string[]) => Answer) => {
  const asked: string[] = [];
  const decide: Decide = async (_state, questions) => {
    const answers: Record<string, Answer> = {};
    for (const [key, question] of Object.entries(questions)) {
      asked.push(key);
      answers[key] = by(question.type === "choice" ? Object.keys(question.criteria) : []);
    }
    return { answers, usage: { inputTokens: 50, outputTokens: 0 } };
  };
  return { asked, decide };
};
const sure = (options: readonly string[]): Answer => ({ type: "choice", choice: options[0]!, confidence: 0.95, probabilities: Object.fromEntries(options.map((o, i) => [o, i === 0 ? 0.95 : 0.05 / (options.length - 1)])) });

describe("a loop repairs until nothing is left", () => {
  it("asks a Choice over the closed set for a violation with several repairs, takes the only repair otherwise, and stops when nothing is wrong", async () => {
    const at = store();
    const { asked, decide } = choosing(sure);
    const seen: ToolCall[] = [];
    const result = await runLoop(at, { name: "keep" }, { decide, app, onCall: (call) => seen.push(call) });
    expect(result.stopped.why).toBe("nothing-left");
    expect(result.stopped.said).toBe("Nothing left to repair: 3 repairs made.");
    /* Only the surface had a choice to make; tidying is the rule's own single answer. */
    expect(asked).toEqual(["repair:surfaced:lawn"]);
    expect(result.turns.map((turn) => [turn.violation.invariant, turn.call.mutation, turn.before, turn.after])).toEqual([
      ["surfaced", "set-surface", 3, 2],
      ["tidy", "tidy-up", 2, 1],
      ["tidy", "tidy-up", 1, 0],
    ]);
    expect(at.violations()).toEqual([]);
    /* Every visit was announced as a read at the violation's node, and the stop was said on the same path. */
    expect(seen.filter((call) => call.name === "repair" && call.phase === "ok").map((call) => [call.args["node"], call.args["about"], call.reads])).toEqual([
      ["lawn", "Back Lawn", ["lawn"]],
      ["lawn", "Back Lawn", ["lawn"]],
      ["border", "Long Border", ["border"]],
    ]);
    expect(seen.at(-1)).toMatchObject({ name: "stop", args: { why: "nothing-left", said: "Nothing left to repair: 3 repairs made." } });
  });

  it("is one batch under its own seat, and one undo takes every turn back", async () => {
    const at = store();
    const result = await runLoop(at, { name: "keep" }, { decide: choosing(sure).decide, app });
    expect(result.author).toMatchObject({ kind: "agent", id: "keep" });
    expect(result.author.session).toMatch(/^loop-/);
    expect(at.batches().map((batch) => batch.id)).toEqual([result.batch]);
    expect(at.log.all().every((op) => op.author.session === result.author.session)).toBe(true);
    at.undo(result.batch);
    expect(at.graph.getNode("lawn")!["surface"]).toBeUndefined();
    expect(at.violations()).toHaveLength(3);
  });

  it("says there was nothing to do when nothing was wrong", async () => {
    const at = store([]);
    const result = await runLoop(at, { name: "keep" }, { decide: choosing(sure).decide, app });
    expect(result.stopped).toEqual({ why: "nothing-left", said: "Nothing is wrong, so there was nothing to repair." });
  });
});

describe("a loop stops for a reason it can say", () => {
  it("stops and asks when it is not sure which repair, handing the question to a person at its node", async () => {
    const at = store();
    const split = (options: readonly string[]): Answer => ({ type: "choice", choice: options[0]!, confidence: 0.4, probabilities: Object.fromEntries(options.map((o, i) => [o, i === 0 ? 0.5 : 0.5 / (options.length - 1)])) });
    const result = await runLoop(at, { name: "keep" }, { decide: choosing(split).decide, app });
    expect(result.stopped.why).toBe("unsure");
    expect(result.stopped.said).toBe("Stopped at Back Lawn: it could be more than one repair, so I am asking rather than acting. 0 repairs made, 3 still standing.");
    expect(result.stopped.question).toMatchObject({ nodeId: "lawn", nodeLabel: "Back Lawn", because: "split" });
    expect(result.stopped.question!.options.map((o) => [o.value, o.call?.args["surface"]])).toEqual([
      ["set-surface", "turf"],
      ["set-surface:2", "bed"],
    ]);
    expect(at.log.all()).toEqual([]);
    const reply = replyFromLoop(result);
    expect(reply.say).toBe(result.stopped.said);
    expect(reply.questions).toHaveLength(1);
  });

  it("stops when a repair puts the graph into a state it has already been in", async () => {
    const at = store([restless]);
    const result = await runLoop(at, { name: "keep" }, { decide: choosing(sure).decide, app });
    expect(result.stopped.why).toBe("seen-before");
    expect(result.stopped.said).toContain("a state it has already been in");
    /* undefined → turf → bed → turf: the third flip lands where the first did. */
    expect(result.turns).toHaveLength(3);
  });

  it("stops at its budget of turns, saying what is still standing", async () => {
    const at = store([restless]);
    const result = await runLoop(at, { name: "keep", budget: { turns: 1 } }, { decide: choosing(sure).decide, app });
    expect(result.stopped.why).toBe("budget");
    expect(result.stopped.said).toBe("Stopped at the budget of 1 turn: 1 repair made, 2 still standing.");
  });

  it("stops when what is wrong names no repair it could take without being told more", async () => {
    const at = store([stuck]);
    const result = await runLoop(at, { name: "keep" }, { decide: choosing(sure).decide, app });
    expect(result.stopped.why).toBe("no-repair");
    expect(result.stopped.said).toContain("none of them names a repair I could take");
  });

  it("stops when the policy refuses the seat, in the policy's words", async () => {
    const at = store([surfaced, tidy], { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] } as never);
    const seen: ToolCall[] = [];
    const result = await runLoop(at, { name: "keep" }, { decide: choosing(sure).decide, app, onCall: (call) => seen.push(call) });
    expect(result.stopped.why).toBe("refused");
    expect(result.stopped.said).toMatch(/^Stopped at Back Lawn: /);
    expect(seen.some((call) => call.name === "repair" && call.phase === "failed")).toBe(true);
    expect(at.log.all()).toEqual([]);
  });

  it("stops when the provider fails, and says whose failure it was", async () => {
    const at = store();
    const failing: Decide = async () => {
      throw new Error("The decision provider refused the key. That is a seat problem — check TYPESAFE_API_KEY — not the model's.");
    };
    const result = await runLoop(at, { name: "keep" }, { decide: failing, app });
    expect(result.stopped.why).toBe("failed");
    expect(result.stopped.said).toContain("seat problem");
  });
});
