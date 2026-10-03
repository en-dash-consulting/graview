import { actingAs, isSystem } from "./policy.js";
import type { Policy, Principal, Sight } from "./types.js";

/** The edges a graph can be asked about, to say what is joined to whom. */
interface Joined {
  out(id: string): readonly { readonly id: string }[];
  in(id: string): readonly { readonly id: string }[];
}

const sightGrantsTo = (sight: Sight, principal: Principal): boolean =>
  sight.roles === "*" || (principal.roles ?? []).some((role) => (sight.roles as readonly string[]).includes(role));

/** The kinds a policy keeps to those its sights name. */
export function sightedKinds(policy: Policy | undefined): ReadonlySet<string> {
  return new Set((policy?.sees ?? []).flatMap((sight) => sight.kinds));
}

/**
 * Whether a principal may see one record.
 *
 * A kind no sight names is everybody's to see. One a sight names is seen by
 * the roles it lists — and with `own`, only the principal's own record and
 * what an edge joins to it, which is how "a shopper sees their own test
 * drives" is said without a field naming the owner.
 */
export function sees(
  policy: Policy | undefined,
  principal: Principal,
  node: { readonly id: string; readonly kind: string },
  graph: Joined,
): boolean {
  const sights = (policy?.sees ?? []).filter((sight) => sight.kinds.includes(node.kind));
  if (sights.length === 0) return true;
  // The system sees what it keeps; an agent sees what it AND its person may (FR-06, FR-17).
  if (isSystem(principal)) return true;
  principal = actingAs(principal);
  return sights.some((sight) => {
    if (!sightGrantsTo(sight, principal)) return false;
    if (!sight.own) return true;
    const me = principal.id;
    if (me === undefined) return false;
    return node.id === me || graph.out(node.id).some((other) => other.id === me) || graph.in(node.id).some((other) => other.id === me);
  });
}
