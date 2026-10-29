import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { classifyApplies, STEP_KINDS, workflowsOf } from "../../src/workflows.js";

/*
 * A CLASSIFY STEP'S OTHERWISE AND APPLY-AT ARE CHECKED AND SAID (Roadmap
 * f-workflow-runs-say-more, request classify-step-otherwise-and-apply-at):
 * `otherwise` names the option a record no option clears is labeled, and
 * `applyAt` how sure a judgment of an option must be to be set without
 * asking. The checker refuses an option the field does not have in either,
 * and an `applyAt` past 0 to 1; the step's line says both; and `confirm`
 * still wins over `applyAt`.
 */

const FEEDBACK = {
  format: "graview-document",
  formatVersion: 1,
  name: "Feedback",
  kinds: {
    feedback: { noun: "feedback", plural: "feedback", label: "{title}", fields: { title: { type: "string", required: true }, category: { type: "enum", options: ["spam", "rude", "needs-look", "good-to-show"] } } },
  },
};

const triage = (step: Record<string, unknown>) => ({ ...FEEDBACK, workflows: { triage: { title: "Triage new feedback", when: [{ made: "feedback" }], steps: [{ classify: "feedback", field: "category", ...step }] } } });
const codes = (document: unknown) =>
  compileDocument(document)
    .findings.filter((f) => f.code.startsWith("workflow-"))
    .map((f) => `${f.code} @ ${f.path}`);

describe("a classify step's otherwise and applyAt", () => {
  it("compile as written, and the step's line says both", () => {
    const document = triage({ otherwise: "needs-look", applyAt: { spam: 0.85 }, approve: "ask" });
    const result = compileDocument(document);
    expect(result.ok, JSON.stringify(result.findings)).toBe(true);
    if (!result.ok) return;
    expect(codes(document)).toEqual([]);
    const step = workflowsOf(result.app).find((workflow) => workflow.name === "triage")!.steps[0];
    expect(STEP_KINDS.classify.words(step as never, (kind) => kind)).toBe("Label each feedback by its category, else needs-look; sets spam at 85% sure without asking (asks a person first)");
  });

  it("are refused an option the field does not have, naming the field's options", () => {
    expect(codes(triage({ otherwise: "ham", applyAt: { eggs: 0.9 } }))).toEqual(["workflow-classify-option-unknown @ workflows.triage.steps.0.applyAt.eggs", "workflow-classify-option-unknown @ workflows.triage.steps.0.otherwise"]);
    const finding = compileDocument(triage({ otherwise: "ham" })).findings.find((f) => f.path.endsWith(".otherwise"));
    expect(finding?.message).toContain('labels what no option clears "ham"');
    expect(finding?.fix).toContain('"needs-look"');
  });

  it("is refused an applyAt past 0 to 1", () => {
    expect(codes(triage({ applyAt: { spam: 1.5 } }))).toEqual(["workflow-classify-threshold-invalid @ workflows.triage.steps.0.applyAt.spam"]);
    expect(compileDocument(triage({ applyAt: { spam: -0.1 } })).findings.find((f) => f.code === "workflow-classify-threshold-invalid")?.message).toContain("runs from 0 to 1");
  });

  it("sets without asking at or above applyAt, never below it, and never an option confirm names", () => {
    const step = { classify: "feedback", field: "category", applyAt: { spam: 0.85, "good-to-show": 0.5 }, confirm: ["good-to-show"] };
    expect(classifyApplies(step, "spam", 0.85)).toBe(true);
    expect(classifyApplies(step, "spam", 0.84)).toBe(false);
    expect(classifyApplies(step, "rude", 0.99)).toBe(false);
    expect(classifyApplies(step, "good-to-show", 0.99)).toBe(false);
  });
});
