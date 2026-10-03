import type { Operation } from "../ops/types.js";
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
 * WHAT THE LOG KNOWS ABOUT A RECORD that the graph may no longer: its kind
 * (a record since removed is still judged as what it was) and who made it.
 */
export interface Records {
  kindOf(id: string): string | undefined;
  /** The id of the seat that first added it — the person, for an agent acting for one. */
  creatorOf(id: string): string | undefined;
}

const RECORDS = new WeakMap<object, { readonly length: number; readonly last: string | undefined; readonly records: Records }>();

/**
 * The records a log names, read from its add- and remove-node primitives.
 * The first op that added a record made it: putting one back by an undo is
 * not a new author. Kept per log until it grows or is cut.
 */
export function recordsOf(log: { all(): readonly Operation[] }): Records {
  const ops = log.all();
  const held = RECORDS.get(log);
  if (held && held.length === ops.length && held.last === ops.at(-1)?.id) return held.records;
  const kinds = new Map<string, string>();
  const creators = new Map<string, string>();
  for (const op of ops) {
    for (const primitive of op.primitives) {
      if (primitive.op !== "add-node" && primitive.op !== "remove-node") continue;
      const { id, kind } = primitive.node;
      if (!kinds.has(id)) kinds.set(id, kind);
      if (primitive.op !== "add-node" || creators.has(id) || op.undoes !== undefined) continue;
      const by = actingAs(op.author as Principal).id;
      if (by !== undefined) creators.set(id, by);
    }
  }
  const records: Records = { kindOf: (id) => kinds.get(id), creatorOf: (id) => creators.get(id) };
  RECORDS.set(log, { length: ops.length, last: ops.at(-1)?.id, records });
  return records;
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
