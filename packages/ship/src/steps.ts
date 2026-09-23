import { UNSET, type MigrationDeclaration, type Primitive } from "@graview/core";
import type { GraphSnapshot } from "./snapshot.js";

/**
 * A MIGRATION AS DATA: what a stored graph needs when the declaration
 * moves, said as steps and turned into primitives against the stored graph
 * at the moment it runs — the only moment the stored graph is known.
 *
 * As data, the same steps are what the studio shows before a change is
 * applied, what it writes into the app's `migrations`, and what runs when a
 * stored graph opens on the new declaration: one description, three uses,
 * none of them able to disagree with the others.
 */
export type MigrationStep =
  | { readonly what: "remove-kind"; readonly kind: string }
  | { readonly what: "rename-kind"; readonly kind: string; readonly to: string }
  | { readonly what: "remove-field"; readonly kind: string; readonly field: string }
  /** A required field arrived: every stored record of the kind starts with `value`. */
  | { readonly what: "start-field"; readonly kind: string; readonly field: string; readonly value: unknown }
  | { readonly what: "remove-edge"; readonly kind: string; readonly edge: string }
  /**
   * The same relation, now declared on another kind. Each stored edge is
   * carried to the records of the new kind that are tied to its old end —
   * a gardener who tended a plot tends each planting in it — and taken off
   * the old end. Where nothing of the new kind is tied to it, it goes.
   */
  | { readonly what: "move-edge"; readonly kind: string; readonly edge: string; readonly to: string };

/** One sentence for a step, for the migration's title and for the person about to apply it. */
export function sayStep(step: MigrationStep): string {
  switch (step.what) {
    case "remove-kind":
      return `${step.kind} records go`;
    case "rename-kind":
      return `${step.kind} records become ${step.to}`;
    case "remove-field":
      return `${step.kind}.${step.field} is dropped`;
    case "start-field":
      return `${step.kind}.${step.field} starts`;
    case "remove-edge":
      return `${step.kind} ${step.edge} edges go`;
    case "move-edge":
      return `${step.kind} ${step.edge} edges move to the ${step.to} records tied to each ${step.kind}`;
  }
}

/** The primitives one step needs against this stored graph. */
export function primitivesFor(step: MigrationStep, stored: GraphSnapshot): Primitive[] {
  const out: Primitive[] = [];
  const ofKind = (kind: string) => new Set(stored.nodes.filter((node) => node.kind === kind).map((node) => node.id));
  switch (step.what) {
    case "remove-kind": {
      const gone = ofKind(step.kind);
      for (const edge of stored.edges) if (gone.has(edge.from) || gone.has(edge.to)) out.push({ op: "remove-edge", edge });
      for (const node of stored.nodes) if (gone.has(node.id)) out.push({ op: "remove-node", node });
      return out;
    }
    case "rename-kind": {
      // A node's kind is its identity to the schema, so each record is taken
      // out and put back under the new name, with the edges it carried —
      // a snapshot drops a removed node's edges with it.
      for (const node of stored.nodes) {
        if (node.kind !== step.kind) continue;
        const carried = stored.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
        out.push({ op: "remove-node", node });
        out.push({ op: "add-node", node: { ...node, kind: step.to } });
        for (const edge of carried) out.push({ op: "add-edge", edge });
      }
      return out;
    }
    case "remove-field":
      for (const node of stored.nodes) {
        if (node.kind !== step.kind || !(step.field in node)) continue;
        out.push({ op: "patch-node", id: node.id, before: { [step.field]: node[step.field] }, after: { [step.field]: UNSET } });
      }
      return out;
    case "start-field":
      for (const node of stored.nodes) {
        if (node.kind !== step.kind || node[step.field] !== undefined) continue;
        out.push({ op: "patch-node", id: node.id, before: { [step.field]: UNSET }, after: { [step.field]: step.value } });
      }
      return out;
    case "remove-edge": {
      const froms = ofKind(step.kind);
      for (const edge of stored.edges) if (edge.kind === step.edge && froms.has(edge.from)) out.push({ op: "remove-edge", edge });
      return out;
    }
    case "move-edge": {
      const froms = ofKind(step.kind);
      const heirs = ofKind(step.to);
      for (const edge of stored.edges) {
        if (edge.kind !== step.edge || !froms.has(edge.from)) continue;
        // Whatever of the new kind is tied to the old end, in either direction, by any edge.
        const tied = new Set(
          stored.edges.flatMap((other) =>
            other.from === edge.from && heirs.has(other.to) ? [other.to] : other.to === edge.from && heirs.has(other.from) ? [other.from] : [],
          ),
        );
        out.push({ op: "remove-edge", edge });
        for (const heir of tied) out.push({ op: "add-edge", edge: { kind: edge.kind, from: heir, to: edge.to } });
      }
      return out;
    }
  }
}

/**
 * The migration the steps describe. Each edge and node goes once, whichever
 * steps reach it: a kind's records take their edges with them, and the
 * edge's own step finds nothing left.
 */
export function stepsMigration(declared: {
  readonly from: number;
  readonly to: number;
  readonly steps: readonly MigrationStep[];
  readonly title?: string;
}): MigrationDeclaration {
  return {
    from: declared.from,
    to: declared.to,
    title: declared.title ?? declared.steps.map(sayStep).join("; "),
    apply: (snapshot) => {
      const seen = new Set<string>();
      return declared.steps
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
