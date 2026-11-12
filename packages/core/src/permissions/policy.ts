import type { AnyMutationDefinition } from "../mutations/types.js";
import type { AnySchema } from "../schema/schema.js";
import { humanizeField, withArticle } from "../schema/define-node.js";
import { listed } from "../capital.js";
import type { Author, Operation, SeatProfile } from "../ops/types.js";
import type { Grant, Policy, Principal, Refusal } from "./types.js";

const matches = (allowed: readonly string[] | "*", value: string): boolean =>
  allowed === "*" || allowed.includes(value);

/**
 * THE SEAT A POLICY JUDGES, delegation read through (FR-06). An agent acting
 * for a person may do what BOTH may: its roles are the intersection of its
 * own and theirs (an agent that declared none takes the person's), and a
 * `self` grant — "you, on yours" — is about the person, not the agent. A
 * principal acting for nobody is judged as itself.
 */
export function actingAs(principal: Principal): Principal {
  const person = principal.onBehalfOf;
  if (!person) return principal;
  const theirs = person.roles ?? [];
  const roles = principal.roles === undefined ? theirs : principal.roles.filter((role) => theirs.includes(role));
  return { ...principal, ...(person.id !== undefined ? { id: person.id } : {}), roles };
}

const PROFILE_ID = /^[\w-]{1,64}$/;
const MOST_PROFILE_NAME = 200;

/**
 * THE PROFILE A PRINCIPAL ACTS AS, delegation read through: a person's, the
 * one an agent acts for, its id checked and its name trimmed and held to 200
 * characters. A shared seat, a visitor, an agent acting for nobody, a seat with
 * no id or one holding a `~` have none, and a bad id or an empty name is none.
 */
export function profileOf(principal: Author): SeatProfile | undefined {
  const person = principal.onBehalfOf ?? principal;
  const profile = person.profile;
  if (!profile || person.kind !== "human" || person.id === undefined || person.id.includes("~") || (person as Principal).shared) return undefined;
  if (typeof profile.id !== "string" || !PROFILE_ID.test(profile.id) || typeof profile.name !== "string") return undefined;
  const name = profile.name.trim().slice(0, MOST_PROFILE_NAME);
  // A name somebody could read: spaces, zero-width and control characters alone say nothing.
  return /[^\s\p{Z}\p{Cf}\p{Cc}]/u.test(name) ? { id: profile.id, name } : undefined;
}

/**
 * A SEAT WITH ITS PROFILE AS IT IS READ: what `profileOf` says of it and
 * nothing else a host or a header hung on it, and none where it is none.
 * What is kept on an op. The seat itself when there is nothing to change.
 */
export function withValidProfile<A extends Author>(seat: A): A {
  const person = seat.onBehalfOf && withValidProfile(seat.onBehalfOf);
  if (!seat.profile && person === seat.onBehalfOf) return seat;
  const { profile: _given, ...rest } = seat;
  const own = person ? undefined : profileOf(seat);
  return { ...rest, ...(person ? { onBehalfOf: person } : {}), ...(own ? { profile: own } : {}) } as unknown as A;
}

/**
 * THE RECORD A PROFILE IS, ON ITS ACCOUNT. Its id is the account's and the
 * profile's together, so a profile is linked to the account's own by what it
 * is called, and no host's say of a profile — nor a client's it believed —
 * reaches a member's record or another account's profile. An id with a `~` is
 * this and nothing else: a profile's id cannot hold one, a record cannot be
 * asked for under one (`compileMutation`), and an account whose id holds one
 * is nobody's person (`meOf`).
 */
export const profilePersonId = (account: string, profile: Pick<SeatProfile, "id">): string => `${account}~${profile.id}`;

/**
 * WHO `$me` IS: the id of the principal's own record of the people kind.
 * The person's, for an agent acting for one (Roadmap f-act-as-me); the
 * profile's person, where the seat carries a profile; nobody, for a seat whose
 * own id reads as a profile's person.
 */
export function meOf(principal: Author): string | undefined {
  return boundPersonOf(principal) ?? seatPersonOf(principal);
}

