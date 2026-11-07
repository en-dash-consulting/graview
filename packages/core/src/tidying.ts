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
 *
 * And a person proposes (Roadmap f-proposals-for-review): a seat the
 * policy lets propose an act it may not run (a grant's `propose`) keeps
 * its calls as the same suggestion op, with itself as the author
 * (`propose`), which waits in the tray as "Proposed by Ada" until whoever
 * may run them accepts it — made as the reviewer, its lineage naming the
 * proposal and its proposer — or declines it, or the proposer withdraws it.
 */
import { GraphError } from "./graph/graph.js";
import type { MutationCall } from "./mutations/types.js";
import { advisoryVoterOf, signedOutSeat, VOTE_SUGGESTION, VOTING, type Vote } from "./mutations/vote-suggestion.js";
import { lineageOf, LINEAGE_VOTERS_LIMIT, type Lineage } from "./ops/lineage.js";
import { PROPOSE_CHANGES, type ProposeChangesArgs } from "./mutations/propose-changes.js";
import { permittedMutations, proposes, subjectKinds } from "./permissions/policy.js";
import type { Policy } from "./permissions/types.js";
import type { AnyMutationDefinition } from "./mutations/types.js";
import { expired, suggestionsIn, votesIn, type Dismissal, type Suggestion } from "./ops/suggestions.js";
import { DECLINES, isAutomated, isStopOp, isTidyingActor, type ActMeanings, type Decline, type KeptDecline, type KeptStop, type ServedStops } from "./ops/tidying.js";
import { declinedIn, declinesIn, isLiftOp, KIND_MARK, keptDeclines, meaningKey, stoppedIn, suggestionKind } from "./ops/declines.js";
import type { Author, Operation, Via } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";
import { seatOf } from "./seat-of.js";
import type { ApplyOptions, ApplyResult, Store } from "./store.js";
import { EMPTY_DIFF } from "./graph/diff.js";
import { ARCHIVED } from "./graph/archived.js";
import { nameInPassing } from "./capital.js";
import { namesUnseen, type SeatLens } from "./ops/withheld.js";
import { actingAs, permits as permitsOf } from "./permissions/policy.js";
import { seatLens } from "./seen.js";
import { fieldInPassing, nounOf, pluralOf } from "./schema/define-node.js";
import { humanizeField } from "./schema/humanize.js";
import { derivedActOf } from "./mutations/derived-names.js";
import { spellingOf } from "./mutations/act-spelling.js";

export { isTidyingActor, tidyingOf, tidyingRefusal } from "./ops/tidying.js";
export { declinedIn, declinesIn, keptDeclines, meaningKey, stoppedIn, suggestionKey, suggestionKind } from "./ops/declines.js";
export type { Decline, KeptDecline, KeptStop, ServedStops } from "./ops/tidying.js";
export type { ActMeanings } from "./ops/tidying.js";
export { isDismissed, suggestionsIn, takenIn, tallyOf, votesIn } from "./ops/suggestions.js";
export type { Dismissal, DismissalStore, Suggestion, SuggestionItem, SuggestionTally, WaitingOptions } from "./ops/suggestions.js";
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
  rehearsal(): Kept<S> & { suggesting: boolean; proposing: boolean };
  refuse(refusal: { readonly mutation: string; readonly message: string; readonly wouldNeed: readonly never[] }, by: string | undefined, told?: boolean): never;
  refuseStopped(calls: readonly MutationCall[], author: Author | Principal, asking: boolean): void;
  viaOf(mutation: unknown, call?: MutationCall, principal?: Principal): readonly string[] | undefined;
  mutations: ReadonlyMap<string, { readonly name: string; readonly derived?: { readonly act: string }; readonly writesLinked?: unknown; readonly subject?: { readonly arg: string; readonly kinds: string | readonly string[] } }>;
  policy?: Policy;
  moved(before: unknown, after: unknown): object;
  applying(calls: readonly MutationCall[], options: ApplyOptions): ApplyResult<S>;
  nextId(): string;
  mintBatch(kind: "batch" | "undo"): string;
  now(): string;
  refuseDeclined(calls: readonly MutationCall[], author: Author | Principal): void;
  actMeanings(): ActMeanings;
}
/*
 * WHAT PEOPLE DECLINED, TAUGHT TO THE STORE (`DECLINES`): loaded, this module
 * holds the app's own actor to every decline in the log and in the
 * checkpoint it begins at, and a checkpoint keeps them (`Epoch.declines`).
 */
