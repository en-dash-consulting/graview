import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  describeRun,
  landRun,
  readRun,
  runFrom,
  type Answer,
  type Decide,
  type Question,
  type RunDeclaration,
  type ToolCall,
} from "../../src/index.js";

/**
 * A RUN IS A SEQUENCE OF TYPED ASKS OVER THE GRAPH, DECLARED NOT SCRIPTED.
 *
 * Steps select nodes by a rule and ask each the questions the declaration
 * already types; fan-out is the ordinary case; each step's outcome is
 * typed and can be judged before the next; the whole run lands as one
 * batch with one undo; and every visit is announced through the seat's
 * own onCall path so the picture can show where the run is.
 */
const zone = defineNode("zone", {
  fields: z.object({
    label: z.string(),
    surface: z.enum(["turf", "bed", "hard"]).describe("What the ground is made of.").optional(),
    exposure: z.enum(["sun", "shade"]).optional(),
  }),
  plural: "Zones",
});
const practice = defineNode("practice", {
  fields: z.object({ label: z.string() }),
  plural: "Practices",
  edges: { helps: { to: ["concern"], description: "what it addresses" } },
});
const concern = defineNode("concern", {
  fields: z.object({ label: z.string() }),
  plural: "Concerns",
  edges: { "is-in": { to: ["zone"], description: "where it shows" } },
});
const schema = createSchema([zone, practice, concern]);
const { defineMutation, defineInvariant } = bindSchema(schema);

