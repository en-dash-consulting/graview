import type { AnySchema, GraviewApp, MigrationDeclaration } from "@graview/core";
import { stepsMigration, type MigrationStep } from "@graview/ship/browser";
import { declarationToGraph } from "./from-declaration.js";
import type { FieldType } from "./meta.js";
import { defaultFor, type Reading } from "./to-declaration.js";

/*
 * WHAT A STORED GRAPH NEEDS when the declaration moves. Compared as two
 * readings of the studio's own graph, so the difference is the same graph
 * difference the studio shows: a kind gone, a field gone, an edge gone or
 * moved, a required field arrived. The steps are data — `@graview/ship`
 * turns them into primitives against the stored graph when it runs — so
 * the studio can say them before Apply and write them into the app after.
 */

export type { MigrationStep } from "@graview/ship/browser";

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
  for (const [id, node] of beforeKinds) {
    const after = afterKinds.get(id);
    if (!after) steps.push({ what: "remove-kind", kind: label(node) });
    // The same declaration, called something else: its records carry the new name.
    else if (label(after) !== label(node)) steps.push({ what: "rename-kind", kind: label(node), to: label(after) });
  }

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
    steps.push({ what: "remove-field", kind: label(kindNode), field: label(node) });
  }
  for (const [key, node] of afterFields) {
    if (!key || beforeFields.has(key) || node["required"] !== true) continue;
    const kindId = key.split("::")[0]!;
    if (!beforeKinds.has(kindId)) continue; // a new kind has no stored records
    const kindNode = afterKinds.get(kindId)!;
    const options = Array.isArray(node["options"]) ? (node["options"] as unknown[]).map(String) : undefined;
    steps.push({ what: "start-field", kind: label(kindNode), field: label(node), value: defaultFor((node["type"] as FieldType) ?? "string", options) });
  }

  const edgeKey = (reading: Reading, edge: Node) => {
    const kindId = targetsOf(reading, edge.id, "from-kind")[0];
    return kindId ? `${kindId}::${label(edge)}` : null;
  };
  const beforeEdges = new Map(ofKind(before, "edge").map((node) => [edgeKey(before, node), node]));
  const afterEdges = new Map(ofKind(after, "edge").map((node) => [edgeKey(after, node), node]));
  // By name as well, so the same relation declared on another kind is seen as MOVED.
  const afterByName = new Map([...afterEdges].flatMap(([key, node]) => (key ? [[label(node), key.split("::")[0]!]] : [])));
  for (const [key, node] of beforeEdges) {
    if (!key || afterEdges.has(key)) continue;
    const kindId = key.split("::")[0]!;
    const kindNode = afterKinds.get(kindId);
    if (!kindNode) continue;
    const movedTo = afterByName.get(label(node));
    const heir = movedTo ? afterKinds.get(movedTo) : undefined;
    steps.push(
      heir
        ? { what: "move-edge", kind: label(kindNode), edge: label(node), to: label(heir) }
        : { what: "remove-edge", kind: label(kindNode), edge: label(node) },
    );
  }
  return steps;
}

/**
 * The migration from one declaration to the next, or null when a stored
 * graph shaped like the old one is already a graph shaped like the new.
 * Given the studio's own graph as `after`, a renamed kind is seen as a
 * rename — its node kept its id — where two declarations read separately
 * would show one kind gone and another arrived.
 */
export function migrationBetween<S extends AnySchema>(before: GraviewApp<S>, after: GraviewApp<AnySchema> | Reading): MigrationDeclaration | null {
  const steps = migrationSteps(declarationToGraph(before), "nodes" in after ? after : declarationToGraph(after));
  if (steps.length === 0) return null;
  const from = before.version ?? 1;
  return stepsMigration({ from, to: from + 1, steps });
}