DECLINES.declined = declinedIn;
DECLINES.kept = (ops, meanings, kept) => keptDeclines(declinesIn(ops, meanings, kept), ops, meanings);
DECLINES.stopped = stoppedIn;
/*
 * A STOP LIFTED BEHIND A CHECKPOINT undoes an op the log no longer holds, so the
 * log cannot vouch for it. What the checkpoint kept of it can: told to the seat
 * that lifted it, and to a seat it names nothing kept from.
 */
DECLINES.liftTold = (op, seeing) => {
  const lens = seeing as SeatLens;
  const log = lens.timeline?.log as { get?(id: string): Operation | undefined; horizonEpoch?(): { readonly declines?: Readonly<Record<string, KeptDecline>> } | undefined } | undefined;
  if (!log?.get || !isLiftOp(op, (id) => log.get!(id) !== undefined)) return false;
  if (lens.actor !== undefined && actingAs(op.author as Principal).id === lens.actor) return true;
  const stop = Object.values(log.horizonEpoch?.()?.declines ?? {}).find((one) => one.id === op.undoes)?.stop;
  return stop !== undefined && !callsNameKept(stop.calls, lens);
};

/**
 * WHETHER CALLS NAME WHAT IS KEPT FROM A SEAT, as `redact` would judge the op that
 * held them: any string at any depth that is a record it may not see, and any
 * field its sight keeps of the record they are about.
 */
function callsNameKept(calls: readonly MutationCall[], lens: SeatLens): boolean {
  return calls.some((call) => {
    const args = (call.args ?? {}) as Record<string, unknown>;
    if (namesUnseen(args, lens.sees)) return true;
    const id = args["id"];
    const kind = typeof id === "string" ? lens.kindOf(id) : undefined;
    const kept = kind && lens.kept?.({ id: id as string, kind });
    return kept ? Object.keys(args).some((key) => key !== "id" && kept(key)) : false;
  });
}

DECLINES.lift = (store, ids, options, author) => {
  const whole = store as Store<AnySchema>;
  const stop = keptStopOf(whole, ids);
  return stop && liftKept(whole, stop, options as ApplyOptions, author);
};
DECLINES.liftRefusal = (store, ids, author) => {
  const whole = store as Store<AnySchema>;
  const stop = keptStopOf(whole, ids);
  if (!stop) return undefined;
  const refusal = keptLiftRefusal(whole, stop, author as Principal);
  return refusal ? { refusal } : {};
};
/*
 * THE LIFTING OF A STOP BEHIND A CHECKPOINT has nothing left to put back: a
 * person stops the kind again, the next time it is suggested. And lifting a
 * stop, or putting one back, is whoever may decide what it was about: what it
 * took back changed nothing, so nothing else would ask.
 */
DECLINES.undoRefusal = (store, ops, author) => {
  const whole = store as Store<AnySchema>;
  for (const target of ops) {
    if (isLiftOp(target, (id) => whole.log.get(id) !== undefined)) return { mutation: "undo", wouldNeed: [], message: `"${target.intent}" cannot be taken back: it may be suggested again now, and can be stopped again then.` };
    let root = target;
    let stops = false;
    for (let at: Operation | undefined = target; at !== undefined; at = at.undoes === undefined ? undefined : whole.log.get(at.undoes)) {
      root = at;
      stops ||= isStopOp(at, at.undoes === undefined ? undefined : whole.log.get(at.undoes));
    }
    if (!stops) continue;
    // Its suggestion gone to the archive, what the checkpoint kept of the stop says what it was; with neither, nothing can vouch for this seat.
    const calls = root.suggests ?? Object.values(whole.log.horizonEpoch()?.declines ?? {}).find((one) => one.id === target.id || one.id === root.id)?.stop?.calls;
    const why = calls ? liftRefusal(whole, calls, author as Principal) : author.kind === "system" ? undefined : { mutation: "undo", wouldNeed: [] as never[], message: "Only somebody who may make these changes can let them be suggested again." };
    if (why) return why;
  }
  return undefined;
};

/** What is worked out once for each graph tick: a tray asks it of every row, again on every draw. */
const TICKS = new WeakMap<object, { readonly length: number; readonly held: Map<string, unknown> }>();
function onceATick<T>(whole: Store<AnySchema>, key: string, work: () => T): T {
  let tick = TICKS.get(whole);
  if (tick?.length !== whole.log.length) TICKS.set(whole, (tick = { length: whole.log.length, held: new Map() }));
  if (!tick.held.has(key)) tick.held.set(key, work());
  return tick.held.get(key) as T;
}

