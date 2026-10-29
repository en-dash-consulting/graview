import type { AnySchema, GraviewApp, Store } from "@graview/core";
import type { HostAi } from "../ai.js";
import type { WorkflowTools } from "../agent/workflow-tools.js";
import { runWorkflow } from "./run.js";
import type { WorkflowLog } from "./types.js";

/**
 * WHAT A HOST HANDS AN OWNER'S SEAT (Roadmap f-jobs-declared): a way to run
 * the app's workflows over its store, kept in its log, an agent step asking
 * its model — `createToolRuntime(store, { workflows: seatWorkflows(…) })`
 * then lists `run_workflow`, and with `edit` (the host's write of the
 * declaration) `pause_workflow` and `resume_workflow`. A run is the app's
 * own actor's, `workflow:<name>`, whoever pressed it.
 */
export function seatWorkflows<S extends AnySchema>(options: {
  readonly app: GraviewApp<S>;
  readonly store: Store<S>;
  readonly log: WorkflowLog;
  readonly ai?: HostAi;
  readonly edit?: WorkflowTools["edit"];
}): WorkflowTools {
  return {
    run: (name, { dryRun, who }) =>
      runWorkflow({
        app: options.app,
        store: options.store,
        workflow: name,
        log: options.log,
        trigger: { kind: "byHand", ...(who !== undefined ? { who } : {}) },
        ...(dryRun ? { dryRun: true } : {}),
        ...(options.ai ? { ai: options.ai } : {}),
      }),
    ...(options.edit ? { edit: options.edit } : {}),
  };
}
