/**
 * `@graview/core/tidying` — THE APP'S OWN ACTOR, AND WHAT PEOPLE SAID TO IT.
 *
 * A background actor ("Graview, tidying", an author that says `automated:
 * true`) applies what it is sure of, with lineage, and suggests what it is
 * not (`suggest`), which waits for a person in the Suggested tray, where
 * they accept it (`acceptSuggestion`) or decline it (`declineSuggestion`).
 * Here too is what reads it back: which suggestions wait (`suggestions`)
 * and which were declined (`declined`), in a store or a log, who a
 * suggestion is, what the declaration lets the actor tidy, why a change of
 * its would be refused, and Activity's rows with an actor's run folded
 * into one digest. Apart from the store, so a page carries none of it
 * before a suggestion is drawn. What a page draws a record with —
 * `isLeftAlone`, `isAutomated` — is the main entry's, and the store holds
 * the actor to what people said whatever path its change takes.
 *
 * Someone who may see a suggestion and may not make its change — a
 * reader, a visitor by link — is not refused (Roadmap f-suggestion-votes):
 * their Accept and Decline are a vote, for or against (`voteSuggestion`),
 * one standing vote each, which they may change or withdraw; whoever may
 * decide (`mayDecide`) sees the tally and accepts or declines as ever, and
 * an app may say a suggestion is made at so many votes for
 * (`tidying.autoAcceptAt`), by the actor, with the voters in its lineage.
 * Loaded, this module teaches the store how a vote's op is made
 * (`VOTING`), as `@graview/core/publishing` does for a publish.
 */
import { GraphError } from "./graph/graph.js";
import type { MutationCall } from "./mutations/types.js";
import { advisoryVoterOf, signedOutSeat, VOTE_SUGGESTION, VOTING, type Vote } from "./mutations/vote-suggestion.js";
import { lineageOf, LINEAGE_VOTERS_LIMIT, type Lineage } from "./ops/lineage.js";
import { expired, suggestionsIn, votesIn, type Dismissal, type Suggestion } from "./ops/suggestions.js";
import { declinedIn, isAutomated, meaningKey, type ActMeanings } from "./ops/tidying.js";
import type { Author, Operation, Via } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";
import { seatOf } from "./seat-of.js";
import type { ApplyOptions, ApplyResult, Store } from "./store.js";
import { EMPTY_DIFF } from "./graph/diff.js";

export { declinedIn, declinesIn, meaningKey, suggestionKey, tidyingOf, tidyingRefusal } from "./ops/tidying.js";
export type { ActMeanings } from "./ops/tidying.js";
export { isDismissed, suggestionsIn, tallyOf, votesIn } from "./ops/suggestions.js";
export type { Dismissal, DismissalStore, Suggestion, SuggestionTally, WaitingOptions } from "./ops/suggestions.js";
export { advisoryVoterOf, SIGN_IN_TO_VOTE, signedOutSeat } from "./mutations/vote-suggestion.js";
export type { AppTidying, SuggestionVote, Vote, VotesOptions } from "./mutations/vote-suggestion.js";
export { digestWords, foldDigests, isSuggestionBatch, typedRowWords } from "./ops/digest.js";
export type { ActivityRow, TypedRow } from "./ops/digest.js";
export { LEFT_ALONE } from "./graph/archived.js";

/**
 * WHAT `suggest` TAKES: who suggests, and — required — what it is based on
 * and how sure (`lineage`). Its channel and the gesture's words as
 * `applyAll` takes them.
 */
export interface SuggestOptions {
  readonly author?: Author | Principal;
  readonly lineage: Lineage;
  readonly via?: Via;
  readonly intent?: string;
  /**
   * WHEN IT STOPS WAITING, as an ISO time (`Operation.expiresAt`): then it
   * leaves the tray and cannot be accepted, and an actor that still thinks
   * so judges it again. Unsaid, it waits until a person answers it.
   */
  readonly expiresAt?: string;
}

/** What reading the suggestions waiting is told besides who reads them. */
export interface SuggestionsOptions {
  /** What the person reading said "not now" to (`Dismissal`), kept where the host keeps their own state. */
  readonly dismissed?: readonly Dismissal[];
}

/*
 * WHAT A SUGGESTION IS JUDGED AND KEPT WITH: the store's own rehearsal,
 * its ids and its refusal of a declined change, which it keeps to itself.
 * Read here, apart from the store, so a page that never suggests carries
 * none of it.
 */