/** A seat, as what it may do and see is keyed by. */
const seatKey = (who: Principal): string => JSON.stringify([who.kind, who.id, who.roles, who.onBehalfOf?.id, who.onBehalfOf?.roles, who.shared]);

/** An id no record has, for asking what a grant says of any record of a kind. */
const NO_RECORD = "\u0000no-such-record";
/** What a derived act that takes a record out or folds it away is: riding the making of a kind, it reaches only what the seat made. */
const UNMAKES = new Set(["remove", "archive", "unarchive", "merge"]);

/**
 * WHETHER THIS SEAT'S GRANTS REACH ANY RECORD OF A KIND, read from the policy
 * rather than the records: the same `permits` the act asks, about a record that
 * is nobody's, on the kind, its far end nobody's either. A grant limited to a
 * seat's own record, its own end of a link or what it made says no; one over the
 * kind says yes, whichever kinds it is drawn on (the store, asked of an id it does
 * not hold, says no kind, which a grant drawn by kind refuses).
 */
function grantsReachAny(whole: Store<AnySchema>, call: MutationCall, kind: string | undefined, who: Principal): boolean {
  const store = keptOf(whole);
  const act = store.mutations.get(call.name);
  if (!act?.subject) return true;
  return permitsOf(store.policy, who, call.name, kind, store.viaOf(act, call, who), NO_RECORD, {}, () => [NO_RECORD], act.derived ? () => undefined : undefined, act.derived !== undefined && UNMAKES.has(act.derived.act)).ok;
}

/**
 * WHETHER THIS SEAT MAY DECIDE THESE CALLS' KINDS, on every record of them: a
 * stop speaks for a kind. Mostly the policy answers: a grant that does not reach
 * any record refuses at once, including a seat that happens to hold every record
 * there is today. What the policy cannot say, the records do, walked once a graph
 * tick for each kind and seat: where this seat's sight keeps records from it, and
 * an act that carries a value across a link, judged on each far record.
 */
function decidesKinds(whole: Store<AnySchema>, calls: readonly MutationCall[], author: Principal): boolean {
  const store = keptOf(whole);
  const meanings = store.actMeanings();
  const seat = seatKey(author);
  return calls.every((call) => {
    if (!whole.permits(call, author).ok) return false;
    return onceATick(whole, `decides|${seat}|${suggestionKind(call, meanings)}`, () => {
      const act = store.mutations.get(call.name) ?? store.mutations.get(spellingOf(call.name));
      const subject = act?.subject;
      if (!subject) return true;
      const kinds = subject.kinds === "*" ? [undefined] : [subject.kinds].flat();
      if (!kinds.every((kind) => grantsReachAny(whole, call, kind, author))) return false;
      const walk = act.writesLinked !== undefined || seatLens(whole as never, author).hides?.() !== false;
      if (!walk) return true;
      return kinds.every((kind) => (kind === undefined ? [] : whole.graph.nodesOfKind(kind as never, { archived: "all" })).every((node) => whole.permits({ ...call, args: { ...call.args, [subject.arg]: (node as { id: string }).id } }, author).ok));
    });
  });
}

/** Why this seat may not lift a stop of these calls, or nothing: whoever may make them may. */
function liftRefusal(whole: Store<AnySchema>, calls: readonly MutationCall[], author: Principal) {
  if (decidesKinds(whole, calls, author)) return undefined;
  return { mutation: "undo", wouldNeed: [] as never[], message: "Only somebody who may make these changes can let them be suggested again." };
}

/** Why this seat may not lift a stop only a checkpoint keeps, or nothing: as any stop, and it may not be one the seat is kept from. */
function keptLiftRefusal(whole: Store<AnySchema>, kept: KeptDecline & { readonly stop: KeptStop }, author: Principal) {
  const lens = seatLens(whole as never, author);
  if (lens.hides?.() !== false && callsNameKept(kept.stop.calls, lens)) return { mutation: "undo", wouldNeed: [] as never[], message: "Only somebody who may make these changes can let them be suggested again." };
  return liftRefusal(whole, kept.stop.calls, author);
}

/** The stop a checkpoint alone keeps, when these batches are that one stop's: its op has gone to the archive, so the log cannot be asked. */
function keptStopOf(whole: Store<AnySchema>, ids: readonly string[]): (KeptDecline & { readonly stop: KeptStop }) | undefined {
  if (ids.length !== 1) return undefined;
  const served = whole.stopsServed?.stops.find((one) => one.batch === ids[0]);
  // The host says this seat may lift it; the page's own log does not hold it. The host judges the undo.
  if (served && !whole.log.all().some((op) => op.batch === served.batch)) return { id: `served:${served.batch}`, at: "", author: { kind: "system" }, stop: { batch: served.batch, words: served.words, calls: [] } };
  const declines = whole.log.horizonEpoch()?.declines;
  if (!declines) return undefined;
  const lifted = new Set(whole.log.all().flatMap((op) => (op.undoes !== undefined ? [op.undoes] : [])));
  return Object.values(declines).find((one): one is KeptDecline & { readonly stop: KeptStop } => one.stop?.batch === ids[0] && !lifted.has(one.id) && whole.log.get(one.id) === undefined);
}

