import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { declaredWorkflows, floorLabel, linksIn, STEP_KINDS, workflowsOf } from "../../src/workflows.js";

/*
 * A CLASSIFY STEP IS CHECKED AND SAID (Roadmap f-feedback-triage-agent):
 * a workflow step that labels each record of a kind with one of a choice
 * field's options compiles as written, the checker says each way it could
 * not label in the person's words — a field that is no choice, an option
 * the field does not have, a floor rule for an option it never chooses, a
 * threshold past 0 to 1 — and the step reads in one line, saying what it
 * sets aside and what it asks a person before.
 */

const OPTIONS = ["spam", "nsfw", "rude", "sensitive", "needs-look", "good-to-show"];

const FEEDBACK = {
  format: "graview-document",
  formatVersion: 1,
  name: "Feedback",
  kinds: {
    feedback: { noun: "feedback", plural: "feedback", label: "{title}", fields: { title: { type: "string", required: true }, body: { type: "string" }, category: { type: "enum", options: OPTIONS } } },
  },
};

const triage = (step: Record<string, unknown>) => ({ ...FEEDBACK, workflows: { triage: { title: "Triage new feedback", when: [{ made: "feedback" }], steps: [{ classify: "feedback", field: "category", ...step }] } } });
const codes = (document: unknown) =>
  compileDocument(document)
    .findings.filter((f) => f.code.startsWith("workflow-"))
    .map((f) => `${f.code} @ ${f.path}`);

describe("a classify step", () => {
  it("is a kind of step, and compiles as it was written", () => {
    expect(Object.keys(STEP_KINDS)).toContain("classify");
    const document = triage({ floor: { spam: { links: 3, words: ["casino"] } }, setAside: { spam: 0.9 }, confirm: ["good-to-show"] });
    const result = compileDocument(document);
    expect(result.ok, JSON.stringify(result.findings)).toBe(true);
    if (!result.ok) return;
    expect(declaredWorkflows(result.app)).toEqual(document.workflows);
    expect(codes(document)).toEqual([]);
  });

  it("is refused a field that is not a choice of options, naming the choice fields it has", () => {
    const result = compileDocument(triage({ field: "body" }));
    const finding = result.findings.find((f) => f.code === "workflow-classify-field-not-choice");
    expect(finding?.path).toBe("workflows.triage.steps.0.field");
    expect(finding?.message).toContain('"body", which is not a choice of options');
    expect(finding?.fix).toContain('"category"');
    expect(codes(triage({ field: "color" }))).toEqual(["workflow-classify-field-not-choice @ workflows.triage.steps.0.field"]);
  });

  it("is refused options the field does not have, and a floor, a set-aside or a confirm for an option it never chooses", () => {
    expect(codes(triage({ options: ["spam", "ham"], floor: { "good-to-show": { links: 0 + 1 } }, setAside: { rude: 0.9 }, confirm: ["ham"] }))).toEqual([
      "workflow-classify-option-unknown @ workflows.triage.steps.0.options.1",
      "workflow-classify-option-unknown @ workflows.triage.steps.0.floor.good-to-show",
      "workflow-classify-option-unknown @ workflows.triage.steps.0.setAside.rude",
      "workflow-classify-option-unknown @ workflows.triage.steps.0.confirm.0",
    ]);
  });

  it("is refused a set-aside threshold outside 0 to 1, a floor rule that tests nothing, and a floor rule that does not read", () => {
    expect(codes(triage({ setAside: { spam: 90 }, floor: { rude: {}, nsfw: { expr: "body ==" } } }))).toEqual([
      "workflow-classify-floor-empty @ workflows.triage.steps.0.floor.rude",
      "workflow-where-invalid @ workflows.triage.steps.0.floor.nsfw.expr",
      "workflow-classify-threshold-invalid @ workflows.triage.steps.0.setAside.spam",
    ]);
  });

  it("is refused a kind the app does not have", () => {
    expect(codes(triage({ classify: "comment" }))).toEqual(["workflow-kind-unknown @ workflows.triage.steps.0.classify"]);
  });

  it("reads in one line: what it labels, as what, what it sets aside and what it asks before", () => {
    const one = (step: Record<string, unknown>) => {
      const result = compileDocument(triage(step));
      if (!result.ok) throw new Error(JSON.stringify(result.findings));
      return workflowsOf(result.app).find((workflow) => workflow.name === "triage")!.steps[0];
    };
    const step = one({ options: ["spam", "rude", "good-to-show"], setAside: { spam: 0.9 }, confirm: ["good-to-show"], approve: "apply" });
    expect(STEP_KINDS.classify.words(step as never, (kind) => kind)).toBe("Label each feedback by its category as spam, rude or good-to-show; archive spam at 90% sure (asks before good-to-show)");
    expect(STEP_KINDS.classify.words(one({ options: ["spam", "good-to-show"] }) as never, (kind) => kind)).toBe("Label each feedback by its category as spam or good-to-show (asks a person first)");
  });
});

describe("the floor", () => {
  it("counts links, finds a blocklisted word whole and in any case, and reads a rule, in the order the step says its options", () => {
    const floor = { spam: { links: 2, words: ["casino"] }, rude: { words: ["idiot"] }, sensitive: { expr: "body != ''" } };
    expect(linksIn("see https://a.example and www.b.example, not mailto")).toBe(2);
    expect(floorLabel(floor, "Win at https://a.example and http://b.example")).toEqual({ option: "spam", basis: "spam, from 2 links" });
    expect(floorLabel(floor, "Best CASINO bonus")).toEqual({ option: "spam", basis: "spam, from the word “casino”" });
    expect(floorLabel(floor, "You idiot.")).toEqual({ option: "rude", basis: "rude, from the word “idiot”" });
    expect(floorLabel(floor, "idiotic but fine")).toBeUndefined();
    expect(floorLabel(floor, "my address", (option) => option === "sensitive")).toEqual({ option: "sensitive", basis: "sensitive, from the rule body != ''" });
  });
});
