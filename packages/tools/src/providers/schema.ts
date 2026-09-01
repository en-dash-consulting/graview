import { argShape, nodeRefArgs, type AnySchema } from "@graview/core";
import type { Affordance, AffordanceProvider, OpenParameter } from "../types.js";

const BASE_SCORE = 40;

/**
 * Which typed mutations are legal across the WHOLE selection.
 *
 * The declaration already says which kinds a mutation acts on and which
 * argument the subject binds to, so "all three selected nodes are duties, and
 * reassign acts on duties" is a fact the schema can answer — no per-selection
 * code, and a new node kind gets its affordances the moment it is declared.
 */
export function schemaProvider<S extends AnySchema>(): AffordanceProvider<S> {
  return {
    name: "schema",
    derive({ store, selection, nodes }) {
      if (nodes.length === 0) return {};
      const kinds = new Set(nodes.map((node) => node.kind));
      const affordances: Affordance[] = [];

      for (const mutation of store.allMutations()) {
        const subject = mutation.subject;
        if (!subject) continue;
        const accepted =
          subject.kinds === "*"
            ? true
            : [...kinds].every((kind) => (subject.kinds as readonly string[]).includes(kind));
        if (!accepted) continue;

        const open: OpenParameter[] = [];
        for (const ref of nodeRefArgs(mutation.input)) {
          if (ref.name === subject.arg) continue;
          const candidates = ref.kinds.includes("*")
            ? store.graph.allNodes().map((node) => node.id)
            : ref.kinds.flatMap((kind) =>
                store.graph.nodesOfKind(kind as never).map((node) => node.id),
              );
          open.push({
            name: ref.name,
            kinds: ref.kinds,
            // Offering real ids is what turns "reassign" into "reassign to
            // whom" without anyone wiring up a picker per mutation.
            candidates: candidates.filter((id) => !selection.includes(id)),
            shape: argShape(mutation.input, ref.name),
          });
        }
        for (const name of otherRequiredArgs(mutation.input, subject.arg)) {
          if (open.some((parameter) => parameter.name === name)) continue;
          open.push({ name, shape: argShape(mutation.input, name) });
        }

        const batch = nodes.map((node) => ({ [subject.arg]: node.id }));
        affordances.push({
          id: `schema:${mutation.name}`,
          label:
            nodes.length > 1
              ? `${mutation.title ?? mutation.name} (${nodes.length})`
              : (mutation.title ?? mutation.name),
          provider: "schema",
          mutation: mutation.name,
          args: batch[0] ?? {},
          open,
          ...(mutation.destructive ? { destructive: true } : {}),
          ...(nodes.length > 1 ? { batch } : {}),
          // A mutation needing nothing more is readier than one needing three
          // more answers, so it should surface above it.
          score: BASE_SCORE - open.length,
          why:
            nodes.length > 1
              ? `all ${nodes.length} selected nodes are ${[...kinds].join(" or ")}`
              : `this is a ${nodes[0]!.kind}`,
          nodeIds: nodes.map((node) => node.id),
        });
      }

      return { affordances };
    },
  };
}

/** Required input fields that are not node references and not the subject. */
function otherRequiredArgs(input: unknown, subjectArg: string): string[] {
  const shape = (input as { shape?: Record<string, { safeParse(value: unknown): { success: boolean } }> })
    .shape;
  if (!shape) return [];
  return Object.entries(shape)
    .filter(([name, field]) => name !== subjectArg && !field.safeParse(undefined).success)
    .map(([name]) => name);
}
