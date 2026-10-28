import { canonicalize } from "../document/canonical.js";
import { shapesFor } from "../document/computed-values.js";
import { evaluateExpr, NodeSet, type Value } from "../document/expr/evaluate.js";
import { parseExpr } from "../document/expr/parse.js";
import type { AnyGraphNode, GraphReader } from "../graph/types.js";
import { sha256Hex } from "../integrity.js";
import { answerJob } from "../jobs.js";
import type { Principal } from "../permissions/types.js";
import type { AnySchema } from "../schema/schema.js";
import type { Store } from "../store.js";
import type { WorkflowDeclaration, WorkflowOver, WorkflowValue } from "../workflow-shape.js";

/*
 * WHAT A STEP READS, worked out as a runner needs it: the records `over`
 * picks, as the run's author sees them; the value a step hands an act,
 * read on the record it is over, as an act's own `{ expr }` values are;
 * the key of what it makes; and the hash of a workflow as declared, which
 * says whether the next run is the first after a change.
 */

/** The ids of the records a step runs over, as `principal` sees them: those of the kind `where` holds of, at most `limit`, in the order they stand. */
export function recordsOver<S extends AnySchema>(store: Store<S>, over: WorkflowOver, principal: Principal): string[] {
  const ids = answerJob(store, { kind: over.kind, ...(over.where !== undefined ? { where: over.where } : {}) }, principal).ids;
  return over.limit === undefined ? [...ids] : ids.slice(0, over.limit);
}

/** A value the language gives, as an act's argument takes it: a record as its id, a set as its ids. */
const asArgument = (value: Value): unknown => {
  if (value instanceof NodeSet) return value.nodes.map((node) => node.id);
  if (Array.isArray(value)) return value.map((one) => asArgument(one as Value));
  if (value !== null && typeof value === "object") return (value as AnyGraphNode).id;
  return value;
};

/**
 * A STEP'S VALUE, as the act is handed it: `{ expr }` read with the record
 * as its subject; `$subject` the record's id; `$now` and `$today` the
 * run's moment and day; `$$…` a literal "$…"; anything else as written.
 */
export function workflowValue<S extends AnySchema>(value: WorkflowValue, record: AnyGraphNode | undefined, store: Store<S>, now: { readonly at: string; readonly today: string }): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value) && "expr" in value) {
    const any = store as unknown as Store<AnySchema>;
    return asArgument(evaluateExpr(parseExpr((value as { expr: string }).expr), { graph: any.graph as unknown as GraphReader, subject: record ?? null, kinds: shapesFor(any.schema), today: now.today, ...(record ? { bindings: { subject: record } } : {}) }));
  }
  if (typeof value === "string") {
    if (value.startsWith("$$")) return value.slice(1);
    if (value === "$subject") return record?.id;
    if (value === "$now") return now.at;
    if (value === "$today") return now.today;
  }
  return value;
}

/** A key template read on what a step has: "{id}:{date}" → "task:7f3:2026-11-02". A name it has no value for reads as nothing. */
export function workflowKey(template: string, values: Readonly<Record<string, unknown>>): string {
  return template.replace(/\{([^{}|\s]+)(?:\s*\|[^{}]*)?\}/g, (_, name: string) => {
    const value = values[name];
    return value === undefined || value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

/** A workflow as declared, hashed — all but whether it is paused, which changes when it runs, not what it does. */
export function workflowSpecHash(declared: WorkflowDeclaration): string {
  const { status: _status, ...rest } = declared;
  return sha256Hex(canonicalize(rest));
}

/** A key as an id may carry it: letters, digits and a few marks; a long one, or one with none of those, by its hash. */
const keySlug = (text: string): string => {
  const slug = text.toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 && slug.length <= 120 ? slug : sha256Hex(text).slice(0, 24);
};

/**
 * THE ID A KEYED RECORD IS MADE UNDER (Roadmap f-job-idempotency):
 * `<prefix>:wf.<workflow>.<key>` — the prefix the kind's ids carry, the
 * workflow's name and the key slugged — asked for as a client asks for an
 * id, so the store itself refuses a second record of the same key.
 */
export const keyedId = (prefix: string, workflow: string, key: string): string => `${prefix}:wf.${workflow}.${keySlug(key)}`;
