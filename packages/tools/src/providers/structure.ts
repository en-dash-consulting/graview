import { actTitle, fieldWords, humanizeField, labelOf, nodeRefKinds, type AnySchema, type NodeOfSchema } from "@graview/core";
import type { Affordance, AffordanceProvider, Observation } from "../types.js";

const SHARED_SCORE = 70;
const ALIGN_SCORE = 80;

const IGNORED_FIELDS = new Set(["id", "kind"]);

/**
 * What is TRUE about this selection, and what that makes worth doing.
 *
 * Nothing here knows what a duty or a person is. It notices shared
 * neighbors, agreement on a field, and the one node that breaks the
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

      // ---------------------------------------------------- shared neighbors
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
        for (const neighborId of shared) {
          const neighbor = store.graph.getNode(neighborId);
          if (!neighbor) continue;
          observations.push({
            id: `shared:${edgeKind}:${neighborId}`,
            text: `all ${nodes.length} share "${named(neighbor)}" (${humanizeField(edgeKind).toLowerCase()})`,
            nodeIds: [...ids, neighborId],
          });
        }

        // The near-miss is more interesting than the agreement: one node out
        // of step is a thing you can fix.
        const counts = new Map<string, number>();
        for (const node of nodes) {
          for (const neighbor of [
            ...store.graph.out(node.id, edgeKind),
            ...store.graph.in(node.id, edgeKind),
          ]) {
            counts.set(neighbor.id, (counts.get(neighbor.id) ?? 0) + 1);
          }
        }
        for (const [neighborId, count] of counts) {
          // A neighbor that is one of the chosen is not shared by "all but" itself: "all but "Run E05" share "Run E05"".
          if (count !== nodes.length - 1 || nodes.length < 3 || ids.includes(neighborId)) continue;
          const neighbor = store.graph.getNode(neighborId);
          if (!neighbor) continue;
          const odd = nodes.find(
            (node) =>
              ![
                ...store.graph.out(node.id, edgeKind),
                ...store.graph.in(node.id, edgeKind),
              ].some((n) => n.id === neighborId),
          );
          if (!odd) continue;
          observations.push({
            id: `near-shared:${edgeKind}:${neighborId}`,
            text: `all but "${named(odd)}" share "${named(neighbor)}" (${humanizeField(edgeKind).toLowerCase()})`,
            nodeIds: [...ids, neighborId],
          });
          /*
           * BROUGHT IN LINE THROUGH THE RELATION THE OTHERS SHARE (the
           * gauntlet's workshop and two keynotes, carried from walks XI and
           * XII). Two talks presented by Zoë and a workshop she leads read
           * "all but the workshop share Zoë (presented by)", and the workshop
           * was offered "Add a leader" and "Unlink a speaker" to bring it in
           * line: acts that tie another relation, or untie one. A record that
           * cannot hold the relation is not out of step with it, and an act
           * that says what it ties must tie this one.
           */
          if (!store.schema.edgeAllowed(edgeKind, odd.kind, neighbor.kind) && !store.schema.edgeAllowed(edgeKind, neighbor.kind, odd.kind)) continue;
          for (const mutation of store.allMutations()) {
            const subject = mutation.subject;
            if (!subject) continue;
            if (subject.kinds !== "*" && !(subject.kinds as readonly string[]).includes(odd.kind)) {
              continue;
            }
            const saysWhatItTies = mutation.connects !== undefined || mutation.severs !== undefined;
            if (saysWhatItTies && !(mutation.connects ?? []).includes(edgeKind)) continue;
            const target = argAccepting(mutation.input, neighbor.kind);
            if (!target) continue;
            affordances.push({
              id: `structure:join:${mutation.name}:${odd.id}:${neighborId}`,
              label: `${actTitle(mutation)}: bring "${named(odd)}" in line with the others`,
              provider: "structure",
              mutation: mutation.name,
              args: { [subject.arg]: odd.id, [target]: neighborId },
              open: [],
              score: SHARED_SCORE,
              why: `every other selected node is connected to "${named(neighbor)}"`,
              nodeIds: [odd.id, neighborId],
            });
          }
        }
      }

      // ------------------------------------------------- agreement on a field
      /*
       * AMONG RECORDS OF ONE KIND (the eleventh walk). A kennel's "status"
       * and an animal's are two facts with one name: read as one, a kennel
       * and the two animals in it "disagreed", the animals' stored value was
       * said raw in the kennel's words, and the kennel was offered its edit
       * told a value only an animal can hold — refused on press.
       */
      const byKind = new Map<string, NodeOfSchema<S>[]>();
      for (const node of nodes) byKind.set(node.kind as string, [...(byKind.get(node.kind as string) ?? []), node]);
      for (const [kindName, group] of byKind) {
        if (group.length < 2) continue;
        const nodes = group;
        const ids = group.map((node) => node.id);
        const scoped = byKind.size > 1 ? `${kindName}:` : "";
        const fields = new Set<string>();
        for (const node of nodes) {
          for (const key of Object.keys(node)) {
            if (!IGNORED_FIELDS.has(key)) fields.add(key);
          }
        }

        // A field and its value in words: "all 3 share status open" read the key and the JSON.
        const definitionOf = (kind: string) => store.schema.definitions.find((definition) => definition.kind === kind);
        for (const field of [...fields].sort()) {
          const definition = definitionOf(nodes[0]!.kind as string);
          const words = fieldWords(definition, field).toLowerCase();
          // The value as the card shows it: the declared format, else the stored value quoted.
          const format = definition?.display?.format?.[field];
          const said = (key: string): string => {
            if (!format) return key;
            try {
              return String(format(JSON.parse(key)));
            } catch {
              return key;
            }
          };
          const values = nodes.map((node) => (node as Record<string, unknown>)[field]);
          const groups = new Map<string, NodeOfSchema<S>[]>();
          values.forEach((value, index) => {
            const key = JSON.stringify(value ?? null);
            const list = groups.get(key);
            if (list) list.push(nodes[index]!);
            else groups.set(key, [nodes[index]!]);
          });

          if (groups.size === 1) {
            const key = [...groups.keys()][0]!;
            if (key === "null") continue;
            observations.push({
              id: `agree:${scoped}${field}`,
              text: `all ${nodes.length} share the ${words} ${said(key)}`,
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
            id: `odd-one-out:${scoped}${field}`,
            text: `${majority.length} share the ${words} ${said(majorityKey)}; "${named(odd)}" does not`,
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
            // Offered with every argument filled, so it must be one the act accepts: never refused on press.
            if (!satisfiable || !(mutation.input as unknown as ZodLike).safeParse(args).success) continue;

            affordances.push({
              id: `structure:align:${mutation.name}:${field}:${odd.id}`,
              label: `Align the ${words} of "${named(odd)}" with the other ${majority.length}`,
              provider: "structure",
              mutation: mutation.name,
              args,
              open: [],
              score: ALIGN_SCORE,
              why: `${majority.length} of ${nodes.length} share the ${words} ${said(majorityKey)}`,
              nodeIds: ids,
            });
          }
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