interface Kept<S extends AnySchema> {
  readonly by: Author | Principal;
  rehearsal(): Kept<S> & { suggesting: boolean };
  applying(calls: readonly MutationCall[], options: ApplyOptions): ApplyResult<S>;
  nextId(): string;
  mintBatch(kind: "batch" | "undo"): string;
  now(): string;
  refuseDeclined(calls: readonly MutationCall[], author: Author | Principal): void;
  actMeanings(): ActMeanings;
}
const keptOf = <S extends AnySchema>(store: Store<S>) => store as unknown as Kept<S>;
const given = <K extends string, V>(key: K, value: V | undefined) => (value === undefined ? {} : { [key]: value }) as { readonly [P in K]?: V };

/**
 * A SUGGESTION THAT WAITS. The calls are judged as `applyAll` would judge
 * them for this author — permission, sight, the act's own guard, a record a
 * person said to leave alone — on a rehearsal, and none of it is applied:
 * the log keeps one op that suggests them (`suggests`), with no
 * primitives, its lineage required, and every subscriber hears it. A
 * change already declined is refused, in a sentence; one already waiting is
 * answered with the suggestion that waits; one that would change nothing
 * is not suggested (undefined). A person accepts it (`acceptSuggestion`) or
 * declines it (`declineSuggestion`). Call it on the store that keeps the
 * log — a server's, for a hosted app — whose ops reach every client as
 * they are.
 */
export function suggest<S extends AnySchema>(store: Store<S>, calls: readonly MutationCall[], options: SuggestOptions): Operation | undefined {
  const whole = seatOf(store)?.store ?? store;
  const kept = keptOf(whole);
  const lineage = lineageOf(options.lineage);
  if (lineage === undefined) throw new GraphError("A suggestion says what it is based on: { basis, confidence? }");
  const author = options.author ?? kept.by;
  if (options.expiresAt !== undefined && Number.isNaN(Date.parse(options.expiresAt))) throw new GraphError(`A suggestion expires at a time: "${options.expiresAt}" is not one (an ISO time, like 2026-10-23T06:00:00Z).`);
  // The same change, however it is spelled, is the one that waits — even one a person said "not now" to.
  const meanings = kept.actMeanings();
  const key = meaningKey(calls, meanings);
  const waiting = suggestions(whole).find((one) => meaningKey(one.calls, meanings) === key);
  if (waiting) return whole.log.get(waiting.id);
  kept.refuseDeclined(calls, author);
  const rehearsal = kept.rehearsal();
  rehearsal.suggesting = true;
  const planned = rehearsal.applying(calls, { author, lineage, ...given("via", options.via) });
  if (planned.ops.length === 0) return undefined;
  const described = [...new Set(planned.ops.flatMap((op) => op.described ?? []))];
  const op: Operation = {
    id: kept.nextId(),
    seq: whole.log.length,
    batch: kept.mintBatch("batch"),
    author,
    intent: planned.ops.map((one) => one.intent).join("; "),
    ...given("batchIntent", options.intent),
    mutation: null,
    primitives: [],
    reads: [],
    writes: [],
    ...(described.length > 0 ? { described } : {}),
    at: kept.now(),
    ...given("via", options.via),
    lineage,
    suggests: calls,
    ...given("expiresAt", options.expiresAt),
  };
  whole.log.append(op);
  whole.notify(EMPTY_DIFF as never, [op]);
  return op;
}

/**
 * THE SUGGESTIONS WAITING, oldest first — as `principal` may see them,
 * when one is named, or as the seat a seat's view (`seenBy`) is of: a
 * suggestion that names a record the seat may not see is not among them
 * (it is withheld, as any op that names one is). One that expired is not
 * waiting; one the reader said "not now" to (`options.dismissed`) is left
 * out for them alone.
 */
export function suggestions<S extends AnySchema>(store: Store<S>, principal?: Principal, options: SuggestionsOptions = {}): readonly Suggestion[] {
  const seat = seatOf(store);
  const whole = seat?.store ?? store;
  const who = principal ?? seat?.principal;
  // A seat that sees everything is handed the store itself.
  const ops = (who !== undefined ? whole.seenBy(who) : whole).log.all();
  return suggestionsIn(ops, (id) => whole.graph.has(id), { now: keptOf(whole).now(), dismissed: options.dismissed, voter: who });
}

/**
 * WHETHER THIS SEAT MAY DECIDE A SUGGESTION (Roadmap f-suggestion-votes):
 * the store would let them make its change — every call of it permitted
 * to them, the same answer `applyAll` gives — so their Accept makes it and
 * their Decline answers it for everyone. One who may not (a reader, a
 * visitor by link) votes instead, and is shown no tally. A store with no
 * policy lets everyone decide, as it always has.
 */
