import { MissingRecordError } from "./graph/graph.js";
import { UndoBlockedError } from "./ops/undo.js";
import { PermissionDeniedError } from "./permissions/types.js";
import { ActRefusal } from "./refused.js";

/**
 * WHY A CHANGE WAS REFUSED, AS A CODE A PROGRAM CAN BRANCH ON (FR-46).
 *
 * A refusal reached a client as a sentence and nothing else, so an MCP tool
 * and an interface told "you may not" from "it is gone" by matching words.
 * The set is closed and on the stability surface (docs/stability.md): a
 * code never changes meaning, and a new one is a new protocol.
 *
 *   forbidden  the seat may not: the policy, a sight, an agent's `may`, a module turned off
 *   missing    what the call names is not there: a record, or a batch to take back
 *   invalid    the call as asked does not fit: its arguments, the kind, a rule, the order things happened in
 *   limit      the host's hard cap: the call can never succeed as asked, however long the caller waits
 *   unavailable  the host takes no changes for a while — a room read-only while it is checked, storage that failed to write — and does not know for how long
 *
 * `limit` and `unavailable` are the host's to say; nothing in the store
 * says them. Neither is `busy`: busy is "not now, after `retryAfter`", and
 * the client keeps the change and sends it again (FR-45). `unavailable` is
 * the one refusal that is not final: nothing was judged, and the client
 * keeps the change pending and sends it again, backing off as it does to
 * reconnect, until the host takes it. A refusal of any other reason is
 * final, and the change is taken back.
 */
export const REFUSAL_REASONS = ["forbidden", "missing", "invalid", "limit", "unavailable"] as const;

export type RefusalReason = (typeof REFUSAL_REASONS)[number];

/** A refusal as the wire carries it: the code, the sentence a person reads, and who could. */
export interface WireRefusal {
  readonly reason: RefusalReason;
  readonly sentence: string;
  /** The roles that would be allowed, when the policy knows them. Absent when it names none. */
  readonly wouldNeed?: readonly string[];
}

/**
 * THE STORE'S OWN ERRORS, READ INTO A REASON. Anything that is not one of
 * the store's refusals — a mutation's own throw, an invariant, an id that
 * is taken — is `invalid`, in its own words.
 */
export function refusalOf(error: unknown): WireRefusal {
  const sentence = error instanceof Error ? error.message : String(error);
  if (error instanceof PermissionDeniedError) {
    const roles = error.refusal.wouldNeed;
    return { reason: "forbidden", sentence, ...(roles.length > 0 ? { wouldNeed: [...roles] } : {}) };
  }
  if (error instanceof MissingRecordError) return { reason: "missing", sentence };
  // An act's own refusal says its reason (FR-110).
  if (error instanceof ActRefusal) return { reason: error.reason, sentence: error.sentence };
  if (error instanceof UndoBlockedError) return { reason: error.check.reason ?? "invalid", sentence };
  return { reason: "invalid", sentence };
}
