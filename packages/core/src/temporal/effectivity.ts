import { z } from "zod";

/**
 * WHEN something is true, as a construct the framework owns rather than one
 * each domain invents.
 *
 * Two apps arrived at the same idea from different directions. A household has
 * agreements that come into force and later lapse, and blocks whose recurrence
 * started in September. A club has a team you picked FOR a fixture — the
 * eleven that were true on the fourteenth, not the eleven that are true now.
 * Both are the same question: as of when?
 *
 * Left alone they would have become two constructs with different field names
 * and slightly different edge semantics, and a lens or a rule that wanted to
 * ask "was this true then" would have had to know which app it was in.
 */

/** A calendar day, `YYYY-MM-DD`. Not a timestamp: effectivity is a day question. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/**
 * The fields a kind spreads into its own to become temporal.
 *
 * Half-open on purpose: `effectiveFrom` includes its day, `effectiveUntil`
 * excludes it. That is the only convention under which two consecutive
 * versions of a thing do not both hold on the day they change over, and
 * getting it wrong is invisible until the one day of the year it matters.
 */
export const effectivity = {
  effectiveFrom: isoDate.optional(),
  effectiveUntil: isoDate.optional(),
};

export interface Effectivity {
  readonly effectiveFrom?: string | undefined;
  readonly effectiveUntil?: string | undefined;
}

/** Whether something holds on a given day. */
export function isEffectiveOn(node: Effectivity, date: string): boolean {
  if (node.effectiveFrom && date < node.effectiveFrom) return false;
  if (node.effectiveUntil && date >= node.effectiveUntil) return false;
  return true;
}

/** Whether something holds at any point in `[from, until)`. */
export function isEffectiveBetween(
  node: Effectivity,
  from: string,
  until: string,
): boolean {
  if (node.effectiveFrom && node.effectiveFrom >= until) return false;
  if (node.effectiveUntil && node.effectiveUntil <= from) return false;
  return true;
}

/**
 * A CHECKPOINT: a moment a selection is true as of.
 *
 * This is the construct the framework had avoided, and the reason to admit it
 * is that the alternative is worse. A team picked for a fixture is a
 * relationship between three things — this player, in this position, for this
 * match — and a graph of nodes and edges has no ternary relation.
 *
 * The honest options were: a ternary relation (a new primitive, and every
 * traversal, lens and rule learns about it), or a NODE standing for the moment,
 * with ordinary binary edges to it. The second is what this is, and it is not
 * a workaround: the moment is a real thing in the domain. A coach talks about
 * "the team for Saturday" as an object — names it, changes it, compares it to
 * last week's. Reifying it is admitting what was already true.
 *
 * A checkpoint is any node carrying `at`. What it means to be selected AS OF
 * it is the app's business; what the framework guarantees is one shape.
 */
export const checkpoint = {
  /** The day this checkpoint stands for. */
  at: isoDate,
};

export interface Checkpoint {
  readonly id: string;
  readonly at: string;
}

/**
 * The checkpoint in force on a day: the latest one at or before it.
 *
 * "In force" rather than "matching", because a selection made for the
 * fourteenth is still what was true on the fifteenth if nobody has picked a
 * new one — and a lookup that returned nothing on any day without its own
 * checkpoint would make every question about a Tuesday unanswerable.
 */
export function checkpointOn<C extends Checkpoint>(
  checkpoints: readonly C[],
  date: string,
): C | undefined {
  return [...checkpoints]
    .filter((candidate) => candidate.at <= date)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
}

/** Every checkpoint within `[from, until)`, in order. */
export function checkpointsBetween<C extends Checkpoint>(
  checkpoints: readonly C[],
  from: string,
  until: string,
): readonly C[] {
  return [...checkpoints]
    .filter((candidate) => candidate.at >= from && candidate.at < until)
    .sort((a, b) => a.at.localeCompare(b.at));
}
