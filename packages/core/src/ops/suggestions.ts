import type { MutationCall } from "../mutations/types.js";
import type { Vote } from "../mutations/vote-suggestion.js";
import { actingAs } from "../permissions/policy.js";
import type { Principal } from "../permissions/types.js";
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
  /**
   * THE VOTES ON IT (Roadmap f-suggestion-votes): how many people's
   * standing vote is for it and against it, and the reader's own when they
   * cast one (`mine`) — what a tray shows beside Accept to whoever may
   * decide, says back to a voter, and a list sorts on.
   */
  readonly tally: SuggestionTally;
  /**
   * WHAT STILL WAITS OF A SUGGESTION OF SEVERAL CALLS (Roadmap
   * f-job-approvals): each call not yet accepted, its place in the
   * suggestion's op, and its act's sentence — a workflow's run asked about
   * as one, accepted whole or one change at a time
   * (`acceptSuggestion(…, { items })`). `calls` holds the same calls. One
   * per call; a suggestion of one call has one.
   */
  readonly items: readonly SuggestionItem[];
  /** The suggestion said as one, when its maker said ("Next week: 28 events to add, 3 to change"): the op's `batchIntent`. */
  readonly headline?: string;
}

/** One call of a suggestion that still waits: where it stands in the suggestion, what it is, and what it would do. */
export interface SuggestionItem {
  readonly at: number;
  readonly call: MutationCall;
  readonly intent: string;
}

