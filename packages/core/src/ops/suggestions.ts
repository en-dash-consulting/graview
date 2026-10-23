import type { MutationCall } from "../mutations/types.js";
import type { Lineage } from "./lineage.js";
import { undoneIn } from "./log.js";
import type { Author, Operation } from "./types.js";

/*
 * THE SUGGESTIONS WAITING IN A LOG (`@graview/core/tidying`): read only by
 * what draws or answers them — the Suggested tray, an agent's tools — so
 * apart from what the store holds the actor to (`tidying.ts`), and none
 * of a page's weight before one is drawn.
 */

/** A suggestion that waits: what it proposes, who proposed it, on what basis, and how sure. */
export interface Suggestion {
  /** The id of the op that holds it: what `acceptSuggestion` and `declineSuggestion` take. */
  readonly id: string;
  readonly batch: string;
  readonly calls: readonly MutationCall[];
  /** What it would do, in the acts' own sentences. */
  readonly intent: string;
  readonly author: Author;
  readonly lineage?: Lineage;
  readonly at: string;
  /** When it stops waiting, when its maker said (`Operation.expiresAt`). */
  readonly expiresAt?: string;
  /** The records its calls name, so a tray can point at them. */
  readonly about: readonly string[];
}

/**
 * "NOT NOW": ONE PERSON PUT A SUGGESTION OUT OF SIGHT, without saying no
 * to it. It is the person's own state, not the app's — kept where the host
 * keeps what a person chose (beside their subscriptions, their pins), and
 * handed to `suggestions` as `dismissed` — so it hides the suggestion from
 * them alone, binds the app's own actor to nothing, and the log, which is
 * what every reader shares and the actor is held to, says nothing of it. A
 * decline is the other answer: an undo in the log, for everyone, and the
 * actor never makes it again.
 */
export interface Dismissal {
  /** The id of the suggestion's op. */
  readonly suggestion: string;
  /** When the person said it. */
  readonly at: string;
  /** When it shows again, if it is still waiting then; absent, not while that suggestion waits. */
  readonly until?: string;
}

/** What reading the suggestions waiting is told besides the log. */
export interface WaitingOptions {
  /** Now, as an ISO time: what an expiry and a dismissal's `until` are read against. Unsaid, the clock's. */
  readonly now?: string;
  /** What the person reading said "not now" to; those are not among what waits for them. */
  readonly dismissed?: readonly Dismissal[] | undefined;
}

/** Whether a suggestion's op has stopped waiting by its own expiry. */
export const expired = (op: Pick<Operation, "expiresAt">, now: string): boolean => op.expiresAt !== undefined && Date.parse(op.expiresAt) <= Date.parse(now);

/** Whether one person put this suggestion out of sight, as of now. */
export const isDismissed = (dismissed: readonly Dismissal[] | undefined, id: string, now: string): boolean =>
  (dismissed ?? []).some((one) => one.suggestion === id && (one.until === undefined || Date.parse(one.until) > Date.parse(now)));

/**
 * THE SUGGESTIONS STILL WAITING in a log, oldest first: each op that
 * suggests, unless an op accepted it (its lineage names it, whether or not
 * that was taken back later), a live undo declined it, or it expired. A
 * withheld op is no suggestion for the seat it was withheld from. `has`
 * keeps, of the ids its calls name, the records (`about`). One the reader
 * said "not now" to (`options.dismissed`) is left out for them.
 */
export function suggestionsIn(ops: readonly Operation[], has: (id: string) => boolean = () => true, options: WaitingOptions = {}): Suggestion[] {
  const undone = undoneIn(ops);
  const accepted = new Set(ops.map((op) => op.lineage?.suggestion));
  const now = options.now ?? new Date().toISOString();
  return ops
    .filter((op) => op.suggests && !op.withheld && !undone.has(op.id) && !accepted.has(op.id) && !expired(op, now) && !isDismissed(options.dismissed, op.id, now))
    .map(({ id, batch, suggests, intent, author, lineage, at, expiresAt }) => {
      const about = new Set<string>();
      // Every string its calls hold, kept where it is a record.
      JSON.stringify(suggests!.map((call) => call.args), (_, value) => (typeof value === "string" && has(value) && about.add(value), value));
      return { id, batch, calls: suggests!, intent, author, ...(lineage ? { lineage } : {}), at, expiresAt, about: [...about] };
    });
}
