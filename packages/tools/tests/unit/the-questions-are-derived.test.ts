import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  allQuestions,
  nodeState,
  questionsForInvariant,
  questionsForKind,
  questionsForMutation,
  scoreToValue,
} from "../../src/index.js";

/**
 * THE QUESTIONS ARE DERIVED, NOT AUTHORED.
 *
 * A declaration already types every question worth asking: an enum is a
 * Choice over its own options, a node reference is a Choice over the live
 * nodes of that kind, a boolean and a rule are truths, a bounded number is
 * a Score. Nothing here is written by hand — the words are the
 * declaration's, so two descriptions of one domain cannot disagree.
 */
const zone = defineNode("zone", {
  fields: z.object({
    label: z.string(),
    surface: z.enum(["turf", "bed", "hard"]).describe("What the ground is made of.").optional(),
    exposure: z.enum(["sun", "shade"]).optional(),
    shaded: z.boolean().optional(),
    effort: z.number().int().min(1).max(5).describe("How much work it takes to keep.").optional(),
    notes: z.string().optional(),
  }),
  plural: "Zones",
  description: "A piece of ground with one purpose.",
  edges: { "within": { to: ["zone"], description: "the zone it sits inside" } },
});
const concern = defineNode("concern", { fields: z.object({ label: z.string() }), plural: "Concerns" });
const schema = createSchema([zone, concern]);
const { defineMutation, defineInvariant } = bindSchema(schema);

const stakeOut = defineMutation("stake-out", {
  title: "Stake out some ground",
  creates: ["zone"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "zone"), kind: "zone", label: args.label } as never),
});
const setSurface = defineMutation("set-surface", {
  title: "Say what the surface is",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), surface: z.enum(["turf", "bed", "hard"]) }),
  apply: (ctx, args) => ctx.patchNode(args.zoneId, { surface: args.surface }),
});
const contendWith = defineMutation("contend-with", {
  title: "Say a zone has a concern",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), concernId: nodeRef(["concern"]).describe("The concern this zone contends with.") }),
  apply: (ctx, args) => ctx.addEdge({ kind: "has-concern", from: args.zoneId, to: args.concernId } as never),
});
const surfaced = defineInvariant("surfaced", {
  scope: { kind: "zone" },
  description: "Every zone says what its surface is.",
  repairs: ["set-surface", "stake-out"],
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
              { mutation: "stake-out", missing: ["label"], label: "Stake out something else" },
            ],
          },
        ],
});

const store = () =>
  new Store({
    schema,
    mutations: [stakeOut, setSurface, contendWith],
    invariants: [surfaced],
    snapshot: {
      nodes: [
        { id: "lawn", kind: "zone", label: "Back Lawn" },
        { id: "border", kind: "zone", label: "Long Border", surface: "bed" },
        { id: "moss", kind: "concern", label: "Moss" },
        { id: "weeds", kind: "concern", label: "Weeds" },
      ] as never,
      edges: [{ kind: "within", from: "border", to: "lawn" }],
    },
  });

describe("a kind's fields as questions", () => {
  it("makes a Choice of an enum, with its options as criteria and its description as the instruction", () => {
    const asked = questionsForKind(store(), "zone");
    const surface = asked.find((q) => q.id === "field:zone.surface")!;
    expect(surface.question).toEqual({
      type: "choice",
      instructions: "Which surface? What the ground is made of.",
      criteria: { turf: null, bed: null, hard: null },
    });
    /* And it names the act that writes the field, so an answer is a call. */
    expect(surface).toMatchObject({ about: "field", writes: { mutation: "set-surface", arg: "surface", subjectArg: "zoneId" } });
  });

  it("makes a truth of a boolean and a Score of a bounded number, and asks nothing of prose", () => {
    const asked = questionsForKind(store(), "zone");
    expect(asked.find((q) => q.id === "field:zone.shaded")!.question.type).toBe("noul");
    const effort = asked.find((q) => q.id === "field:zone.effort")!.question;
    expect(effort.type).toBe("score");
    expect(effort.type === "score" ? effort.criteria : []).toHaveLength(5);
    expect(effort.instructions).toContain("How much work it takes to keep.");
    expect(asked.some((q) => q.id === "field:zone.notes" || q.id === "field:zone.label")).toBe(false);
    expect(scoreToValue({ min: 1 }, 1.3)).toBe(2);
  });

  it("falls back to the field's name when no description was declared, in words", () => {
    const exposure = questionsForKind(store(), "zone").find((q) => q.id === "field:zone.exposure")!;
    expect(exposure.question.instructions).toBe("Which exposure? Exposure of a zone.");
  });
});

