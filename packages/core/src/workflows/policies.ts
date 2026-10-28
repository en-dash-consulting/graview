import type { GraphReader } from "../graph/types.js";
import type { AnySchema } from "../schema/schema.js";
import type { WorkflowFinding } from "./steps.js";
import type { WorkflowWorld } from "./world.js";

/*
 * RULE INPUTS (Roadmap f-job-rule-inputs): a workflow that `follows` a kind
 * of policy records reads them once per run; an agent step is told them
 * verbatim. The foundation's placeholder: W4 (feat/workflow-retain-approve)
 * writes the convention a policy record is read by.
 */

/** One policy record as a run reads it. */
export type WorkflowPolicy = Readonly<Record<string, unknown>>;

/** The policy records of the kind a workflow follows, in order. None until the convention is written. */
export function policiesOf(_graph: GraphReader, _schema: AnySchema, follows: string | undefined): readonly WorkflowPolicy[] {
  return follows === undefined ? [] : [];
}

/** The policies, said to a model after its instruction; "" for none. */
export function policyInstruction(policies: readonly WorkflowPolicy[]): string {
  return policies.length === 0 ? "" : `\n\nFollow these policies, in order:\n${policies.map((policy, at) => `${at + 1}. ${JSON.stringify(policy)}`).join("\n")}`;
}

/** What the checker says of `follows`: a kind the app does not have. */
export function followsFindings(follows: string | undefined, world: WorkflowWorld): WorkflowFinding[] {
  if (follows === undefined || world.kinds.has(follows)) return [];
  return [{ code: "workflow-follows-unknown", severity: "error", path: "follows", message: `The workflow follows “${follows}” records, and “${follows}” is not a kind of this app.`, fix: `Name the kind its policy records are, one of ${[...world.kinds.keys()].map((kind) => `"${kind}"`).join(", ") || "none"}.` }];
}
