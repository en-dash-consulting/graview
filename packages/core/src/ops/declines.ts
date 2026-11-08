import { spellingOf } from "../mutations/act-spelling.js";
import { derivedActOf } from "../mutations/derived-names.js";
import type { MutationCall } from "../mutations/types.js";
import { undoneIn } from "./log.js";
import { isStopOp, type ActMeanings, type Decline, type KeptDecline, type KeptStop } from "./tidying.js";
import type { Operation } from "./types.js";

/*
 * WHAT A PERSON DECLINED, AND WHAT A CALL MEANS (`@graview/core/tidying`).
 * Off the page: the store asks it through `DECLINES`, which
 * `@graview/core/tidying` fills when it loads, before the app's own actor
 * changes or suggests anything, and when a checkpoint is made.
 */

/** A value written out with every object's keys in order: two spellings of one set of arguments are one key. */
const sortedKey = (value: unknown): string => JSON.stringify(value, (_, inner) => (inner && typeof inner === "object" && !Array.isArray(inner) ? Object.fromEntries(Object.entries(inner).sort()) : inner));

/** WHO A SUGGESTION IS, whoever made it and on whatever basis: its calls, in order, each its act and arguments, keys in order. */
export const suggestionKey = (calls: readonly MutationCall[]): string => sortedKey(calls.map((call) => [call.name, call.args]));

/** The acts said of one record alone: set aside, brought back, removed, left alone, let be tidied. */
const ON_ONE = /^(archive|unarchive|remove|leave-alone|allow-tidying)$/;

/** What one call means, as what a key is written from. */
function meaningOf(call: MutationCall, meanings: ActMeanings | undefined): unknown {
  const name = spellingOf(call.name);
  const act = meanings?.act(call.name);
  const args = (call.args ?? {}) as Record<string, unknown>;
  // The act's own word on what it is; a bare name is read as one only when nothing knows the act.
  const derived: { readonly act: string; readonly relation?: string } | undefined = act ? act.derived : derivedActOf(name);
  const { id } = args;
  if (derived && typeof id === "string") {
    if (ON_ONE.test(derived.act)) return [derived.act, id];
    // A pair merged, whichever of the two went into the other.
    if (derived.act === "merge") return ["merge", ...[id, args["into"]].sort()];
    if (derived.relation) return [derived.act, derived.relation, id, args["to"]];
  }
  // A declared act that makes one relation between its subject and one other record is that link, as its relation's own act would make it.
  const subject = act?.subject?.arg ?? "id";
  const [other, more] = Object.keys(args).filter((key) => key !== subject);
  if (act?.connects?.length === 1 && other && !more && meanings!.has(args[subject] as string) && meanings!.has(args[other] as string)) return ["connect", act.connects[0], args[subject], args[other]];
  // Anything else is its act and arguments, less the id of a record it would make: minted afresh each time it is asked.
  return [name, act?.creates?.length && typeof id === "string" && !meanings!.has(id) ? { ...args, id: 0 } : args];
}

/**
 * WHAT A SUGGESTION MEANS, however its calls were spelled: a link between
 * two records by its relation, whichever act asks for it; a merge of a
 * pair, whichever way round; a record archived, removed or left alone; and
 * anything else its act, in any spelling of it, and its arguments, less the
 * minted id of a record it would make. Worked out from the calls whenever
 * it is asked, so a decline already in a log matches by it too.
 */
export const meaningKey = (calls: readonly MutationCall[], meanings?: ActMeanings): string => `≈${sortedKey(calls.map((call) => meaningOf(call, meanings)))}`;

/**
 * THE KIND OF THING A CALL IS, whatever record it is about: a link by its
 * relation, whichever act asks for it; an edit by its act and the fields it
 * writes, so stopping a change to a task's note does not stop every change to
 * a task; and anything else its act, in any spelling. What "Don't suggest
 * this kind of thing" stops (`stopSuggesting`).
 */
