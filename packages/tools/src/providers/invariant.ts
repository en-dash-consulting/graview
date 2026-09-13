import { argShape, nodeRefArgs, type AnySchema } from "@graview/core";
import type { Affordance, AffordanceProvider, Observation } from "../types.js";

const REPAIR_SCORE = 100;

/**
 * Violations touching the selection, and the repairs that would resolve them.
 *
 * This is why `repairs` exists on a violation at all: the invariant engine
 * already knows both the problem and the mutations that would fix it, so a
 * repair reaches the interface without anyone writing a rule to connect them.
 * Repairs outrank every other provider — a thing that is currently broken is
 * more interesting than a thing you could do.
 */
export function invariantProvider<S extends AnySchema>(): AffordanceProvider<S> {
  return {
    name: "invariant",
    derive({ store, selection, nodes, violations }) {
      const selected = new Set(selection);
      const touching = violations.filter(
        (violation) =>
          violation.nodeIds.some((id) => selected.has(id)) ||
          (violation.subjectId !== undefined && selected.has(violation.subjectId)),
      );

      const affordances: Affordance[] = [];
      const observations: Observation[] = [];

      touching.forEach((violation, index) => {
        observations.push({
          id: `violation:${violation.invariant}:${index}`,
          text: violation.message,
          nodeIds: violation.nodeIds,
        });
        violation.repairs.forEach((repair, repairIndex) => {
          affordances.push({
            id: `invariant:${violation.invariant}:${index}:${repairIndex}`,
            label: repair.label,
            provider: "invariant",
            mutation: repair.mutation,
            args: repair.args ?? {},
            /*
             * A repair names the mutation it would run, so everything the
             * schema provider derives applies here too: what sort of answer
             * the argument wants, and — when it names a node — which nodes
             * would actually fit.
             *
             * The candidates were missing, and the omission only showed up
             * in a second app: a repair saying "cover this in a section"
             * with `sectionId` unanswered rendered as a free text box asking
             * for a node id. Every repair that needed a node was unusable,
             * and the household example never noticed because its repairs happened to
             * carry their node arguments pre-filled.
             */
            open: (repair.missing ?? []).map((name) => {
              const mutation = store
                .allMutations()
                .find((candidate: { name: string }) => candidate.name === repair.mutation);
              if (!mutation) return { name };
              const ref = nodeRefArgs(mutation.input).find((arg) => arg.name === name);
              const candidates = ref
                ? ref.kinds.includes("*")
                  ? store.graph.allNodes().map((node) => node.id)
                  : ref.kinds.flatMap((kind: string) =>
                      store.graph.nodesOfKind(kind as never).map((node) => node.id),
                    )
                : undefined;
              return {
                name,
                shape: argShape(mutation.input, name),
                ...(ref ? { kinds: ref.kinds } : {}),
                ...(candidates ? { candidates } : {}),
              };
            }),
            // A repair that needs nothing more is the readiest thing here.
            score: REPAIR_SCORE - repairIndex - (repair.missing?.length ?? 0),
            why: violation.message,
            nodeIds: violation.nodeIds,
            // Carried so the ranking can lead with the repairs of the RULE
            // you clicked, the same way it leads with a task's own.
            ...(violation.subjectId === undefined ? {} : { subjectId: violation.subjectId }),
          });
        });
      });

      /*
       * A rule that is HOLDING says so, rather than showing nothing.
       *
       * A rule node has no edges, so selecting one used to change nothing on
       * screen and read as broken. Lighting what it judges fixed half of
       * that; the other half is the case where it judges everything
       * correctly — silence there is indistinguishable from a rule that does
       * not work, and "nothing is wrong" is an answer.
       *
       * Which nodes are rules is derivable: an invariant declares the kind it
       * is scoped to, and a kind may declare the invariant it requires.
       * Nothing is authored per app.
       */
      for (const node of nodes) {
        const judged = store
          .allInvariants()
          .filter((invariant) => {
            if (invariant.scope === "graph") return false;
            const scope = invariant.scope as {
              kind: string;
              match?: (candidate: never) => boolean;
            };
            if (scope.kind !== node.kind) return false;
            return scope.match ? scope.match(node as never) : true;
          });
        if (judged.length === 0) continue;
        if (touching.some((violation) => violation.subjectId === node.id)) continue;
        observations.push({
          id: `holds:${node.id}`,
          text: `${labelOf(node)} holds — nothing currently breaks ${
            judged.length === 1 ? "it" : `any of its ${judged.length} rules`
          }`,
          nodeIds: [node.id],
        });
      }

      return { affordances, observations };
    },
  };
}

/** A node's own label, falling back to its id. */
function labelOf(node: { id: string } & Record<string, unknown>): string {
  return typeof node["label"] === "string" && node["label"].length > 0
    ? node["label"]
    : node.id;
}