export function mayDecide<S extends AnySchema>(store: Store<S>, suggestion: Pick<Suggestion, "calls">, principal?: Principal): boolean {
  const seat = seatOf(store);
  const whole = seat?.store ?? store;
  const who = principal ?? seat?.principal ?? (keptOf(whole).by as Principal);
  return suggestion.calls.every((call) => whole.permits(call, who).ok);
}

/** What accepting or declining a suggestion answers: the change made, or — from a seat that may not make it — the vote kept instead (`voted`). */
export type SuggestionAnswer<S extends AnySchema> = ApplyResult<S> & { readonly voted?: Exclude<Vote, null> };

/**
 * VOTE ON A SUGGESTION (Roadmap f-suggestion-votes): `for` it, `against`
 * it, or `null` to withdraw the vote — one standing vote per person, the
 * latest, kept as an op of the built-in `vote-suggestion` act, which
 * changes nothing of the graph. Anybody who may see the suggestion votes;
 * whoever may decide it accepts or declines it instead
 * (`acceptSuggestion`, `declineSuggestion`), which do this on their
 * behalf when they may not. A suggestion that is no longer waiting, or
 * that the voter may not see, is refused in a sentence.
 */
export function voteSuggestion<S extends AnySchema>(store: Store<S>, id: string, vote: Vote, options: ApplyOptions = {}): SuggestionAnswer<S> {
  const whole = seatOf(store)?.store ?? store;
  const author = options.author ?? keptOf(whole).by;
  waitingFor(whole, id, author);
  const result = whole.applyAll([{ name: VOTE_SUGGESTION, args: { suggestion: id, vote } }], { ...options, author });
  return vote === null ? result : { ...result, voted: vote };
}

/** A suggestion still waiting that this author may see, or a sentence saying it is not. */
function waitingFor<S extends AnySchema>(store: Store<S>, id: string, author: Author | Principal): Suggestion {
  const found = suggestions(store, author as Principal).find((one) => one.id === id);
  const op = found ? undefined : store.log.get(id);
  if (op?.suggests && expired(op, keptOf(store).now())) throw new GraphError(`That suggestion expired on ${op.expiresAt!.slice(0, 10)}.`);
  if (!found) throw new GraphError("That suggestion is no longer waiting: it was accepted or declined, or it is not one you can see.");
  return found;
}

/**
 * ACCEPT A SUGGESTION: its calls applied as one gesture, as the person
 * (`options.author`, or the store's principal) — judged as any change of
 * theirs is — carrying the suggestion's lineage, which names it
 * (`lineage.suggestion`), so it waits no longer.
 */
export function acceptSuggestion<S extends AnySchema>(store: Store<S>, id: string, options: ApplyOptions = {}): SuggestionAnswer<S> {
  const whole = seatOf(store)?.store ?? store;
  const author = options.author ?? keptOf(whole).by;
  const suggestion = waitingFor(whole, id, author);
  // From a seat the store would refuse the change, a vote for it (Roadmap f-suggestion-votes).
  if (!mayDecide(whole, suggestion, author as Principal)) return voteSuggestion(whole, id, "for", { ...options, author });
  return whole.applyAll(suggestion.calls, { ...options, author, lineage: { ...suggestion.lineage!, suggestion: id } });
}

/**
 * DECLINE A SUGGESTION: an undo of it, which changes nothing and carries
 * its lineage (`undoneLineage`), so `declined(store, calls)` says so and
 * the same suggestion — or the same change, made on its own — is refused
 * to the app's own actor from now on. Undone, it waits again.
 */
export function declineSuggestion<S extends AnySchema>(store: Store<S>, id: string, options: ApplyOptions = {}): SuggestionAnswer<S> {
  const whole = seatOf(store)?.store ?? store;
  const author = options.author ?? keptOf(whole).by;
  const suggestion = waitingFor(whole, id, author);
  // From a seat the store would refuse the change, a vote against it (Roadmap f-suggestion-votes): a decline is whoever may decide's.
  if (!mayDecide(whole, suggestion, author as Principal)) return voteSuggestion(whole, id, "against", { ...options, author });
  return whole.undo(suggestion.batch, { ...options, author });
}

