import { permits, rolesOf } from "../../permissions/policy.js";
import { THEMSELVES } from "./people.js";
import { derivedVia } from "../../mutations/derive-edits.js";
import { nodeRefKinds } from "../../mutations/node-ref.js";
import { nearestAct } from "../../mutations/act-spelling.js";
import type { AnySchema } from "../../schema/schema.js";
import { BIND_PERSON, BINDING_ACTS, isBindingAct } from "../../binding-served.js";
import { KEEP_LINK } from "../../mutations/keep-link.js";
import { PUBLISH } from "../../publish.js";
import { PROPOSE_CHANGES } from "../../mutations/propose-changes.js";
import { VOTE_SUGGESTION } from "../../mutations/vote-suggestion.js";
import { TYPE_TEXT } from "../../text/typing-hook.js";
import { bindingUngranted } from "../../binding-ungranted.js";
import type { Grant } from "../../permissions/types.js";

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

/*
 * THE ACTS EVERY STORE ANSWERS beside an app's own and those it derives per
 * kind and relation. Keeping a link and typing into a field are judged by
 * the policy, so a grant naming either grants it; a vote on a suggestion, a
 * proposal and publishing are judged without a grant (by who may see the
 * suggestion, by what each proposed call is, by `publishing.publishers`), so
 * a grant naming any of them grants nothing.
 */