/**
 * THE PERSON A SEAT IS BEFORE ANY BINDING: its account's id, or its
 * profile's person (`profilePersonId`). What a binding is kept under
 * (`PERSON_SEAT`, `bind-person`): the seat, not the record.
 */
export function seatPersonOf(principal: Author): string | undefined {
  const account = actingAs(principal as Principal).id;
  if (account === undefined || account.includes("~")) return undefined;
  const profile = profileOf(principal);
  return profile ? profilePersonId(account, profile) : account;
}

/**
 * WHERE A STORE SAYS WHICH RECORD A SEAT WAS BOUND TO: on the principal it
 * judges, under a key no JSON can carry, so a host's header, a client's
 * call or an op read back from the log never says it. Only `seatedIn` sets
 * it, from the graph, each time a store is asked; whatever a caller hung
 * there is read again and replaced.
 */
const BOUND_PERSON: unique symbol = Symbol.for("@graview/core:bound-person") as never;

/** The record a store bound this seat to, as `seatedIn` read it. */
export const boundPersonOf = (principal: Author): string | undefined => {
  const bound = (principal as { readonly [BOUND_PERSON]?: unknown })[BOUND_PERSON];
  return typeof bound === "string" ? bound : undefined;
};

/** What a graph says of bindings: the record of the people kind a seat was bound to (`Graph.personBoundTo`). */
export interface PersonBindings {
  personBoundTo?(seat: string): string | undefined;
}

/**
 * Whether a seat can be bound to a record at all: a person who signed in,
 * or an agent acting for one — never a seat no one person holds (`shared`),
 * a visitor, or an agent or the system acting for nobody.
 */
export function bindable(principal: Author): boolean {
  const person = (principal.onBehalfOf ?? principal) as Principal;
  return person.kind === "human" && person.shared !== true && (principal as Principal).shared !== true && seatPersonOf(principal) !== undefined;
}

/**
 * THE SEAT AS A STORE JUDGES IT NOW: its bound person read from the graph
 * (Roadmap f-invite-binds-existing-person) — the record an organizer
 * entered before the person joined, which `$me`, `own`, `self` and an act
 * done as them then are — and none where the graph binds it to none,
 * whatever the principal was handed with. Read each time it is asked, so
 * a binding taken back is taken back from every answer that follows. The
 * principal itself where nothing changes.
 */
export function seatedIn<P extends Author>(graph: PersonBindings | undefined, principal: P): P {
  if (typeof principal !== "object" || principal === null) return principal;
  const seat = bindable(principal) ? seatPersonOf(principal) : undefined;
  const bound = seat === undefined ? undefined : graph?.personBoundTo?.(seat);
  const had = (principal as { readonly [BOUND_PERSON]?: unknown })[BOUND_PERSON];
  if (bound === had) return principal;
  const { [BOUND_PERSON]: _given, ...rest } = principal as P & { readonly [BOUND_PERSON]?: unknown };
  return (bound === undefined ? rest : { ...rest, [BOUND_PERSON]: bound }) as P;
}

/**
 * WHO AN ACT IS DONE AS, IN THIS APP: `meOf`, where a kind is the people. Where
 * none is there is no person to be: an act's `ctx.me` is the account's, with a
 * profile or without, since a profile never changes what its account may do.
 */
export function meIn(schema: { readonly definitions: readonly unknown[] }, principal: Author): string | undefined {
  return schema.definitions.some((definition) => (definition as { readonly people?: boolean }).people) ? meOf(principal) : actingAs(principal as Principal).id;
}

/**
 * WHETHER AN ID IS THE PRINCIPAL'S OWN, as `self`, `ownEnd`, `own` and `via`
 * read it: the account's, always, so a profile narrows nothing; the
 * person of the profile it carries, which is the account's own and no other's;
 * and the record the store bound the seat to (`seatedIn`).
 */
export function ownsId(principal: Principal, id: string | undefined): boolean {
  if (id === undefined) return false;
  const account = actingAs(principal).id;
  if (account === undefined || account.includes("~")) return false;
  return id === account || id === boundPersonOf(principal) || (id.includes("~") && id === meOf(principal));
}

