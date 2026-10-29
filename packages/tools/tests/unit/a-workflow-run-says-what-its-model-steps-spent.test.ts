import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import type { HostAi } from "../../src/ai.js";
import type { Decide } from "../../src/fast.js";
import { memoryWorkflowLog, runWorkflow } from "../../src/workflows.js";

/*
 * A WORKFLOW RUN SAYS WHAT ITS MODEL STEPS SPENT (Roadmap
 * f-workflow-runs-say-more, requests workflow-run-says-model-spend and
 * classify-step-reports-usage): an agent step's reply usage and a classify
 * step's requests through `decide` are counted on the run, by step and in
 * all, so a host meters a run from the run alone — with nothing wrapped
 * around `complete` or `decide`. A run that asked no model spent nothing.
 */

const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Feedback",
  kinds: {
    feedback: { noun: "feedback", plural: "feedback", label: "{title}", fields: { title: { type: "string", required: true }, category: { type: "enum", options: ["spam", "good-to-show"] }, done: { type: "boolean" } } },
  },
  workflows: {
    sort: {
      title: "Sort the feedback",
      when: [{ byHand: true }],
      approve: "apply",
      steps: [
        { agent: "Mark what is answered as done.", reads: ["feedback"], acts: ["edit-feedback"], model: "thinker" },
        { classify: "feedback", field: "category", approve: "apply" },
      ],
    },
    plain: { title: "Plain", when: [{ byHand: true }], steps: [{ archive: "feedback", where: "done" }] },
  },
};

const compiled = compileDocument(DOCUMENT);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const NOW = "2026-11-01T16:00:00.000Z";

const storeOf = () =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    now: () => NOW,
    snapshot: { nodes: [{ id: "f-1", kind: "feedback", title: "Buy watches" }, { id: "f-2", kind: "feedback", title: "Lovely app" }, { id: "f-3", kind: "feedback", title: "Thanks" }], edges: [] } as never,
  });

const ai = (): HostAi => {
  const decide: Decide = async (state) => {
    const choice = /watches/.test(JSON.stringify(state)) ? "spam" : "good-to-show";
    return { answers: { label: { type: "choice", choice, confidence: 0.9, probabilities: { [choice]: 0.9 } } }, usage: { inputTokens: 120, outputTokens: 4 } };
  };
  return { name: "jev-test", decide, complete: async () => ({ text: '{"proposals": []}', usage: { inputTokens: 800, outputTokens: 30, costUsd: 0.01 } }) } as HostAi;
};

describe("a workflow run's spend", () => {
  it("counts the agent step's reply usage and the classify step's requests, by step and in all, on a dry run too", async () => {
    const store = storeOf();
    const log = memoryWorkflowLog();
    const lent = ai();
    // The first run after a workflow is added is dry, and still asks its models.
    const run = await runWorkflow({ app, store, log, workflow: "sort", now: NOW, ai: lent });
    expect(run.dry).toBe(true);
    expect(run.spent.steps).toEqual([
      { step: 0, calls: 1, inputTokens: 800, outputTokens: 30, costUsd: 0.01, model: "thinker" },
      { step: 1, calls: 3, inputTokens: 360, outputTokens: 12, model: "jev-test" },
    ]);
    expect(run.spent).toMatchObject({ calls: 4, inputTokens: 1160, outputTokens: 42, costUsd: 0.01 });
    // The next run's labels are answered from what was asked: only the agent step spends.
    const again = await runWorkflow({ app, store, log, workflow: "sort", now: NOW, ai: lent });
    expect(again.dry).toBe(false);
    expect(again.spent.steps.map((one) => one.step)).toEqual([0]);
  });

  it("counts a call the model failed to answer, with no tokens", async () => {
    const store = storeOf();
    const log = memoryWorkflowLog();
    const failing = { name: "thinker", complete: async () => Promise.reject(new Error("overloaded")) } as unknown as HostAi;
    await runWorkflow({ app, store, log, workflow: "sort", now: NOW, ai: failing });
    const run = await runWorkflow({ app, store, log, workflow: "sort", now: NOW, ai: failing });
    expect(run.spent.steps[0]).toEqual({ step: 0, calls: 1, inputTokens: 0, outputTokens: 0, model: "thinker" });
  });

  it("is nothing for a run that asked no model", async () => {
    const run = await runWorkflow({ app, store: storeOf(), log: memoryWorkflowLog(), workflow: "plain", now: NOW });
    expect(run.spent).toEqual({ calls: 0, inputTokens: 0, outputTokens: 0, steps: [] });
  });
});