const setSurface = defineMutation("set-surface", {
  title: "Say what the surface is",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), surface: z.enum(["turf", "bed", "hard"]) }),
  apply: (ctx, args) => ctx.patchNode(args.zoneId, { surface: args.surface }),
});
const setExposure = defineMutation("set-exposure", {
  title: "Say how much sun it gets",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), exposure: z.enum(["sun", "shade"]) }),
  apply: (ctx, args) => ctx.patchNode(args.zoneId, { exposure: args.exposure }),
});
const placeConcern = defineMutation("place-concern", {
  title: "Say where a concern shows",
  subject: { kinds: ["concern"], arg: "concernId" },
  input: z.object({ concernId: nodeRef(["concern"]), zoneId: nodeRef(["zone"]).describe("The zone it shows in.") }),
  apply: (ctx, args) => ctx.addEdge({ kind: "is-in", from: args.concernId, to: args.zoneId }),
});
const saysItHelps = defineMutation("says-it-helps", {
  title: "Say a practice addresses a concern",
  description: "The practice, done as described, reduces the concern.",
  subject: { kinds: ["practice"], arg: "practiceId" },
  input: z.object({ practiceId: nodeRef(["practice"]), concernId: nodeRef(["concern"]) }),
  apply: (ctx, args) => ctx.addEdge({ kind: "helps", from: args.practiceId, to: args.concernId }),
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
const mutations = [setSurface, setExposure, placeConcern, saysItHelps];
const app = defineApp({ name: "grounds", schema, mutations, invariants: [surfaced] });
const store = () =>
  new Store({
    schema,
    mutations,
    invariants: [surfaced],
    snapshot: {
      nodes: [
        { id: "lawn", kind: "zone", label: "Back Lawn" },
        { id: "border", kind: "zone", label: "Long Border", surface: "bed" },
        { id: "mow", kind: "practice", label: "Mow weekly" },
        { id: "mulch", kind: "practice", label: "Mulch in spring" },
        { id: "moss", kind: "concern", label: "Moss" },
        { id: "weeds", kind: "concern", label: "Weeds" },
      ] as never,
      edges: [],
    },
  });

/** A decision provider that answers by rule, and remembers every call. */
const deciding = () => {
  const calls: { state: unknown; questions: Record<string, Question> }[] = [];
  const decide: Decide = async (state, questions) => {
    calls.push({ state, questions: { ...questions } });
    const answers: Record<string, Answer> = {};
    for (const [key, question] of Object.entries(questions)) {
      if (question.type === "choice") {
        const options = Object.keys(question.criteria);
        const choice = key.endsWith(".surface") ? "turf" : key.endsWith(".exposure") ? "sun" : key.includes("zoneId") ? "lawn" : options[0]!;
        answers[key] = { type: "choice", choice, confidence: 0.9, probabilities: Object.fromEntries(options.map((o) => [o, o === choice ? 0.9 : 0.1 / (options.length - 1)])) };
      } else if (question.type === "noul") {
        answers[key] = { type: "noul", noul: key.includes(":mow:") && key.endsWith(":moss") ? 0.2 : key.includes(":mow:") ? 0.85 : 0.6 };
      } else {
        answers[key] = { type: "score", score: 1, confidence: 0.8, probabilities: {}, legend: {} };
      }
    }
    return { answers, usage: { inputTokens: 100 * Object.keys(questions).length, outputTokens: 0 } };
  };
  return { calls, decide };
};

const run: RunDeclaration = {
  name: "keep-the-grounds",
  steps: [
    { fill: "zone" },
    { ask: "place-concern", over: "concern" },
    { pair: "says-it-helps", over: "practice", against: "concern", threshold: 0.5 },
  ],
};

describe("a run can be read before it is run", () => {
  it("counts the nodes, the questions and the calls of every step, and says roughly what it costs", () => {
    const reading = readRun(store(), run);
    expect(reading.steps.map((step) => [step.nodes, step.questions, step.calls])).toEqual([
      [2, 3, 2], // lawn asks surface+exposure, border (surface set) asks exposure only
      [2, 2, 2], // each concern asks which zone
      [2, 4, 2], // each practice against both concerns: one call, two questions
    ]);
    expect(reading.questions).toBe(9);
    expect(reading.approxUsd).toBeGreaterThan(0);
    expect(describeRun(reading)).toContain("1. fill every typed field of every zone — 2 nodes, 3 questions.");
  });

  it("refuses to begin a run its budget cannot afford, before anything is asked", async () => {
    const { calls, decide } = deciding();
    const result = await runFrom(store(), { ...run, budget: { questions: 4 } }, { decide, app });
    expect(result.refused).toContain("would ask 9 questions and its budget is 4");
    expect(calls).toHaveLength(0);
    expect(result.steps).toEqual([]);
  });
});

describe("fan-out is the ordinary case", () => {
  it("visits every node of the kind as one call each, asking that node's whole unset half at once", async () => {
    const { calls, decide } = deciding();
    const result = await runFrom(store(), { name: "fill", steps: [{ fill: "zone" }] }, { decide, app });
    expect(calls).toHaveLength(2);
    expect(Object.keys(calls[0]!.questions)).toEqual(["field:zone.surface", "field:zone.exposure"]);
    expect(Object.keys(calls[1]!.questions)).toEqual(["field:zone.exposure"]);
    expect((calls[0]!.state as { label: string }).label).toBe("Back Lawn");
    const [step] = result.steps;
    expect(step!.nodes).toEqual(["lawn", "border"]);
    expect(step!.proposals).toEqual([
      { mutation: "set-surface", args: { zoneId: "lawn", surface: "turf" }, why: "surface of Back Lawn: turf (90% sure)" },
      { mutation: "set-exposure", args: { zoneId: "lawn", exposure: "sun" }, why: "exposure of Back Lawn: sun (90% sure)" },
      { mutation: "set-exposure", args: { zoneId: "border", exposure: "sun" }, why: "exposure of Long Border: sun (90% sure)" },
    ]);
    expect(result.usage).toMatchObject({ questions: 3, calls: 2, inputTokens: 300 });
  });

  it("turns a matrix of truths into the joining act, above the threshold only", async () => {
    const { decide } = deciding();
    const result = await runFrom(store(), { name: "matrix", steps: [run.steps[2]!] }, { decide, app });
    const [step] = result.steps;
    expect(step!.asked).toBe(4);
    expect(step!.proposals.map((call) => [call.args["practiceId"], call.args["concernId"]])).toEqual([
      ["mow", "weeds"],
      ["mulch", "moss"],
      ["mulch", "weeds"],
    ]);
    /* The pair that did not hold is still an answer — with its truth — just not a call. */
    const notHeld = step!.answered.find((a) => a.question.id === "pair:says-it-helps:mow:moss")!;
    expect(notHeld.call).toBeUndefined();
    expect(notHeld.answer).toEqual({ type: "noul", noul: 0.2 });
    expect(notHeld.confidence).toBeCloseTo(0.6, 5);
  });

  it("asks an act's remaining arguments once per subject, and one call carries them all", async () => {
    const { decide } = deciding();
    const result = await runFrom(store(), { name: "place", steps: [run.steps[1]!] }, { decide, app });
    expect(result.steps[0]!.proposals).toEqual([
      { mutation: "place-concern", args: { concernId: "moss", zoneId: "lawn" }, why: "Say where a concern shows — zoneId: lawn (90% sure)" },
      { mutation: "place-concern", args: { concernId: "weeds", zoneId: "lawn" }, why: "Say where a concern shows — zoneId: lawn (90% sure)" },
    ]);
  });

  it("judges every violation of a rule by a Choice over the closed set of repairs", async () => {
    const { calls, decide } = deciding();
    const result = await runFrom(store(), { name: "judge", steps: [{ judge: "surfaced" }] }, { decide, app });
    expect(Object.keys(calls[0]!.questions)).toEqual(["repair:surfaced:lawn"]);
    expect(result.steps[0]!.proposals).toEqual([
      { mutation: "set-surface", args: { zoneId: "lawn", surface: "turf" }, why: "Back Lawn does not say what its surface is.: Call it turf (90% sure)" },
    ]);
  });
});

describe("each step is typed, and the whole run is one batch", () => {
  it("lets a judge stop the run on a step's outcome, with a reason", async () => {
    const { calls, decide } = deciding();
    const result = await runFrom(store(), run, {
      decide,
      app,
      judge: (outcome) => (outcome.step === 0 && outcome.answered.every((a) => a.confidence >= 0.95) ? true : "not sure enough of the surfaces to go on"),
    });
    expect(result.stopped).toEqual({ at: 0, why: "not sure enough of the surfaces to go on" });
    expect(result.steps).toHaveLength(1);
    expect(calls).toHaveLength(2);
  });

  it("in review mode returns one plan for the whole run, and landing it is one batch with one undo", async () => {
    const at = store();
    const { decide } = deciding();
    const result = await runFrom(at, run, { decide, app });
    expect(result.applied).toBeUndefined();
    expect(result.plan.ready).toHaveLength(3 + 2 + 3);
    expect(at.graph.getNode("lawn")!["surface"]).toBeUndefined();
    const landed = landRun(at, result);
    expect(landed.stoppedAt).toBeUndefined();
    expect(landed.applied).toBe(8);
    expect(at.graph.getNode("lawn")!["surface"]).toBe("turf");
    expect(at.batches().map((batch) => batch.id)).toEqual([result.batch]);
    at.undo(result.batch);
    expect(at.graph.getNode("lawn")!["surface"]).toBeUndefined();
    expect(at.graph.outEdges("mow")).toEqual([]);
  });

  it("in each-step mode a later step sees an earlier one's answers, still under one batch", async () => {
    const at = store();
    const { calls, decide } = deciding();
    const result = await runFrom(at, { name: "twice", steps: [{ fill: "zone", fields: ["surface"] }, { judge: "surfaced" }] }, { decide, app, land: "each-step" });
    /* Step 1 set the lawn's surface, so step 2 found no violation to judge. */
    expect(calls).toHaveLength(1);
    expect(result.steps[1]!.asked).toBe(0);
    expect(at.batches().map((batch) => batch.id)).toEqual([result.batch]);
    expect(at.log.all().every((op) => op.author.kind === "agent" && op.author.id === "twice" && op.author.session?.startsWith("run-"))).toBe(true);
  });

  it("stops where the provider failed, saying so, and keeps what earlier steps decided", async () => {
    let n = 0;
    const failing: Decide = async () => {
      n += 1;
      if (n === 2) throw new Error("The decision provider is overloaded and stayed so through 3 retries.");
      return { answers: {}, usage: { inputTokens: 0, outputTokens: 0 } };
    };
    const result = await runFrom(store(), run, { decide: failing, app });
    expect(result.stopped).toEqual({ at: 0, why: "The decision provider is overloaded and stayed so through 3 retries." });
  });
});

describe("a run announces where it is through the seat's own path", () => {
  it("names the kind and node of every visit as a read, under the run's own agent session", async () => {
    const { decide } = deciding();
    const seen: ToolCall[] = [];
    const result = await runFrom(store(), { name: "fill", steps: [{ fill: "zone" }] }, { decide, app, onCall: (call) => seen.push(call) });
    expect(result.author).toMatchObject({ kind: "agent", id: "fill" });
    expect(result.author.session).toMatch(/^run-/);
    expect(seen.map((call) => [call.name, call.phase, call.args["kind"], call.args["node"], call.reads])).toEqual([
      ["decide", "running", "zone", "lawn", undefined],
      ["decide", "ok", "zone", "lawn", ["lawn"]],
      ["decide", "running", "zone", "border", undefined],
      ["decide", "ok", "zone", "border", ["border"]],
    ]);
    expect(seen.every((call) => call.mutating === false)).toBe(true);
  });
});
