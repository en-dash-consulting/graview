import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import type { GraviewDocument } from "../../src/document/schema.js";
import { lineageOf } from "../../src/ops/lineage.js";
import { createSchema, defineNode, Store, type AnySchema, type Author } from "../../src/index.js";
import { acceptSuggestion, proposalWords, suggest, suggestions } from "../../src/tidying.js";
import { afterMs, documentWorkflowFindings, followsFindings, policiesOf, policyApplies, policyInstruction, STEP_KINDS, declaredWorkflows, kindNoun, workflowWorldOfApp, workflowWorldOfDocument } from "../../src/workflows.js";
import { z } from "zod";

/*
 * AN ARCHIVE STEP, A WORKFLOW'S RULES AND A SUGGESTION OF SEVERAL
 * (Roadmap f-retention-rules, f-job-rule-inputs, f-job-approvals): the
 * archive step is one of the step kinds, checked in the person's words and
 * said in a line; the rules a workflow follows are read from records by
 * one convention; and a suggestion of several calls keeps each call's
 * sentence, is said as one, and is accepted a change at a time.
 */

const HOME = {
  format: "graview-document",
  formatVersion: 1,
  name: "Home",
  kinds: {
    "grocery-list": { label: "{name}", fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["open", "done"] }, doneOn: { type: "date" } } },
    note: { label: "{name}", fields: { name: { type: "string", required: true } }, archives: false },
    rule: { label: "{name}", fields: { name: { type: "string", required: true }, action: { type: "string" }, order: { type: "number" }, appliesTo: { type: "string" }, status: { type: "enum", options: ["active", "retired"] } } },
  },
  workflows: {
    tidy: { title: "Set aside done lists", when: [{ every: "day 03:00" }], follows: "rule", steps: [{ archive: "grocery-list", where: "status == 'done'", after: "3 days" }] },
  },
} as unknown as GraviewDocument;

const withSteps = (steps: unknown[], extra: Record<string, unknown> = {}) => ({ ...HOME, workflows: { tidy: { title: "Set aside", when: [{ byHand: true }], steps, ...extra } } }) as unknown as GraviewDocument;
const codes = (document: GraviewDocument) => documentWorkflowFindings(document).map((finding) => finding.code);

describe("an archive step is a step kind, checked and said (f-retention-rules)", () => {
  it("is one of the step kinds, compiles onto the app as written, and has nothing to say of a sound one", () => {
    expect(Object.keys(STEP_KINDS)).toContain("archive");
    const compiled = compileDocument(HOME);
    expect(compiled.ok && declaredWorkflows(compiled.app)?.["tidy"]?.steps[0]).toEqual({ archive: "grocery-list", where: "status == 'done'", after: "3 days" });
    expect(codes(HOME)).toEqual([]);
  });

  it("is said in a line", () => {
    expect(STEP_KINDS.archive.words({ archive: "grocery-list", where: "status == 'done'", after: "3 days" }, kindNoun)).toBe("Archive grocery list records where status == 'done' 3 days after it last changed");
    expect(STEP_KINDS.archive.words({ archive: "grocery-list", after: { field: "doneOn", days: 7 } }, kindNoun)).toBe("Archive grocery list records 7 days after its done on");
  });

  it("reads how long in hours, days or weeks", () => {
    expect(afterMs("3 days")).toBe(3 * 86_400_000);
    expect(afterMs("1 week")).toBe(7 * 86_400_000);
    expect(afterMs("12 hours")).toBe(12 * 3_600_000);
    expect(afterMs("soon")).toBeUndefined();
  });

  it("finds a kind it does not have, a kind never archived, a where that does not read, and a wait it cannot read", () => {
    expect(codes(withSteps([{ archive: "grocery" }]))).toEqual(["workflow-kind-unknown"]);
    expect(codes(withSteps([{ archive: "note" }]))).toEqual(["workflow-archive-never"]);
    expect(codes(withSteps([{ archive: "grocery-list", where: "state == 'done'" }]))).toEqual(["workflow-where-invalid"]);
    expect(codes(withSteps([{ archive: "grocery-list", after: "a while" }]))).toEqual(["workflow-archive-after-invalid"]);
    expect(codes(withSteps([{ archive: "grocery-list", after: { field: "finished", days: 3 } }]))).toEqual(["workflow-archive-after-invalid"]);
    // A kind that says archives: false is given no archive act.
    const compiled = compileDocument(HOME);
    const world = workflowWorldOfApp(compiled.ok ? compiled.app : (undefined as never));
    const [finding] = STEP_KINDS.archive.findings({ archive: "note" }, { world, workflow: "tidy", index: 0, said: "Step 1", declared: {} });
    expect(finding?.code).toBe("workflow-archive-never");
    expect(finding!.message).toContain("the app says they are never archived");
  });
});

