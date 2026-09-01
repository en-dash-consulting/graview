import { labelOf, type AnySchema } from "@graview/core";
import type { AffordanceProvider, Observation } from "../types.js";

/**
 * THE GRAPH ITSELF IS THE FIRST INTELLIGENCE.
 *
 * Before any model or key exists, the typed graph already knows things
 * worth saying: a selected node connected to nothing, one node carrying
 * most of an edge kind, an empty kind that other kinds declare edges into.
 * These ship as observations — statements, not suggestions — because their
 * authority is structural fact, and a fact should not have to dress up as
 * advice to be seen.
 */
export function insightProvider<S extends AnySchema>(): AffordanceProvider<S> {
  return {
    name: "insight",
    derive({ store, nodes, kindSelection }) {
      const observations: Observation[] = [];
      const name = (node: { id: string; kind: string }): string =>
        labelOf(store.schema.tryDefinition(node.kind), node as never);

      for (const node of nodes) {
        // ------------------------------------------------------- an island
        const degree = [...store.schema.edgeKinds].reduce(
          (count, edgeKind) =>
            count +
            store.graph.out(node.id, edgeKind).length +
            store.graph.in(node.id, edgeKind).length,
          0,
        );
        if (degree === 0) {
          observations.push({
            id: `insight:island:${node.id}`,
            text: `${name(node)} is connected to nothing yet`,
            nodeIds: [node.id],
          });
          continue;
        }

        /*
         * ------------------------------------------------- a concentration
         * One node holding most of an edge kind is the structural shape of
         * overload — "Ana carries 5 of 6 runs" — derivable with no idea
         * what a run is.
         */
        for (const edgeKind of store.schema.edgeKinds) {
          const mine = store.graph.in(node.id, edgeKind).length;
          if (mine < 3) continue;
          const everywhere = [...store.graph.allEdges()].filter(
            (edge) => edge.kind === edgeKind,
          ).length;
          if (everywhere >= 4 && mine / everywhere > 0.6) {
            observations.push({
              id: `insight:load:${node.id}:${edgeKind}`,
              text: `${name(node)} holds ${mine} of ${everywhere} "${edgeKind}" — most of them`,
              nodeIds: [node.id],
            });
          }
        }
      }

      // ------------------------------------------------------------- a gap
      for (const kind of kindSelection) {
        if (store.graph.nodesOfKind(kind as never).length > 0) continue;
        const expectedBy = store.schema.definitions
          .filter((definition) =>
            Object.values(definition.edges).some(
              (edge) => edge.to !== "*" && (edge.to as readonly string[]).includes(kind),
            ),
          )
          .map((definition) => definition.plural ?? `${definition.kind}s`);
        if (expectedBy.length > 0) {
          observations.push({
            id: `insight:gap:${kind}`,
            text: `Nothing here yet, though ${expectedBy.join(" and ")} expect to connect to these`,
            nodeIds: [],
          });
        }
      }

      return { observations };
    },
  };
}