/**
 * A STOP LIFTED AFTER ITS OP WAS ARCHIVED: an op that changes nothing and
 * undoes the archived one (`lineage.liftedStop`), which `declinesIn` reads as
 * no longer standing, so a client's ordinary undo of the batch it was told does
 * it, and the next checkpoint leaves it out.
 */
function liftKept(whole: Store<AnySchema>, kept: KeptDecline & { readonly stop: KeptStop }, options: ApplyOptions, author: Author | Principal): ApplyResult<AnySchema> {
  const store = keptOf(whole);
  const refused = keptLiftRefusal(whole, kept, author as Principal);
  if (refused) store.refuse(refused, author.id, true);
  const before = whole.violations();
  const op: Operation = {
    id: store.nextId(),
    seq: whole.log.length,
    batch: options.batch ?? store.mintBatch("undo"),
    author,
    intent: `Undo: ${kept.stop.words}`,
    ...given("batchIntent", options.intent),
    mutation: null,
    primitives: [],
    reads: [],
    writes: [],
    at: store.now(),
    undoes: kept.id,
    ...given("via", options.via),
    lineage: { basis: "A person let this kind of thing be suggested again", liftedStop: true },
  };
  whole.log.append(op);
  if (whole.stopsServed) whole.stopsServed = { ...whole.stopsServed, stops: whole.stopsServed.stops.filter((one) => one.batch !== kept.stop.batch) };
  whole.notify(EMPTY_DIFF as never, [op]);
  return { batch: op.batch, ops: [op], diff: EMPTY_DIFF as never, primitives: [], reads: [], writes: [], intent: op.intent, ...store.moved(before, before), violationsAfter: before } as unknown as ApplyResult<AnySchema>;
}
DECLINES.stopRefusal = (store, targets, author) => {
  const whole = store as Store<AnySchema>;
  if (targets.length === 0 || targets.some((op) => !op.suggests)) return "Only a suggestion can be answered with not suggesting that kind of thing.";
  for (const op of targets) {
    const why = stopRefusal(whole, op.suggests!, op.author, op.lineage, author as Principal);
    if (why) return why;
  }
  return undefined;
};

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
  // What a person said not to suggest is said to the app's own tidying actor, not a workflow they set going or a chat agent (`isTidyingActor`).
  if (isTidyingActor(author)) kept.refuseStopped(calls, author, true);
  const rehearsal = kept.rehearsal();
  rehearsal.suggesting = true;
  const planned = rehearsal.applying(calls, { author, lineage, ...given("via", options.via) });
  if (planned.ops.length === 0) return undefined;
  const described = [...new Set(planned.ops.flatMap((op) => op.described ?? []))];
  // Each call's own sentence, when the calls are several and each made one op: what the tray lists and a person accepts one by one (Roadmap f-job-approvals).
  const own = planned.ops.filter((one) => one.mutation !== null && one.author === author);
  const said = calls.length > 1 && own.length === calls.length ? own.map((one) => one.intent) : undefined;
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
    ...given("suggestsSaid", said),
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
  const waiting = suggestionsIn(ops, (id) => whole.graph.has(id), { now: keptOf(whole).now(), dismissed: options.dismissed, voter: who });
  // Of a kind a person said not to suggest: gone from every tray, and back if that is undone. A person's proposal is a person's, and still waits.
  const stops = new Set(stoppedKindsOf(whole).keys());
  for (const kind of whole.stopsServed?.kinds ?? []) stops.add(kind);
  for (const one of servedStanding(whole as unknown as Store<AnySchema>)) for (const kind of one.kinds) stops.add(kind);
  if (stops.size === 0) return waiting;
  const meanings = keptOf(whole).actMeanings();
  return waiting.filter((one) => !isTidyingActor(one.author) || isProposal(one) || !one.calls.every((call) => stops.has(suggestionKind(call, meanings))));
}

/**
 * THE STOP THAT ANSWERS THESE CALLS, every one of them, or undefined (`stoppedIn`):
 * what the app's own tidying actor asks before it suggests (`dream`, `suggest`).
 * Not `declined`: a workflow or a chat agent asking that is told nothing of a stop.
 */
