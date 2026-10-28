import type { ActStep } from "@graview/core/workflows";
import type { StepRunner } from "./types.js";

/** RUN AN ACT, once or over each record `over` picks; a `key` makes a rerun change what it made rather than make another. */
export const runActStep: StepRunner<ActStep> = {
  key: "act",
  async run(_step, context) {
    context.skipped("Running an act is not built yet.");
  },
};
