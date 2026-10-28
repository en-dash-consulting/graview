import { shapesFor } from "../document/computed-values.js";
import { evaluateExpr, ExprEvalError } from "../document/expr/evaluate.js";
import { parseExpr } from "../document/expr/parse.js";
import type { AnyGraphNode } from "../graph/types.js";
import type { Operation } from "../ops/types.js";
import type { Principal } from "../permissions/types.js";
import type { AnySchema } from "../schema/schema.js";
import type { Store } from "../store.js";
import { matchSubscriptions, type Subscription } from "../subscriptions.js";
import type { WorkflowTrigger } from "../workflow-shape.js";
import { workflowAuthor } from "./resolve.js";

/*
 * WHAT A COMMIT STARTS (Roadmap f-jobs-declared): which of a workflow's
 * `made`, `changed` and `synced` triggers a commit — the ops one landed —
 * or a connection's finished pass fires, and the records each was fired
 * by. Read by the same matcher a person's subscriptions are
 * (`matchSubscriptions`), as the workflow's own author sees the app: a
 * change the workflow made itself never starts it again.
 */

/** What a commit is, to a workflow: the ops it landed, or a connection's pass. */
export type WorkflowCommit = { readonly ops: readonly Operation[] } | { readonly synced: string };

/** A trigger a commit fired, and the records that fired it. */
export interface FiredTrigger {
  readonly trigger: WorkflowTrigger;
  readonly records: readonly string[];
}

const holds = (where: string | undefined, node: AnyGraphNode | undefined, store: Store<AnySchema>): boolean => {
  if (where === undefined) return true;
  if (!node) return false;
  try {
    const value = evaluateExpr(parseExpr(where), { graph: store.graph as never, subject: node, kinds: shapesFor(store.schema) });
    return value === true;
  } catch (error) {
    if (error instanceof ExprEvalError) return false;
    return false;
  }
};

/** The triggers of a workflow a commit fires, in the order declared. */
export function triggeredBy<S extends AnySchema>(workflow: { readonly name: string; readonly title: string; readonly when: readonly WorkflowTrigger[] }, commit: WorkflowCommit, given: Store<S>): FiredTrigger[] {
  const store = given as unknown as Store<AnySchema>;
  if ("synced" in commit) return workflow.when.filter((trigger) => "synced" in trigger && trigger.synced === commit.synced).map((trigger) => ({ trigger, records: [] }));
  const who = { ...workflowAuthor(workflow) } as Principal;
  const fired: FiredTrigger[] = [];
  workflow.when.forEach((trigger, at) => {
    if (!("made" in trigger) && !("changed" in trigger)) return;
    const kind = "made" in trigger ? trigger.made : trigger.changed;
    const subscription: Subscription = { id: `workflow:${workflow.name}:${at}`, who, app: "", when: "made" in trigger ? { on: "created", kind } : { on: "changed", kind }, at: "" };
    const records = new Set<string>();
    for (const match of matchSubscriptions(given, commit.ops, [subscription])) {
      for (const record of match.records) {
        if (record.kind !== kind) continue;
        if ("made" in trigger ? record.change !== "created" : record.change !== "changed") continue;
        if ("changed" in trigger && trigger.fields?.length && !(record.fields ?? []).some((field) => trigger.fields!.includes(field.field))) continue;
        if (!holds(trigger.where, store.graph.getNode(record.id) as AnyGraphNode | undefined, store)) continue;
        records.add(record.id);
      }
    }
    if (records.size > 0) fired.push({ trigger, records: [...records] });
  });
  return fired;
}
