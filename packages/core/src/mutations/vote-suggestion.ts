import * as z from "../schema/zod.js";
import type { Lineage } from "../ops/lineage.js";
import type { Operation } from "../ops/types.js";
import type { Principal } from "../permissions/types.js";
import type { AnySchema } from "../schema/schema.js";
import type { AnyMutationDefinition, MutationCall } from "./types.js";

/** The name of the act that votes on a suggestion (Roadmap f-suggestion-votes). */
export const VOTE_SUGGESTION = "vote-suggestion";

/** A vote on a suggestion: for it, against it, or none (a vote withdrawn). */
export type Vote = "for" | "against" | null;

/** What a vote's op keeps (`Operation.vote`): which suggestion, and which way. */
export interface SuggestionVote {
  /** The id of the suggestion's op. */
  readonly suggestion: string;
  readonly vote: Vote;
}

/**
 * WHAT THE DECLARATION SAYS OF SUGGESTIONS AS A WHOLE (`tidying` at the
 * top of a document, Roadmap f-suggestion-votes): `autoAcceptAt`, the
 * number of votes for a suggestion at which the app's own actor makes it
 * without waiting for someone who may. Absent, a suggestion waits until
 * one of them decides, however many voted. Handed to the store
 * (`StoreOptions.tidying`), which is where it is honored.
 */
export interface AppTidying {
  readonly autoAcceptAt?: number;
}

/**
 * "VOTE ON A SUGGESTION" (Roadmap f-suggestion-votes): what Accept and
 * Decline do from a seat that may see a suggestion and may not make the
 * change — a reader, a visitor by link — so the person is heard rather
 * than refused. Its arguments are the suggestion's id and the vote: `for`,
 * `against`, or `null` to withdraw one. One standing vote per person: a
 * later one replaces it.
 *
 * Every store answers to it and no list offers it: it is not one of the
 * app's acts, and the tray offers it as Accept and Decline. It goes over
 * the wire like any call, and is permitted to whoever may see the
 * suggestion. The store makes its op itself (`VOTING.op`, filled in by
 * `@graview/core/tidying`): no primitives, the vote on the op, so it folds
 * to nothing and a build before it reads it as a change that touched
 * nothing.
 */
export function voteSuggestionMutation<S extends AnySchema>(): AnyMutationDefinition<S> {
  return {
    name: VOTE_SUGGESTION,
    title: "Vote on a suggestion",
    input: z.object({ suggestion: z.string(), vote: z.union([z.literal("for"), z.literal("against"), z.null()]) }) as never,
    apply() {
      // The store makes the op (`VOTING.op`); nothing of the graph changes.
    },
  } as AnyMutationDefinition<S>;
}

/** What `@graview/core/tidying` teaches the store about votes when it is loaded, as `PUBLISHING` does for a publish. */
export interface VotingServed {
  /** The vote's op, judged as the voter sees the suggestion: a sentence when it is not waiting for them. */
  op?: (store: object, made: { readonly id: string; readonly at: string }, call: MutationCall, batch: string, author: Principal, options: { readonly via?: unknown }) => Operation;
  /**
   * What the vote just kept has the app's own actor make, when the
   * declaration says a suggestion is made at `autoAcceptAt` votes for and
   * this one reached it: the suggestion's calls, the actor, and a lineage
   * naming the suggestion and its voters. Undefined when nothing is to be
   * made.
   */
  accepting?: (store: object, vote: Operation) => { readonly calls: readonly MutationCall[]; readonly author: Principal; readonly lineage: Lineage } | undefined;
}
/*
 * One object for the store and `@graview/core/tidying`, found by a key
 * every copy agrees on, as the seat view and publishing are: the module a
 * page fetches to draw the tray imports nothing of what it loaded first.
 */
export const VOTING: VotingServed = ((globalThis as Record<symbol, VotingServed | undefined>)[Symbol.for("@graview/core:voting")] ??= {});
