import type { AnyMutationDefinition } from "../mutations/types.js";
import type { AnySchema } from "../schema/schema.js";
import { withArticle } from "../schema/define-node.js";
import type { Grant, Policy, Principal, Refusal } from "./types.js";

const matches = (allowed: readonly string[] | "*", value: string): boolean =>
  allowed === "*" || allowed.includes(value);

/** Whether a grant covers a principal at all, before looking at the call. */
function grantsTo(grant: Grant, principal: Principal): boolean {
  if (grant.roles === "*") return true;
  return (principal.roles ?? []).some((role) => grant.roles.includes(role));
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
): { readonly ok: true } | { readonly ok: false; readonly refusal: Refusal } {
  // No policy means permission is not a concern in this installation.
  if (!policy) return { ok: true };

  /*
   * A derived act is permitted when the policy names it (or says `*`) —
   * the grants are read first, as for any act — and otherwise when any of
   * the declared acts it rides is permitted for this principal on this kind.
   */
  if (via !== undefined) {
    if (permits(policy, principal, mutation, kind, undefined, subjectId).ok) return { ok: true };
    if (via.some((name) => permits(policy, principal, name, kind, undefined, subjectId).ok)) return { ok: true };
    /*
     * A derived edit is reachable two ways, and the refusal has to count
     * both: a grant naming it (or saying `*`), and a grant on any declared
     * act it rides. Counting only the second said "no declared act writes or
     * creates it, so no role can" to a rider while the driver's `mutations:
     * "*"` grant plainly reached it.
     */
    const names = [mutation, ...via];
    const wouldNeed = [
      ...new Set(names.flatMap((name) => rolesWhoCould(policy, name, kind))),
    ].sort();
    const who =
      wouldNeed.length === 0
        ? via.length === 0
          ? "no declared act writes or creates it, so no role can"
          : "no role can"
        : `${wouldNeed.length === 1 ? "" : "one of "}${wouldNeed.join(", ")} can`;
    return {
      ok: false,
      refusal: {
        mutation,
        ...(kind === undefined ? {} : { kind }),
        wouldNeed,
        message: said(policy, names, kind, who),
      },
    };
  }

  for (const grant of policy.grants) {
    if (!grantsTo(grant, principal)) continue;
    if (!matches(grant.mutations, mutation)) continue;
    if (grant.kinds !== undefined && grant.kinds !== "*") {
      if (kind === undefined || !grant.kinds.includes(kind)) continue;
    }
    // "You, on yours": a self grant needs the subject to be the principal.
    if (grant.self && (subjectId === undefined || principal.id === undefined || subjectId !== principal.id)) continue;
    return { ok: true };
  }

  const wouldNeed = rolesWhoCould(policy, mutation, kind);
  const who =
    wouldNeed.length === 0
      ? "no role can"
      : `${wouldNeed.length === 1 ? "" : "one of "}${wouldNeed.join(", ")} can`;
  return {
    ok: false,
    refusal: {
      mutation,
      ...(kind === undefined ? {} : { kind }),
      wouldNeed,
      message: said(policy, [mutation], kind, who),
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
): string {
  const because = [...new Set(names.flatMap((name) => whyNot(policy, name, kind)))];
  return (
    `Not permitted: ${names[0]}${kind ? ` on ${withArticle(kind)}` : ""} — ${who}.` +
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
 * not what the organisation means. The sentences of the grants that WOULD
 * allow this are the ones worth repeating.
 */
export function whyNot(policy: Policy, mutation: string, kind?: string): readonly string[] {
  const said = new Set<string>();
  for (const grant of policy.grants) {
    if (!matches(grant.mutations, mutation)) continue;
    if (grant.kinds !== undefined && grant.kinds !== "*" && kind !== undefined) {
      if (!grant.kinds.includes(kind)) continue;
    }
    if (grant.describe) said.add(grant.describe);
  }
  return [...said];
}

/**
 * Every role that could run this mutation, so a refusal can name what would
 * be needed instead of merely saying no.
 */
export function rolesWhoCould(
  policy: Policy,
  mutation: string,
  kind?: string,
): readonly string[] {
  const roles = new Set<string>();
  for (const grant of policy.grants) {
    if (!matches(grant.mutations, mutation)) continue;
    if (grant.kinds !== undefined && grant.kinds !== "*" && kind !== undefined) {
      if (!grant.kinds.includes(kind)) continue;
    }
    if (grant.roles === "*") {
      // Everyone already may; naming roles would be misleading.
      return [];
    }
    for (const role of grant.roles) roles.add(role);
  }
  return [...roles].sort();
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
    const subject = mutation.subject;
    const kinds =
      subject && subject.kinds !== "*" ? (subject.kinds as readonly string[]) : [undefined];
    // Permitted for ANY of its subject kinds is enough to offer the tool; the
    // store still refuses the individual call that is not allowed.
    return kinds.some((kind) => permits(policy, principal, mutation.name, kind).ok);
  });
}
