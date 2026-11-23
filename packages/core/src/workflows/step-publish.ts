import * as z from "../schema/zod.js";
import type { PublishStep } from "../workflow-shape.js";
import type { StepCheck, StepKind, StepShapes, WorkflowFinding } from "./steps.js";

/*
 * PUBLISH THE APP'S DRAFTS (Roadmap f-workflow-step-publishes): in an app
 * that publishes, the built-in `publish` act — the one a publisher presses —
 * run as the workflow's own actor under the step's approval, so a
 * scheduled sync finishes by publishing rather than waiting for somebody
 * outside the app to. `"head"` publishes everything to the head as the
 * step reaches it; `"run"` publishes through what this run read and made,
 * leaving what somebody else changed meanwhile a draft. It touches no
 * record, so it reads and writes no kind. Running it is
 * `@graview/tools/workflows`' (`runPublishStep`); a live app has nothing
 * to publish, and the checker says so.
 */

export const publishStep: StepKind<PublishStep> = {
  key: "publish",
  title: "Publish the drafts",
  shape: (s: StepShapes) =>
    z.strictObject({
      publish: z.enum(["head", "run"], 'publish is "head" (every draft, to the head) or "run" (through what this run read and made)'),
      approve: z.optional(s.approve),
    }),
  findings(_step, check: StepCheck): WorkflowFinding[] {
    if (check.world.publishes) return [];
    return [
      {
        code: "workflow-publish-live",
        severity: "error",
        path: `steps.${check.index}.publish`,
        message: `${check.said} publishes, and the app is live: every edit reaches its readers as it is made, so there is nothing to publish.`,
        fix: `Say "publishing": { "mode": "on-publish", "working": ["<the roles that edit drafts>"] } on the app, or let this step go.`,
      },
    ];
  },
  words(step) {
    return step.publish === "run" ? "Publish what this run read and made" : "Publish every draft";
  },
  touches() {
    return { reads: [], writes: [] };
  },
};
