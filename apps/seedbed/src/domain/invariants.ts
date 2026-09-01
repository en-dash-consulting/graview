import {
  defineInvariant,
  type GraphReader,
  type InvariantDefinition,
  type Repair,
  type Violation,
} from "@graview/core";
import type { SeedbedSchema } from "./schema.js";

type SInvariant = InvariantDefinition<SeedbedSchema>;
type AnyNode = { id: string; kind: string } & Record<string, unknown>;
type Reader = GraphReader<AnyNode>;

const labelOf = (node: AnyNode): string =>
  typeof node["label"] === "string" && node["label"].length > 0 ? (node["label"] as string) : node.id;

/**
 * The garden's one rule, and it exists only once someone ADOPTS it — the
 * rule node is data, so in a blank graph nothing judges anything, and
 * agreeing to the rule is a step of the onboarding rather than a constant
 * of the app. The fourth app to use this pattern unchanged.
 */
export const everyPlotTended: SInvariant = defineInvariant<SeedbedSchema, "rule">(
  "every-plot-tended",
  {
    scope: { kind: "rule", match: (node) => node.spec.type === "every-plot-tended" },
    label: "Every plot has a caretaker",
    description: "Each plot must have someone tending it.",
    repairs: ["tend"],
    evaluate({ graph, subject }) {
      const reader = graph as Reader;
      const gardeners = [...reader.allNodes()].filter((node) => node.kind === "gardener");
      const violations: Violation[] = [];
      for (const candidate of reader.allNodes()) {
        if (candidate.kind !== "plot") continue;
        if (reader.out(candidate.id, "tended-by").length > 0) continue;
        const repairs: Repair[] = gardeners.map(
          (gardener): Repair => ({
            mutation: "tend",
            args: { plotId: candidate.id, gardenerId: gardener.id },
            label: `${labelOf(gardener)} takes on ${labelOf(candidate)}`,
          }),
        );
        violations.push({
          invariant: "every-plot-tended",
          subjectId: subject.id,
          label: subject.label,
          message: `Nobody tends ${labelOf(candidate)}`,
          nodeIds: [candidate.id],
          repairs,
        });
      }
      return violations;
    },
  },
);

export const seedbedInvariants = [everyPlotTended];