/**
 * THE OP THAT MADE A PROFILE'S PERSON, on first use, in the batch that used
 * it: no act, the author's own record. It stays when that batch is taken
 * back — later acts stand on the record — so it is no part of what an undo
 * reads, and a batch with only it left counts as undone.
 */
export const madeOwnPerson = (op: Pick<Operation, "author" | "mutation" | "primitives">): boolean => {
  if (op.mutation !== null || op.primitives.length !== 1 || !profileOf(op.author)) return false;
  const [made] = op.primitives;
  return made!.op === "add-node" && made!.node.id === meOf(op.author);
};

/**
 * THE HOST'S OWN WORK HAS A SEAT (FR-17). A template's setup, a seed, a
 * migration applied by the system is not a person a policy was written
 * about, and `roles: ["*"]` matched no grant — so a host gave its system
 * every role the policy named. `system` is a kind, not a role: it passes.
 */
export const isSystem = (principal: Principal): boolean => principal.kind === "system" && principal.onBehalfOf === undefined;

/** Whether a grant (or a sight) covers a principal at all, before looking at the call. */
export const grantsTo = (grant: Pick<Grant, "roles">, principal: Principal): boolean =>
  grant.roles === "*" || (principal.roles ?? []).some((role) => grant.roles.includes(role));

/**
 * WHAT A REFUSAL CALLS THINGS. The policy knows acts and roles by their
 * names; a person reads "Not permitted: close-deal on a deal — sales-manager
 * can" struck through beside every button they may not press. The store
 * hands its titles and nouns ("“Close the deal” on a deal — a sales manager
 * can"); a role is always said in words.
 */
export interface PolicyWords {
  readonly act?: (mutation: string) => string | undefined;
  readonly noun?: (kind: string) => string;
}

/** "a sales manager", "a sales manager or a salesperson". */
/** Roles said as a person reads them: "an owner or a planner". */
export function rolesSaid(roles: readonly string[]): string {
  return listed(roles.map((role) => withArticle(humanizeField(role).toLowerCase())), "or");
}

/**
 * Whether a principal may run a mutation, and if not, who could.
 *
 * `kind` is the subject's kind when the call names one. A grant restricted by
 * kind and a call whose subject cannot be resolved is refused rather than
 * allowed: the safe reading of "I could not tell what this acts on" is no.
 */
