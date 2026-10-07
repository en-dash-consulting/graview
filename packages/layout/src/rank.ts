import type { AnySchema } from "@graview/core";

/**
 * How near a kind is to what you are looking at.
 *
 * `focus` is the kind you are in; `primary` is one declared edge away in
 * either direction; `secondary` is everything else, reachable or not.
 */
export type KindRank = "primary" | "secondary";

export interface KindRanking {
  /** Absent for the focused kind itself, and when nothing is focused. */
  rankOf(kind: string): KindRank | undefined;
  /**
   * For a kind reachable only THROUGH one primary kind, that kind. This is
   * what lets a nested relationship be drawn as nested rather than flattened
   * into a sibling.
   */
  parentOf(kind: string): string | undefined;
}

const UNRANKED: KindRanking = {
  rankOf: () => undefined,
  parentOf: () => undefined,
};

/**
 * Ranks every declared kind by its distance from the focused kinds, using the
 * SCHEMA rather than the graph.
 *
 * The schema is the right source for the same reason the kinds strip is
 * constant: spatial memory. If ranking came from the instances, adding one
 * node could promote a kind and shuffle every card after it, and the picture
 * you remember would stop being the picture you get. Which kinds relate to
 * which is a property of the domain, not of today's data.
 *
 * Relatedness is symmetric here. An edge declaration has a direction and it
 * matters elsewhere, but "is this near what I am looking at" does not care
 * which end declared it — a run is as related to a person as a person is to a
 * run.
 */
export function rankKinds<S extends AnySchema>(
  schema: S,
  focusKinds: ReadonlySet<string>,
): KindRanking {
  if (focusKinds.size === 0) return UNRANKED;

  const kinds = schema.kinds as readonly string[];
  const neighbors = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    (neighbors.get(a) ?? neighbors.set(a, new Set()).get(a)!).add(b);
    (neighbors.get(b) ?? neighbors.set(b, new Set()).get(b)!).add(a);
  };
  for (const kind of kinds) {
    const definition = schema.tryDefinition(kind);
    if (!definition) continue;
    for (const declaration of Object.values(definition.edges ?? {})) {
      // A wildcard edge genuinely does touch everything, and saying so is
      // more honest than quietly excluding it from the ranking.
      const targets = declaration.to === "*" ? kinds : declaration.to;
      for (const target of targets) link(kind, target);
    }
  }

  /*
   * Breadth first from every focused kind at once, so a focus that spans two
   * kinds (a group of blocks and runs, say) ranks by whichever is nearer
   * rather than by an arbitrary first.
   */
  const distance = new Map<string, number>();
  const reachedFrom = new Map<string, string>();
  let frontier = [...focusKinds].filter((kind) => kinds.includes(kind));
  for (const kind of frontier) distance.set(kind, 0);
  let step = 0;
  while (frontier.length > 0) {
    step += 1;
    const next: string[] = [];
    // Schema order, so which primary a kind hangs off is deterministic when
    // more than one could claim it.
    for (const kind of [...frontier].sort((a, b) => kinds.indexOf(a) - kinds.indexOf(b))) {
      for (const neighbor of [...(neighbors.get(kind) ?? [])].sort(
        (a, b) => kinds.indexOf(a) - kinds.indexOf(b),
      )) {
        if (distance.has(neighbor)) continue;
        distance.set(neighbor, step);
        if (step === 2) reachedFrom.set(neighbor, kind);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  return {
    rankOf: (kind) => {
      const at = distance.get(kind);
      if (at === 0) return undefined;
      return at === 1 ? "primary" : "secondary";
    },
    // Only the ring immediately outside the primaries nests. Beyond that a
    // card would hang off something that is itself hanging off something,
    // which is a tree nobody asked a strip to draw.
    parentOf: (kind) => reachedFrom.get(kind),
  };
}
