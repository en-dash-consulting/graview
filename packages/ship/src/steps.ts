import { UNSET, type MigrationDeclaration, type Primitive } from "@graview/core";
import { coerce, type FieldSpec, type FieldType } from "@graview/core/document";
import { applyToSnapshot, type GraphSnapshot } from "./snapshot.js";
import { withArticle } from "@graview/core";

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
  | { readonly what: "move-edge"; readonly kind: string; readonly edge: string; readonly to: string }
  /** A field called something else: every value moves to the new name (FR-22). */
  | { readonly what: "rename-field"; readonly kind: string; readonly field: string; readonly to: string }
  /** A relation called something else, on every kind that declares it: every link moves. */
  | { readonly what: "rename-edge"; readonly edge: string; readonly to: string }
  /**
   * A field whose type changed: each value kept where its meaning survives —
   * text→number when it parses, datetime→date, a word→the enum option it
   * names, a value→a list of one, and back where nothing is lost — and
   * cleared, counted, where it does not.
   */
  | { readonly what: "coerce-field"; readonly kind: string; readonly field: string; readonly from: FieldType; readonly to: Pick<FieldSpec, "type" | "options" | "of"> }
  /*
   * CONTENT STEPS. The ones above move a stored graph when the DECLARATION
   * moves; these move it when the DEFAULT CONTENT does — a new question in
   * the interview, a renamed list, a plot the example no longer has. Each
   * is said by id and judged against the stored graph at the moment it
   * runs, so it is idempotent: a node already there is not put twice, a
   * patch that changes nothing emits nothing, a drop of what is gone is
   * silent. That is what lets a seed be brought in step with a live store
   * without deleting the store first — and what lets the same steps sit in
   * `migrations[]`, versioned with the app, for every installation.
   */
  /** A record the graph should have. Left alone when it already does. */
  | { readonly what: "put-node"; readonly node: GraphSnapshot["nodes"][number] }
  /** Fields a record should carry. Only what differs is written. */
  | { readonly what: "patch-node"; readonly id: string; readonly fields: Readonly<Record<string, unknown>> }
  /** A record the graph should no longer have, with every tie it has. */
  | { readonly what: "drop-node"; readonly id: string }
  /** A tie the graph should have. Left alone when it does, or when either end is missing. */
  | { readonly what: "put-edge"; readonly edge: GraphSnapshot["edges"][number] }
  /** A tie the graph should no longer have. */
  | { readonly what: "drop-edge"; readonly edge: GraphSnapshot["edges"][number] };

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
    case "rename-field":
      return `${step.kind}.${step.field} is renamed ${step.to}, its values kept`;
    case "rename-edge":
      return `${step.edge} links are renamed ${step.to}, every one kept`;
    case "coerce-field":
      return `${step.kind}.${step.field} becomes ${step.to.type === "enum" ? "a choice" : withArticle(step.to.type)}: values that fit are kept, the rest cleared`;
    case "put-node":
      return `${step.node.kind} ${step.node.id} is put`;
    case "patch-node":
      return `${step.id} is patched: ${Object.keys(step.fields).join(", ") || "nothing"}`;
    case "drop-node":
      return `${step.id} goes`;
    case "put-edge":
      return `${step.edge.from} ${step.edge.kind} ${step.edge.to} is tied`;
    case "drop-edge":
      return `${step.edge.from} ${step.edge.kind} ${step.edge.to} is cut`;
  }
}

