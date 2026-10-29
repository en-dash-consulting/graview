import type { AnySchema, Principal, Store } from "@graview/core";
import { foldDigests, suggestions, type ActivityRow, type SuggestionsOptions } from "@graview/core/tidying";

/*
 * WHILE YOU WERE AWAY: what the app's own actor did and suggested since a
 * person last looked, for the tray or the bar to say in one line — "3
 * suggestions waiting · tidied 12 things while you were away". Read as the
 * person may see the app: a suggestion or a change about a record they may
 * not see is not counted, and one they said "not now" to (`dismissed`, as
 * `suggestions` takes it) does not wait for them (FR-212).
 */

/** Since when: a position in the log (`seq`, the first op not yet seen) or a moment (`at`, ISO). */
export interface AwaySince {
  readonly seq?: number;
  readonly at?: string;
}

export interface WhileAway {
  /** Suggestions waiting now, whenever they were made. */
  readonly waiting: number;
  /** Of those, the ones made since. */
  readonly suggestedSince: number;
  /**
   * THE MOST PEOPLE WHO AGREE WITH ONE THAT WAITS (Roadmap
   * f-votes-shared-seat): the standing votes for the waiting suggestion
   * with the most of them — people's, not visitors' advisory ones — said
   * "3 readers agree with one that waits". 0 when nobody voted for one.
   */
  readonly agreed: number;
  /** How many things the actor did on its own since, not counting what was taken back. */
  readonly tidied: number;
  /** Activity's digest rows since: each run of the actor's changes as one row. */
  readonly digests: readonly Extract<ActivityRow, { digest: unknown }>["digest"][];
  /** "3 suggestions waiting · 3 readers agree with one that waits · tidied 12 things while you were away", or undefined when there is nothing to say. */
  readonly said: string | undefined;
}

/** What the app's own actor did and suggested since `since`, as `principal` (or the seat a seat's store is of) may see it, less what they said "not now" to. */
export function whileAway<S extends AnySchema>(store: Store<S>, since: AwaySince, principal?: Principal, options: SuggestionsOptions = {}): WhileAway {
  const seen = principal ? store.seenBy(principal) : store;
  const after = (op: { readonly seq: number; readonly at: string }) => (since.seq === undefined || op.seq >= since.seq) && (since.at === undefined || op.at > since.at);
  const waitingNow = suggestions(seen, undefined, options);
  const ops = seen.log.all();
  const byId = new Map(ops.map((op) => [op.id, op]));
  const seqOf = (id: string) => byId.get(id);
  const suggestedSince = waitingNow.filter((one) => {
    const op = seqOf(one.id);
    return op !== undefined && after(op);
  }).length;
  const batches = seen.batches().filter((batch) => batch.ops.length > 0 && after(batch.ops[0]!));
  const digests = foldDigests(batches, (id) => byId.get(id)).flatMap((row) => ("digest" in row ? [row.digest] : []));
  const tidied = digests.reduce((sum, digest) => sum + digest.things, 0);
  const agreed = waitingNow.reduce((most, one) => Math.max(most, one.tally.for), 0);
  const parts = [
    waitingNow.length > 0 ? `${waitingNow.length === 1 ? "one suggestion" : `${waitingNow.length} suggestions`} waiting` : "",
    agreed > 0 ? `${agreed === 1 ? "a reader agrees" : `${agreed} readers agree`} with one that waits` : "",
    tidied > 0 ? `tidied ${tidied === 1 ? "one thing" : `${tidied} things`} while you were away` : "",
  ].filter(Boolean);
  const said = parts.length > 0 ? parts.join(" · ").replace(/^./, (first) => first.toUpperCase()) : undefined;
  return { waiting: waitingNow.length, suggestedSince, agreed, tidied, digests, said };
}
