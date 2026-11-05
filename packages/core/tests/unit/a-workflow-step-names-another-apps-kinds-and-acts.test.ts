import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";
import type { GraviewDocument } from "../../src/document/schema.js";
import { documentWorkflowFindings, farReferenceOf, kindNoun, stepKindOf, workflowsOf, type FarAppResolver } from "../../src/workflows.js";

/*
 * A WORKFLOW'S STEP NAMES ANOTHER APP'S KINDS AND ACTS (Roadmap
 * f-workflow-steps-in-another-app): an agent step's `reads` and `acts`, and
 * an act step's `act`, take `@<app address>/<kind>` and `@<app address>/<act>`
 * — the address a relation to another app's kind already names
 * (`@nick/house/house`). The checker cannot see the other app, so it holds
 * the reference to its shape (`workflow-far-reference`); a host that hands
 * it a resolver (`resolveFarApp`) has it say whether that app, its kind,
 * its act and the arguments a step hands the act are there.
 */

const HQ = {
  format: "graview-document",
  formatVersion: 1,
  name: "HQ",
  kinds: {
    ticket: { label: "{title}", fields: { title: { type: "string", required: true }, status: { type: "enum", options: ["open", "done"] }, public: { type: "boolean" } } },
  },
  workflows: {
    "sync-tickets": {
      title: "Keep Graview Public's tickets in step",
      when: [{ every: "day 07:00" }],
      steps: [
        { act: "@self/graview-public/set-ticket-status", over: { kind: "ticket", where: "public" }, args: { title: { expr: "title" }, status: { expr: "status" } }, key: "{id}" },
        { agent: "Close what HQ closed.", reads: ["ticket", "@self/graview-public/ticket"], acts: ["edit-ticket", "@self/graview-public/set-ticket-status"] },
      ],
    },
  },
} as const;

const PUBLIC: ReturnType<FarAppResolver> = {
  name: "Graview Public",
  kinds: ["ticket"],
  acts: {
    "set-ticket-status": { title: "Set a ticket's status", input: { type: "object", properties: { title: { type: "string" }, status: { type: "string", enum: ["open", "done"] } }, required: ["title"], additionalProperties: false } },
  },
};
const resolveFarApp: FarAppResolver = (address) => (address === "@self/graview-public" ? PUBLIC : undefined);

const withSteps = (steps: readonly unknown[]) => ({ ...HQ, workflows: { w: { title: "T", when: [{ byHand: true }], steps } } });
const codes = (document: unknown, options: { resolveFarApp?: FarAppResolver } = {}) => documentWorkflowFindings(document as GraviewDocument, options).map((f) => `${f.code} @ ${f.path.replace(/^workflows\.w\./, "")}`);

describe("a far reference", () => {
  it("is read as a relation's target is: the app's address, then the kind or act", () => {
    expect(farReferenceOf("@self/graview-public/set-ticket-status")).toEqual({ address: "@self/graview-public", name: "set-ticket-status" });
    expect(farReferenceOf("@app_kf5eydr9z58jzf/ticket")).toEqual({ address: "app_kf5eydr9z58jzf", name: "ticket" });
    expect(farReferenceOf("@https://example.com/a/ticket")).toEqual({ address: "https://example.com/a", name: "ticket" });
    expect(farReferenceOf("ticket")).toBeUndefined();
    expect(farReferenceOf("@self/")).toBeUndefined();
  });
});

