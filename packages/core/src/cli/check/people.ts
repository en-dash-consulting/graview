import { nodeRefArgs } from "../../mutations/node-ref.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/** The far end of a link, as a role judged acting on themselves has it: their own (an `ownEnd` grant passes). */
export const THEMSELVES = (): readonly string[] => ["themselves"];

/**
 * THE KIND THAT STANDS FOR THE PEOPLE, AND WHAT READS IT (Roadmap
 * f-people-kind, f-own-end-grants, "visibility scoped by relation").
 *
 * A principal's id is a record of the people kind, and three parts of a
 * policy read it that way: a sight `via` a relation (the relation must
 * reach that kind), a grant held to the principal's own end of a link (the
 * act must make or break one, and name the record at its far end), and a
 * document act's `$me` (said by the document's own findings). Each needs
 * one kind to be the people — two is a declaration that cannot say whose
 * record a principal's id is, and none is a policy reading a record that is
 * nowhere.
 */
export function checkPeople<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, mutations, add } = ctx;
  const definitions = app.schema.definitions;
  const people = definitions.filter((definition) => definition.people).map((definition) => definition.kind);
  for (const kind of people.slice(1)) {
    add({
      severity: "error",
      code: "people-ambiguous",
      where: `${kind} (people)`,
      message: `${people.map((one) => `"${one}"`).join(" and ")} both say they are the people, so a principal's id is a record of neither for certain.`,
      fix: `Say people: true on one kind — the one whose records are the people who sign in.`,
    });
  }
  const policy = app.policy;
  if (!policy) return;
  const readers = [...(policy.sees ?? []).filter((sight) => sight.via !== undefined).map(() => "a sight via a relation"), ...policy.grants.filter((grant) => grant.ownEnd).map(() => "a grant held to your own end of a link")];
  if (people.length === 0 && readers.length > 0) {
    add({
      severity: "error",
      code: "people-unsaid",
      where: "policy",
      message: `The policy has ${readers[0]}, which reads a principal's id as their own record, and no kind says it is the people.`,
      fix: `Say people: true on the kind whose records are the people (a record's id is a member's principal id).`,
    });
  }

  for (const sight of policy.sees ?? []) {
    const via = sight.via;
    if (via === undefined) continue;
    const from = definitions.filter((definition) => via in definition.edges);
    if (from.length === 0) {
      add({
        severity: "error",
        code: "sight-via-unknown-edge",
        where: "policy.sees",
        message: `A sight reaches ${sight.kinds.join(", ")} via "${via}", which no kind declares — so it shows nothing.`,
        fix: `Name a relation that joins ${sight.kinds.join(" or ")} to the people.`,
      });
      continue;
    }
    if (people.length === 0) continue;
    const to = (kind: string) => from.some((definition) => definition.kind === kind);
    const reaches = (target: string) => from.some((definition) => {
      const edge = definition.edges[via] as { to: readonly string[] | "*" };
      return edge.to === "*" || edge.to.includes(target);
    });
    // Joined at either end: the sighted kind declares it toward the people, or the people declare it toward the kind.
    for (const kind of sight.kinds) {
      if ((to(kind) && people.some(reaches)) || (people.some(to) && reaches(kind))) continue;
      add({
        severity: "error",
        code: "sight-via-misses-people",
        where: "policy.sees",
        message: `A sight shows ${kind} via "${via}", which does not join ${kind} to ${people[0]} — so it reaches nobody's own record and shows no ${kind} to anyone.`,
        fix: `Name a relation between ${kind} and ${people[0]}, or let the sight be own: true.`,
      });
    }
  }

  for (const grant of policy.grants) {
    if (!grant.ownEnd) continue;
    if (grant.mutations === "*") {
      add({
        severity: "error",
        code: "grant-own-end-without-link",
        where: "policy.grants",
        message: `A grant held to your own end of a link names every act, and most connect and sever nothing.`,
        fix: `Name the acts it holds — the ones that connect or sever.`,
      });
      continue;
    }
    for (const name of grant.mutations) {
      const mutation = mutations.get(name);
      if (!mutation) continue;
      const links = (mutation.connects?.length ?? 0) + (mutation.severs?.length ?? 0) > 0;
      const far = nodeRefArgs(mutation.input).filter((ref) => ref.name !== mutation.subject?.arg);
      if (links && far.length > 0) continue;
      add({
        severity: "error",
        code: "grant-own-end-without-link",
        where: `${name} (policy.grants)`,
        message: links
          ? `"${name}" takes no record at the other end of what it links, so a grant held to your own end of it is never met.`
          : `"${name}" connects and severs nothing, so a grant held to your own end of a link has no end to hold.`,
        fix: links ? `Its far end is already yours (it says $me): drop ownEnd from the grant.` : `Hold it with self: true for the subject, or name an act that connects or severs.`,
      });
    }
  }
}
