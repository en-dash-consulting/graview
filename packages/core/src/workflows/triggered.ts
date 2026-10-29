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
 * change the workflow made itself never starts it again. A change another
 * workflow's run made does, and the trigger says whose (`by`), so the run
 * it starts carries the chain and a loop stops at the runner's limit.
 */

/** What a commit is, to a workflow: the ops it landed, or a connection's pass. */
export type WorkflowCommit = { readonly ops: readonly Operation[] } | { readonly synced: string };

/** The workflow whose run made an op: its name, and the run (`lineage.run`) when the op says it. */
export interface WorkflowOrigin {
  readonly workflow: string;
  readonly run?: string;
}

/** A trigger a commit fired, the records that fired it, and the workflow whose run made the ops that did, when one did. */
export interface FiredTrigger {
  readonly trigger: WorkflowTrigger;
  readonly records: readonly string[];
  /** Another workflow's run made the ops that fired it: hand it to the run (`WorkflowRunTrigger.by`), which carries the chain and stops past its limit. */
  readonly by?: WorkflowOrigin;
}

/**
 * Which workflow's run made an op: its `lineage.run` (`workflow:<name>:<started>`),
 * else its author (`workflow:<name>`). Undefined for an op a person, a seat
 * or anything else made.
 */
export function workflowOrigin(op: Operation): WorkflowOrigin | undefined {
  const run = op.lineage?.run;
  const fromRun = typeof run === "string" ? /^workflow:([^:]+):/.exec(run) : null;
  if (fromRun) return { workflow: fromRun[1]!, run: run! };
  const fromAuthor = typeof op.author?.id === "string" ? /^workflow:([^:]+)$/.exec(op.author.id) : null;
  return fromAuthor ? { workflow: fromAuthor[1]! } : undefined;
}

/** The ids an op made or changed. */
const touched = (op: Operation): string[] => op.primitives.flatMap((primitive) => (primitive.op === "add-node" ? [primitive.node.id] : "id" in primitive && typeof primitive.id === "string" ? [primitive.id] : []));

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
    if (records.size === 0) return;
    const by = commit.ops.filter((op) => touched(op).some((id) => records.has(id))).map(workflowOrigin).find((origin) => origin !== undefined && origin.workflow !== workflow.name);
    fired.push({ trigger, records: [...records], ...(by ? { by } : {}) });
  });
  return fired;
}