export function permits(
  policy: Policy | undefined,
  principal: Principal,
  mutation: string,
  kind?: string,
  /**
   * Declared mutations any ONE of which being permitted permits this one.
   * How a derived edit act is judged: whoever may already change or make a
   * kind may change what was set when it was made — the policy's own grants,
   * read again, rather than a second list.
   */
  via?: readonly string[],
  /**
   * The id of the node the call acts on, when it names one. A `self` grant
   * is only ever satisfied when this is the principal's own id.
   */
  subjectId?: string,
  /** How the refusal names an act and a kind: the store hands its titles and nouns. */
  words: PolicyWords = {},
  /** The records the call names at the far end of the links it makes or breaks: an `ownEnd` grant holds them to the principal's own. */
  ends?: () => readonly unknown[],
  /**
   * Who made the record a derived act is about. Riding only a grant to
   * every role, the act reaches what this principal made (W-201).
   */
  madeBy?: () => string | undefined,
  /**
   * Whether the derived act takes a record out or folds it away — remove,
   * archive, bring back or merge — rather than changing what it says. Riding
   * the acts that make the kind, such an act reaches only what this principal
   * made, whoever's grant it rides (W-201).
   */
  unmakes?: boolean,
): { readonly ok: true } | { readonly ok: false; readonly refusal: Refusal } {
  // No policy means permission is not a concern in this installation.
  if (!policy) return { ok: true };
  if (isSystem(principal)) return { ok: true };
  principal = actingAs(principal);

  /*
   * A derived act is permitted when the policy names it (or says `*`) —
   * the grants are read first, as for any act — and otherwise when any of
   * the declared acts it rides is permitted for this principal on this kind.
   */
  if (via !== undefined) {
    if (permits(policy, principal, mutation, kind, undefined, subjectId).ok) return { ok: true };
    let ridden = false;
    if (via.some((name) => permits(policy, principal, name, kind, undefined, subjectId).ok)) {
      /*
       * A DOOR FOR EVERYBODY IS NOT A KEY TO EVERY RECORD (the ninth walk,
       * W-201). "Anybody may join" let a novice remove her mentor from the
       * co-op, and anybody at all archive or merge any member they could see:
       * the grant that lets everybody make a record is not a grant over every
       * record of its kind. Riding only a grant to every role, a derived
       * edit reaches the records this principal made; a role's own grant on
       * the acts it rides, or one that names the act or says `*`, reaches
       * the rest.
       *
       * AND A ROLE'S DOOR IS NOT A KEY EITHER, to take a record out. A
       * member who may log an inspection could remove, archive or merge
       * anybody's: the grant to make a kind is a grant to make one, not to
       * unmake the rest. Riding the acts that make the kind — whoever's
       * grant — a derived remove, archive, bring-back or merge reaches only
       * what this principal made; over the rest the policy names the act,
       * or says `*` (decided by Nick, 2026-10-14).
       */
      if (!madeBy || subjectId === undefined || (principal.id !== undefined && madeBy() === principal.id) || (!unmakes && policy.grants.some((grant) => grant.roles !== "*" && grantsTo(grant, principal) && via.some((name) => matches(grant.mutations, name))))) return { ok: true };
      ridden = true;
    }
    /*
     * A derived edit is reachable two ways, and the refusal has to count
     * both: a grant naming it (or saying `*`), and a grant on any declared
     * act it rides. Counting only the second said "no declared act writes or
     * creates it, so no role can" to a rider while the driver's `mutations:
     * "*"` grant plainly reached it.
     */
    const names = ridden ? [mutation] : [mutation, ...via];
    const wouldNeed = [
      ...new Set(names.flatMap((name) => rolesWhoCould(policy, name, kind))),
    ].sort();
    const who =
      (ridden ? "only on what you made; " : "") +
      (wouldNeed.length === 0
        ? via.length === 0
          ? "no declared act creates or changes it, so no role can"
          : "no role can"
        : `${rolesSaid(wouldNeed)} can`);
    return {
      ok: false,
      refusal: {
        mutation,
        ...(kind === undefined ? {} : { kind }),
        wouldNeed,
        message: said(policy, names, kind, who, words),
        ...(ridden ? { onlyWhatYouMade: true as const } : {}),
      },
    };
  }

  let theirs = false;
  for (const grant of policy.grants) {
    if (!grantsTo(grant, principal)) continue;
    if (!matches(grant.mutations, mutation)) continue;
    if (grant.kinds !== undefined && grant.kinds !== "*") {
      if (kind === undefined || !grant.kinds.includes(kind)) continue;
    }
    // "You, on yours": a self grant needs the subject to be the principal.
    if (grant.self && !ownsId(principal, subjectId)) continue;
    // And an own-end grant every record at the far end of the link (Roadmap f-own-end-grants).
    if (grant.ownEnd) {
      const far = ends?.() ?? [];
      if (!far.length || far.some((id) => !ownsId(principal, id as string))) {
        theirs = true;
        continue;
      }
    }
    return { ok: true };
  }

  const wouldNeed = rolesWhoCould(policy, mutation, kind);
  const who = theirs ? "only on your own end of the link" : wouldNeed.length === 0 ? "no role can" : `${rolesSaid(wouldNeed)} can`;
  return {
    ok: false,
    refusal: {
      mutation,
      ...(kind === undefined ? {} : { kind }),
      wouldNeed,
      message: said(policy, [mutation], kind, who, words),
    },
  };
}

/**
 * The refusal in words: what it was, who could, and why the policy says so.
 *
 * `names` is every act that would have reached this one, because a derived
 * edit rides the acts that write its fields — and the sentence has to come
 * from the same grants the roles did, or the two halves contradict.
 */
function said(
  policy: Policy,
  names: readonly string[],
  kind: string | undefined,
  who: string,
  words: PolicyWords,
): string {
  const because = [...new Set(names.flatMap((name) => whyNot(policy, name, kind)))];
  const act = words.act?.(names[0]!);
  return (
    `Not permitted: ${act ? `“${act}”` : names[0]}${kind ? ` on ${withArticle(words.noun?.(kind) ?? kind)}` : ""} — ${who}.` +
    (because.length > 0 ? ` ${because.join(" ")}` : "")
  );
}