describe("an act's arguments as questions", () => {
  it("makes a Choice over the live nodes of a kind, labeled the way every surface labels them", () => {
    const asked = questionsForMutation(store(), "contend-with", { zoneId: "lawn" });
    expect(asked.map((q) => q.id)).toEqual(["arg:contend-with.concernId"]);
    expect(asked[0]!.question).toEqual({
      type: "choice",
      instructions: "Which concern id? The concern this zone contends with.",
      criteria: { moss: "a concern: Moss", weeds: "a concern: Weeds" },
    });
  });

  it("asks the subject too when nothing settled it", () => {
    const asked = questionsForMutation(store(), "set-surface");
    expect(asked.map((q) => q.id)).toEqual(["arg:set-surface.zoneId", "arg:set-surface.surface"]);
    const zones = asked[0]!.question;
    expect(zones.type === "choice" ? Object.keys(zones.criteria) : []).toEqual(["lawn", "border"]);
  });
});

describe("a rule as a truth, and its repairs as the Choice that follows", () => {
  it("asks whether the rule holds in the invariant's own words", () => {
    const [judge, repair] = questionsForInvariant(store(), "surfaced");
    expect(judge!.question).toEqual({
      type: "noul",
      instructions: "Every zone says what its surface is. Does this hold in the state given?",
      criteria: { true: "Every zone says what its surface is.", false: "Every zone says what its surface is. — but it does not hold." },
    });
    /* Before the store has judged, the follow-on is over what the rule declares it may name. */
    expect(repair!.question).toMatchObject({ type: "choice", criteria: { "set-surface": "Say what the surface is", "stake-out": "Stake out some ground" } });
  });

  it("narrows the follow-on to the violation's own ready repairs, so an answer is a call", () => {
    const at = store();
    const violation = at.violations().find((v) => v.subjectId === "lawn")!;
    const [judge, repair] = questionsForInvariant(at, "surfaced", violation);
    expect(judge!.id).toBe("rule:surfaced:lawn");
    expect(judge!.question.type === "noul" ? judge!.question.criteria?.false : "").toBe("Back Lawn does not say what its surface is.");
    /* A repair still missing an argument is not a closed answer, and is left
       out; two repairs of one act are told apart, and each names its call. */
    expect(repair!.question.type === "choice" ? repair!.question.criteria : {}).toEqual({
      "set-surface": "Call it turf",
      "set-surface:2": "Call it a bed",
    });
    expect(repair!.about === "repair" ? repair!.options["set-surface:2"] : undefined).toEqual({
      mutation: "set-surface",
      args: { zoneId: "lawn", surface: "bed" },
    });
  });
});

describe("the state a question is asked over", () => {
  it("is the node as a card would show it, joined things by label", () => {
    expect(nodeState(store(), "border")).toEqual({
      id: "border",
      kind: "zone",
      "what the kind is": "A piece of ground with one purpose.",
      label: "Long Border",
      fields: { Surface: "Bed" },
      joined: { within: ["Back Lawn"] },
    });
    expect(nodeState(store(), "nobody")).toBeUndefined();
  });

  it("is nothing hand-written: every question in the app comes from the declaration", () => {
    const ids = allQuestions(store()).map((q) => q.id);
    expect(ids).toContain("field:zone.surface");
    expect(ids).toContain("arg:contend-with.concernId");
    expect(ids).toContain("rule:surfaced");
    expect(ids.every((id) => /^(field|arg|rule|repair):/.test(id))).toBe(true);
  });
});
