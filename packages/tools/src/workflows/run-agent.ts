import type { AgentStep } from "@graview/core/workflows";
import type { StepRunner } from "./types.js";

/** LET A MODEL PROPOSE acts from the step's list over the kinds it reads; skipped, and said, with no model lent. */
export const runAgentStep: StepRunner<AgentStep> = {
  key: "agent",
  async run(_step, context) {
    context.skipped("No model was lent, so the model's step did not run.");
  },
};