/**
 * WHY, IN THE POLICY'S OWN WORDS.
 *
 * A grant carries a `describe` — documented from the day it was added as
 * "shown when an action is withheld, so a refusal can say something useful"
 * — and nothing read it. Every refusal in every surface was assembled from a
 * mutation id and a list of role names, which is what the declaration says,
 * not what the organization means. The sentences of the grants that WOULD
 * allow this are the ones worth repeating.
 */
export function whyNot(policy: Policy, mutation: string, kind?: string): readonly string[] {
  return [...new Set(grantsOf(policy, mutation, kind).flatMap((grant) => grant.describe || []))];
}

/** The grants that name this mutation, and this kind where they name kinds at all. */
const grantsOf = (policy: Policy, mutation: string, kind?: string): readonly Grant[] =>
  policy.grants.filter((grant) => matches(grant.mutations, mutation) && (kind === undefined || matches(grant.kinds ?? "*", kind)));

/**
 * Every role that could run this mutation, so a refusal can name what would
 * be needed instead of merely saying no.
 */
export function rolesWhoCould(
  policy: Policy,
  mutation: string,
  kind?: string,
): readonly string[] {
  const grants = grantsOf(policy, mutation, kind);
  // Everyone already may, where any of them is for everyone; naming roles would be misleading.
  return grants.some((grant) => grant.roles === "*") ? [] : [...new Set(grants.flatMap((grant) => grant.roles))].sort();
}

/** Every role the policy mentions, declared or implied by its grants. */
export function rolesOf(policy: Policy): readonly string[] {
  if (policy.roles) return policy.roles;
  const roles = new Set<string>();
  for (const grant of policy.grants) {
    if (grant.roles === "*") continue;
    for (const role of grant.roles) roles.add(role);
  }
  return [...roles].sort();
}

/**
 * The mutations a principal may run at all, ignoring any particular subject.
 *
 * This is what narrows an agent seat's generated tool schema: a seat holding
 * a principal gets tools for what that principal can do, and there is no
 * second list to keep in step.
 */
export function permittedMutations<S extends AnySchema>(
  policy: Policy | undefined,
  principal: Principal,
  mutations: readonly AnyMutationDefinition<S>[],
): readonly AnyMutationDefinition<S>[] {
  if (!policy) return mutations;
  return mutations.filter((mutation) => {
    // Permitted for ANY of its subject kinds is enough to offer the tool; the
    // store still refuses the individual call that is not allowed.
    // A `self` grant is offered with the principal as its subject: "ask, on
    // yours" is an act the principal has, though only ever on themselves;
    // an `ownEnd` grant with the principal at the far end, likewise — for a principal who has a record to be there.
    const me = actingAs(principal).id;
    return subjectKinds(mutation).some((kind) => permits(policy, principal, mutation.name, kind, undefined, me, undefined, () => [me ?? []].flat()).ok);
  });
}

/** The kinds a mutation's subject may be, or one unknown kind when it takes any or none. */
export const subjectKinds = (mutation: Pick<AnyMutationDefinition<AnySchema>, "subject">): readonly (string | undefined)[] =>
  mutation.subject && mutation.subject.kinds !== "*" ? (mutation.subject.kinds as readonly string[]) : [undefined];

/**
 * WHETHER A PRINCIPAL MAY PROPOSE AN ACT (Roadmap f-proposals-for-review):
 * a grant to one of their roles names it in `propose` (or says `"*"`), on
 * this kind where it names kinds. Asked of a call the policy refuses to
 * run: no policy, or the system, runs it instead and proposes nothing.
 */
export function proposes(policy: Policy | undefined, principal: Principal, mutation: string, kind?: string): boolean {
  if (!policy || isSystem(principal)) return false;
  const acting = actingAs(principal);
  return policy.grants.some((grant) => grant.propose !== undefined && grantsTo(grant, acting) && matches(grant.propose, mutation) && (grant.kinds === undefined || grant.kinds === "*" || (kind !== undefined && grant.kinds.includes(kind))));
}
