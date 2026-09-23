import { labelOf, nodeRefKinds, type AnySchema, type NodeOfSchema } from "@graview/core";
import type { Affordance, AffordanceProvider, Observation } from "../types.js";

const SHARED_SCORE = 70;
const ALIGN_SCORE = 80;

const IGNORED_FIELDS = new Set(["id", "kind"]);

/**
 * What is TRUE about this selection, and what that makes worth doing.
 *
 * Nothing here knows what a duty or a person is. It notices shared
 * neighbours, agreement on a field, and the one node that breaks the
 * agreement — then looks for a declared mutation that could resolve the
 * difference. "Move the Wednesday run to Tuesday like the other three" comes
 * out of this without anyone writing a rule about days, because the schema
 * already said which mutation writes that field.
 */
export function structureProvider<S extends AnySchema>(): AffordanceProvider<S> {
  return {
    name: "structure",
    derive({ store, nodes }) {
      // A node's name as its kind says it, not its label field alone.
      const named = (node: { id: string; kind: string } & Record<string, unknown>) => labelOf(store.schema.tryDefinition(node.kind), node);
      if (nodes.length < 2) return {};
      const observations: Observation[] = [];
      const affordances: Affordance[] = [];
      const ids = nodes.map((node) => node.id);

      // ---------------------------------------------------- shared neighbours
      for (const edgeKind of store.schema.edgeKinds) {
        const shared = intersect(
          nodes.map(
            (node) =>
              new Set([
                ...store.graph.out(node.id, edgeKind).map((n) => n.id),
                ...store.graph.in(node.id, edgeKind).map((n) => n.id),
              ]),
          ),
        );
        for (const neighbourId of shared) {
          const neighbour = store.graph.getNode(neighbourId);
          if (!neighbour) continue;
          observations.push({
            id: `shared:${edgeKind}:${neighbourId}`,
            text: `all ${nodes.length} share "${named(neighbour)}" via ${edgeKind}`,
            nodeIds: [...ids, neighbourId],
          });
        }

        // The near-miss is more interesting than the agreement: one node out
        // of step is a thing you can fix.
        const counts = new Map<string, number>();
        for (const node of nodes) {
          for (const neighbour of [
            ...store.graph.out(node.id, edgeKind),
            ...store.graph.in(node.id, edgeKind),
          ]) {
            counts.set(neighbour.id, (counts.get(neighbour.id) ?? 0) + 1);
          }
        }
        for (const [neighbourId, count] of counts) {
          if (count !== nodes.length - 1 || nodes.length < 3) continue;
          const neighbour = store.graph.getNode(neighbourId);
          if (!neighbour) continue;
          const odd = nodes.find(
            (node) =>
              ![
                ...store.graph.out(node.id, edgeKind),
                ...store.graph.in(node.id, edgeKind),
              ].some((n) => n.id === neighbourId),
          );
          if (!odd) continue;
          observations.push({
            id: `near-shared:${edgeKind}:${neighbourId}`,
            text: `all but "${named(odd)}" share "${named(neighbour)}" via ${edgeKind}`,
            nodeIds: [...ids, neighbourId],
          });
          for (const mutation of store.allMutations()) {
            const subject = mutation.subject;
            if (!subject) continue;
            if (subject.kinds !== "*" && !(subject.kinds as readonly string[]).includes(odd.kind)) {
              continue;
            }
            const target = argAccepting(mutation.input, neighbour.kind);
            if (!target) continue;
            affordances.push({
              id: `structure:join:${mutation.name}:${odd.id}:${neighbourId}`,
              label: `${mutation.title ?? mutation.name}: bring "${named(odd)}" in line with the others`,
              provider: "structure",
              mutation: mutation.name,
              args: { [subject.arg]: odd.id, [target]: neighbourId },
              open: [],
              score: SHARED_SCORE,
              why: `every other selected node is connected to "${named(neighbour)}"`,
              nodeIds: [odd.id, neighbourId],
            });
          }
        }
      }

      // ------------------------------------------------- agreement on a field
      const fields = new Set<string>();
      for (const node of nodes) {
        for (const key of Object.keys(node)) {
          if (!IGNORED_FIELDS.has(key)) fields.add(key);
        }
      }

      for (const field of [...fields].sort()) {
        const values = nodes.map((node) => (node as Record<string, unknown>)[field]);
        const groups = new Map<string, NodeOfSchema<S>[]>();
        values.forEach((value, index) => {
          const key = JSON.stringify(value ?? null);
          const list = groups.get(key);
          if (list) list.push(nodes[index]!);
          else groups.set(key, [nodes[index]!]);
        });

        if (groups.size === 1) {
          const [key] = [...groups.keys()];
          if (key === "null") continue;
          observations.push({
            id: `agree:${field}`,
            text: `all ${nodes.length} share ${field} ${key}`,
            nodeIds: ids,
          });
          continue;
        }

        // A majority and exactly one hold-out: that is an alignment.
        if (nodes.length < 3 || groups.size !== 2) continue;
        const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
        const [majorityKey, majority] = sorted[0]!;
        const [, minority] = sorted[1]!;
        if (minority.length !== 1 || majorityKey === "null") continue;
        const odd = minority[0]!;
        const majorityValue = JSON.parse(majorityKey) as unknown;

        observations.push({
          id: `odd-one-out:${field}`,
          text: `${majority.length} share ${field} ${majorityKey}; "${named(odd)}" does not`,
          nodeIds: ids,
        });

        for (const mutation of store.allMutations()) {
          const subject = mutation.subject;
          if (!subject) continue;
          if (subject.kinds !== "*" && !(subject.kinds as readonly string[]).includes(odd.kind)) {
            continue;
          }
          const shape = shapeOf(mutation.input);
          if (!shape || !(field in shape)) continue;

          // Fill every other argument this mutation needs from the node's own
          // current values, so the aligned change is exactly the one field.
          const args: Record<string, unknown> = {
            [subject.arg]: odd.id,
            [field]: majorityValue,
          };
          let satisfiable = true;
          for (const [name, schema] of Object.entries(shape)) {
            if (name in args) continue;
            if (schema.safeParse(undefined).success) continue;
            const current = (odd as Record<string, unknown>)[name];
            if (current === undefined) {
              satisfiable = false;
              break;
            }
            args[name] = current;
          }
          if (!satisfiable) continue;

          affordances.push({
            id: `structure:align:${mutation.name}:${field}:${odd.id}`,
            label: `Align "${named(odd)}" ${field} with the other ${majority.length}`,
            provider: "structure",
            mutation: mutation.name,
            args,
            open: [],
            score: ALIGN_SCORE,
            why: `${majority.length} of ${nodes.length} share ${field} ${majorityKey}`,
            nodeIds: ids,
          });
        }
      }

      return { affordances, observations };
    },
  };
}


function intersect(sets: Set<string>[]): string[] {
  if (sets.length === 0) return [];
  const [first, ...rest] = sets;
  return [...first!].filter((value) => rest.every((set) => set.has(value))).sort();
}

interface ZodLike {
  safeParse(value: unknown): { success: boolean };
}

function shapeOf(input: unknown): Record<string, ZodLike> | null {
  return (input as { shape?: Record<string, ZodLike> }).shape ?? null;
}

/** The first argument of a mutation that accepts a node of `kind`. */
function argAccepting(input: unknown, kind: string): string | null {
  const shape = shapeOf(input);
  if (!shape) return null;
  for (const [name] of Object.entries(shape)) {
    const kinds = nodeRefKinds(shape[name]);
    if (kinds && (kinds.includes("*") || kinds.includes(kind))) return name;
  }
  return null;
}
