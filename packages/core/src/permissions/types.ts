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
  /** The person an agent acts for: its roles bound the agent's, and a `self` grant reads their id. */
  readonly onBehalfOf?: Principal;
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
  /**
   * Only on the principal's OWN record: the call's subject must be the node
   * whose id is the principal's. This is how a person edits their profile
   * without a role that edits everyone's — the grant reads "you, on yours".
   */
  readonly self?: boolean;
}

/**
 * A policy is deny-by-default, and its ABSENCE permits everything.
 *
 * The second half matters as much as the first: a store with no policy is not
 * a store where nothing works, it is a store where permission is not a
 * concern yet. An app opts in by declaring one.
 */
/**
 * WHO MAY SEE WHAT. A grant says who may DO an act; a sight says who may
 * see the records of a kind at all. A kind no sight names is seen by
 * everyone — the opt-in a policy already is — and once one names it, a
 * record of it is seen only by the roles a sight lists, and, with `own`,
 * only when it is theirs: their own record, or one joined to it by an edge
 * (a shopper's test drive, their enquiry, their trade-in).
 */
export interface Sight {
  readonly roles: readonly string[] | "*";
  readonly kinds: readonly string[];
  /** Only the principal's own record, and what an edge joins to it. */
  readonly own?: boolean;
  readonly describe?: string;
}

export interface Policy {
  readonly grants: readonly Grant[];
  /**
   * Who may see the records of which kinds. Absent, everybody sees
   * everything — a storefront that declares none shows every customer's
   * name, email and finance question to whoever opens it.
   */
  readonly sees?: readonly Sight[];
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
