import { UNSET, type AnySchema, type GraphSnapshot, type GraviewApp, type MigrationDeclaration, type Primitive } from "@graview/core";
import { defaultFor, type Reading } from "./to-declaration.js";
import { declarationToGraph } from "./from-declaration.js";
import type { FieldType } from "./meta.js";

/*
 * WHAT A STORED GRAPH NEEDS when the declaration moves. Compared as two
 * readings of the studio's own graph, so the difference is the same graph
 * difference the studio shows: a kind gone, a field gone, an edge gone, a
 * required field arrived. Each is a step whose primitives are computed
 * against the stored graph at the moment the migration runs, which is the
 * only moment the stored graph is known.
 */

export interface MigrationStep {
  readonly what: "remove-kind" | "remove-field" | "remove-edge" | "start-field";
  readonly kind: string;
  readonly name?: string;
  readonly type?: FieldType;
  readonly options?: readonly string[];
}

type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;
const ofKind = (reading: Reading, kind: string) => reading.nodes.filter((node) => node.kind === kind) as Node[];
const label = (node: Node) => String(node["label"] ?? node.id);
const targetsOf = (reading: Reading, from: string, kind: string) =>
  reading.edges.filter((edge) => edge.from === from && edge.kind === kind).map((edge) => edge.to);

/** The steps between two declarations' graphs; empty when the stored graph needs nothing. */
export function migrationSteps(before: Reading, after: Reading): MigrationStep[] {
  const steps: MigrationStep[] = [];
  const beforeKinds = new Map(ofKind(before, "kind").map((node) => [node.id, node]));
  const afterKinds = new Map(ofKind(after, "kind").map((node) => [node.id, node]));
  for (const [id, node] of beforeKinds) if (!afterKinds.has(id)) steps.push({ what: "remove-kind", kind: label(node) });

  const fieldKey = (reading: Reading, field: Node) => {
    const kindId = targetsOf(reading, field.id, "of")[0];
    return kindId ? `${kindId}::${label(field)}` : null;
  };
  const beforeFields = new Map(ofKind(before, "field").map((node) => [fieldKey(before, node), node]));
  const afterFields = new Map(ofKind(after, "field").map((node) => [fieldKey(after, node), node]));
  for (const [key, node] of beforeFields) {
    if (!key || afterFields.has(key)) continue;
    const kindId = key.split("::")[0]!;
    const kindNode = afterKinds.get(kindId);
    if (!kindNode) continue; // the whole kind goes; its fields go with it
    steps.push({ what: "remove-field", kind: label(kindNode), name: label(node) });
  }
  for (const [key, node] of afterFields) {
    if (!key || beforeFields.has(key) || node["required"] !== true) continue;
    const kindId = key.split("::")[0]!;
    if (!beforeKinds.has(kindId)) continue; // a new kind has no stored records
    const kindNode = afterKinds.get(kindId)!;
    steps.push({
      what: "start-field",
      kind: label(kindNode),
      name: label(node),
      type: (node["type"] as FieldType) ?? "string",
      ...(Array.isArray(node["options"]) ? { options: (node["options"] as unknown[]).map(String) } : {}),
    });
  }

  const edgeKey = (reading: Reading, edge: Node) => {
    const kindId = targetsOf(reading, edge.id, "from-kind")[0];
    return kindId ? `${kindId}::${label(edge)}` : null;
  };
  const beforeEdges = new Map(ofKind(before, "edge").map((node) => [edgeKey(before, node), node]));
  const afterEdges = new Map(ofKind(after, "edge").map((node) => [edgeKey(after, node), node]));
  for (const [key, node] of beforeEdges) {
    if (!key || afterEdges.has(key)) continue;
    const kindId = key.split("::")[0]!;
    const kindNode = afterKinds.get(kindId);
    if (!kindNode) continue;
    steps.push({ what: "remove-edge", kind: label(kindNode), name: label(node) });
  }
  return steps;
}

/** The primitives a step needs against this stored graph. */
export function primitivesFor(step: MigrationStep, stored: GraphSnapshot): Primitive[] {
  const out: Primitive[] = [];
  switch (step.what) {
    case "remove-kind": {
      const gone = new Set(stored.nodes.filter((node) => node.kind === step.kind).map((node) => node.id));
      for (const edge of stored.edges) if (gone.has(edge.from) || gone.has(edge.to)) out.push({ op: "remove-edge", edge });
      for (const node of stored.nodes) if (gone.has(node.id)) out.push({ op: "remove-node", node });
      return out;
    }
    case "remove-field":
      for (const node of stored.nodes) {
        if (node.kind !== step.kind || !(step.name! in node)) continue;
        out.push({ op: "patch-node", id: node.id, before: { [step.name!]: node[step.name!] }, after: { [step.name!]: UNSET } });
      }
      return out;
    case "start-field":
      for (const node of stored.nodes) {
        if (node.kind !== step.kind || node[step.name!] !== undefined) continue;
        out.push({ op: "patch-node", id: node.id, before: { [step.name!]: UNSET }, after: { [step.name!]: defaultFor(step.type ?? "string", step.options) } });
      }
      return out;
    case "remove-edge": {
      const froms = new Set(stored.nodes.filter((node) => node.kind === step.kind).map((node) => node.id));
      for (const edge of stored.edges) if (edge.kind === step.name && froms.has(edge.from)) out.push({ op: "remove-edge", edge });
      return out;
    }
  }
}

const say = (step: MigrationStep): string => {
  switch (step.what) {
    case "remove-kind":
      return `${step.kind} records go`;
    case "remove-field":
      return `${step.kind}.${step.name} is dropped`;
    case "start-field":
      return `${step.kind}.${step.name} starts`;
    case "remove-edge":
      return `${step.kind} ${step.name} edges go`;
  }
};

/**
 * The migration from one declaration to the next, or null when a stored
 * graph shaped like the old one is already a graph shaped like the new.
 */
export function migrationBetween<S extends AnySchema>(before: GraviewApp<S>, after: GraviewApp<AnySchema>): MigrationDeclaration | null {
  const steps = migrationSteps(declarationToGraph(before), declarationToGraph(after));
  if (steps.length === 0) return null;
  const from = before.version ?? 1;
  return {
    from,
    to: from + 1,
    title: steps.map(say).join("; "),
    apply: (snapshot) => {
      // Each edge and node goes once, whichever steps reach it: a kind's
      // records take their edges with them, and the edge's own step finds nothing left.
      const seen = new Set<string>();
      return steps
        .flatMap((step) => primitivesFor(step, snapshot as GraphSnapshot))
        .filter((primitive) => {
          const key =
            primitive.op === "remove-edge" || primitive.op === "add-edge"
              ? `${primitive.op} ${primitive.edge.kind} ${primitive.edge.from} ${primitive.edge.to}`
              : primitive.op === "patch-node"
                ? `${primitive.op} ${primitive.id} ${Object.keys(primitive.after).join(",")}`
                : `${primitive.op} ${primitive.node.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    },
  };
}