export function stoppedKind(store: Pick<Store<AnySchema>, "log">, calls: readonly MutationCall[]): Decline | undefined {
  const kept = store as unknown as Partial<Kept<AnySchema>>;
  return stoppedIn(store.log.all(), calls, typeof kept.actMeanings === "function" ? kept.actMeanings() : undefined, store.log.horizonEpoch()?.declines);
}

/** What the host said of stops, less any the log now holds as taken back: it said so before that landed. */
function servedStanding(whole: Store<AnySchema>): ServedStops["stops"] {
  const said = whole.stopsServed?.stops ?? [];
  if (said.length === 0) return said;
  const undone = whole.log.undoneIds();
  return said.filter((one) => !whole.log.all().some((op) => op.batch === one.batch && undone.has(op.id)));
}

/** The kinds of thing people said not to suggest that still stand, each with the decline that said so; looked for only where a log or its checkpoint holds any. */
function stoppedKindsOf<S extends AnySchema>(whole: Store<S>): ReadonlyMap<string, Decline> {
  const ops = whole.log.all();
  const kept = whole.log.horizonEpoch()?.declines;
  if (!ops.some((op) => op.lineage?.stopsKind === true) && !Object.keys(kept ?? {}).some((key) => key.startsWith(KIND_MARK))) return new Map();
  return new Map([...declinesIn(ops, keptOf(whole).actMeanings(), kept)].filter(([key]) => key.startsWith(KIND_MARK)));
}

/** A kind of thing a person said not to suggest, as `stoppedSuggestions` lists it. */
export interface StoppedSuggestions {
  /** The batch of the decline that said so: `store.undo` of it lets that kind be suggested again, even after a checkpoint archived it. */
  readonly batch: string;
  /** What was stopped, in the words it was stopped with. */
  readonly words: string;
}

/**
 * WHAT PEOPLE SAID NOT TO SUGGEST, and still stands (Roadmap
 * f-inbox-needs-you-first), each with the batch to take back, so a person who
 * changes their mind long after Activity has moved on has a way back. Read as
 * `principal` may, when one is named, or as the seat a seat's view is of: an
 * op withheld from them is not listed, and neither is a stop a checkpoint
 * keeps that names what they may not see. A page served by a host holds only
 * a tail of the log and no checkpoint: what the host says of the rest
 * (`Store.stopsServed`, `servedStops`) is listed with it.
 */
export function stoppedSuggestions<S extends AnySchema>(store: Store<S>, principal?: Principal): readonly StoppedSuggestions[] {
  const seat = seatOf(store);
  const whole = seat?.store ?? store;
  const who = principal ?? seat?.principal;
  const seen = who !== undefined ? whole.seenBy(who) : whole;
  const shown = new Map(seen.log.all().map((op) => [op.id, op]));
  const found = new Map<string, StoppedSuggestions>();
  for (const decline of stoppedKindsOf(whole).values()) {
    const { stop } = decline as KeptDecline;
    if (stop) {
      if (who === undefined || !callsNameKept(stop.calls, seatLens(whole as never, who))) found.set(stop.batch, { batch: stop.batch, words: stop.words });
      continue;
    }
    const op = shown.get(decline.id);
    if (op?.batch !== undefined && !op.withheld) found.set(op.batch, { batch: op.batch, words: op.batchIntent ?? op.intent });
  }
  for (const one of servedStanding(whole as unknown as Store<AnySchema>)) found.set(one.batch, { batch: one.batch, words: one.words });
  return [...found.values()];
}

/**
 * WHAT A HOST TELLS A SEAT OF THE STOPS STANDING (`stops` and `stoppedKinds` on
 * the wire's state and welcome): each it may lift and may be told of, and of the
 * rest, only the kinds of suggestions it is served, so its tray and its bell
 * agree with the store. Undefined where there is nothing to say.
 */
export function servedStops<S extends AnySchema>(store: Store<S>, principal: Principal): ServedStops | undefined {
  const whole = store as unknown as Store<AnySchema>;
  return onceATick(whole, `served|${seatKey(principal)}`, () => servedStopsNow(whole, principal));
}

