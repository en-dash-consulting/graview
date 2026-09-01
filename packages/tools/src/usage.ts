import type { Operation } from "@graview/core";

/**
 * WHAT YOU ACTUALLY USE, read off the op log.
 *
 * A menu that ranks only by what is structurally possible treats the act a
 * workspace performs forty times a week exactly like the one it has never
 * touched. The log already knows the difference — every applied mutation is
 * an op with a name and a position — so the boost is DERIVED, deterministic
 * and free of any model: recent and frequent use counts, decaying by
 * half-lives of log distance so the menu tracks the season rather than the
 * archive.
 *
 * This is the simple, derived stand-in for the deferred ELM ranking
 * evaluation (ba7345a2): it feeds the same score field, and if that
 * evaluation ever revisits with real data, its model replaces this
 * arithmetic behind the same seam.
 */

/** How far back the boost reads, in ops. Everything older says nothing. */
const WINDOW = 512;
/** Ops of distance over which a use loses half its weight. */
const HALF_LIFE = 64;
/** The most a mutation's history may add to its score — well inside a band. */
const CEILING = 8;

/** Decayed use per mutation name, from the tail of the log. */
export function usageWeights(ops: readonly Operation[]): ReadonlyMap<string, number> {
  const weights = new Map<string, number>();
  if (ops.length === 0) return weights;
  const last = ops[ops.length - 1]!.seq;
  for (const op of ops.slice(-WINDOW)) {
    if (!op.mutation) continue;
    // An undo is a retraction, not a use — counting it would teach the
    // menu to promote the acts people keep taking back.
    if (op.undoes) continue;
    const weight = Math.pow(0.5, (last - op.seq) / HALF_LIFE);
    weights.set(op.mutation.name, (weights.get(op.mutation.name) ?? 0) + weight);
  }
  return weights;
}

/**
 * A bounded score boost from decayed use. Monotonic in use, capped at
 * CEILING so history shuffles a band and never jumps one — a much-used act
 * still ranks below every repair and above no destructive tail.
 */
export function usageBoost(weight: number): number {
  return CEILING * (weight / (weight + 1));
}
