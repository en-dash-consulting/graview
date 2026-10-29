import { Store, type AnySchema, type GraviewApp, type Operation } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredWorkflows, triggeredBy } from "@graview/core/workflows";
import { describe, expect, it } from "vitest";
import { memoryWorkflowLog, MOST_CHAIN, runWorkflow, type WorkflowLog, type WorkflowRun } from "../../src/workflows.js";

/*
 * TWO WORKFLOWS THAT WAKE EACH OTHER STOP AT THE CHAIN LIMIT (Roadmap
 * f-workflow-runs-say-more, request workflow-chains-with-a-depth-limit):
 * "ping" makes a pong when a ping is made, and "pong" a ping when a pong
 * is. What one's run makes starts the other (`triggeredBy` says whose run
 * it was), each run carries the chain of workflows behind it, and the run
 * one deeper than the limit (3 when unsaid) is held and says so in words —
 * never silently, and never forever.
 */

const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Echo",
  kinds: {
    ping: { label: "{name}", fields: { name: { type: "string", required: true } } },
    pong: { label: "{name}", fields: { name: { type: "string", required: true } } },
  },
  acts: {
    "add-ping": { title: "Add a ping", args: { name: { type: "string", required: true } }, effects: [{ create: "ping", set: { name: "$name" } }] },
    "add-pong": { title: "Add a pong", args: { name: { type: "string", required: true } }, effects: [{ create: "pong", set: { name: "$name" } }] },
  },
  workflows: {
    ping: { title: "Answer a ping", when: [{ made: "ping" }, { byHand: true }], approve: "apply", steps: [{ act: "add-pong", args: { name: "pong" } }] },
    pong: { title: "Answer a pong", when: [{ made: "pong" }], approve: "apply", steps: [{ act: "add-ping", args: { name: "ping" } }] },
  },
};

const compiled = compileDocument(DOCUMENT);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const declared = declaredWorkflows(app)!;
const NOW = "2026-11-01T16:00:00.000Z";

/** A host's loop: each commit judged for each workflow, and each one it fires run with what fired it. */
async function echo(store: Store<AnySchema>, log: WorkflowLog, chainLimit?: number): Promise<WorkflowRun[]> {
  const runs: WorkflowRun[] = [];
  let at = 0;
  let next: WorkflowRun = await runWorkflow({ app, store, log, workflow: "ping", now: new Date(Date.parse(NOW) + at++ * 1000).toISOString(), ...(chainLimit !== undefined ? { chainLimit } : {}) });
  runs.push(next);
  for (let turn = 0; turn < 20; turn++) {
    const ops = store.log.all().filter((op: Operation) => op.lineage?.run === next.id);
    const fired = Object.entries(declared).flatMap(([name, one]) => triggeredBy({ name, title: one.title, when: one.when }, { ops }, store).map((found) => ({ name, found })));
    if (fired.length === 0) break;
    const { name, found } = fired[0]!;
    next = await runWorkflow({ app, store, log, workflow: name, now: new Date(Date.parse(NOW) + at++ * 1000).toISOString(), trigger: { kind: "made", records: found.records, ...(found.by ? { by: found.by } : {}) }, ...(chainLimit !== undefined ? { chainLimit } : {}) });
    runs.push(next);
    if (next.outcome === "held") break;
  }
  return runs;
}

/** The first run after a workflow is added is a dry run: warm both up so the loop's runs keep. */
async function warmed() {
  const store = new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: { nodes: [], edges: [] } as never });
  const log = memoryWorkflowLog();
  await runWorkflow({ app, store, log, workflow: "ping", now: NOW, dryRun: true });
  await runWorkflow({ app, store, log, workflow: "pong", now: NOW, dryRun: true });
  return { store, log };
}

describe("two workflows that wake each other", () => {
  it("each carry the chain behind them, and the run past the limit is held and says so", async () => {
    const { store, log } = await warmed();
    const runs = await echo(store, log);
    expect(MOST_CHAIN).toBe(3);
    expect(runs.map((run) => [run.workflow, run.chain.length, run.outcome])).toEqual([
      ["ping", 0, "ok"],
      ["pong", 1, "ok"],
      ["ping", 2, "ok"],
      ["pong", 3, "ok"],
      ["ping", 4, "held"],
    ]);
    expect(runs[3]!.chain).toEqual(["ping", "pong", "ping"]);
    const held = runs.at(-1)!;
    expect(held.made).toEqual([]);
    expect(held.notes.join(" ")).toContain("was started by a chain of 4 workflow runs");
    expect(held.notes.join(" ")).toContain("past the limit of 3: it did not run");
    expect(held.notes.join(" ")).toContain("“Answer a ping” → “Answer a pong”");
  });

  it("stop at a limit the host says", async () => {
    const { store, log } = await warmed();
    const runs = await echo(store, log, 1);
    expect(runs.map((run) => run.outcome)).toEqual(["ok", "ok", "held"]);
    expect(runs.at(-1)!.notes.join(" ")).toContain("past the limit of 1");
  });

  it("a run a person started carries no chain", async () => {
    const { store, log } = await warmed();
    const run = await runWorkflow({ app, store, log, workflow: "ping", now: NOW });
    expect(run.chain).toEqual([]);
  });
});