export function suggestionKind(call: MutationCall, meanings?: ActMeanings): string {
  const act = meanings?.act(call.name);
  const relation = act?.derived?.relation ?? (act?.connects?.length === 1 ? act.connects[0] : undefined);
  if (relation !== undefined) return `${KIND_MARK}${sortedKey([act?.derived?.act ?? "connect", relation])}`;
  const name = spellingOf(call.name);
  const derived = act?.derived ?? derivedActOf(name);
  const subject = act?.subject?.arg ?? "id";
  const fields = derived?.act === "edit" ? Object.keys(call.args ?? {}).filter((key) => key !== subject).sort() : undefined;
  return `${KIND_MARK}${sortedKey(fields ? [name, fields] : [name])}`;
}

/** What a kind's key begins with, among a log's declines. */
export const KIND_MARK = "\u2200";

/** What a link means, as the act that makes it would mean (`meaningKey`): a person breaking it declines it. */
const linkKey = (edge: { readonly kind: string; readonly from: string; readonly to: string }): string => `≈${sortedKey([["connect", edge.kind, edge.from, edge.to]])}`;

/**
 * THE DECLINE THAT ANSWERS THESE CALLS — the whole suggestion, or any one of
 * them on its own, asked exactly as it was or meaning the same
 * (`meaningKey`) — or undefined. What a person declined (`declinesIn`) the
 * app's own actor does not make or suggest again. `kept` is what the
 * checkpoint the log begins at kept (`Epoch.declines`).
 */
export function declinedIn(ops: readonly Operation[], calls: readonly MutationCall[], meanings?: ActMeanings, kept?: Readonly<Record<string, KeptDecline>>): Decline | undefined {
  const declines = declinesIn(ops, meanings, kept);
  return [calls, ...calls.map((call) => [call])].map((asked) => declines.get(meaningKey(asked, meanings))).find(Boolean);
}

/** A lift: an undo that changed nothing, of an op the log no longer holds (`isStopOp` says why it is asked). */
export function isLiftOp(op: Pick<Operation, "lineage" | "undoes" | "mutation" | "primitives">, holds: (id: string) => boolean): boolean {
  return op.lineage?.liftedStop === true && op.undoes !== undefined && op.mutation === null && op.primitives.length === 0 && !holds(op.undoes);
}

/**
 * THE STOP THAT ANSWERS THESE CALLS: every one of them of a kind a person
 * said not to suggest (`Lineage.stopsKind`), or undefined. Apart from
 * `declinedIn` on purpose. A decline holds every automated author to one
 * change a person said no to; a stop is said to the app's own tidying actor
 * alone, so a declared workflow and a chat agent go on as they were
 * (`isTidyingActor`). A call of several not stopped leaves the whole
 * standing: a person is still asked about it.
 */
export function stoppedIn(ops: readonly Operation[], calls: readonly MutationCall[], meanings?: ActMeanings, kept?: Readonly<Record<string, KeptDecline>>): Decline | undefined {
  if (calls.length === 0) return undefined;
  const declines = declinesIn(ops, meanings, kept);
  const found = calls.map((call) => declines.get(suggestionKind(call, meanings)));
  return found.every(Boolean) ? found[0] : undefined;
}

/**
 * EVERY DECLINE IN A LOG, keyed by what the whole suggestion means and what
 * each of its calls alone means (`meaningKey`): "do not make this again".
 * A decline is
 *  - a live undo of a suggestion, by anyone but who made it;
 *  - a live undo of a change made with a lineage (an actor's confident
 *    change), by anyone;
 *  - a person's live undo of any other change, whoever made it;
 *  - a person breaking a link (a disconnect, or any change of theirs that
 *    removes one), which declines the link — lifted when a person makes
 *    it again;
 *  - a suggestion declined as a kind (`Lineage.stopsKind`), which declines
 *    the kind of each of its calls too (`suggestionKind`).
 * `kept` is what a checkpoint kept of the declines behind it
 * (`Epoch.declines`), read first; one whose op is undone in the log no
 * longer stands.
 */
