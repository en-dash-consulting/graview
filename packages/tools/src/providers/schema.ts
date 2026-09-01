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
    derive({ store, selection, nodes, kindSelection, edgeSelection }) {
      const affordances: Affordance[] = [];

      /*
       * A selected LINE asks "what may be done to this relation". Mutations
       * declare the edge kinds they make and break; endpoints prefill by
       * matching each node-reference argument's accepted kinds against the
       * edge's real ends — derived, never wired, and ambiguous matches stay
       * open questions rather than guesses.
       */
      if (nodes.length === 0 && edgeSelection.length > 0) {
        for (const edge of edgeSelection) {
          const fromNode = store.graph.getNode(edge.from);
          const toNode = store.graph.getNode(edge.to);
          if (!fromNode || !toNode) continue;
          for (const mutation of store.allMutations()) {
            const makes = (mutation.connects ?? []).includes(edge.kind);
            const breaks = (mutation.severs ?? []).includes(edge.kind);
            if (!makes && !breaks) continue;
            const args: Record<string, unknown> = {};
            const open: OpenParameter[] = [];
            const refs = nodeRefArgs(mutation.input);
            for (const ref of refs) {
              const takesFrom = ref.kinds.includes("*") || ref.kinds.includes(fromNode.kind as string);
              const takesTo = ref.kinds.includes("*") || ref.kinds.includes(toNode.kind as string);
              const fromOnly = takesFrom && !refs.some(
                (other) => other !== ref && (other.kinds.includes(fromNode.kind as string) || other.kinds.includes("*")),
              );
              // Prefill only the unambiguous end; two arguments accepting
              // the same kind stay open with candidates.
              if (takesFrom && !takesTo) args[ref.name] = edge.from;
              else if (takesTo && !takesFrom) args[ref.name] = edge.to;
              else if (takesFrom && takesTo && fromOnly) args[ref.name] = edge.from;
              else {
                const candidates = ref.kinds.includes("*")
                  ? store.graph.allNodes().map((node) => node.id)
                  : ref.kinds.flatMap((kind) =>
                      store.graph.nodesOfKind(kind as never).map((node) => node.id),
                    );
                open.push({ name: ref.name, kinds: ref.kinds, candidates, shape: argShape(mutation.input, ref.name) });
              }
            }
            for (const name of otherRequiredArgs(mutation.input, "")) {
              if (name in args || open.some((parameter) => parameter.name === name)) continue;
              open.push({ name, shape: argShape(mutation.input, name) });
            }
            const askable = open.every((parameter) =>
              parameter.kinds !== undefined
                ? (parameter.candidates?.length ?? 0) > 0
                : (parameter.candidates?.length ?? 0) > 0 ||
                  (parameter.shape !== undefined && parameter.shape.type !== "unknown"),
            );
            if (!askable) continue;
            affordances.push({
              id: `schema:edge:${mutation.name}:${edge.kind}:${edge.from}:${edge.to}`,
              label: mutation.title ?? mutation.name,
              provider: "schema",
              mutation: mutation.name,
              args,
              open,
              ...(mutation.destructive ? { destructive: true } : {}),
              // A break offered on the line itself outranks a make; both sit
              // between plain schema actions and repairs.
              score: (breaks ? 62 : 58) - open.length,
              why: `this line is "${edge.kind}"`,
              nodeIds: [edge.from, edge.to],
            });
          }
        }
        return { affordances };
      }

      /*
       * A selected KIND — a card, a district — asks a different question
       * from a selected node: not "what can I do with this" but "how does
       * the first one get here". Mutations declare what they create, so an
       * empty kind card offers its own beginnings — which is the whole
       * onboarding path of a blank graph, one derived affordance at a time.
       */
      if (nodes.length === 0 && kindSelection.length > 0) {
        const wanted = new Set(kindSelection);
        for (const mutation of store.allMutations()) {
          if (!(mutation.creates ?? []).some((kind) => wanted.has(kind as string))) continue;
          const open: OpenParameter[] = [];
          for (const ref of nodeRefArgs(mutation.input)) {
            const candidates = ref.kinds.includes("*")
              ? store.graph.allNodes().map((node) => node.id)
              : ref.kinds.flatMap((kind) =>
                  store.graph.nodesOfKind(kind as never).map((node) => node.id),
                );
            open.push({
              name: ref.name,
              kinds: ref.kinds,
              candidates,
              shape: argShape(mutation.input, ref.name),
            });
          }
          for (const name of otherRequiredArgs(mutation.input, "")) {
            if (open.some((parameter) => parameter.name === name)) continue;
            open.push({ name, shape: argShape(mutation.input, name) });
          }
          const askable = open.every((parameter) =>
            parameter.kinds !== undefined
              ? // A node reference is only askable when real nodes exist to
                // pick — "sow into which plot?" has no honest answer at zero
                // plots, so the button waits for the first plot instead.
                (parameter.candidates?.length ?? 0) > 0
              : (parameter.candidates?.length ?? 0) > 0 ||
                (parameter.shape !== undefined && parameter.shape.type !== "unknown"),
          );
          if (!askable) continue;
          affordances.push({
            id: `schema:add:${mutation.name}`,
            label: mutation.title ?? mutation.name,
            provider: "schema",
            mutation: mutation.name,
            args: {},
            open,
            score: BASE_SCORE - open.length,
            why: `this makes a ${(mutation.creates ?? []).filter((kind) => wanted.has(kind as string)).join(", ")}`,
            nodeIds: [],
          });
        }
        return { affordances };
      }

      if (nodes.length === 0) return {};
      const kinds = new Set(nodes.map((node) => node.kind));

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

        /*
         * Only actions the interface can actually ASK FOR.
         *
         * An open argument with no candidates and no scalar shape — a
         * structured object, say — has no honest prompt: the strip offered a
         * text box whose every answer failed validation, which read as a
         * button that does nothing. The mutation still exists and an agent
         * supplies structured arguments natively; it is just not a button.
         * Invariant repairs are unaffected — a rule that names a repair has
         * already decided it is offerable.
         */
        const askable = open.every(
          (parameter) =>
            (parameter.candidates?.length ?? 0) > 0 ||
            (parameter.shape !== undefined && parameter.shape.type !== "unknown"),
        );
        if (!askable) continue;

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