const sameEdge = (a: GraphSnapshot["edges"][number], b: GraphSnapshot["edges"][number]): boolean =>
  a.kind === b.kind && a.from === b.from && a.to === b.to;

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
    case "put-node": {
      if (stored.nodes.some((node) => node.id === step.node.id)) return out;
      out.push({ op: "add-node", node: step.node });
      return out;
    }
    case "patch-node": {
      const node = stored.nodes.find((candidate) => candidate.id === step.id);
      if (!node) return out;
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(step.fields)) {
        if (key === "id" || key === "kind") continue;
        if (JSON.stringify(node[key]) === JSON.stringify(value)) continue;
        before[key] = node[key] === undefined ? UNSET : node[key];
        after[key] = value === undefined ? UNSET : value;
      }
      if (Object.keys(after).length > 0) out.push({ op: "patch-node", id: step.id, before, after });
      return out;
    }
    case "drop-node": {
      const node = stored.nodes.find((candidate) => candidate.id === step.id);
      if (!node) return out;
      for (const edge of stored.edges) if (edge.from === step.id || edge.to === step.id) out.push({ op: "remove-edge", edge });
      out.push({ op: "remove-node", node });
      return out;
    }
    case "put-edge": {
      const has = (id: string) => stored.nodes.some((node) => node.id === id);
      if (!has(step.edge.from) || !has(step.edge.to)) return out;
      if (stored.edges.some((edge) => sameEdge(edge, step.edge))) return out;
      out.push({ op: "add-edge", edge: step.edge });
      return out;
    }
    case "drop-edge": {
      if (!stored.edges.some((edge) => sameEdge(edge, step.edge))) return out;
      out.push({ op: "remove-edge", edge: step.edge });
      return out;
    }
    case "rename-field":
      for (const node of stored.nodes) {
        if (node.kind !== step.kind || node[step.field] === undefined) continue;
        out.push({ op: "patch-node", id: node.id, before: { [step.field]: node[step.field], [step.to]: node[step.to] === undefined ? UNSET : node[step.to] }, after: { [step.field]: UNSET, [step.to]: node[step.field] } });
      }
      return out;
    case "rename-edge":
      for (const edge of stored.edges) {
        if (edge.kind !== step.edge) continue;
        out.push({ op: "remove-edge", edge });
        out.push({ op: "add-edge", edge: { ...edge, kind: step.to } });
      }
      return out;
    case "coerce-field":
      for (const node of stored.nodes) {
        if (node.kind !== step.kind || node[step.field] === undefined || node[step.field] === null) continue;
        const value = coerce(node[step.field], step.from, step.to as FieldSpec);
        if (JSON.stringify(value) === JSON.stringify(node[step.field])) continue;
        out.push({ op: "patch-node", id: node.id, before: { [step.field]: node[step.field] }, after: { [step.field]: value === undefined ? UNSET : value } });
      }
      return out;
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
    apply: (snapshot) => primitivesForSteps(declared.steps, snapshot as GraphSnapshot),
  };
}

/**
 * Every step's primitives against one stored graph, IN SEQUENCE: each step
 * is judged against the graph as the steps before it leave it. That is
 * what the studio already assumes — it renames a kind and then says its
 * field steps by the new name — and what a content run needs, where the
 * record is put and then tied in the same breath. Each edge and node still
 * goes once whichever steps reach it.
 */
export function primitivesForSteps(steps: readonly MigrationStep[], stored: GraphSnapshot): Primitive[] {
  const seen = new Set<string>();
  let running = stored;
  return steps
    .flatMap((step) => {
      const out = primitivesFor(step, running);
      running = applyToSnapshot(running, out);
      return out;
    })
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
}

/** What one step does to one stored graph, counted: values or links that move, values converted, values cleared, records and links removed. */
export interface StepCount {
  readonly step: MigrationStep;
  readonly said: string;
  readonly moved: number;
  readonly converted: number;
  readonly cleared: number;
  readonly removed: number;
}

/**
 * WHAT MOVES AND WHAT IS LOST, PER STEP (FR-22), against the stored graph
 * as the steps before it leave it — so "rename quote to price" says how
 * many values moved, and "notes becomes a number" how many it kept and how
 * many it had to clear. "Breaking" is these counts, not the kind of edit.
 */
export function countSteps(steps: readonly MigrationStep[], stored: GraphSnapshot): readonly StepCount[] {
  let running = stored;
  return steps.map((step) => {
    const primitives = primitivesFor(step, running);
    let moved = 0;
    let converted = 0;
    let cleared = 0;
    let removed = 0;
    for (const primitive of primitives) {
      if (primitive.op === "remove-node") removed++;
      else if (primitive.op === "add-edge" && (step.what === "rename-edge" || step.what === "move-edge" || step.what === "rename-kind")) moved++;
      else if (primitive.op === "remove-edge" && step.what !== "rename-edge" && step.what !== "move-edge" && step.what !== "rename-kind") removed++;
      else if (primitive.op === "patch-node") {
        if (step.what === "rename-field") moved++;
        else if (Object.values(primitive.after).some((value) => value === UNSET)) cleared++;
        else converted++;
      }
    }
    if (step.what === "move-edge") removed += primitives.filter((p) => p.op === "remove-edge").length - moved;
    running = applyToSnapshot(running, primitives);
    return { step, said: sayStep(step), moved, converted, cleared, removed: Math.max(0, removed) };
  });
}
