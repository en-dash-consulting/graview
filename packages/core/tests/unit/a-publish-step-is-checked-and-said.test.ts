import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import type { GraviewDocument } from "../../src/document/schema.js";
import { declaredWorkflows, documentWorkflowFindings, kindNoun, STEP_KINDS, workflowReach, workflowWorldOfApp, workflowWorldOfDocument } from "../../src/workflows.js";

/*
 * A PUBLISH STEP (Roadmap f-workflow-step-publishes) is one of the step
 * kinds: its shape, its line, and what the checker refuses — a publish in
 * an app that is live, where every edit reaches readers as it is made and
 * there is nothing to publish. Publishing was reachable only as the
 * built-in act a publisher presses, never as a step: an act step naming
 * it is pointed at the publish step.
 */

const NEWS = {
  format: "graview-document",
  formatVersion: 1,
  name: "News",
  kinds: { story: { label: "{title}", fields: { title: { type: "string", required: true } } } },
  policy: { grants: [{ roles: ["editor"], mutations: "*" }], sees: [{ roles: ["editor"], kinds: ["story"] }] },
  publishing: { mode: "on-publish", working: ["editor"] },
  workflows: {
    morning: { title: "Publish each morning", when: [{ every: "day 07:00" }], steps: [{ publish: "head" }] },
  },
} as unknown as GraviewDocument;

const live = (document: GraviewDocument): GraviewDocument => {
  const { publishing: _publishing, ...rest } = document as unknown as Record<string, unknown>;
  return rest as unknown as GraviewDocument;
};
const withSteps = (steps: unknown[], document: GraviewDocument = NEWS) => ({ ...document, workflows: { morning: { title: "Publish", when: [{ byHand: true }], steps } } }) as unknown as GraviewDocument;
const codes = (document: GraviewDocument) => documentWorkflowFindings(document).map((finding) => finding.code);

describe("a publish step is a step kind, checked and said", () => {
  it("is one of the step kinds, compiles onto an app that publishes as written, and has nothing to say of a sound one", () => {
    expect(Object.keys(STEP_KINDS)).toContain("publish");
    const compiled = compileDocument(NEWS);
    expect(compiled.ok && declaredWorkflows(compiled.app)?.["morning"]?.steps[0]).toEqual({ publish: "head" });
    expect(codes(NEWS)).toEqual([]);
    expect(codes(withSteps([{ publish: "run", approve: "ask" }]))).toEqual([]);
  });

  it("is said in a line, and touches no kind", () => {
    expect(STEP_KINDS.publish.words({ publish: "head" }, kindNoun)).toBe("Publish every draft");
    expect(STEP_KINDS.publish.words({ publish: "run" }, kindNoun)).toBe("Publish what this run read and made");
    expect(workflowReach([{ publish: "head" }], workflowWorldOfDocument(NEWS))).toMatchObject({ reads: [], writes: [] });
  });

  it("is refused in an app that is live, where there is nothing to publish, in the workflow codes' words", () => {
    const findings = documentWorkflowFindings(live(NEWS));
    expect(findings.map((finding) => finding.code)).toEqual(["workflow-publish-live"]);
    expect(findings[0]).toMatchObject({ severity: "error", message: expect.stringContaining("the app is live"), fix: expect.stringContaining('"on-publish"') });
    expect((findings[0] as { path?: string }).path).toContain("steps.0.publish");
    // A live document with it is refused whole; and a live app's world, read off its own `publishing`, refuses the step.
    expect(compileDocument(live(NEWS)).ok).toBe(false);
    const { workflows: _workflows, ...bare } = live(NEWS) as unknown as Record<string, unknown>;
    const compiled = compileDocument(bare);
    expect(compiled.ok).toBe(true);
    const world = workflowWorldOfApp(compiled.ok ? compiled.app : (undefined as never));
    expect(world.publishes).toBe(false);
    expect(STEP_KINDS.publish.findings({ publish: "head" }, { world, workflow: "morning", index: 0, said: "Step 1", declared: {} }).map((one) => one.code)).toEqual(["workflow-publish-live"]);
  });

  it("refuses a publish that is neither the head nor the run", () => {
    expect(codes(withSteps([{ publish: "everything" }]))).toEqual(["workflow-shape"]);
  });

  it("points an act step that names publish at the publish step", () => {
    const [finding] = documentWorkflowFindings(withSteps([{ act: "publish" }]));
    expect(finding?.code).toBe("workflow-act-unknown");
    expect(finding?.fix).toContain('{ "publish": "head" }');
  });
});
