import { shapesFor } from "../document/computed-values.js";
import { evaluateExpr, ExprEvalError, NodeSet } from "../document/expr/evaluate.js";
import { ExprSyntaxError, parseExpr } from "../document/expr/parse.js";
import type { AnyGraphNode, GraphReader } from "../graph/types.js";
import { labelOf, nounOf, pluralOf } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import type { WorkflowFinding } from "./steps.js";
import type { WorkflowWorld } from "./world.js";

/*
 * RULES A WORKFLOW FOLLOWS, KEPT AS RECORDS (Roadmap f-job-rule-inputs).
 * A workflow may say `follows: "<kind>"`: the app's own records of that
 * kind are its policy — "Recipes tagged family stay public", "Keep the
 * standing grocery list" — so whoever owns the app changes what it does by
 * editing a record, not a prompt. One convention, read by field name:
 *
 *   action    the rule in words (also `rule`, `instruction`, `text`); the
 *             record's label when it has none of these
 *   order     a number; lower first (also `rank`, `priority`)
 *   appliesTo a kind's name, or a rule-language condition read on each
 *             record (also `applies-to`, `applies_to`, `scope`); unsaid,
 *             every record
 *   status    the rule stands unless it says retired, off, inactive,
 *             paused, draft or archived (or `active` is false); an
 *             archived record is no rule
 *
 * An agent step is handed the rules that stand verbatim, in order
 * (`policyInstruction`); a deterministic step reads them — an archive step
 * passes by every record a rule whose action begins "keep" or "never
 * archive" applies to.
 */

/** One rule a workflow follows: the record it is, its words, its place, and what it applies to. */
export interface WorkflowPolicy {
  readonly id: string;
  readonly label: string;
  /** The rule, verbatim. */
  readonly action: string;
  readonly order?: number;
  /** A kind's name or a rule-language condition; absent, every record. */
  readonly appliesTo?: string;
}

const ACTION = ["action", "rule", "instruction", "text"];
const ORDER = ["order", "rank", "priority"];
const APPLIES = ["appliesTo", "applies-to", "applies_to", "scope"];
const RETIRED = /^(retired|off|inactive|paused|draft|archived|disabled)$/i;

const first = (node: Record<string, unknown>, names: readonly string[]): unknown => names.map((name) => node[name]).find((value) => value !== undefined && value !== null && value !== "");

/** Whether a policy record stands: not retired by its status, nor `active: false`. */
const stands = (node: Record<string, unknown>): boolean => node["active"] !== false && !(typeof node["status"] === "string" && RETIRED.test(node["status"].trim()));

/**
 * THE RULES THAT STAND, IN ORDER: the live records of `follows` whose
 * status does not retire them, by `order` (those with none last), then by
 * label. Nothing when the workflow follows nothing or the kind is not the app's.
 */
export function policiesOf(graph: Pick<GraphReader, "getNode"> & { nodesOfKind(kind: string): readonly AnyGraphNode[] }, schema: AnySchema, follows: string | undefined): WorkflowPolicy[] {
  if (follows === undefined || !schema.tryDefinition(follows)) return [];
  const definition = schema.tryDefinition(follows);
  return graph
    .nodesOfKind(follows)
    .filter((node) => stands(node as Record<string, unknown>))
    .map((node) => {
      const fields = node as Record<string, unknown>;
      const label = labelOf(definition as never, node);
      const action = first(fields, ACTION);
      const order = first(fields, ORDER);
      const applies = first(fields, APPLIES);
      return {
        id: node.id,
        label,
        action: typeof action === "string" ? action.trim() : label,
        ...(typeof order === "number" && Number.isFinite(order) ? { order } : {}),
        ...(typeof applies === "string" && applies.trim() !== "" ? { appliesTo: applies.trim() } : {}),
      };
    })
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.label.localeCompare(b.label));
}

/**
 * WHETHER A RULE APPLIES TO A RECORD: one that says nothing of what it
 * applies to applies to every record; one that names a kind (its name, or
 * its plural) to that kind's; anything else is read as a condition in the
 * rule language with the record as its subject — a mistake applies to nothing.
 */
export function policyApplies(policy: WorkflowPolicy, record: AnyGraphNode, graph: GraphReader, schema: AnySchema, today?: string): boolean {
  const said = policy.appliesTo;
  if (said === undefined) return true;
  const words = said.toLowerCase();
  if (schema.tryDefinition(said)) return said === record.kind;
  const names = (kind: string) => [pluralOf(schema, kind).toLowerCase(), nounOf(schema.tryDefinition(kind), kind).toLowerCase()];
  if (names(record.kind).includes(words)) return true;
  if (schema.definitions.some((one) => names(one.kind).includes(words))) return false;
  try {
    const value = evaluateExpr(parseExpr(said), { graph, subject: record, kinds: shapesFor(schema), ...(today ? { today } : {}) });
    return value instanceof NodeSet ? value.nodes.length > 0 : Array.isArray(value) ? value.length > 0 : value === true;
  } catch (error) {
    if (error instanceof ExprEvalError || error instanceof ExprSyntaxError) return false;
    throw error;
  }
}

/** Whether a rule says to keep what it applies to: its words begin "keep", "never archive" or "do not archive". */
export const keeps = (policy: WorkflowPolicy): boolean => /^(keep|never archive|do not archive|don['’]t archive)\b/i.test(policy.action);

/**
 * THE RULES, AS AN AGENT STEP IS HANDED THEM: verbatim, numbered in order,
 * under a line that says they are the app's own — or "" when none stand.
 */
export function policyInstruction(policies: readonly WorkflowPolicy[]): string {
  if (policies.length === 0) return "";
  const lines = policies.map((policy, at) => `${at + 1}. ${policy.action === policy.label ? policy.action : `${policy.label}: ${policy.action}`}${policy.appliesTo ? ` (applies to ${policy.appliesTo})` : ""}`);
  return `\n\nFollow these rules, which the app's own people keep, in order; an earlier one wins:\n${lines.join("\n")}`;
}

/** What the checker says of `follows`: a kind the app has, or a finding with the fix. */
export function followsFindings(follows: string | undefined, world: WorkflowWorld): WorkflowFinding[] {
  if (follows === undefined || world.kinds.has(follows)) return [];
  const kinds = [...world.kinds.keys()];
  return [
    {
      code: "workflow-follows-unknown",
      severity: "error",
      path: "follows",
      message: `The workflow follows the rules kept as "${follows}" records, and "${follows}" is not a kind of this app.`,
      fix: `Name the kind its rules are kept as: ${kinds.map((kind) => `"${kind}"`).join(", ") || "none"}.`,
    },
  ];
}
