/*
 * `@graview/tools/workflows` — RUNNING WHAT THE APP DOES ON ITS OWN
 * (Roadmap f-jobs-declared, f-job-idempotency, f-job-pause-dry-run).
 *
 * `runWorkflow` runs one of the declaration's workflows once, as an
 * automated system author (`workflow:<name>`, named by its title), every
 * op it makes under one `lineage.run` so Activity reads the run as one
 * row. Each step goes to its runner (`STEP_RUNNERS`, keyed as core's
 * `STEP_KINDS` are) and every change through one door that applies,
 * previews, suggests or lets it go. The host keeps the runs
 * (`WorkflowLog`, `memoryWorkflowLog`). On no page.
 */
export { runWorkflow } from "./workflows/run.js";
export { memoryWorkflowLog } from "./workflows/log.js";
export { STEP_RUNNERS, stepRunnerOf } from "./workflows/steps.js";
export { runActStep } from "./workflows/run-act.js";
export { runAgentStep } from "./workflows/run-agent.js";
export { runGenerateStep } from "./workflows/run-generate.js";
export { runArchiveStep } from "./workflows/run-archive.js";
export { askedOf, type Asked, type AskedOptions } from "./workflows/ask.js";
export { runClassifyStep } from "./workflows/run-classify.js";
export type { ChangeOutcome, RunWorkflowOptions, StepChange, StepContext, StepRunner, WorkflowLog, WorkflowOutcome, WorkflowRun, WorkflowRunTrigger } from "./workflows/types.js";
export { seatWorkflows } from "./workflows/seat.js";
export type { WorkflowTools } from "./agent/workflow-tools.js";
