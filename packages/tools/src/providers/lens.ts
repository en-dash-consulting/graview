import type { AnySchema, NodeOfSchema } from "@graview/core";
import type { Affordance, AffordanceProvider } from "../types.js";

const LENS_SCORE = 55;

export interface LensAction<S extends AnySchema> {
  readonly id: string;
  readonly label: string;
  readonly mutation: string;
  /** Whether this lens can do anything with the given selection. */
  readonly applies: (nodes: readonly NodeOfSchema<S>[]) => boolean;
  readonly args: (nodes: readonly NodeOfSchema<S>[]) => Readonly<Record<string, unknown>>;
  readonly why?: string;
}

/**
 * What the ACTIVE lens can do with this selection — collapse, align, group.
 *
 * A lens is a way of looking, so its actions belong to the looking rather
 * than to the schema: "collapse this week" means nothing outside a timeline.
 * Registering them here keeps them in the same ranked set as everything else,
 * so the interface never has two competing action surfaces.
 */
export function lensProvider<S extends AnySchema>(
  lens: { name: string; actions: readonly LensAction<S>[] },
): AffordanceProvider<S> {
  return {
    name: "lens",
    derive({ nodes }) {
      if (nodes.length === 0) return {};
      const affordances: Affordance[] = [];
      for (const action of lens.actions) {
        if (!action.applies(nodes)) continue;
        affordances.push({
          id: `lens:${lens.name}:${action.id}`,
          label: action.label,
          provider: "lens",
          mutation: action.mutation,
          args: action.args(nodes),
          open: [],
          score: LENS_SCORE,
          why: action.why ?? `the ${lens.name} lens can do this here`,
          nodeIds: nodes.map((node) => node.id),
        });
      }
      return { affordances };
    },
  };
}
