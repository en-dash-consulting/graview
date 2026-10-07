import { Graph } from "./graph/graph.js";
import { UNSET, type Primitive } from "./graph/primitives.js";
import { edgeId, type AnyGraphNode, type GraphEdge, type GraphSnapshot } from "./graph/types.js";
import { evaluate } from "./invariants/engine.js";
import type { EvaluateOptions, InvariantDefinition } from "./invariants/types.js";
import { humanizeField, labelOf } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";

/**
 * STORED DATA, CHECKED AGAINST ITS DECLARATION (FR-21).
 *
 * A declaration changes; what was stored under the old one stays. A host
 * that holds thousands of stored apps needs to ask each one what no longer
 * fits — in codes a program can count, about ids a program can find — and
 * to fix it as an ordinary change that somebody made and somebody can take
 * back.
 *
 * THE CODES ARE A STABILITY SURFACE (docs/stability.md §4): a code never
 * changes meaning. A new one may appear.
 *
 *   node-shape       a record's fields do not fit its kind's declaration
 *   kind-unknown     a record of a kind the declaration no longer has
 *   edge-dangling    a link to or from a record that is not there
 *   edge-disallowed  a link the declaration does not allow between those kinds
 *   rule-error       a rule threw rather than judged (`could-not-judge`)
 *   rule-budget      a rule would have read more than its budget (`over-budget`)
 */
export type GraphFindingCode =
  | "node-shape"
  | "kind-unknown"
  | "edge-dangling"
  | "edge-disallowed"
  | "rule-error"
  | "rule-budget";

/** Every code, in the order findings are reported. */
export const GRAPH_FINDING_CODES: readonly GraphFindingCode[] = [
  "kind-unknown",
  "node-shape",
  "edge-dangling",
  "edge-disallowed",
  "rule-error",
  "rule-budget",
];

/**
 * The smallest fix for one finding. `drop` removes the record (with its
 * links first, so the undo puts them back) or the link; `clear` unsets an
 * optional field; `coerce` sets a required field to its declared default —
 * a zod `.default()`, or the kind's `defaults` (a document's).
 */
export interface FindingRepair {
  readonly action: "drop" | "clear" | "coerce";
  readonly primitives: readonly Primitive[];
}

export interface GraphFinding {
  readonly code: GraphFindingCode;
  /**
   * What it is about, by id: the record's id, a link as `kind:from->to`
   * (as `health()` names a dangling one), or a rule's subject (the rule's
   * own name for a graph-wide rule).
   */
  readonly id: string;
  /** The field (`node-shape`) or the rule (`rule-*`) concerned. A name, never a value. */
  readonly detail?: string;
  /** The finding in words, for a person. */
  readonly message: string;
  /** Absent for a rule finding: a rule that cannot judge is the declaration's to fix. */
  readonly repair?: FindingRepair;
}

/** What `validateGraph` reads of an app: its schema and its rules. */
export interface ValidatedApp<S extends AnySchema = AnySchema> {
  readonly schema: S;
  readonly invariants?: readonly InvariantDefinition<S>[];
}

export interface ValidateGraphOptions<S extends AnySchema = AnySchema> {
  /** Passed to the rules, as a store passes its own (`today` pins the horizon). */
  readonly invariantOptions?: EvaluateOptions<S>;
}

/** A stored node's fields that do not fit: undefined when it fits, [] when the failure names no field. */
function failingFields(schema: AnySchema, node: unknown): string[] | undefined {
  try {
    schema.parseNode(node);
    return undefined;
  } catch (error) {
    const issues = (error as { issues?: readonly { code?: string; path?: readonly PropertyKey[]; keys?: readonly string[] }[] }).issues ?? [];
    const fields = issues.flatMap((issue) =>
      issue.code === "unrecognized_keys" && issue.keys ? [...issue.keys] : typeof issue.path?.[0] === "string" ? [issue.path[0]] : [],
    );
    return [...new Set(fields)];
  }
}

/** The declared field schema, when the kind's fields are an object of them. */
function fieldSchema(schema: AnySchema, kind: string, field: string): { safeParse(value: unknown): { success: boolean; data?: unknown } } | undefined {
  const shape = (schema.tryDefinition(kind)?.fields as { shape?: Record<string, unknown> } | undefined)?.shape;
  return shape?.[field] as never;
}

function named(schema: AnySchema, node: AnyGraphNode): string {
  try {
    return labelOf(schema.tryDefinition(node.kind), node as never);
  } catch {
    return typeof node["label"] === "string" ? (node["label"] as string) : "A record";
  }
}

/** A link named the way `health()` names one: `kind:from->to`. */
const linkId = (edge: GraphEdge): string => `${edge.kind}:${edge.from}->${edge.to}`;

const byString = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * What in a stored graph no longer fits its declaration, each with its
 * smallest repair. Reads the snapshot as it is: nothing is parsed into it,
 * coerced or stripped. A clean graph has no findings.
 */
