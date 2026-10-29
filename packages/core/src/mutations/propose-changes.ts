import * as z from "../schema/zod.js";
import type { AnySchema } from "../schema/schema.js";
import type { AnyMutationDefinition, MutationCall } from "./types.js";

/** The name of the act that proposes changes for review (Roadmap f-proposals-for-review). */
export const PROPOSE_CHANGES = "propose-changes";

/** The most calls one proposal holds, as a suggestion's items are bounded. */
export const MOST_PROPOSED = 500;

/** What "Propose changes" takes: the calls proposed, and the proposal said in the person's own words. */
export interface ProposeChangesArgs {
  readonly calls: readonly MutationCall[];
  readonly intent?: string;
}

/**
 * "PROPOSE CHANGES" (Roadmap f-proposals-for-review): what a seat sends
 * when it may propose an act and may not run it — a grant's `propose` —
 * and what an act's form sends when its button reads "Propose". Its op is
 * a suggestion (`suggests`) with the person as its author and a lineage
 * naming them (`proposedBy`): no primitives, waiting in the Suggested tray
 * until somebody who may run its calls accepts it, as themselves, or
 * declines it. Every store answers to it and no list offers it. It goes
 * over the wire like any call; the store makes its op itself
 * (`VOTING.propose`, filled in by `@graview/core/tidying`), each call
 * judged as the store would judge it but for the grant to run it.
 */
export function proposeChangesMutation<S extends AnySchema>(): AnyMutationDefinition<S> {
  return {
    name: PROPOSE_CHANGES,
    title: "Propose changes",
    input: z.object({
      calls: z.array(z.object({ name: z.string(), args: z.record(z.string(), z.unknown()) })),
      intent: z.optional(z.string()),
    }) as never,
    apply() {
      // The store makes the op (`VOTING.propose`); nothing of the graph changes until it is accepted.
    },
  } as AnyMutationDefinition<S>;
}
