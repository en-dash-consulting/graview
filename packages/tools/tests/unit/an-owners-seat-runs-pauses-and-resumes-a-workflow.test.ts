import { readFileSync } from "node:fs";
import { compileDocument } from "@graview/core/check";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";
import { memoryWorkflowLog, seatWorkflows } from "../../src/workflows.js";

/*
 * AN OWNER'S SEAT RUNS, PAUSES AND RESUMES A WORKFLOW (Roadmap
 * f-jobs-declared). A host hands an owner's seat `workflows` (`seatWorkflows`:
 * its store, its log of runs, and its own write of the declaration) — and the seat lists
 * `run_workflow`, `pause_workflow` and `resume_workflow` for an app that
 * declares workflows: none for a read-only seat, none unhanded, and no
 * pause where the host writes no declaration. A run is the app's own
 * actor's, kept in the host's log: the first after a change is dry, the
 * next keeps what it makes, and a dry run asked for keeps nothing.
 */

const household = (): GraviewApp<AnySchema> => {
  const document = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/workflows.gdd.json", import.meta.url), "utf8"));
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return compiled.app as GraviewApp<AnySchema>;
};

const OWNER = { kind: "human" as const, id: "u:owner", roles: ["owner"] };

function storeOf(app: GraviewApp<AnySchema>): Store<AnySchema> {
  const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], ...(app.policy ? { policy: app.policy } : {}) });
  for (const name of ["Swim practice", "Piano lesson"]) store.apply({ name: "add-routine", args: { name } }, { author: OWNER });
  return store;
}

const names = (definitions: readonly { readonly name: string }[]) => definitions.map((tool) => tool.name).filter((name) => name.endsWith("_workflow"));

describe("an owner's seat and the app's workflows", () => {
  it("lists run, pause and resume when its host hands it the log and a write of the declaration, run alone without the write, and none read-only or unhanded", () => {
    const app = household();
    const store = storeOf(app);
    const log = memoryWorkflowLog();
    const edit = async () => ({ ok: true as const });
    const managed = seatWorkflows({ app, store, log, edit });
    expect(names(createToolRuntime(store, { author: OWNER, app, workflows: managed }).definitions)).toEqual(["run_workflow", "pause_workflow", "resume_workflow"]);
    expect(names(createToolRuntime(store, { author: OWNER, app, workflows: seatWorkflows({ app, store, log }) }).definitions)).toEqual(["run_workflow"]);
    expect(names(createToolRuntime(store, { author: OWNER, app, readOnly: true, workflows: managed }).definitions)).toEqual([]);
    expect(names(createToolRuntime(store, { author: OWNER, app }).definitions)).toEqual([]);
    const none = { ...app, workflows: undefined };
    expect(names(createToolRuntime(store, { author: OWNER, app: none, workflows: seatWorkflows({ app: none, store, log, edit }) }).definitions)).toEqual([]);
  });

  it("names the app's workflows as the only names a call takes", () => {
    const app = household();
    const store = storeOf(app);
    const run = createToolRuntime(store, { author: OWNER, app, workflows: seatWorkflows({ app, store, log: memoryWorkflowLog() }) }).definitions.find((tool) => tool.name === "run_workflow")!;
    expect((run.inputSchema["properties"] as Record<string, { enum?: string[] }>)["name"]!.enum).toEqual(["next-weeks-events", "keep-events-in-step", "set-aside-done-lists"]);
    expect(run.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });

  it("lists the same tools without a store, from the declaration alone", () => {
    const app = household();
    const declared = ["next-weeks-events", "keep-events-in-step", "set-aside-done-lists"];
    expect(names(toolDefinitions(app, OWNER, { workflows: { names: declared, manage: true } }).definitions)).toEqual(["run_workflow", "pause_workflow", "resume_workflow"]);
    expect(names(toolDefinitions(app, OWNER, { workflows: { names: declared } }).definitions)).toEqual(["run_workflow"]);
    expect(names(toolDefinitions(app, OWNER, { workflows: { names: [] } }).definitions)).toEqual([]);
    expect(names(toolDefinitions(app, OWNER).definitions)).toEqual([]);
  });

  it("runs a workflow as the app's own actor: dry the first time after a change, kept the next, and nothing kept when a dry run is asked for", async () => {
    const app = household();
    const store = storeOf(app);
    const log = memoryWorkflowLog();
    const seat = createToolRuntime(store, { author: OWNER, app, workflows: seatWorkflows({ app, store, log }) });
    const events = () => store.graph.nodesOfKind("event" as never).length;

    const first = await seat.call("run_workflow", { name: "next-weeks-events" });
    expect(first).toMatchObject({ ok: true, data: { workflow: "next-weeks-events", dry: true, outcome: "ok" } });
    expect((first as { data: { made: string[] } }).data.made).toHaveLength(2);
    expect(events()).toBe(0);

    const kept = await seat.call("run_workflow", { name: "next-weeks-events" });
    expect(kept).toMatchObject({ ok: true, data: { dry: false } });
    expect(events()).toBe(2);
    // Made by the app's own actor, under the run's id.
    const made = store.log.all().filter((op) => op.lineage?.run === (kept as { data: { run: string } }).data.run);
    expect(made.length).toBeGreaterThan(0);
    expect(made.every((op) => op.author.kind === "system" && op.author.id === "workflow:next-weeks-events")).toBe(true);

    const asked = await seat.call("run_workflow", { name: "next-weeks-events", dryRun: true });
    expect(asked).toMatchObject({ ok: true, data: { dry: true } });
    expect(events()).toBe(2);
    expect(log.runs("next-weeks-events")).toHaveLength(3);
    expect(log.last("next-weeks-events")?.trigger).toEqual({ kind: "byHand", who: "u:owner" });
  });

  it("pauses and resumes through the host's write, says a workflow already paused, and hands back the edit that takes it back", async () => {
    const app = household();
    const written: unknown[] = [];
    const store = storeOf(app);
    const seat = createToolRuntime(store, { author: OWNER, app, workflows: seatWorkflows({ app, store, log: memoryWorkflowLog(), edit: async (edit) => (written.push(edit), { ok: true }) }) });
    expect(await seat.call("pause_workflow", { name: "next-weeks-events" })).toMatchObject({ ok: true, data: { status: "paused", undo: { op: "resume-workflow", name: "next-weeks-events" } } });
    expect(await seat.call("pause_workflow", { name: "set-aside-done-lists" })).toMatchObject({ ok: true, data: { status: "paused", said: "“Set aside done grocery lists” is already paused. Nothing was changed." } });
    expect(await seat.call("resume_workflow", { name: "set-aside-done-lists" })).toMatchObject({ ok: true, data: { status: "active", undo: { op: "pause-workflow", name: "set-aside-done-lists" } } });
    expect(written).toEqual([
      { op: "pause-workflow", name: "next-weeks-events" },
      { op: "resume-workflow", name: "set-aside-done-lists" },
    ]);
  });

  it("refuses a workflow the app does not have, naming the ones it does", async () => {
    const app = household();
    const store = storeOf(app);
    const seat = createToolRuntime(store, { author: OWNER, app, workflows: seatWorkflows({ app, store, log: memoryWorkflowLog() }) });
    const refused = await seat.call("run_workflow", { name: "weekly-report" });
    expect(refused).toMatchObject({ ok: false, reason: "invalid" });
    expect((refused as { error: string }).error).toBe('No workflow is called "weekly-report". The app\'s workflows are: next-weeks-events, keep-events-in-step, set-aside-done-lists. Nothing was changed.');
  });
});
