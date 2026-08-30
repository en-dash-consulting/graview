import { argShape, type AnySchema } from "@graview/core";
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
    derive({ store, selection, violations }) {
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
            // A repair names the mutation it would run, so the same schema
            // introspection applies: an unanswered argument here describes
            // itself exactly as one from the schema provider does.
            open: (repair.missing ?? []).map((name) => {
              const mutation = store
                .allMutations()
                .find((candidate: { name: string }) => candidate.name === repair.mutation);
              return mutation
                ? { name, shape: argShape(mutation.input, name) }
                : { name };
            }),
            // A repair that needs nothing more is the readiest thing here.
            score: REPAIR_SCORE - repairIndex - (repair.missing?.length ?? 0),
            why: violation.message,
            nodeIds: violation.nodeIds,
          });
        });
      });

      return { affordances, observations };
    },
  };
}
