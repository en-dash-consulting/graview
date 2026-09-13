import { nodeRefArgs } from "@graview/core";
import type { AnyMutationDefinition, AnySchema, GraphEdge, GraphSnapshot, GraviewApp, InvariantDefinition } from "@graview/core";
import type { z } from "zod";
import type { FieldType } from "./meta.js";

/*
 * A DECLARATION READ INTO THE GRAPH. Every kind, field, edge, act, rule,
 * role, grant and lens the app declares becomes a node with a stable id —
 * `kind:plot`, `field:plot.label`, `edge:plot.tended-by`, `act:tend` — so
 * the same declaration read twice is the same graph, and a change is a
 * difference between two of them.
 */

type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;

interface ZodDef {
  readonly type?: string;
  readonly innerType?: unknown;
  readonly element?: unknown;
  readonly entries?: Record<string, unknown>;
  readonly checks?: readonly unknown[];
}
const defOf = (type: unknown): ZodDef =>
  ((type as { def?: ZodDef }).def ?? (type as { _def?: ZodDef })._def ?? {}) as ZodDef;

/** A zod field's type, as the studio names types. */
export function fieldTypeOf(type: unknown): { readonly type: FieldType; readonly required: boolean; readonly options?: readonly string[] } {
  let def = defOf(type);
  let required = true;
  while (def.type === "optional" || def.type === "nullable" || def.type === "default") {
    required = false;
    def = defOf(def.innerType);
  }
  switch (def.type) {
    case "number":
    case "int":
      return { type: "number", required };
    case "boolean":
      return { type: "boolean", required };
    case "date":
      return { type: "date", required };
    case "enum": {
      const options = Object.values(def.entries ?? {}).map(String);
      return { type: "enum", required, options };
    }
    case "array":
      return { type: "list", required };
    default:
      return { type: "string", required };
  }
}

const shapeOf = (fields: unknown): Record<string, unknown> =>
  ((fields as { shape?: Record<string, unknown> }).shape ?? {}) as Record<string, unknown>;

