import type { WorkflowStep } from "@graview/core/workflows";
import { runActStep } from "./run-act.js";
import { runAgentStep } from "./run-agent.js";
import type { StepRunner } from "./types.js";

/** Every kind of step, run, by the key `STEP_KINDS` tells it apart by. A new kind: its file, and one line here. */
export const STEP_RUNNERS: Readonly<Record<string, StepRunner<never>>> = {
  act: runActStep,
  agent: runAgentStep,
};

/** The runner for a step, by the one key of `STEP_RUNNERS` it holds. */
export function stepRunnerOf(step: WorkflowStep): StepRunner<WorkflowStep> | undefined {
  for (const key of Object.keys(STEP_RUNNERS)) if (key in step) return STEP_RUNNERS[key] as unknown as StepRunner<WorkflowStep>;
  return undefined;
}
