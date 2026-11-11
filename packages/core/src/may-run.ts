import type { Principal } from "./permissions/types.js";
import type { AnySchema, NodeOfSchema } from "./schema/schema.js";
import type { Store } from "./store.js";
import type { AnyMutationDefinition, MutationCall } from "./mutations/types.js";
import { InvalidArguments } from "./mutations/invalid-arguments.js";
import { refusalOf } from "./refusal.js";
import { ActRefusal, type RefusalReason } from "./refused.js";
import { MissingRecordError } from "./graph/graph.js";
import { wouldRefuse } from "./graph/would-refuse.js";
import { FIELD_SIGHT } from "./permissions/sight.js";
import { isAutomated, tidyingRefusal } from "./ops/tidying.js";

/*
 * MAY THIS SEAT RUN THIS ACT ON THIS RECORD? — answered without running it.
 *
 * A host that offers a seat only the acts it could run (a chat's route
 * tool, a menu built on a server) asked by rehearsing each act in a copy
 * of the store, which costs a copy per act and so was capped at a few.
 * Handed a whole call, `mayRun` asks the store what `apply` would say of it
 * (`Store.wouldApply`): the same steps `apply` takes, in its order, and
 * what the act would make judged by the graph's own checks of a write
 * (`wouldRefuse`) — so it cannot say otherwise than applying would, for
 * every seat, the app's own actor included. Nothing is written and no
 * store is copied, but for a seat whose profile's person is not made yet:
 * it is judged, as `apply` judges it, as that person, on the one copy the
 * store keeps for it while it stands.
 *
 * Handed part of a call — a record and no words yet — it says which
 * arguments are still to fill, by name, after judging all it can without
 * them: who may, what the seat may see, the arguments given as the act's
 * input reads them, and a document act's condition (`allowedWhen`) where it
 * reads none of what is missing. Any other rule is the act's to say once it
 * is handed everything.
 */

/** The rule that refused an act: who may (`policy`), the records a seat made (`own-records`), what the seat may see (`sight`), the act's own condition (`condition`), what it was handed (`arguments`), or the act itself (`act`: none by that name, or one that went wrong). */
export type MayRunRule = "policy" | "own-records" | "sight" | "condition" | "arguments" | "act";

export type MayRunAnswer =
  /** The act would run as asked. */
  | { readonly answer: "allowed" }
  /** The act may run once these arguments are given, by name; whether it then does is the act's to say. */
  | { readonly answer: "fill"; readonly toFill: readonly string[] }
  /** It would be refused: by which rule, the reason a program branches on, the words a person reads, and the roles that could where the policy knows them. */
  | { readonly answer: "refused"; readonly rule: MayRunRule; readonly reason: RefusalReason; readonly message: string; readonly wouldNeed?: readonly string[] };

export interface MayRunAsk {
  /** The act's name, as the store spells it or as a caller does (`connect-threat-partOf`). */
  readonly act: string;
  /** The record the act is on: its subject argument. Absent for an act that makes one, or when the args name it; refused when the args name another. */
  readonly record?: string;
  /** The arguments known so far; a required one not given is named in `toFill`. */
  readonly args?: Readonly<Record<string, unknown>>;
}

const refused = (rule: MayRunRule, reason: RefusalReason, message: string, wouldNeed?: readonly string[]): MayRunAnswer => ({ answer: "refused", rule, reason, message, ...(wouldNeed && wouldNeed.length > 0 ? { wouldNeed } : {}) });

type FieldSchema = { safeParse(value: unknown): { success: boolean; data?: unknown; error?: { issues?: readonly { message?: string }[] } } };

/** The arguments given, read as the act's input reads each — its defaults filled — and those it cannot run without that are not given yet. */
function readGiven(mutation: AnyMutationDefinition<AnySchema>, given: Readonly<Record<string, unknown>>): { readonly args: Record<string, unknown>; readonly toFill: string[]; readonly wrong?: string } {
  const shape = (mutation.input as { shape?: Record<string, FieldSchema> }).shape ?? {};
  const args: Record<string, unknown> = { ...given };
  const toFill: string[] = [];
  for (const [name, schema] of Object.entries(shape)) {
    const read = schema.safeParse(given[name]);
    if (read.success) {
      if (read.data !== undefined) args[name] = read.data;
    } else if (given[name] === undefined) toFill.push(name);
    else return { args, toFill, wrong: `${name}: ${read.error?.issues?.[0]?.message ?? "not what this act takes"}` };
  }
  return { args, toFill };
}

/** The names an expression reads where an argument could stand: a bare name, and `$arg.<name>`. */
function namesRead(expr: unknown, names: Set<string> = new Set()): Set<string> {
  if (!expr || typeof expr !== "object") return names;
  const node = expr as { readonly t?: string; readonly name?: string; readonly object?: { readonly t?: string; readonly name?: string } };
  if (node.t === "ident" && node.name) names.add(node.name);
  if (node.t === "member" && node.object?.t === "ident" && node.object.name === "$arg" && node.name) names.add(node.name);
  for (const value of Object.values(node)) if (value && typeof value === "object") namesRead(value, names);
  return names;
}