const GRANTED_STORE_ACTS: ReadonlySet<string> = new Set([KEEP_LINK, TYPE_TEXT]);
const UNGRANTED_STORE_ACTS: ReadonlySet<string> = new Set([VOTE_SUGGESTION, PROPOSE_CHANGES, PUBLISH]);

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
  // A name the framework keeps for an act of its own is never the app's.
  for (const kept of BINDING_ACTS) {
    if ((app.mutations ?? []).some((mutation) => mutation.name === kept)) {
      add({ severity: "error", code: "binding-act-taken", where: `mutations.${kept}`, message: `The app declares its own "${kept}" act, a name the framework keeps for an act of its own.`, fix: `Rename the app's "${kept}" act.` });
    }
  }
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
            permits(app.policy, { kind: "human", id: "themselves", roles: [role] }, mutation.name, kind, undefined, "themselves", undefined, THEMSELVES).ok,
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
            permits(app.policy, { kind: "human", id: "themselves", roles: [role] }, mutation.name, kind, via, "themselves", undefined, THEMSELVES).ok,
        );
      });
      /*
       * A ROLE THAT ONLY READS IS A READER, NOT A MISTAKE. A viewer that
       * may run nothing is the point of a viewer: it reads every kind where
       * the policy keeps no kind from anybody (no `sees`), and what a sight
       * names it for where it does. Only a role that can neither act nor
       * see a thing is one nobody could use.
       */
      const canRead = !app.policy.sees?.length || app.policy.sees.some((sight) => sight.roles === "*" || sight.roles.includes(role));
      if (!canDo && !canRead) {
        add({
          severity: "warning",
          code: "role-may-do-nothing",
          where: `policy (role "${role}")`,
          message: `"${role}" may run no mutation and see no kind, so anyone holding it can do nothing at all.`,
          fix: `Grant it a mutation (policy.grants) or a kind to read (policy.sees), or drop the role.`,
        });
      }
    }

    for (const grant of app.policy.grants) {
      /*
       * BINDING AN ACCOUNT TO A PERSON IS THE HOST'S (Roadmap
       * f-invite-binds-existing-person): it runs `bind-person` as its own
       * seat when an invitation is accepted, for the app's owner. A role
       * granted it — or let propose it — could bind any account to any
       * person, its own among them, so no grant may name it.
       */
      for (const named of bindingActsIn(grant)) {
        add({
          severity: "error",
          code: "grant-gives-binding",
          where: "policy.grants",
          message: `${bindingUngranted(named)}.`,
          fix: `Drop "${named}" from the grant. The host ${named === BIND_PERSON ? "binds with bindPerson" : "moves a person with rebindPerson"} (@graview/core/binding) as its own seat.`,
        });
      }
      if (grant.mutations === "*") continue;
      for (const name of grant.mutations) {
        if (mutations.has(name) || isBindingAct(name) || GRANTED_STORE_ACTS.has(name)) continue;
        if (UNGRANTED_STORE_ACTS.has(name)) {
          add({
            severity: "warning",
            code: "grant-names-ungranted-act",
            where: "policy.grants",
            message: `Grants "${name}", which every store answers without a grant: ${name === VOTE_SUGGESTION ? "anybody who may see a suggestion may vote on it" : name === PUBLISH ? "who may publish is the roles publishing.publishers names" : "anybody may propose the calls they may run or may propose"}, so the grant gives nothing.`,
            fix: name === PUBLISH ? `Drop "${name}" from the grant, and name who may publish in publishing.publishers.` : `Drop "${name}" from the grant.`,
          });
          continue;
        }
        /*
         * A grant written in code is matched by the act's own name, as it
         * is written: `connect-threat-partOf` grants nothing, so it is
         * refused naming the act it spells — a document's is rewritten as
         * that act when it compiles (`act-spellings.ts`).
         */
        const near = nearestAct(name, mutations.keys());
        add({
          severity: "error",
          code: "grant-unknown-mutation",
          where: "policy.grants",
          message: `Grants "${name}", which no mutation declares.`,
          fix: near ? `Did you mean "${near}"? Name it as it is spelled.` : `Register a mutation called "${name}", or drop it from the grant.`,
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
    /* Who may see what: a sight naming a kind nobody declared keeps nothing, and says it does. */
    for (const sight of app.policy.sees ?? []) {
      for (const kind of sight.kinds) {
        if (kinds.has(kind)) continue;
        add({
          severity: "error",
          code: "sight-unknown-kind",
          where: "policy.sees",
          message: `Says who may see "${kind}", which no defineNode declares — so nobody sees what it meant to show.`,
          fix: `Use one of: ${[...kinds].join(", ")}.`,
        });
      }
    }
    /*
     * A KIND NO SIGHT NAMES, once some sight is declared, is seen by nobody
     * but the system (FR-02). Deliberate for a kind the host keeps to
     * itself; otherwise a kind added without saying who sees it, and every
     * page that lists it is empty for everybody.
     */
    const sights = app.policy.sees ?? [];
    if (sights.length > 0) {
      const named = new Set(sights.flatMap((sight) => sight.kinds));
      for (const kind of kinds) {
        if (named.has(kind)) continue;
        add({
          severity: "warning",
          code: "sight-unnamed-kind",
          where: "policy.sees",
          message: `No sight names "${kind}", so nobody but the system sees one: a policy that says who sees what says it for every kind.`,
          fix: `Add a sight for "${kind}" — { roles: "*", kinds: ["${kind}"] } if everybody may see it.`,
        });
      }
      /*
       * A REQUIRED REFERENCE TO WHAT A ROLE MAY NOT SEE (FR-55). A record
       * whose required field names a record its seat may not see is withheld
       * from that seat whole — clearing the field would serve a record that
       * fails its own declaration — so a role that sees the kind but not
       * what every one of its records must name sees none of them but the
       * ones it wrote itself. Asked of every role a grant or a sight names,
       * and, when a sight is for everybody, of a seat with no role at all.
       */
      const seesKind = (role: string | undefined, kind: string) =>
        sights.some((sight) => sight.kinds.includes(kind) && (sight.roles === "*" || (role !== undefined && sight.roles.includes(role))));
      const everyRole: (string | undefined)[] = [
        ...new Set([...rolesOf(app.policy), ...sights.flatMap((sight) => (sight.roles === "*" ? [] : sight.roles))]),
      ].sort();
      if (sights.some((sight) => sight.roles === "*")) everyRole.push(undefined);
      for (const definition of app.schema.definitions) {
        const shape = (definition.fields as { shape?: Record<string, unknown> }).shape ?? {};
        for (const [field, declared] of Object.entries(shape)) {
          const targets = nodeRefKinds(declared);
          const required = !(declared as { safeParse(value: unknown): { success: boolean } }).safeParse(undefined).success;
          if (!targets || !required || targets.includes("*")) continue;
          for (const role of everyRole) {
            if (!seesKind(role, definition.kind)) continue;
            const hidden = targets.filter((target) => !seesKind(role, target));
            if (hidden.length !== targets.length) continue;
            const who = role === undefined ? "Anybody without a role" : `${/^[aeiou]/i.test(role) ? "An" : "A"} ${role}`;
            add({
              severity: "warning",
              code: "sight-hides-required-ref",
              where: "policy.sees",
              message: `${who} will never see ${definition.kind} records somebody else wrote, because each names a ${hidden.join(" or ")} (its required field "${field}") they may not see — a record that names one is withheld whole, since clearing a required field would serve it broken.`,
              fix: `Let ${role === undefined ? "everybody" : `"${role}"`} see ${hidden.map((kind) => `"${kind}"`).join(" and ")} too, make "${field}" optional so it can be cleared instead, or say the link with an edge.`,
            });
          }
        }
      }
    }
  }
}

/** The binding acts a grant names, to run or to propose: each once. */
function bindingActsIn(grant: Pick<Grant, "mutations" | "propose">): readonly string[] {
  const named: unknown[] = [grant.mutations, grant.propose].flatMap((list) => (Array.isArray(list) ? list : []));
  return BINDING_ACTS.filter((act) => named.includes(act));
}

/** Whether a grant names binding a person, or moving one, to run or to propose. */
export function givesBinding(grant: Pick<Grant, "mutations" | "propose">): boolean {
  return bindingActsIn(grant).length > 0;
}