describe("the checker, without a resolver", () => {
  it("accepts a step that reads another app's kind and runs or proposes its acts", () => {
    const result = compileDocument(HQ);
    expect(result.findings.filter((f) => f.code.startsWith("workflow-")), JSON.stringify(result.findings)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("refuses a far reference that names no app's kind or act, in a step's reads, acts and act (workflow-far-reference)", () => {
    const found = codes(withSteps([{ act: "@self/graview-public/Set Status" }, { agent: "Look", reads: ["@self/"], acts: ["@/edit-ticket"] }]));
    expect(found).toEqual(["workflow-far-reference @ steps.0.act", "workflow-far-reference @ steps.1.reads.0", "workflow-far-reference @ steps.1.acts.0"]);
    const finding = documentWorkflowFindings(withSteps([{ act: "@self/" }]) as unknown as GraviewDocument)[0]!;
    expect(finding.path).toBe("workflows.w.steps.0.act");
    expect(finding.fix).toContain("@self/graview-public/set-ticket-status");
  });

  it("still refuses a local name the app does not have", () => {
    expect(codes(withSteps([{ agent: "Look", reads: ["tickt"], acts: ["edit-tickt"] }]))).toEqual(["workflow-kind-unknown @ steps.0.reads.0", "workflow-act-unknown @ steps.0.acts.0"]);
  });

  it("says the far app the workflow reaches beside what it reads and writes here, and keeps its kinds off this app's", () => {
    const result = compileDocument(HQ);
    if (!result.ok) throw new Error("compiles");
    const workflow = workflowsOf(result.app).find((one) => one.name === "sync-tickets")!;
    expect(workflow.reads).toEqual(["ticket"]);
    expect(workflow.writes).toEqual(["ticket"]);
    expect(workflow.reaches).toEqual([{ address: "@self/graview-public", reads: ["ticket"], acts: ["set-ticket-status"] }]);
    expect(workflow.steps.map((step) => stepKindOf(step)!.words(step, kindNoun))).toEqual([
      "Run “set-ticket-status” in @self/graview-public for each ticket where public",
      "Ask a model to close what HQ closed reading ticket, ticket in @self/graview-public, proposing “edit-ticket”, “set-ticket-status” in @self/graview-public",
    ]);
  });
});

describe("the checker, with the host's resolver", () => {
  it("accepts what the far app has", () => {
    expect(codes(HQ, { resolveFarApp })).toEqual([]);
  });

  it("refuses an app the host does not know, and a kind or an act the far app lacks", () => {
    expect(codes(withSteps([{ agent: "Look", reads: ["@self/graview-public/tikcet", "@self/hq-two/ticket"], acts: ["@self/graview-public/close-ticket"] }]), { resolveFarApp })).toEqual([
      "workflow-kind-unknown @ steps.0.reads.0",
      "workflow-far-app-unknown @ steps.0.reads.1",
      "workflow-act-unknown @ steps.0.acts.0",
    ]);
    const finding = documentWorkflowFindings(withSteps([{ act: "@self/graview-public/close-ticket" }]) as unknown as GraviewDocument, { resolveFarApp })[0]!;
    expect(finding.message).toContain("Graview Public");
    expect(finding.fix).toContain('"set-ticket-status"');
  });

  it("refuses an argument the far act does not take, and one it requires left out (workflow-far-args)", () => {
    const found = documentWorkflowFindings(withSteps([{ act: "@self/graview-public/set-ticket-status", args: { status: "done", colour: "red" } }]) as unknown as GraviewDocument, { resolveFarApp });
    expect(found.map((f) => `${f.code} @ ${f.path}`)).toEqual(["workflow-far-args @ workflows.w.steps.0.args.colour", "workflow-far-args @ workflows.w.steps.0.args"]);
    expect(found[1]!.message).toContain('"title"');
  });

  it("is what a checked compile and an edit are told", () => {
    const steps = [{ act: "@self/graview-public/close-ticket" }];
    expect(compileDocument(withSteps(steps), { resolveFarApp }).findings.map((f) => f.code)).toContain("workflow-act-unknown");
    expect(compileDocument(withSteps(steps)).findings.filter((f) => f.code.startsWith("workflow-"))).toEqual([]);
    const edited = editDocument(HQ as unknown as GraviewDocument, [{ op: "add-workflow", name: "close", workflow: { title: "Close", when: [{ byHand: true }], steps } }], { resolveFarApp });
    expect(edited.ok).toBe(false);
    if (!edited.ok) expect(edited.findings.map((f) => f.code)).toEqual(["workflow-act-unknown"]);
    const malformed = editDocument(HQ as unknown as GraviewDocument, [{ op: "add-workflow", name: "close", workflow: { title: "Close", when: [{ byHand: true }], steps: [{ act: "@self/" }] } }]);
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.findings.map((f) => f.code)).toEqual(["workflow-far-reference"]);
  });
});
