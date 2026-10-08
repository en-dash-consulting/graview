/**
 * WHY A CHANGE WAS REFUSED, AS A CODE A PROGRAM CAN BRANCH ON (FR-46).
 *
 * A refusal reached a client as a sentence and nothing else, so an MCP tool
 * and an interface told "you may not" from "it is gone" by matching words.
 * The set is closed and on the stability surface (docs/stability.md): a
 * code never changes meaning, and before 1.0 one may be added, the
 * changelog saying so (`unavailable`, FR-66; `refused`, FR-119).
 *
 *   forbidden  the seat may not: the policy, a sight, an agent's `may`, a module turned off
 *   missing    what the call names is not there: a record, or a batch to take back
 *   invalid    the call as sent does not fit: its arguments, an argument the act does not take, a call that changes nothing, the kind, an invariant, the order things happened in
 *   limit      the host's hard cap: the call can never succeed as asked, however long the caller waits
 *   unavailable  the host takes no changes for a while — a room read-only while it is checked, storage that failed to write — and does not know for how long
 *   refused    the act's own rule said no to a well-formed call: a document act's `allowedWhen`, a TypeScript mutation's `ActRefusal` (FR-119)
 *
 * `limit` and `unavailable` are the host's to say; nothing in the store
 * says them. Neither is `busy`: busy is "not now, after `retryAfter`", and
 * the client keeps the change and sends it again (FR-45). `unavailable` is
 * the one refusal that is not final: nothing was judged, and the client
 * keeps the change pending and sends it again, backing off as it does to
 * reconnect, until the host takes it. A refusal of any other reason is
 * final, and the change is taken back.
 */
export const REFUSAL_REASONS = ["forbidden", "missing", "invalid", "limit", "unavailable", "refused"] as const;

export type RefusalReason = (typeof REFUSAL_REASONS)[number];

/**
 * A REFUSAL AN ACT SAYS ITSELF, TYPED (FR-110).
 *
 * An act that cannot do what it was asked — a document's act whose
 * condition does not hold, a TypeScript mutation whose own logic says no,
 * a derived edit given nothing to change — throws one of these
 * (`@graview/core/document` exports the same class): its reason from the
 * closed set `refusalOf` speaks, and the sentence a person reads. A bare
 * `Error` from an act was a host's "went wrong on our side"; this is the
 * act saying no, and a host shows it.
 *
 * Its reason is `refused` unless it says another (FR-119): the act's own
 * rule said no to a call that was well formed. An act that refuses the
 * call as sent — nothing to change, a subject of the wrong kind — says
 * `invalid`, so a host tells "the rules say no" from "you sent the wrong
 * thing".
 *
 * Its own module, importing nothing, so a page that compiles a document
 * carries the class and not what `refusalOf` reads.
 */
export class ActRefusal extends Error {
  constructor(
    readonly sentence: string,
    readonly reason: RefusalReason = "refused",
  ) {
    super(sentence);
    this.name = "ActRefusal";
  }
}