function servedStopsNow(whole: Store<AnySchema>, principal: Principal): ServedStops | undefined {
  const standing = stoppedKindsOf(whole);
  if (standing.size === 0) return undefined;
  const told = new Map(stoppedSuggestions(whole, principal).filter((one) => whole.mayUndo(one.batch, principal).ok).map((one) => [one.batch, { ...one, kinds: [] as string[] }]));
  const seen = whole.seenBy(principal);
  const meanings = keptOf(whole).actMeanings();
  const held = new Set(suggestionsIn(seen.log.all(), () => true, { now: keptOf(whole).now() }).flatMap((one) => one.calls.map((call) => suggestionKind(call, meanings))));
  const kinds = new Set<string>();
  for (const [kind, decline] of standing) {
    const batch = (decline as KeptDecline).stop?.batch ?? (decline as Partial<Operation>).batch;
    const one = batch === undefined ? undefined : told.get(batch);
    if (one) one.kinds.push(kind);
    else if (held.has(kind)) kinds.add(kind);
  }
  return told.size > 0 || kinds.size > 0 ? { stops: [...told.values()], kinds: [...kinds] } : undefined;
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

/** What accepting a suggestion takes besides who accepts it: of a suggestion of several calls, only some (Roadmap f-job-approvals). */
export interface AcceptOptions extends ApplyOptions {
  /**
   * THE CALLS TO TAKE, by their place in the suggestion (`Suggestion.items`'
   * `at`): those are made, carrying the suggestion's lineage with these
   * places (`lineage.items`), and the rest still wait. Unsaid, every call
   * still waiting.
   */
  readonly items?: readonly number[];
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
export function acceptSuggestion<S extends AnySchema>(store: Store<S>, id: string, options: AcceptOptions = {}): SuggestionAnswer<S> {
  const whole = seatOf(store)?.store ?? store;
  const { items: asked, ...applying } = options;
  const author = applying.author ?? keptOf(whole).by;
  const waiting = waitingFor(whole, id, author);
  // Some of a suggestion of several (Roadmap f-job-approvals): each named place one still waiting, in the suggestion's order.
  const items = asked === undefined ? waiting.items : waiting.items.filter((item) => asked.includes(item.at));
  if (asked !== undefined && (asked.length === 0 || items.length !== new Set(asked).size)) throw new GraphError("Name the changes to accept by their place among those still waiting in the suggestion.");
  const suggestion = { ...waiting, calls: items.map((item) => item.call) };
  // From a seat the store would refuse the change, a vote for it (Roadmap f-suggestion-votes).
  if (!mayDecide(whole, suggestion, author as Principal)) return voteSuggestion(whole, id, "for", { ...applying, author });
  // The places it took, when it took less than the whole of what was suggested: the rest still wait.
  const suggested = whole.log.get(id)?.suggests?.length ?? items.length;
  const some = items.length < suggested ? { items: items.map((item) => item.at) } : {};
  return whole.applyAll(suggestion.calls, { ...applying, author, lineage: { ...waiting.lineage!, suggestion: id, ...some } });
}

/**
 * A SUGGESTION OF SEVERAL CHANGES SAID AS ONE (Roadmap f-job-approvals):
 * what its ops would do, counted by what and of which kind — "Next week:
 * 28 events to add, 3 to change, 1 to archive". A made record is one to
 * add, one set aside is one to archive, one taken out is one to remove,
 * and any other change is one to change. `title`, when said, leads.
 */
export function proposalWords(schema: AnySchema, graph: { getNode(id: string): unknown }, ops: readonly Pick<Operation, "primitives">[], title?: string): string {
  const counts = new Map<string, number>();
  for (const op of ops) {
    const made = op.primitives.find((one) => one.op === "add-node");
    const gone = op.primitives.find((one) => one.op === "remove-node");
    const patch = op.primitives.find((one) => one.op === "patch-node" || one.op === "splice-text") as { id: string; after?: Record<string, unknown> } | undefined;
    const verb = made ? "add" : gone ? "remove" : patch?.after?.[ARCHIVED] === true ? "archive" : "change";
    const id = made ? made.node.id : gone ? gone.node.id : (patch?.id ?? "");
    const kind = made ? made.node.kind : gone ? gone.node.kind : ((graph.getNode(id) as { kind?: string } | undefined)?.kind ?? "");
    const key = `${verb}\u0000${kind}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let last = "";
  const parts = ["add", "change", "archive", "remove"].flatMap((verb) =>
    [...counts].filter(([key]) => key.startsWith(`${verb}\u0000`)).map(([key, n]) => {
      const kind = key.slice(verb.length + 1);
      const noun = kind === "" || kind === last ? "" : ` ${n === 1 ? nounOf(schema.tryDefinition(kind) as never, kind) : pluralOf(schema, kind)}`;
      last = kind;
      return `${n === 1 ? "one" : n}${noun} to ${verb}`;
    }),
  );
  const said = parts.join(", ") || "nothing to change";
  return title ? `${title}: ${said}` : said.replace(/^./, (first) => first.toUpperCase());
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
  // A person's proposal is answered in words (Roadmap f-proposals-for-review): "Declined Ada's proposal: …".
  const answered = isProposal(suggestion) && options.intent === undefined ? { intent: `Declined ${possessive(proposerName(suggestion))} proposal: ${suggestion.intent}` } : {};
  return whole.undo(suggestion.batch, { ...options, ...answered, author });
}

/** What one call is, as a kind of thing, in words: no record's name, since a kind is about none. */
function kindSaid(store: Store<AnySchema>, call: MutationCall, meanings: ActMeanings): string {
  const act = meanings.act(call.name) as (ReturnType<ActMeanings["act"]> & { readonly title?: string; readonly name?: string }) | undefined;
  const relation = act?.derived?.relation ?? (act?.connects?.length === 1 ? act.connects[0] : undefined);
  if (relation !== undefined) return `\u201c${nameInPassing(humanizeField(relation))}\u201d links`;
  const derived = derivedActOf(spellingOf(act?.name ?? call.name));
  const definition = derived && (store.schema.tryDefinition(derived.kind) as Parameters<typeof fieldInPassing>[0] | undefined);
  if (derived && definition) {
    const plural = pluralOf(store.schema, derived.kind).toLowerCase();
    if (derived.act === "edit") {
      const fields = Object.keys(call.args ?? {}).filter((key) => key !== "id").map((field) => fieldInPassing(definition, field));
      return `changes to the ${fields.length > 0 ? fields.join(" and ") : "details"} of ${plural}`;
    }
    const doing: Partial<Record<typeof derived.act, string>> = { archive: `setting ${plural} aside`, unarchive: `bringing ${plural} back`, remove: `removing ${plural}`, merge: `merging ${plural}` };
    if (doing[derived.act]) return doing[derived.act]!;
  }
  return `\u201c${act?.title ?? humanizeField(spellingOf(call.name))}\u201d`;
}

/** What a suggestion's kinds are, in words: "changes to the note of tasks", "“in chapter” links". */
export function suggestionKindWords<S extends AnySchema>(store: Store<S>, suggestion: Pick<Suggestion, "calls">): string {
  const whole = (seatOf(store)?.store ?? store) as unknown as Store<AnySchema>;
  const meanings = keptOf(whole).actMeanings();
  return [...new Set(suggestion.calls.map((call) => kindSaid(whole, call, meanings)))].join(", ");
}

/**
 * WHY THIS SEAT MAY NOT STOP THESE CALLS' KINDS, or undefined when it may: a
 * stop is said to the app's own tidying actor, of its own suggestions, by
 * whoever may decide every suggestion of those kinds now waiting. A seat that
 * may edit its own record does not get to silence that kind on everyone's.
 */
function stopRefusal(whole: Store<AnySchema>, calls: readonly MutationCall[], suggestedBy: Author, lineage: Lineage | undefined, author: Principal): string | undefined {
  if (lineage?.proposedBy !== undefined) return "A person proposed this: decline it, and they may propose again.";
  if (!isTidyingActor(suggestedBy)) return "Only what the app's own actor suggests can be stopped this way: decline this one.";
  const meanings = keptOf(whole).actMeanings();
  const kinds = [...new Set(calls.map((call) => suggestionKind(call, meanings)))].sort();
  const refused = onceATick(whole, `stops|${seatKey(author)}|${kinds.join("|")}`, () => {
    const these = new Set(kinds);
    const waiting = onceATick(whole, "waiting", () => suggestions(whole)).filter((one) => isTidyingActor(one.author) && !isProposal(one) && one.calls.some((call) => these.has(suggestionKind(call, meanings))));
    return !(decidesKinds(whole, calls, author) && waiting.every((one) => mayDecide(whole, one, author)));
  });
  if (!refused) return undefined;
  return "Only somebody who may decide every suggestion of this kind can say not to suggest it.";
}

/** Whether this seat may say "Don't suggest this kind of thing" of this suggestion: what the store would answer (`stopRefusal`). */
export function mayStopSuggesting<S extends AnySchema>(store: Store<S>, suggestion: Pick<Suggestion, "calls" | "author" | "lineage">, principal?: Principal): boolean {
  const whole = (seatOf(store)?.store ?? store) as unknown as Store<AnySchema>;
  return stopRefusal(whole, suggestion.calls, suggestion.author, suggestion.lineage, (principal ?? keptOf(whole).by) as Principal) === undefined;
}

/**
 * "DON'T SUGGEST THIS KIND OF THING" (Roadmap f-inbox-needs-you-first): a
 * decline of this suggestion that answers its kind as well
 * (`suggestionKind`). Whatever else the app's own tidying actor has waiting of
 * that kind leaves every tray with it, and it is refused that kind from now on
 * (`stoppedKind`), kept in the log, and by a checkpoint, as every decline is.
 * A workflow and a chat agent are told nothing of it. Undone, all of it waits
 * again and the actor may suggest it. The store judges who may say so
 * (`mayStopSuggesting`), and says the kind in its words.
 */
export function stopSuggesting<S extends AnySchema>(store: Store<S>, id: string, options: ApplyOptions = {}): ApplyResult<S> {
  const whole = seatOf(store)?.store ?? store;
  const author = options.author ?? keptOf(whole).by;
  const suggestion = waitingFor(whole, id, author);
  const intent = options.intent ?? `Stopped suggesting ${suggestionKindWords(whole, suggestion)}`;
  return whole.undo(suggestion.batch, { ...options, author, intent, lineage: { basis: "A person said not to suggest this kind of thing", stopsKind: true } });
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
export function declined(store: Pick<Store<AnySchema>, "log">, calls: readonly MutationCall[]): Decline | undefined {
  const kept = store as unknown as Partial<Kept<AnySchema>>;
  return declinedIn(store.log.all(), calls, typeof kept.actMeanings === "function" ? kept.actMeanings() : undefined, store.log.horizonEpoch()?.declines);
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

/**
 * WHETHER A SUGGESTION IS A PERSON'S PROPOSAL (Roadmap
 * f-proposals-for-review): its lineage names who proposed it
 * (`proposedBy`), as `propose` keeps one — not the app's own actor's.
 */
export const isProposal = (suggestion: Pick<Suggestion, "lineage">): boolean => suggestion.lineage?.proposedBy !== undefined;

/** Who proposed a suggestion, as they are named: "Ada". */
const proposerName = (suggestion: Pick<Suggestion, "author">): string => suggestion.author.name ?? suggestion.author.id ?? "Somebody";

/** "Ada's", "Jess'". */
const possessive = (name: string): string => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

/**
 * PROPOSE CHANGES FOR REVIEW (Roadmap f-proposals-for-review): the calls
 * kept as one suggestion with `principal` as its author — the store's
 * "Propose changes" act, so it goes over the wire as any call does and is
 * made where the log is kept. Refused, in a sentence, where the seat may
 * neither run nor propose one of the acts (a grant's `propose`); each call
 * judged as the store judges it for whoever accepts it — the act's own
 * guard, the invariants, what the seat may see — on a rehearsal, and none
 * of it applied. The same change already waiting is answered with the
 * suggestion that waits; one that would change nothing is not proposed
 * (undefined). Whoever may run the calls accepts it (`acceptSuggestion`),
 * as themselves, its lineage naming the proposal and its proposer
 * (`suggestion`, `proposedBy`), or declines it, which answers it in
 * words; the proposer may withdraw it (`withdrawSuggestion`). Accepted, it
 * lands in the working state, and reaches readers on the next publish
 * where the app publishes.
 */
export function propose<S extends AnySchema>(store: Store<S>, principal: Principal, calls: readonly MutationCall[], intent?: string): Operation | undefined {
  const whole = seatOf(store)?.store ?? store;
  const meanings = keptOf(whole).actMeanings();
  const key = meaningKey(calls, meanings);
  const waiting = suggestions(whole, principal).find((one) => isProposal(one) && meaningKey(one.calls, meanings) === key);
  if (waiting) return whole.log.get(waiting.id);
  const args: ProposeChangesArgs = { calls: calls.map(({ name, args }) => ({ name, args })), ...given("intent", intent) };
  return whole.applyAll([{ name: PROPOSE_CHANGES, args: args as never }], { author: principal }).ops.find((op) => op.suggests !== undefined);
}

/** The acts a principal may propose and may not run: what lists `propose_changes` for an agent seat acting for them. */
export function proposedMutations<S extends AnySchema>(policy: Policy | undefined, principal: Principal, mutations: readonly AnyMutationDefinition<S>[]): readonly AnyMutationDefinition<S>[] {
  if (!policy || !policy.grants.some((grant) => grant.propose !== undefined)) return [];
  const runs = new Set(permittedMutations(policy, principal, mutations));
  return mutations.filter((mutation) => !runs.has(mutation) && subjectKinds(mutation).some((kind) => proposes(policy, principal, mutation.name, kind)));
}
