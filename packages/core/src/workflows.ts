/**
 * `@graview/core/workflows` — WHAT THE APP DOES ON ITS OWN, AND WHEN
 * (Roadmap f-jobs-declared).
 *
 * The declaration's `workflows`, read: their shape (`WorkflowSpec`), the
 * closed set of step kinds (`STEP_KINDS`) and what each may name
 * (`workflowWorldOfDocument`, `workflowWorldOfApp`). Running one is
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
