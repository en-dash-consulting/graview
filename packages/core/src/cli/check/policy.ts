import { permits, rolesOf } from "../../permissions/policy.js";
import { derivedVia } from "../../mutations/derive-edits.js";
import type { AnySchema } from "../../schema/schema.js";

/**
 * `note` is a QUESTION ASKED OUT LOUD, not a problem.
 *
 * Some things a checker can see are legitimate designs that the author
 * should nonetheless have looked at once: a lens written for this app and
 * never proved against another domain, a role name two vocabularies both
 * use, a kind unreachable on an empty graph. Filed as warnings they would
 * be warnings that can only ever be acknowledged, and those are the ones
 * people learn to scroll past — which costs the checker its authority on
 * the warnings that matter. So they have their own voice: counted, printed,
 * and never a failure.
 */
import type { CheckContext } from "./context.js";

export function checkPolicy<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, kinds, declaredMutations, mutations, add } = ctx;
  /*
   * A policy that locks somebody out of everything, or locks everybody out of
   * something.
   *
   * Both are mistakes in the declaration rather than at runtime, and both are
   * silent: a mutation no role can run looks exactly like a mutation nobody
   * happens to have needed yet, and a role with nothing to do looks exactly
   * like a role whose grants are elsewhere. The person who finds either is
   * otherwise the person standing in front of a button they cannot press.
   */
  if (app.policy) {
    const roles = rolesOf(app.policy);
    for (const mutation of app.mutations ?? []) {
      const subjectKinds =
        mutation.subject && mutation.subject.kinds !== "*"
          ? (mutation.subject.kinds as readonly string[])
          : [undefined];
      const reachable = roles.some((role) =>
        subjectKinds.some(
          // A self grant counts: a role that may edit its own record may do
          // something, so the role is judged as somebody acting on themselves.
          (kind) =>
            permits(app.policy, { kind: "human", id: "themselves", roles: [role] }, mutation.name, kind, undefined, "themselves").ok,
        ),
      );
      const openToAll = subjectKinds.some(
        (kind) => permits(app.policy, { kind: "human", roles: [] }, mutation.name, kind).ok,
      );
      if (!reachable && !openToAll) {
        add({
          severity: "error",
          code: "mutation-unreachable-by-any-role",
          where: `policy.grants (mutation "${mutation.name}")`,
          message: `No role may ever run "${mutation.name}", so it is declared and unreachable.`,
          fix: `Grant it to a role, or remove the mutation.${
            roles.length > 0 ? ` Roles in this policy: ${roles.join(", ")}.` : ""
          }`,
        });
      }
    }

    for (const role of roles) {
      /*
       * Declared AND derived acts count, and a self grant counts: a role
       * that may edit its own record may do something. The role is judged
       * as somebody acting on themselves, which is the most a self grant
       * ever allows.
       */
      const canDo = [...mutations.values()].some((mutation) => {
        const subjectKinds =
          mutation.subject && mutation.subject.kinds !== "*"
            ? (mutation.subject.kinds as readonly string[])
            : [undefined];
        const via = derivedVia(app.schema, declaredMutations, mutation);
        return subjectKinds.some(
          (kind) =>
            permits(app.policy, { kind: "human", id: "themselves", roles: [role] }, mutation.name, kind, via, "themselves").ok,
        );
      });
      if (!canDo) {
        add({
          severity: "warning",
          code: "role-may-do-nothing",
          where: `policy.grants (role "${role}")`,
          message: `"${role}" may run no mutation, so anyone holding it can only read.`,
          fix: "Grant it something, or drop the role if read-only was the intent.",
        });
      }
    }

    for (const grant of app.policy.grants) {
      if (grant.mutations === "*") continue;
      for (const name of grant.mutations) {
        if (mutations.has(name)) continue;
        add({
          severity: "error",
          code: "grant-unknown-mutation",
          where: "policy.grants",
          message: `Grants "${name}", which no mutation declares.`,
          fix: `Register a mutation called "${name}", or drop it from the grant.`,
        });
      }
      if (grant.kinds === undefined || grant.kinds === "*") continue;
      for (const kind of grant.kinds) {
        if (kinds.has(kind)) continue;
        add({
          severity: "error",
          code: "grant-unknown-kind",
          where: "policy.grants",
          message: `Restricted to "${kind}", which no defineNode declares.`,
          fix: `Use one of: ${[...kinds].join(", ")}.`,
        });
      }
    }
  }
}
