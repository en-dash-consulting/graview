import { parsedComputed } from "../../document/computed.js";
import { factsIn, factsSaid } from "../../document/rule-reads.js";
import { rolesOf } from "../../permissions/policy.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";
import { kindsRead } from "./hidden-reads.js";

/*
 * A RULE THAT SAYS A FACT SOME ROLE MAY NOT SEE ALL OF.
 *
 * A seat's problems are judged over what it sees, facts included (FR-55):
 * "3 proposed" to the owner who sees three is "1 proposed" to a guest who
 * sees one — or, where the one the guest sees keeps the rule, no problem at
 * all. Each is true of what that seat sees, and none is the count the rule
 * was written about. The author should know where that is so: a rule whose
 * message says a fact (`fact('<name>')` in its sentence, or, with none, in
 * what it requires, which its line says), a kind that fact reads, and a
 * role that may see the rule's subject but not every record of that kind —
 * none of it, or only what is its own. A warning, never an error: a count
 * of what each seat sees may be what is meant.
 */
export function checkFactRules<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  const sights = app.policy?.sees ?? [];
  const facts = parsedComputed(app.schema as never);
  if (!app.policy || sights.length === 0 || !facts) return;
  const schema = app.schema as AnySchema;
  /** The kinds a fact reads, following the facts it reads in turn. */
  const kindsOf = (name: string, read = new Map<string, string>(), seen = new Set<string>()): Map<string, string> => {
    const expr = facts.get(name);
    if (!expr || seen.has(name)) return read;
    seen.add(name);
    kindsRead(expr, [], schema, read, name);
    for (const other of factsIn(expr)) kindsOf(other, read, seen);
    return read;
  };
  /** Whether a role sees a kind: any of it, or all of it — named for the role by a sight that is not only what is its own. */
  const sees = (role: string, kind: string, all: boolean) => sights.some((sight) => (sight.roles === "*" || sight.roles.includes(role)) && sight.kinds.includes(kind) && !(all && sight.own));
  const roles = [...new Set([...rolesOf(app.policy), ...sights.flatMap((sight) => (sight.roles === "*" ? [] : sight.roles))])].sort();
  for (const rule of app.invariants ?? []) {
    const shape = rule.shape;
    for (const fact of shape ? factsSaid(shape) : []) {
      const kinds = [...kindsOf(fact).keys()].sort();
      // A role that may not see the rule's subject is never told of it.
      for (const role of roles.filter((role) => shape!.over === "graph" || sees(role, shape!.over, false))) {
        const named = kinds.filter((kind) => !sees(role, kind, true)).join(", ");
        if (!named) continue;
        add({
          severity: "warning",
          code: "rule-says-hidden-fact",
          where: rule.name,
          message: `"${rule.name}" says fact('${fact}'), which reads ${named} records "${role}" may not see all of: "${role}" is told the rule as it holds over what they see, so the count, and whether it is broken at all, may not be the ones the rule was written about.`,
          fix: `Let "${role}" see all of ${named}, say the rule without fact('${fact}'), or mean a count of what each seat sees.`,
        });
      }
    }
  }
}
