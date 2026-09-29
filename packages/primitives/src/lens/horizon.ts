import { isCurrent, type AnySchema, type GraphReader, type NodeOfSchema } from "@graview/core";

/**
 * WHAT A LENS OVER A GROUP MAY DRAW: the whole graph, on the scene's horizon.
 *
 * A lens reads the kinds it binds from the store — the group hands it only
 * its own members — and reading `allNodes()` also read what the horizon had
 * put away. A discography's coverage of songs by theme drew its three
 * retired demos as rows and headed the matrix "3 unanswered": the three
 * songs the district had already said were past. So: the group's own kind
 * is exactly the members the scene handed over (the horizon, and `past=1`
 * when it is widened), and every other kind is what is current.
 */
export function onTheHorizon<S extends AnySchema>(
  graph: GraphReader<NodeOfSchema<S>>,
  schema: S,
  members: readonly NodeOfSchema<S>[] | undefined,
): NodeOfSchema<S>[] {
  const handed = new Set((members ?? []).map((node) => node.kind as string));
  const mine = new Set((members ?? []).map((node) => node.id));
  return graph.allNodes().filter((node) =>
    handed.has(node.kind as string)
      ? mine.has(node.id)
      : isCurrent(schema.tryDefinition(node.kind as never), node as never),
  );
}
