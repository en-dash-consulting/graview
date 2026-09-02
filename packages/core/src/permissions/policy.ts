import type { AnyMutationDefinition } from "../mutations/types.js";
import type { AnySchema } from "../schema/schema.js";
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
): { readonly ok: true } | { readonly ok: false; readonly refusal: Refusal } {
  // No policy means permission is not a concern in this installation.
  if (!policy) return { ok: true };

  /*
   * A derived act is permitted when the policy names it (or says `*`) —
   * the grants are read first, as for any act — and otherwise when any of
   * the declared acts it rides is permitted for this principal on this kind.
   */
  if (via !== undefined) {
    if (permits(policy, principal, mutation, kind).ok) return { ok: true };
    if (via.some((name) => permits(policy, principal, name, kind).ok)) return { ok: true };
    const wouldNeed = [
      ...new Set(via.flatMap((name) => rolesWhoCould(policy, name, kind))),
    ].sort();
    const who =
      via.length === 0
        ? "no declared act writes or creates it, so no role can"
        : wouldNeed.length === 0
          ? "no role can"
          : `${wouldNeed.length === 1 ? "" : "one of "}${wouldNeed.join(", ")} can`;
    return {
      ok: false,
      refusal: {
        mutation,
        ...(kind === undefined ? {} : { kind }),
        wouldNeed,
        message: `Not permitted: ${mutation}${kind ? ` on a ${kind}` : ""} — ${who}.`,
      },
    };
  }

  for (const grant of policy.grants) {
    if (!grantsTo(grant, principal)) continue;
    if (!matches(grant.mutations, mutation)) continue;
    if (grant.kinds !== undefined && grant.kinds !== "*") {
      if (kind === undefined || !grant.kinds.includes(kind)) continue;
    }
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
      message: `Not permitted: ${mutation}${kind ? ` on a ${kind}` : ""} — ${who}.`,
    },
  };
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