export function declinesIn(ops: readonly Operation[], meanings?: ActMeanings, kept?: Readonly<Record<string, KeptDecline>>): ReadonlyMap<string, Decline> {
  const undone = undoneIn(ops);
  const byId = new Map(ops.map((op) => [op.id, op]));
  const declines = new Map<string, Decline>();
  // A stop lifted after its op was archived: the op that lifted it names the archived one, which the log no longer holds to mark undone.
  const heldIds = new Set(ops.map((op) => op.id));
  const lifted = new Set(ops.filter((op) => isLiftOp(op, (id) => heldIds.has(id)) && !undone.has(op.id)).map((op) => op.undoes));
  for (const [key, one] of Object.entries(kept ?? {})) if (!undone.has(one.id) && !lifted.has(one.id)) declines.set(key, one);
  // The calls of a suggestion a person accepted one by one before declining the rest: those were said yes to (Roadmap f-job-approvals).
  const took = new Map<string, number[]>();
  for (const op of ops) if (op.lineage?.suggestion !== undefined && op.lineage.items) took.set(op.lineage.suggestion, [...(took.get(op.lineage.suggestion) ?? []), ...op.lineage.items]);
  for (const op of ops) {
    const live = !undone.has(op.id) && !op.withheld;
    const person = op.author.kind === "human";
    const target = op.undoes !== undefined && live ? byId.get(op.undoes) : undefined;
    // A suggestion its own maker took back was withdrawn, not declined: nobody said no to it (`withdrawSuggestion`).
    if (target?.suggests && target.author.kind === op.author.kind && target.author.id === op.author.id) continue;
    const taken = target?.mutation && target.undoes === undefined && (target.lineage || op.undoneLineage || person);
    const calls = target?.suggests ? target.suggests.filter((_, at) => !took.get(target.id)?.includes(at)) : taken ? [target.mutation!] : [];
    if (calls.length > 0) for (const asked of [calls, ...calls.map((call) => [call])]) declines.set(meaningKey(asked, meanings), op);
    if (target?.suggests && live && isStopOp(op, target)) for (const call of calls) declines.set(suggestionKind(call, meanings), op);
    // A link a person broke is declined; one a person made again is not.
    if (!live || !person || op.undoes !== undefined) continue;
    for (const primitive of op.primitives) {
      if (primitive.op === "remove-edge") declines.set(linkKey(primitive.edge), op);
      else if (primitive.op === "add-edge") declines.delete(linkKey(primitive.edge));
    }
  }
  return declines;
}

/**
 * What a checkpoint keeps of a log's declines (`Epoch.declines`): each as who
 * said it and when, so the archive can take the op. A stop keeps its batch,
 * its words and one call of each kind besides (`KeptStop`), or nobody could
 * find it or take it back once its op has gone.
 */
export function keptDeclines(declines: ReadonlyMap<string, Decline>, ops: readonly Operation[] = [], meanings?: ActMeanings): Record<string, KeptDecline> {
  const byId = new Map(ops.map((op) => [op.id, op]));
  const stopOf = (one: Decline): KeptStop | undefined => {
    const carried = (one as KeptDecline).stop;
    if (carried) return carried;
    const op = one as Partial<Operation>;
    if (op.batch === undefined || one.undoes === undefined || !isStopOp(op as Operation, byId.get(one.undoes))) return undefined;
    const calls = new Map((byId.get(one.undoes)?.suggests ?? []).map((call) => [suggestionKind(call, meanings), call]));
    return { batch: op.batch, words: op.batchIntent ?? op.intent ?? "", calls: [...calls.values()] };
  };
  return Object.fromEntries(
    [...declines].map(([key, one]) => {
      const stop = stopOf(one);
      return [key, { id: one.id, at: one.at, author: one.author, ...(one.undoes !== undefined && { undoes: one.undoes }), ...(stop && { stop }) }];
    }),
  );
}
