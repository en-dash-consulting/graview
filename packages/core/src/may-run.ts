import type { Principal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";
import type { Store } from "./store.js";
import type { AnyMutationDefinition, MutationCall } from "./mutations/types.js";
import { refusalOf } from "./refusal.js";
import type { RefusalReason } from "./refused.js";
import { ruleByRunning } from "./mutations/would-run.js";
import { wouldRefuse } from "./graph/would-refuse.js";

/*
 * MAY THIS SEAT RUN THIS ACT ON THIS RECORD? — answered without running it.
 *
 * A host that offers a seat only the acts it could run (a chat's route
 * tool, a menu built on a server) asked by rehearsing each act in a copy
 * of the store, which costs a copy per act and so was capped at a few. The
 * store already judges every call in steps it can be asked one at a time:
 * the policy, with the rule that a derived remove, archive, bring-back or
 * merge riding the grant to make a kind reaches only the records the seat
 * made (`Store.permits`); what the seat may see (`Store.missingFor`); and
 * the act's own rule — a document act's `allowedWhen`, a code act's
 * `ActRefusal` — with the act compiled and nothing written
 * (`Store.wouldLand`). `mayRun` asks those, in the order `apply` does, and
 * makes no copy of anything: the answer is the store's own, so it cannot
 * say otherwise than applying would.
 *
 * Handed part of a call — a record and no title yet — it says which
 * arguments are still to fill, by name, after judging all it can without
 * them: the policy, the seat's sight, and the act's rule on the record
 * where the rule reads none of what is missing (`ruleOn`).
 */

/** The rule that refused an act: who may (`policy`), the records a seat made (`own-records`), what the seat may see (`sight`), the act's own condition (`condition`), or what it was handed (`arguments`, an `act` no store has). */
export type MayRunRule = "policy" | "own-records" | "sight" | "condition" | "arguments" | "act";

export type MayRunAnswer =
  /** The act would run as asked. */
  | { readonly answer: "allowed" }
  /** The act may run once these arguments are given, by name, in the order its form asks them. */
  | { readonly answer: "fill"; readonly toFill: readonly string[] }
  /** It would be refused: by which rule, the reason a program branches on, the words a person reads, and the roles that could where the policy knows them. */
  | { readonly answer: "refused"; readonly rule: MayRunRule; readonly reason: RefusalReason; readonly message: string; readonly wouldNeed?: readonly string[] };

export interface MayRunAsk {
  /** The act's name, as the store spells it or as a caller does (`connect-threat-partOf`). */
  readonly act: string;
  /** The record the act is on: its subject argument. Absent for an act that makes one, or when the args name it. */
  readonly record?: string;
  /** The arguments known so far; a required one not given is named in `toFill`. */
  readonly args?: Readonly<Record<string, unknown>>;
}

const refused = (rule: MayRunRule, reason: RefusalReason, message: string, wouldNeed?: readonly string[]): MayRunAnswer => ({ answer: "refused", rule, reason, message, ...(wouldNeed && wouldNeed.length > 0 ? { wouldNeed } : {}) });

/** The arguments an act cannot run without that the call does not give: required, with no default, not given. */
function stillToFill(mutation: AnyMutationDefinition<AnySchema>, args: Readonly<Record<string, unknown>>): string[] {
  const shape = (mutation.input as { shape?: Record<string, { safeParse?(value: unknown): { success: boolean } }> }).shape ?? {};
  return Object.entries(shape)
    .filter(([name, schema]) => args[name] === undefined && schema.safeParse?.(undefined).success === false)
    .map(([name]) => name);
}

/**
 * WHETHER `seat` MAY RUN `act` ON `record` (with `args` as far as they are
 * known), in the store's own judgment and without running it: allowed;
 * allowed once the arguments named are given; or refused, saying by which
 * rule and in the words that refused it. The store holds the declaration —
 * its acts, policy and sight — so it is the only thing to hand.
 */
export function mayRun<S extends AnySchema>(store: Store<S>, seat: Principal, ask: MayRunAsk): MayRunAnswer {
  let mutation: AnyMutationDefinition<S>;
  try {
    mutation = store.mutation(ask.act);
  } catch (error) {
    return refused("act", "invalid", error instanceof Error ? error.message : String(error));
  }
  const subject = mutation.subject?.arg;
  const args: Record<string, unknown> = { ...(ask.record !== undefined && subject !== undefined ? { [subject]: ask.record } : {}), ...ask.args };
  const call: MutationCall = { name: mutation.name, args };

  // Who may: the policy, an agent's `may`, a module turned off, and what a derived act reaches only on the seat's own records.
  const verdict = store.permits(call, seat);
  if (!verdict.ok) return refused(verdict.refusal.onlyWhatYouMade ? "own-records" : "policy", "forbidden", verdict.refusal.message, verdict.refusal.wouldNeed);

  // What the seat may see: a record it may not is no record, as `apply` says of one.
  const missing = store.missingFor(call, seat);
  if (missing) return refused("sight", "missing", missing.message);

  const toFill = stillToFill(mutation as AnyMutationDefinition<AnySchema>, args);
  if (toFill.length === 0) {
    // The act compiled as `apply` compiles it, nothing written: its arguments, and its own rule on the record.
    const done = store.wouldLand([call], seat, wouldRefuse)[0];
    if (done === undefined || done === "changes" || done === "nothing") return { answer: "allowed" };
    const said = refusalOf(done.refused);
    return refused(said.reason === "refused" || said.reason === "missing" ? "condition" : "arguments", said.reason, said.sentence, said.wouldNeed);
  }

  // Part of a call: the act's rule on its record, where it can be judged without what is missing.
  const on = subject !== undefined ? args[subject] : undefined;
  if (typeof on === "string") {
    const seen = store.seenBy(seat).graph;
    const rule = mutation.ruleOn ? mutation.ruleOn(seen as never, on, args) : ruleByRunning(mutation, store.schema, seen, args, store.personOf(seat));
    if (rule !== undefined && rule !== true) return refused(rule.reason === "invalid" ? "arguments" : "condition", rule.reason, rule.refused);
  }
  return { answer: "fill", toFill };
}

/** `mayRun` of several acts for one seat — a route tool's whole list in one call. */
export function mayRunEach<S extends AnySchema>(store: Store<S>, seat: Principal, asks: readonly MayRunAsk[]): MayRunAnswer[] {
  return asks.map((ask) => mayRun(store, seat, ask));
}