/** The app's declaration as the studio's graph. */
export function declarationToGraph<S extends AnySchema>(app: GraviewApp<S>): GraphSnapshot {
  const nodes: Node[] = [];
  const edges: GraphEdge[] = [];
  const kinds = app.schema.definitions;
  const kindId = (kind: string) => `kind:${kind}`;
  const edgeIds = new Map<string, string>();

  for (const def of kinds) {
    nodes.push({
      id: kindId(def.kind),
      kind: "kind",
      label: def.kind,
      ...(def.plural ? { plural: def.plural } : {}),
      ...(def.description ? { description: def.description } : {}),
      ...(def.lifecycle ? { lifecycleField: def.lifecycle.field, retired: def.lifecycle.retired === "date" ? ["date"] : def.lifecycle.retired.map(String) } : {}),
      ...(def.figure ? { figure: def.figure } : {}),
    });
    for (const [name, type] of Object.entries(shapeOf(def.fields))) {
      const id = `field:${def.kind}.${name}`;
      const typed = fieldTypeOf(type);
      nodes.push({
        id,
        kind: "field",
        label: name,
        type: typed.type,
        required: typed.required,
        ...(typed.options ? { options: [...typed.options] } : {}),
        ...(def.display?.labels?.[name] ? { description: def.display.labels[name] } : {}),
      });
      edges.push({ kind: "of", from: id, to: kindId(def.kind) });
    }
    for (const [name, edge] of Object.entries(def.edges)) {
      const id = `edge:${def.kind}.${name}`;
      edgeIds.set(name, id);
      nodes.push({
        id,
        kind: "edge",
        label: name,
        cardinality: edge.cardinality ?? "many",
        appendOnly: edge.appendOnly ?? false,
        toAny: edge.to === "*",
        ...(edge.description ? { description: edge.description } : {}),
        ...(edge.inverse ? { inverse: edge.inverse } : {}),
      });
      edges.push({ kind: "from-kind", from: id, to: kindId(def.kind) });
      if (edge.to !== "*") for (const target of edge.to) edges.push({ kind: "to-kind", from: id, to: kindId(target) });
    }
  }

  const actId = (name: string) => `act:${name}`;
  /** The checkout's own name for the far end of a tie: the node argument that is not the subject. */
  const targetArgOf = (mutation: AnyMutationDefinition): string | undefined => {
    if (!(mutation.connects?.length || mutation.severs?.length)) return undefined;
    const refs = nodeRefArgs(mutation.input as never);
    return refs.find((ref) => ref.name !== mutation.subject?.arg)?.name;
  };
  for (const mutation of (app.mutations ?? []) as unknown as readonly AnyMutationDefinition[]) {
    const id = actId(mutation.name);
    nodes.push({
      id,
      kind: "act",
      label: mutation.name,
      destructive: mutation.destructive ?? false,
      onAny: mutation.subject?.kinds === "*",
      derived: mutation.derived !== undefined,
      ...(mutation.title ? { title: mutation.title } : {}),
      ...(mutation.fromTheOtherEnd ? { fromTheOtherEnd: mutation.fromTheOtherEnd } : {}),
      ...(mutation.description ? { description: mutation.description } : {}),
      ...(mutation.writes ? { writes: [...mutation.writes] } : {}),
      ...(mutation.subject ? { subjectArg: mutation.subject.arg } : {}),
      ...(targetArgOf(mutation) ? { targetArg: targetArgOf(mutation) } : {}),
    });
    if (mutation.subject && mutation.subject.kinds !== "*") for (const kind of mutation.subject.kinds) edges.push({ kind: "on", from: id, to: kindId(kind) });
    for (const kind of mutation.creates ?? []) edges.push({ kind: "creates", from: id, to: kindId(kind) });
    for (const name of mutation.connects ?? []) {
      const target = edgeIds.get(name);
      if (target) edges.push({ kind: "connects", from: id, to: target });
    }
    for (const name of mutation.severs ?? []) {
      const target = edgeIds.get(name);
      if (target) edges.push({ kind: "severs", from: id, to: target });
    }
  }

  for (const rule of (app.invariants ?? []) as unknown as readonly InvariantDefinition[]) {
    const id = `rule:${rule.name}`;
    nodes.push({
      id,
      kind: "rule",
      label: rule.name,
      judgesPast: rule.judgesPast ?? false,
      wholeGraph: rule.scope === "graph",
      ...(rule.label ? { title: rule.label } : {}),
      ...(rule.description ?? rule.label ? { description: rule.description ?? rule.label } : {}),
    });
    if (rule.scope !== "graph") edges.push({ kind: "over", from: id, to: kindId(rule.scope.kind) });
    for (const name of rule.repairs ?? []) edges.push({ kind: "repairs", from: id, to: actId(name) });
  }

  const roleId = (role: string) => `role:${role}`;
  const roles = new Set<string>(app.policy?.roles ?? []);
  for (const g of app.policy?.grants ?? []) if (g.roles !== "*") for (const role of g.roles) roles.add(role);
  for (const lens of app.lenses ?? []) for (const role of lens.requiredRoles) roles.add(role);
  for (const role of roles) nodes.push({ id: roleId(role), kind: "role", label: role });

  (app.policy?.grants ?? []).forEach((g, index) => {
    const id = `grant:${index + 1}`;
    const who = g.roles === "*" ? "everyone" : g.roles.join(", ");
    const what = g.mutations === "*" ? "do anything" : g.mutations.join(", ");
    nodes.push({
      id,
      kind: "grant",
      label: g.describe ?? `${who} may ${what}`,
      self: g.self ?? false,
      everyone: g.roles === "*",
      allActs: g.mutations === "*",
      allKinds: g.kinds === undefined || g.kinds === "*",
      ...(g.describe ? { describe: g.describe } : {}),
    });
    if (g.roles !== "*") for (const role of g.roles) edges.push({ kind: "lets", from: id, to: roleId(role) });
    if (g.mutations !== "*") for (const name of g.mutations) edges.push({ kind: "may", from: id, to: actId(name) });
    if (g.kinds && g.kinds !== "*") for (const kind of g.kinds) edges.push({ kind: "over", from: id, to: kindId(kind) });
  });

  for (const lens of app.lenses ?? []) {
    const id = `lens:${lens.name}`;
    nodes.push({ id, kind: "lens", label: lens.name, ...(lens.binds ? { binds: lens.binds } : {}) });
    for (const role of lens.requiredRoles) edges.push({ kind: "requires", from: id, to: roleId(role) });
  }

  if (app.brand) {
    nodes.push({
      id: "brand",
      kind: "brand",
      label: app.brand.name,
      ...(app.brand.typography?.body ? { body: app.brand.typography.body } : {}),
      ...(app.brand.typography?.display ? { display: app.brand.typography.display } : {}),
    });
  }

  // Only edges whose both ends exist: an act that connects an edge the schema
  // does not declare is the checker's to report, not a dangling line here.
  const ids = new Set(nodes.map((node) => node.id));
  return { nodes: nodes as never, edges: edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) };
}

export type { z };
