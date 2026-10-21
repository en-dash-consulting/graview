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
 */
import { GraphError } from "./graph/graph.js";
import type { MutationCall } from "./mutations/types.js";
import { lineageOf, type Lineage } from "./ops/lineage.js";
import { suggestionsIn, type Suggestion } from "./ops/suggestions.js";
import { declinedIn, suggestionKey } from "./ops/tidying.js";
import type { Author, Operation, Via } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";
import { seatOf } from "./seat-of.js";
import type { ApplyOptions, ApplyResult, Store } from "./store.js";
import { EMPTY_DIFF } from "./graph/diff.js";

export { declinedIn, declinesIn, suggestionKey, tidyingOf, tidyingRefusal } from "./ops/tidying.js";
export { suggestionsIn } from "./ops/suggestions.js";
export type { Suggestion } from "./ops/suggestions.js";
export { digestWords, foldDigests, isSuggestionBatch } from "./ops/digest.js";
export type { ActivityRow } from "./ops/digest.js";
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
  const key = suggestionKey(calls);
  const waiting = suggestions(whole).find((one) => suggestionKey(one.calls) === key);
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
  };
  whole.log.append(op);
  whole.notify(EMPTY_DIFF as never, [op]);
  return op;
}

/**
 * THE SUGGESTIONS WAITING, oldest first — as `principal` may see them,
 * when one is named, or as the seat a seat's view (`seenBy`) is of: a
 * suggestion that names a record the seat may not see is not among them
 * (it is withheld, as any op that names one is).
 */
export function suggestions<S extends AnySchema>(store: Store<S>, principal?: Principal): readonly Suggestion[] {
  const seat = seatOf(store);
  const whole = seat?.store ?? store;
  const who = principal ?? seat?.principal;
  // A seat that sees everything is handed the store itself.
  const ops = (who !== undefined ? whole.seenBy(who) : whole).log.all();
  return suggestionsIn(ops, (id) => whole.graph.has(id));
}

/** A suggestion still waiting that this author may see, or a sentence saying it is not. */
function waitingFor<S extends AnySchema>(store: Store<S>, id: string, author: Author | Principal): Suggestion {
  const found = suggestions(store, author as Principal).find((one) => one.id === id);
  if (!found) throw new GraphError("That suggestion is no longer waiting: it was accepted or declined, or it is not one you can see.");
  return found;
}

/**
 * ACCEPT A SUGGESTION: its calls applied as one gesture, as the person
 * (`options.author`, or the store's principal) — judged as any change of
 * theirs is — carrying the suggestion's lineage, which names it
 * (`lineage.suggestion`), so it waits no longer.
 */
export function acceptSuggestion<S extends AnySchema>(store: Store<S>, id: string, options: ApplyOptions = {}): ApplyResult<S> {
  const whole = seatOf(store)?.store ?? store;
  const author = options.author ?? keptOf(whole).by;
  const suggestion = waitingFor(whole, id, author);
  return whole.applyAll(suggestion.calls, { ...options, author, lineage: { ...suggestion.lineage!, suggestion: id } });
}

/**
 * DECLINE A SUGGESTION: an undo of it, which changes nothing and carries
 * its lineage (`undoneLineage`), so `declined(store, calls)` says so and
 * the same suggestion — or the same change, made on its own — is refused
 * to the app's own actor from now on. Undone, it waits again.
 */
export function declineSuggestion<S extends AnySchema>(store: Store<S>, id: string, options: ApplyOptions = {}): ApplyResult<S> {
  const whole = seatOf(store)?.store ?? store;
  const author = options.author ?? keptOf(whole).by;
  const suggestion = waitingFor(whole, id, author);
  return whole.undo(suggestion.batch, { ...options, author });
}

/** The op that declined these calls — the whole suggestion, or any one of them on its own — or undefined: what an actor asks before it suggests. */
export function declined(store: Pick<Store<AnySchema>, "log">, calls: readonly MutationCall[]): Operation | undefined {
  return declinedIn(store.log.all(), calls);
}