export function validateGraph<S extends AnySchema>(
  app: ValidatedApp<S>,
  snapshot: GraphSnapshot,
  options: ValidateGraphOptions<S> = {},
): GraphFinding[] {
  const { schema } = app;
  const findings: GraphFinding[] = [];
  const nodes = new Map<string, AnyGraphNode>();
  for (const node of snapshot.nodes) if (!nodes.has(node.id)) nodes.set(node.id, node);
  const edgesOf = (id: string): GraphEdge[] => snapshot.edges.filter((edge) => edge.from === id || edge.to === id);
  const drop = (node: AnyGraphNode): FindingRepair => ({
    action: "drop",
    primitives: [
      ...edgesOf(node.id)
        .filter((edge) => nodes.has(edge.from) && nodes.has(edge.to))
        .map((edge): Primitive => ({ op: "remove-edge", edge })),
      { op: "remove-node", node },
    ],
  });

  const unknownKind = new Set<string>();
  for (const node of [...nodes.values()].sort((a, b) => byString(a.id, b.id))) {
    if (!schema.tryDefinition(node.kind)) {
      unknownKind.add(node.id);
      findings.push({
        code: "kind-unknown",
        id: node.id,
        message: `${named(schema, node)} is a kind of record this app no longer has`,
        repair: drop(node),
      });
      continue;
    }
    const failing = failingFields(schema, node);
    if (failing === undefined) continue;
    const name = named(schema, node);
    /*
     * THE SMALLEST FIX, PER FIELD: an optional field is cleared, a required
     * one with a default takes it, and otherwise the record cannot be made to
     * fit and goes. The fix must itself fit, or the record goes.
     */
    const fixes = new Map<string, { action: "clear" | "coerce"; value: unknown }>();
    let fixable = failing.length > 0;
    for (const field of failing) {
      if (field === "id" || field === "kind") {
        fixable = false;
        continue;
      }
      const declared = fieldSchema(schema, node.kind, field);
      let empty = declared ? declared.safeParse(undefined) : { success: true, data: undefined };
      /*
       * A default declared beside the schema (a document's, FR-50): the zod
       * field cannot invent it, so a required field reads it here.
       */
      const beside = schema.tryDefinition(node.kind)?.defaults;
      if (!empty.success && declared && beside && Object.hasOwn(beside, field)) empty = declared.safeParse(beside[field]);
      if (!empty.success) fixable = false;
      else if (empty.data === undefined) fixes.set(field, { action: "clear", value: UNSET });
      else fixes.set(field, { action: "coerce", value: empty.data });
    }
    if (fixable) {
      const patched: Record<string, unknown> = { ...node };
      for (const [field, fix] of fixes) {
        if (fix.value === UNSET) delete patched[field];
        else patched[field] = fix.value;
      }
      if (failingFields(schema, patched) !== undefined) fixable = false;
    }
    if (failing.length === 0) {
      findings.push({ code: "node-shape", id: node.id, message: `${name} does not fit what ${node.kind} declares`, repair: drop(node) });
      continue;
    }
    for (const field of failing) {
      const fix = fixes.get(field);
      const repair: FindingRepair =
        fixable && fix
          ? {
              action: fix.action,
              primitives: [
                {
                  op: "patch-node",
                  id: node.id,
                  before: { [field]: node[field] === undefined ? UNSET : node[field] },
                  after: { [field]: fix.value },
                },
              ],
            }
          : drop(node);
      findings.push({
        code: "node-shape",
        id: node.id,
        detail: field,
        message: `${name}: ${humanizeField(field)} does not fit what ${node.kind} declares`,
        repair,
      });
    }
  }

  const seenEdges = new Set<string>();
  const held: GraphEdge[] = [];
  for (const edge of [...snapshot.edges].sort((a, b) => byString(edgeId(a), edgeId(b)))) {
    if (seenEdges.has(edgeId(edge))) continue;
    seenEdges.add(edgeId(edge));
    const id = linkId(edge);
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) {
      findings.push({
        code: "edge-dangling",
        id,
        message: "A link points at a record that is not there",
        repair: { action: "drop", primitives: [{ op: "remove-edge", edge }] },
      });
      continue;
    }
    held.push(edge);
    // A link from or to a record of an unknown kind goes with its record.
    if (unknownKind.has(from.id) || unknownKind.has(to.id)) continue;
    if (!schema.edgeAllowed(edge.kind, from.kind, to.kind)) {
      findings.push({
        code: "edge-disallowed",
        id,
        message: `${named(schema, from)} → ${named(schema, to)}: this app does not allow that link between them`,
        repair: { action: "drop", primitives: [{ op: "remove-edge", edge }] },
      });
    }
  }

  /*
   * THE RULES, JUDGED OVER THE GRAPH AS STORED. Held without validation —
   * a record that does not fit is exactly what a rule may fail to judge —
   * and without the dangling links, which a graph cannot hold.
   */
  const invariants = app.invariants ?? [];
  if (invariants.length > 0) {
    const graph = Graph.from(schema, { nodes: [...nodes.values()] as never, edges: held }, { validate: false });
    const seen = new Set<string>();
    let violations;
    try {
      violations = evaluate(graph, invariants, options.invariantOptions ?? {});
    } catch {
      violations = [{ invariant: "rules", status: "could-not-judge" as const, label: "The rules", message: "The rules could not be judged", nodeIds: [], repairs: [] }];
    }
    for (const violation of violations) {
      const code = violation.status === "could-not-judge" ? "rule-error" : violation.status === "over-budget" ? "rule-budget" : undefined;
      if (!code) continue;
      const id = violation.subjectId ?? violation.invariant;
      const key = `${code}|${id}|${violation.invariant}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ code, id, detail: violation.invariant, message: violation.message });
    }
  }

  return findings.sort(
    (a, b) =>
      GRAPH_FINDING_CODES.indexOf(a.code) - GRAPH_FINDING_CODES.indexOf(b.code) ||
      byString(a.id, b.id) ||
      byString(a.detail ?? "", b.detail ?? ""),
  );
}

export interface RepairPlan {
  /**
   * One batch: links removed first, then fields cleared or coerced, then
   * records removed — so its inverse puts the records back before their
   * links. Apply it with `store.applyPrimitives`.
   */
  readonly primitives: readonly Primitive[];
  /** The plan in words, counted ("2 fields that no longer fit would be cleared"). */
  readonly said: readonly string[];
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * The repairs of a set of findings, as one batch of primitives. A record
 * that goes takes its field fixes with it; a link two findings both remove
 * is removed once. Rule findings are left alone: they are the declaration's
 * to fix.
 */
export function repairPlan(findings: readonly GraphFinding[]): RepairPlan {
  const removedNodes = new Map<string, Primitive>();
  const removedEdges = new Map<string, Primitive>();
  const patches = new Map<string, { before: Record<string, unknown>; after: Record<string, unknown> }>();
  let unknown = 0;
  let unfit = 0;
  let cleared = 0;
  let coerced = 0;
  const dangling = new Set<string>();
  const disallowed = new Set<string>();
  let unjudged = 0;

  for (const finding of findings) {
    if (finding.code === "rule-error" || finding.code === "rule-budget") unjudged++;
    const repair = finding.repair;
    if (!repair) continue;
    for (const primitive of repair.primitives) {
      if (primitive.op === "remove-node") {
        if (!removedNodes.has(primitive.node.id)) {
          if (finding.code === "kind-unknown") unknown++;
          else unfit++;
        }
        removedNodes.set(primitive.node.id, primitive);
      } else if (primitive.op === "remove-edge") {
        const id = edgeId(primitive.edge);
        if (finding.code === "edge-dangling") dangling.add(id);
        if (finding.code === "edge-disallowed") disallowed.add(id);
        removedEdges.set(id, primitive);
      } else if (primitive.op === "patch-node") {
        const patch = patches.get(primitive.id) ?? { before: {}, after: {} };
        Object.assign(patch.before, primitive.before);
        Object.assign(patch.after, primitive.after);
        patches.set(primitive.id, patch);
      }
    }
  }

  const patchPrimitives: Primitive[] = [];
  for (const [id, patch] of [...patches].sort(([a], [b]) => byString(a, b))) {
    if (removedNodes.has(id)) continue;
    for (const value of Object.values(patch.after)) {
      if (value === UNSET) cleared++;
      else coerced++;
    }
    patchPrimitives.push({ op: "patch-node", id, before: patch.before, after: patch.after });
  }

  const said: string[] = [];
  if (unknown > 0) said.push(`${count(unknown, "record of a kind this app no longer has", "records of kinds this app no longer has")} would be removed, with their links`);
  if (cleared > 0) said.push(count(cleared, "field that no longer fits would be cleared", "fields that no longer fit would be cleared"));
  if (coerced > 0) said.push(count(coerced, "required field would be set to its default", "required fields would be set to their defaults"));
  if (unfit > 0) said.push(`${count(unfit, "record that cannot be made to fit would be removed", "records that cannot be made to fit would be removed")}, with their links`);
  if (dangling.size > 0) said.push(count(dangling.size, "link to a record that is not there would be removed", "links to records that are not there would be removed"));
  if (disallowed.size > 0) said.push(count(disallowed.size, "link this app no longer allows would be removed", "links this app no longer allows would be removed"));
  if (unjudged > 0) said.push(`${count(unjudged, "rule could not be judged", "rules could not be judged")}; that is the declaration's to fix, and a repair leaves it alone`);
  if (said.length === 0) said.push("Everything fits its declaration; there is nothing to repair.");

  return {
    primitives: [...removedEdges.values(), ...patchPrimitives, ...[...removedNodes.values()]],
    said,
  };
}