describe("the rules a workflow follows are records, read by one convention (f-job-rule-inputs)", () => {
  const rule = defineNode("rule", { fields: z.object({ label: z.string(), action: z.string().optional(), order: z.number().optional(), appliesTo: z.string().optional(), status: z.string().optional(), active: z.boolean().optional() }) });
  const list = defineNode("grocery-list", { fields: z.object({ label: z.string(), status: z.string() }) });
  const schema = createSchema([rule, list]);
  const store = new Store<AnySchema>({
    schema,
    snapshot: {
      nodes: [
        { id: "rule:b", kind: "rule", label: "Second", action: "Say why", order: 2 },
        { id: "rule:a", kind: "rule", label: "First", action: "Keep the standing order", order: 1, appliesTo: "label == 'Standing'" },
        { id: "rule:none", kind: "rule", label: "Its own words" },
        { id: "rule:retired", kind: "rule", label: "Retired", action: "Archive everything", status: "retired" },
        { id: "rule:off", kind: "rule", label: "Off", action: "Archive everything", active: false },
        { id: "grocery-list:standing", kind: "grocery-list", label: "Standing", status: "done" },
        { id: "grocery-list:party", kind: "grocery-list", label: "Party", status: "done" },
      ] as never,
      edges: [],
    },
  });

  it("are the records that stand, by order then label, the label standing for an action unsaid", () => {
    const policies = policiesOf(store.graph as never, schema, "rule");
    expect(policies.map((policy) => policy.id)).toEqual(["rule:a", "rule:b", "rule:none"]);
    expect(policies[2]!.action).toBe("Its own words");
    expect(policiesOf(store.graph as never, schema, undefined)).toEqual([]);
  });

  it("apply to every record, a kind's, or the records a rule-language condition holds of", () => {
    const [keep] = policiesOf(store.graph as never, schema, "rule");
    const graph = store.graph as never;
    expect(policyApplies(keep!, store.graph.getNode("grocery-list:standing") as never, graph, schema)).toBe(true);
    expect(policyApplies(keep!, store.graph.getNode("grocery-list:party") as never, graph, schema)).toBe(false);
    expect(policyApplies({ ...keep!, appliesTo: "grocery lists" }, store.graph.getNode("grocery-list:party") as never, graph, schema)).toBe(true);
    expect(policyApplies({ ...keep!, appliesTo: "rule" }, store.graph.getNode("grocery-list:party") as never, graph, schema)).toBe(false);
    expect(policyApplies({ ...keep!, appliesTo: "label ==" }, store.graph.getNode("grocery-list:party") as never, graph, schema)).toBe(false);
  });

  it("are handed to a model verbatim and in order, and nothing when none stand", () => {
    const words = policyInstruction(policiesOf(store.graph as never, schema, "rule"));
    expect(words).toContain("1. First: Keep the standing order (applies to label == 'Standing')\n2. Second: Say why\n3. Its own words");
    expect(policyInstruction([])).toBe("");
  });

  it("name a kind the app has, or the checker says so", () => {
    expect(codes(withSteps([{ archive: "grocery-list" }], { follows: "policy" }))).toEqual(["workflow-follows-unknown"]);
    expect(followsFindings("rule", workflowWorldOfDocument(HOME))).toEqual([]);
  });
});

describe("a suggestion of several is said as one and accepted a change at a time (f-job-approvals)", () => {
  const list = defineNode("grocery-list", { fields: z.object({ label: z.string() }) });
  const event = defineNode("event", { fields: z.object({ label: z.string() }) });
  const schema = createSchema([list, event]);
  const actor: Author = { kind: "system", id: "workflow:tidy", name: "Set aside", automated: true };
  const nick: Author = { kind: "human", id: "nick" };
  const storeOf = () =>
    new Store<AnySchema>({
      schema,
      snapshot: { nodes: [{ id: "grocery-list:a", kind: "grocery-list", label: "A" }, { id: "grocery-list:b", kind: "grocery-list", label: "B" }, { id: "event:x", kind: "event", label: "X" }] as never, edges: [] },
    });
  const calls = [
    { name: "archive-grocery-list", args: { id: "grocery-list:a" } },
    { name: "archive-grocery-list", args: { id: "grocery-list:b" } },
    { name: "edit-event", args: { id: "event:x", label: "Y" } },
  ];

  it("counts what its changes would do, by what and of which kind", () => {
    const store = storeOf();
    const preview = store.previewAll(calls, { author: actor });
    expect(proposalWords(schema, store.graph, preview.ops, "Next week")).toBe("Next week: one event to change, 2 grocery lists to archive");
    expect(proposalWords(schema, store.graph, [])).toBe("Nothing to change");
  });

  it("keeps each call's sentence and its maker's headline, and takes the places a person accepts", () => {
    const store = storeOf();
    const op = suggest(store, calls, { author: actor, lineage: { basis: "done", run: "workflow:tidy:1" }, intent: "Set aside: 2 to archive" })!;
    expect(op.suggestsSaid).toHaveLength(3);
    const [group] = suggestions(store);
    expect(group!.headline).toBe("Set aside: 2 to archive");
    expect(group!.items.map((item) => item.at)).toEqual([0, 1, 2]);
    acceptSuggestion(store, op.id, { author: nick, items: [0, 2] });
    expect(store.log.all().at(-1)!.lineage?.items).toEqual([0, 2]);
    expect(suggestions(store)[0]!.items.map((item) => item.at)).toEqual([1]);
    expect(() => acceptSuggestion(store, op.id, { author: nick, items: [0] })).toThrow("Name the changes to accept");
    acceptSuggestion(store, op.id, { author: nick });
    expect(store.log.all().at(-1)!.lineage?.items).toEqual([1]);
    expect(suggestions(store)).toEqual([]);
  });

  it("keeps a lineage's places only as whole numbers", () => {
    expect(lineageOf({ basis: "b", items: [0, 3] })?.items).toEqual([0, 3]);
    expect(() => lineageOf({ basis: "b", items: [-1] })).toThrow();
    expect(() => lineageOf({ basis: "b", items: [] })).toThrow();
  });
});
