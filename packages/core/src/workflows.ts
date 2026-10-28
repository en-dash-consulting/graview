/**
 * `@graview/core/workflows` — WHAT THE APP DOES ON ITS OWN, AND WHEN
 * (Roadmap f-jobs-declared).
 *
 * The declaration's `workflows`, read: their shape (`WorkflowSpec`), the
 * closed set of step kinds (`STEP_KINDS`) and what each may name
 * (`workflowWorldOfDocument`, `workflowWorldOfApp`), each resolved with its
 * defaults (`workflowsOf`, dreaming among them), said in a sentence
 * (`workflowWords`), when it next runs on its clock (`nextRunAt`), what a
 * commit starts (`triggeredBy`) and what the checker says of them
 * (`workflowFindings`). Running one is
 * `@graview/tools/workflows`' (`runWorkflow`). An entry of its own, on no
 * page: nothing a page draws runs a workflow.
 */
export type { ActStep, AgentStep, AppWorkflows, WorkflowApproval, WorkflowDeclaration, WorkflowOver, WorkflowStep, WorkflowTrigger, WorkflowValue } from "./workflow-shape.js";
export { MOST_STEPS, MOST_WORKFLOWS } from "./workflow-shape.js";
export { STEP_KINDS, stepKindOf, stepShapes, type StepCheck, type StepKind, type StepKindKey, type StepShapes, type WorkflowFinding } from "./workflows/steps.js";
export { actStep, keyFields, kindWords } from "./workflows/step-act.js";
export { agentStep } from "./workflows/step-agent.js";
export { workflowWorldOfApp, workflowWorldOfDocument, type WorkflowConnection, type WorkflowWorld } from "./workflows/world.js";
export { WorkflowSpec, WorkflowStepSpec, WorkflowTriggerSpec, WorkflowsSpec } from "./document/workflow-spec.js";
export { DREAMING, dreamingWorkflow, resolveWorkflow, workflowAuthor, workflowReach, workflowsOf, type ResolvedWorkflow } from "./workflows/resolve.js";
export { nextOf, nextRunAt, scheduleOf, scheduleOfCron, scheduleOfWords, scheduleWords, SCHEDULE_WORDS, type Schedule } from "./workflows/schedule.js";
export { triggerWords, workflowWords } from "./workflows/words.js";
export { triggeredBy, type FiredTrigger, type WorkflowCommit } from "./workflows/triggered.js";
export { documentWorkflowFindings, workflowFindings, workflowFindingsOf } from "./workflows/findings.js";
export { recordsOver, workflowKey, workflowSpecHash, workflowValue } from "./workflows/values.js";
export { followsFindings, policiesOf, policyInstruction, type WorkflowPolicy } from "./workflows/policies.js";
export { agoWords, lastRunWords, workflowSpots, workflowsOnTheMap, type MapWorkflow, type RunSaid, type SpotPlot, type WorkflowSpot } from "./workflows/on-the-map.js";