/** The standing votes on a suggestion, counted (Roadmap f-suggestion-votes). */
export interface SuggestionTally {
  readonly for: number;
  readonly against: number;
  /** The reader's own standing vote, when one was named to `suggestions` and they cast one. */
  readonly mine?: "for" | "against";
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

/**
 * WHERE A PERSON'S "NOT NOW" IS KEPT: the host's, beside what else it keeps
 * of them (their subscriptions, their pins), for the one person reading.
 * `list` is read as the tray draws, so a host whose storage is far away
 * keeps a copy near and says `onChange` when it moves.
 */
export interface DismissalStore {
  /** What this person said "not now" to. */
  list(): readonly Dismissal[];
  /** Keep one, in place of any earlier one for the same suggestion. */
  dismiss(dismissal: Dismissal): void | Promise<void>;
  /** Told when what is kept changes; returns how to stop being told. */
  onChange?(listener: () => void): () => void;
}

/** What reading the suggestions waiting is told besides the log. */
export interface WaitingOptions {
  /** Now, as an ISO time: what an expiry and a dismissal's `until` are read against. Unsaid, the clock's. */
  readonly now?: string;
  /** What the person reading said "not now" to; those are not among what waits for them. */
  readonly dismissed?: readonly Dismissal[] | undefined;
  /** Who is reading, so each suggestion's `tally.mine` is their standing vote (Roadmap f-suggestion-votes). */
  readonly voter?: Principal | undefined;
}

/** Who a vote is counted as: the person, for an agent acting for one; a seat with no id, by its session. */
export const voterId = (author: Author): string | undefined => actingAs(author as Principal).id ?? author.session;

/**
 * THE STANDING VOTES IN A LOG, by suggestion then by voter (Roadmap
 * f-suggestion-votes): each person's latest vote that still stands — a
 * later vote replaces an earlier one, `null` withdraws it, an undone vote
 * never counted, and a vote withheld from the reader is not theirs to
 * count. One pass over the ops, asked once per reading.
 */
export function votesIn(ops: readonly Operation[]): ReadonlyMap<string, ReadonlyMap<string, Exclude<Vote, null>>> {
  const undone = undoneIn(ops);
  const standing = new Map<string, Map<string, Exclude<Vote, null>>>();
  for (const op of ops) {
    if (op.vote === undefined || op.withheld || undone.has(op.id)) continue;
    const who = voterId(op.author);
    if (who === undefined) continue;
    let votes = standing.get(op.vote.suggestion);
    if (!votes) standing.set(op.vote.suggestion, (votes = new Map()));
    if (op.vote.vote === null) votes.delete(who);
    else votes.set(who, op.vote.vote);
  }
  return standing;
}

/** The votes on one suggestion, counted, with the reader's own when they are named. */
export function tallyOf(votes: ReadonlyMap<string, Exclude<Vote, null>> | undefined, voter?: Principal): SuggestionTally {
  let votedFor = 0;
  let against = 0;
  for (const vote of votes?.values() ?? []) vote === "for" ? votedFor++ : against++;
  const me = voter && voterId(voter);
  const mine = me !== undefined ? votes?.get(me) : undefined;
  return { for: votedFor, against, ...(mine !== undefined ? { mine } : {}) };
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
 * said "not now" to (`options.dismissed`) is left out for them. Each
 * carries the standing votes on it (`tally`), the reader's own among them
 * when `options.voter` names them.
 */
export function suggestionsIn(ops: readonly Operation[], has: (id: string) => boolean = () => true, options: WaitingOptions = {}): Suggestion[] {
  const undone = undoneIn(ops);
  const taken = takenIn(ops);
  const now = options.now ?? new Date().toISOString();
  let votes: ReturnType<typeof votesIn> | undefined;
  return ops
    .filter((op) => op.suggests && !op.withheld && !undone.has(op.id) && taken.get(op.id) !== "all" && !expired(op, now) && !isDismissed(options.dismissed, op.id, now))
    .flatMap(({ id, batch, suggests, suggestsSaid, intent, batchIntent, author, lineage, at, expiresAt }) => {
      const took = taken.get(id) as ReadonlySet<number> | undefined;
      const items = itemsOf(suggests!, suggestsSaid, intent).filter((item) => !took?.has(item.at));
      // Every call accepted, one by one.
      if (items.length === 0) return [];
      const calls = items.map((item) => item.call);
      const about = new Set<string>();
      // Every string its calls hold, kept where it is a record.
      JSON.stringify(calls.map((call) => call.args), (_, value) => (typeof value === "string" && has(value) && about.add(value), value));
      return [
        {
          id,
          batch,
          calls,
          intent: took ? items.map((item) => item.intent).join("; ") : intent,
          ...(batchIntent !== undefined ? { headline: batchIntent } : {}),
          items,
          author,
          ...(lineage ? { lineage } : {}),
          at,
          expiresAt,
          about: [...about],
          tally: tallyOf((votes ??= votesIn(ops)).get(id), options.voter),
        },
      ];
    });
}

/** A suggestion's calls as items: each with its own sentence when the op kept them, else the op's sentence for a lone call, or the act's name. */
function itemsOf(calls: readonly MutationCall[], said: readonly string[] | undefined, intent: string): SuggestionItem[] {
  const own = said && said.length === calls.length ? said : undefined;
  return calls.map((call, at) => ({ at, call, intent: own?.[at] ?? (calls.length === 1 ? intent : call.name) }));
}

/**
 * WHAT OF EACH SUGGESTION HAS BEEN ACCEPTED (Roadmap f-job-approvals): by
 * the suggestion's op id, "all" when a change took it whole — an accept
 * that named no items, whether or not it was taken back later — else the
 * places of the calls the changes that named items took.
 */
export function takenIn(ops: readonly Operation[]): ReadonlyMap<string, "all" | ReadonlySet<number>> {
  const taken = new Map<string, "all" | Set<number>>();
  for (const op of ops) {
    const id = op.lineage?.suggestion;
    if (id === undefined) continue;
    const items = op.lineage!.items;
    const had = taken.get(id);
    if (had === "all") continue;
    if (items === undefined) taken.set(id, "all");
    else {
      const set = had ?? new Set<number>();
      for (const at of items) set.add(at);
      taken.set(id, set);
    }
  }
  // Every call of a suggestion taken one by one is the suggestion taken.
  const byId = new Map(ops.filter((op) => op.suggests && taken.has(op.id)).map((op) => [op.id, op.suggests!.length]));
  for (const [id, set] of taken) if (set !== "all" && byId.has(id) && set.size >= byId.get(id)!) taken.set(id, "all");
  return taken;
}