/**
 * WITHDRAW A SUGGESTION ITS MAKER NO LONGER STANDS BY (Roadmap
 * f-withdraw-own-suggestions): an undo of it by whoever suggested it — the
 * app's own actor, once a host raised the bar it is asked at — which
 * changes nothing, takes it out of the tray, and is no decline: nobody said
 * no to it, so the actor may suggest it again should it come to be sure
 * enough. Only its maker withdraws a suggestion; a person declines one
 * (`declineSuggestion`). Undone, it waits again.
 */
export function withdrawSuggestion<S extends AnySchema>(store: Store<S>, id: string, options: ApplyOptions = {}): ApplyResult<S> {
  const whole = seatOf(store)?.store ?? store;
  const author = options.author ?? keptOf(whole).by;
  const suggestion = waitingFor(whole, id, author);
  if (suggestion.author.kind !== author.kind || suggestion.author.id !== author.id) throw new GraphError("Only who made a suggestion withdraws it: a person declines it (declineSuggestion).");
  return whole.undo(suggestion.batch, { ...options, author });
}

/**
 * The op that declined these calls — the whole suggestion, or any one of
 * them on its own, as asked or meaning the same (`meaningKey`) — or
 * undefined: what an actor asks before it suggests.
 */
export function declined(store: Pick<Store<AnySchema>, "log">, calls: readonly MutationCall[]): Operation | undefined {
  const kept = store as unknown as Partial<Kept<AnySchema>>;
  return declinedIn(store.log.all(), calls, typeof kept.actMeanings === "function" ? kept.actMeanings() : undefined);
}

/** The app's own actor, when a suggestion's maker is not one: who makes a suggestion that reached `autoAcceptAt`. */
const TIDYING_ACTOR: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };

/*
 * HOW A VOTE'S OP IS MADE, taught to the store (`VOTING`, Roadmap
 * f-suggestion-votes): judged as the voter sees the suggestion — one not
 * waiting for them is refused in `waitingFor`'s sentence — its intent the
 * suggestion's own sentence under the vote, the records the suggestion
 * names as what the sentence read (`described`), so a seat that may not
 * see one is served the op withheld, as the suggestion is; no primitives,
 * and the vote on the op.
 */
VOTING.op = (held, made, call, batch, author, options) => {
  const store = held as Store<AnySchema>;
  const { suggestion: id, vote } = call.args as { suggestion: string; vote: Vote };
  const suggestion = waitingFor(store, id, author);
  // From a shared or signed-out seat the store let vote (`StoreOptions.votes`), advisory, and its visitor's (Roadmap f-votes-shared-seat).
  const voter = signedOutSeat(author) ? advisoryVoterOf(author) : undefined;
  const intent = vote === "for" ? `For: ${suggestion.intent}` : vote === "against" ? `Against: ${suggestion.intent}` : `Withdraws a vote on: ${suggestion.intent}`;
  return {
    id: made.id,
    seq: store.log.length,
    batch,
    author,
    intent,
    mutation: call,
    primitives: [],
    reads: [],
    writes: [],
    ...(suggestion.about.length > 0 ? { described: suggestion.about } : {}),
    at: made.at,
    ...(options.via !== undefined ? { via: options.via as Via } : {}),
    vote: { suggestion: id, vote, ...(voter !== undefined ? { advisory: true as const, voter } : {}) },
  };
};

/*
 * WHAT A VOTE HAS THE ACTOR MAKE (`VOTING.accepting`): when the declaration
 * says `autoAcceptAt` and this vote brought the suggestion's standing votes
 * for it to that many, the suggestion's calls — as its maker when that is
 * an automated actor, else as "Graview, tidying" — with its lineage naming
 * it (`suggestion`) and who voted for it (`voters`, the first 200). The
 * store queues them in the vote's own gesture, having rehearsed that the
 * actor would be let.
 */
VOTING.accepting = (held, vote) => {
  const store = held as Store<AnySchema>;
  const at = store.tidying?.autoAcceptAt;
  if (at === undefined || vote.vote?.vote !== "for") return undefined;
  const id = vote.vote.suggestion;
  const suggestion = suggestions(store).find((one) => one.id === id);
  if (!suggestion) return undefined;
  const votes = votesIn(store.log.all()).get(id);
  const voters = [...(votes ?? [])].filter(([, each]) => each === "for").map(([who]) => who);
  if (voters.length < at) return undefined;
  const author = isAutomated(suggestion.author) ? suggestion.author : TIDYING_ACTOR;
  return { calls: suggestion.calls, author: author as Principal, lineage: { ...suggestion.lineage!, suggestion: id, voters: voters.slice(0, LINEAGE_VOTERS_LIMIT) } };
};
