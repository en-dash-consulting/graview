import { MissingRecordError } from "./graph/graph.js";
import { UndoBlockedError } from "./ops/undo.js";
import { PermissionDeniedError } from "./permissions/types.js";
import { ActRefusal, type RefusalReason } from "./refused.js";

export { REFUSAL_REASONS } from "./refused.js";
export type { RefusalReason } from "./refused.js";

/** A refusal as the wire carries it: the code, the sentence a person reads, and who could. */
export interface WireRefusal {
  readonly reason: RefusalReason;
  readonly sentence: string;
  /** The roles that would be allowed, when the policy knows them. Absent when it names none. */
  readonly wouldNeed?: readonly string[];
}

/**
 * THE STORE'S OWN ERRORS, READ INTO A REASON. An `ActRefusal` says its
 * own (`refused` for an act's rule, FR-119). Anything else that is not one
 * of the store's refusals — a bare `Error` a mutation throws, an invariant,
 * an id that is taken — is `invalid`, in its own words: a bare throw may be
 * a rule or a slip, and only the act can say which, by throwing an
 * `ActRefusal`.
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
