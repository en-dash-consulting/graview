import type { Author } from "../ops/types.js";

/**
 * Who is acting, and what they are allowed to be.
 *
 * A principal IS an author with roles. Attribution and authorization are the
 * same fact seen twice, not two systems: every op already records `{ kind,
 * id, session }`, so adding roles to that shape means the thing the log
 * blames is the thing the policy judged, by construction. There is no way to
 * act as one participant and be authorized as another.
 */
export interface Principal extends Author {
  readonly roles?: readonly string[];
  /** The person an agent acts for: its roles bound the agent's, and a `self` grant reads their id. */
  readonly onBehalfOf?: Principal;
  /**
   * A SEAT NO ONE PERSON HOLDS (Roadmap f-votes-shared-seat): the host
   * serves every signed-out visitor as this one principal (Cloud's
   * `anonymous`), or this reader is signed out. It reads what its roles let
   * it read, and its vote on a suggestion is nobody's, so the store refuses
   * one ("Sign in to vote on this suggestion") unless the host made such
   * votes advisory (`StoreOptions.votes`) and said which visitor this is
   * (`visitorKey`).
   */
  readonly shared?: true;
  /**
   * THE ONE VISITOR BEHIND A SHARED SEAT, in the host's own key (a cookie's
   * id, say): what an advisory vote is kept under, so one stranger's vote
   * is theirs to change and no other's. Read only for a seat that is
   * `shared` or a `visitor`.
   */
  readonly visitorKey?: string;
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
  /**
   * Only on the principal's OWN END of the link the act makes or breaks:
   * every record the call names at the far end of what it connects or
   * severs must be the principal's own (Roadmap f-own-end-grants). How a
   * voter takes back their own vote and nobody else's — the act is on the
   * idea, so `self` cannot say it. `graview check` refuses it on an act
   * that connects and severs nothing (`grant-own-end-without-link`).
   */
  readonly ownEnd?: boolean;
  /**
   * WHAT THESE ROLES MAY PROPOSE (Roadmap f-proposals-for-review): acts, by
   * name or `"*"`, that a seat holding the grant may not run but may ask
   * for — its call kept as a suggestion with the person as its author
   * (`propose`, `@graview/core/tidying`), made when somebody who may run it
   * accepts it. On the grant's `kinds`, as `mutations` are; `self` and
   * `ownEnd` hold what it runs, not what it proposes. A grant that only
   * proposes says `mutations: []`.
   */
  readonly propose?: readonly string[] | "*";
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
 * see the records of a kind at all. Like grants, sights are deny by
 * default once there are any (FR-02): a kind no sight names is seen by
 * nobody but the system, so a kind added tomorrow is kept from everybody
 * until somebody says who sees it, rather than shown to everybody. A kind
 * a sight names is seen by the roles it lists (`"*"`: everybody), and with
 * `own` only when it is theirs: their own record, one joined to it by an
 * edge (a shopper's test drive, their enquiry), or one they made.
 */
export interface Sight {
  readonly roles: readonly string[] | "*";
  readonly kinds: readonly string[];
  /** Only the principal's own records: their own record, what an edge joins to it, and what they made. */
  readonly own?: boolean;
  /**
   * Only the records this relation joins to the principal's own record (of
   * the people kind), at either end: `{ kinds: ["match"], via: "givenBy" }`
   * shows each giver their own match and not the one they receive in, which
   * `own` would (it reads every edge). `graview check` holds the relation
   * to one that reaches the people kind (`sight-via-misses-people`).
   */
  readonly via?: string;
  /**
   * ONLY THESE FIELDS of the records it shows (Roadmap f-field-sight): an
   * allow list, so a field added tomorrow is kept from these roles until a
   * sight shows it. Absent, every field.
   */
  readonly fields?: readonly string[];
  /**
   * EVERY FIELD BUT THESE of the records it shows: `{ roles: ["parent"],
   * kinds: ["player"], hide: ["phone"] }` shows parents each player
   * without a phone number. With `fields`, the fields it lists but these.
   *
   * SIGHTS ADD UP. A role is shown a field of a record when ANY sight that
   * shows it that record shows that field: a second sight `{ roles:
   * ["parent"], kinds: ["player"], own: true }` gives each parent their own
   * child's phone back, and a person with two roles sees what either
   * shows. A hidden field is not in anything the seat is served — the
   * record, the log, a search, a form, a label — and the seat cannot set
   * it: it reads as a field the record does not have. The id and the kind
   * are never hidden.
   */
  readonly hide?: readonly string[];
  readonly describe?: string;
}

export interface Policy {
  readonly grants: readonly Grant[];
  /**
   * Who may see the records of which kinds. Absent, everybody sees
   * everything — a storefront that declares none shows every customer's
   * name, email and finance question to whoever opens it. Present, every
   * kind is kept from everybody but the system until a sight names it.
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
