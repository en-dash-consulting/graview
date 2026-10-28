import type { AnySchema } from "@graview/core";
import type { RunWorkflowOptions, WorkflowRun } from "./types.js";

/** RUN ONE WORKFLOW. */
export async function runWorkflow<S extends AnySchema>(options: RunWorkflowOptions<S>): Promise<WorkflowRun> {
  throw new Error(`Running the workflow "${options.workflow}" is not built yet.`);
}