/** A refusal `apply` would throw, said by the rule that made it. */
function saidBy(error: unknown): MayRunAnswer {
  const said = refusalOf(error);
  if (said.reason === "forbidden") return refused((error as { refusal?: { onlyWhatYouMade?: true } }).refusal?.onlyWhatYouMade ? "own-records" : "policy", "forbidden", said.sentence, said.wouldNeed);
  if (error instanceof ActRefusal) return refused(error.reason === "invalid" ? "arguments" : "condition", error.reason, said.sentence);
  if (error instanceof InvalidArguments) return refused("arguments", said.reason, said.sentence);
  if (error instanceof MissingRecordError) return refused("condition", said.reason, said.sentence);
  return refused("act", said.reason, said.sentence, said.wouldNeed);
}

/**
 * WHETHER `seat` MAY RUN `act` ON `record` (with `args` as far as they are
 * known), in the store's own judgment and without running it: allowed;
 * allowed once the arguments named are given; or refused, saying by which
 * rule and in the words that refused it. The store holds the declaration —
 * its acts, policy and sight — so it is the only thing to hand.
 */
export function mayRun<S extends AnySchema>(store: Store<S>, seat: Principal, ask: MayRunAsk): MayRunAnswer {
  // The store as `apply` would judge this seat on: with its profile's person made, where it is not yet.
  const judged = store.judgedAs(seat);
  let mutation: AnyMutationDefinition<S>;
  try {
    mutation = judged.mutation(ask.act);
  } catch (error) {
    return refused("act", "invalid", error instanceof Error ? error.message : String(error));
  }
  const subject = mutation.subject?.arg;
  const named = subject === undefined ? undefined : ask.args?.[subject];
  if (ask.record !== undefined && named !== undefined && named !== ask.record) return refused("arguments", "invalid", `“${mutation.title ?? mutation.name}” was handed two records to act on, ${ask.record} and ${String(named)}: name one.`);
  const given: Record<string, unknown> = { ...(ask.record !== undefined && subject !== undefined ? { [subject]: ask.record } : {}), ...ask.args };
  const read = readGiven(mutation as AnyMutationDefinition<AnySchema>, given);

  // A whole call: what `apply` would say of it.
  if (read.toFill.length === 0 && read.wrong === undefined) {
    const refusal = store.wouldApply({ name: mutation.name, args: given }, seat, wouldRefuse);
    if (refusal === undefined) return { answer: "allowed" };
    // A record the call names that this seat is not served is the seat's sight, as `apply` asks it (`missingFor`); one the act's writes find gone is the record's state.
    if (refusal instanceof MissingRecordError && judged.missingFor({ name: mutation.name, args: given }, seat)) return refused("sight", "missing", refusal.message);
    return saidBy(refusal);
  }

  // Part of a call: who may, what the seat may see, what it was given, and a condition that reads none of what is missing.
  const call: MutationCall = { name: mutation.name, args: given };
  const verdict = judged.permits(call, seat);
  if (!verdict.ok) return refused(verdict.refusal.onlyWhatYouMade ? "own-records" : "policy", "forbidden", verdict.refusal.message, verdict.refusal.wouldNeed);
  const missing = judged.missingFor(call, seat);
  if (missing) return refused("sight", "missing", missing.message);
  if (read.wrong !== undefined) return refused("arguments", "invalid", read.wrong);
  const on = subject !== undefined ? given[subject] : undefined;
  const record = typeof on === "string" ? (judged.seenBy(seat).graph.getNode(on) as NodeOfSchema<S> | undefined) : undefined;
  const kinds = mutation.subject?.kinds;
  if (record && kinds !== undefined && kinds !== "*" && !(kinds as readonly string[]).includes(record.kind)) return refused("arguments", "invalid", `"${mutation.title ?? mutation.name}" acts on ${kinds.join(" or ")}, not on ${record.kind}`);
  // An act that writes only fields the seat's sight keeps on this record is refused whatever it is handed: `apply` refuses each such write.
  const kept = record ? FIELD_SIGHT.keptFrom?.(judged as never, seat)?.(record) : undefined;
  const writes = mutation.writes ?? [];
  const makes = mutation as { readonly creates?: readonly unknown[]; readonly connects?: readonly unknown[]; readonly severs?: readonly unknown[] };
  if (kept && writes.length > 0 && writes.every((field) => kept(field)) && !makes.creates?.length && !makes.connects?.length && !makes.severs?.length) {
    return refused("arguments", "invalid", `"${mutation.title ?? mutation.name}" writes ${writes.map((field) => `"${field}"`).join(", ")}, which this seat is not shown on this record`);
  }
  // The app's own actor changes no record a person said to leave alone, nor a kind the app never tidies: what `apply` holds it to, of the record the act changes.
  if (record && isAutomated(seat as never) && (writes.length > 0 || makes.connects?.length || makes.severs?.length)) {
    const no = tidyingRefusal(judged.schema, judged.graph as never, [{ op: "patch-node", id: record.id, after: {} } as never], seat.name ?? seat.id ?? "The app's own actor");
    if (no) return refused("policy", "forbidden", no);
  }
  const condition = mutation.condition;
  if (record && condition) {
    const reads = namesRead(condition.expr);
    if (record && !read.toFill.some((name) => reads.has(name))) {
      try {
        const no = condition.refusedBy(judged.seenBy(seat).graph as never, record, read.args);
        if (no !== undefined) return refused("condition", "refused", no);
      } catch (error) {
        return saidBy(error);
      }
    }
  }
  return { answer: "fill", toFill: read.toFill };
}

/** `mayRun` of several acts for one seat — a route tool's whole list in one call. */
export function mayRunEach<S extends AnySchema>(store: Store<S>, seat: Principal, asks: readonly MayRunAsk[]): MayRunAnswer[] {
  return asks.map((ask) => mayRun(store, seat, ask));
}
