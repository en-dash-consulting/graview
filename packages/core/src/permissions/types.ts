import type { Author } from "../ops/types.js";

/**
 * Who is acting, and what they are allowed to be.
 *
 * A principal IS an author with roles. Attribution and authorisation are the
 * same fact seen twice, not two systems: every op already records `{ kind,
 * id, session }`, so adding roles to that shape means the thing the log
 * blames is the thing the policy judged, by construction. There is no way to
 * act as one participant and be authorised as another.
 */
export interface Principal extends Author {
  readonly roles?: readonly string[];
}

/**
 * One permission: these roles may run these mutations, optionally only
 * against subjects of certain kinds.
 *
 * Deliberately small. A grant is a fact about the declaration — mutation
 * names and node kinds, both of which `graview check` can see — so "a
 * mutation no role can ever run" and "a role that may do nothing" are
 * build-time findings rather than things discovered by a person who cannot
 * press a button.
 */
export interface Grant {
  /** Roles this grant is for. `"*"` means everyone, including no roles at all. */
  readonly roles: readonly string[] | "*";
  readonly mutations: readonly string[] | "*";
  /** Restricts the grant to subjects of these kinds. Defaults to all of them. */
  readonly kinds?: readonly string[] | "*";
  /** Shown when an action is withheld, so a refusal can say something useful. */
  readonly describe?: string;
}

/**
 * A policy is deny-by-default, and its ABSENCE permits everything.
 *
 * The second half matters as much as the first: a store with no policy is not
 * a store where nothing works, it is a store where permission is not a
 * concern yet. An app opts in by declaring one.
 */
export interface Policy {
  readonly grants: readonly Grant[];
  /**
   * Roles the policy knows about, so `graview check` can report a role that
   * may do nothing. Derived from the grants when absent.
   */
  readonly roles?: readonly string[];
}

/** Why an action is not available, in terms someone can act on. */
export interface Refusal {
  readonly mutation: string;
  /** The subject kind that was refused, when the call names one. */
  readonly kind?: string;
  readonly message: string;
  /**
   * The roles that WOULD be allowed to do it. Empty means nobody can, which
   * is a different problem and says so.
   */
  readonly wouldNeed: readonly string[];
}

/**
 * Thrown when a principal runs a mutation they may not.
 *
 * An error rather than a silent no-op: enforcement lives at the store, and a
 * store that quietly did nothing would be indistinguishable from one that
 * worked. Every caller — a person's click, an agent's tool call, a sync
 * adapter's inbound change — hits the same wall in the same way.
 */
export class PermissionDeniedError extends Error {
  readonly refusal: Refusal;
  constructor(refusal: Refusal) {
    super(refusal.message);
    this.name = "PermissionDeniedError";
    this.refusal = refusal;
  }
}
