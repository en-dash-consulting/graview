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

/** A log as `recordsOf` reads it: its ops, and, for an `OperationLog`, the seq it has reached (FR-23). */
export interface RecordedLog {
  all(): readonly Operation[];
  /** The seq the next op takes, counting what a compaction archived; without it, the ops it holds. */
  readonly length?: number;
}

/** What one op wrote into the index, so a log cut back can take it out again. */
interface Entry {
  readonly seq: number;
  readonly id: string;
  readonly creator: boolean;
}

/** The index one log keeps: the ops it read from seq `base` up to `end`, and what each wrote. */
interface Index {
  base: number;
  end: number;
  read: Operation[];
  readonly kinds: Map<string, string>;
  readonly creators: Map<string, string>;
  readonly entries: Entry[];
  readonly records: Records;
}

const INDEXES = new WeakMap<object, Index>();

function indexFrom(base: number): Index {
  const kinds = new Map<string, string>();
  const creators = new Map<string, string>();
  return { base, end: base, read: [], kinds, creators, entries: [], records: { kindOf: (id) => kinds.get(id), creatorOf: (id) => creators.get(id) } };
}

/** Reads one op into the index: the kind of each record it first adds or removes, and who first made one. */
function readInto(index: Index, op: Operation): void {
  const seq = index.end;
  for (const primitive of op.primitives) {
    if (primitive.op !== "add-node" && primitive.op !== "remove-node") continue;
    const { id, kind } = primitive.node;
    if (!index.kinds.has(id)) {
      index.kinds.set(id, kind);
      index.entries.push({ seq, id, creator: false });
    }
    if (primitive.op !== "add-node" || index.creators.has(id) || op.undoes !== undefined) continue;
    const by = actingAs(op.author as Principal).id;
    if (by === undefined) continue;
    index.creators.set(id, by);
    index.entries.push({ seq, id, creator: true });
  }
  index.read.push(op);
  index.end++;
}

/** Takes out what the ops from `seq` on wrote: the log was cut back there. */
function cutBack(index: Index, seq: number): void {
  while (index.entries.length > 0 && index.entries.at(-1)!.seq >= seq) {
    const entry = index.entries.pop()!;
    (entry.creator ? index.creators : index.kinds).delete(entry.id);
  }
  index.read.length = seq - index.base;
  index.end = seq;
}

/**
 * The records a log names, read from its add- and remove-node primitives.
 * The first op that added a record made it: putting one back by an undo is
 * not a new author.
 *
 * KEPT AS THE LOG GOES (FR-51), as the label index follows the graph: a
 * call reads only the ops appended since the last one, so a commit costs
 * its own ops, not the log's. A log cut back (`truncate`, under a rebase)
 * is noticed by its ops no longer being the ones read, and what they wrote
 * is taken out, back to where the log and the index still agree. A log
 * compacted behind its horizon (FR-23) keeps what the index had already
 * read of the archived ops, so a record made behind the horizon is still
 * known by its maker for as long as this log is open; a log OPENED
 * compacted never read them, and knows its makers from the horizon on.
 * The `Records` returned is the same object every time, and answers as of
 * the last call.
 */
export function recordsOf(log: RecordedLog): Records {
  const ops = log.all();
  const end = typeof log.length === "number" ? log.length : ops.length;
  const first = end - ops.length;
  let index = INDEXES.get(log);
  if (index && index.base <= first && first <= index.end) {
    // Back to the last seq where the log still holds the op the index read: a log is only ever cut from its end.
    let agreed = Math.min(index.end, end);
    while (agreed > first && ops[agreed - 1 - first] !== index.read[agreed - 1 - index.base]) agreed--;
    if (agreed === first && first > index.base && agreed < index.end) {
      // It disagrees all the way back to its horizon: not the log this index read.
      index = undefined;
    } else {
      if (agreed < index.end) cutBack(index, agreed);
      // What a compaction archived is no longer held here to compare against (FR-23).
      if (first > index.base) {
        index.read = index.read.slice(first - index.base);
        index.base = first;
      }
    }
  } else index = undefined;
  if (!index) INDEXES.set(log, (index = indexFrom(first)));
  for (let seq = index.end; seq < end; seq++) readInto(index, ops[seq - first]!);
  return index.records;
}

/**
 * Whether a principal may see one record.
 *
 * ONE MEANING, the document's and the framework's alike (FR-02). With no
 * `sees`, everybody sees everything. Once a policy says who sees what, it
 * says it for every kind: a kind no sight names is seen by nobody but the
 * system — the host's own seat — which is how a store fails closed when a
 * kind is added and nobody said who sees it. A kind a sight names is seen
 * by the roles it lists, and with `own` only the principal's own records:
 * their record itself, what an edge joins to it ("a shopper sees their own
 * test drives" without a field naming the owner), and what they made.
 */
export function sees(
  policy: Policy | undefined,
  principal: Principal,
  node: { readonly id: string; readonly kind: string },
  graph: Joined,
  /** Who made a record, from the log; without it, `own` reads the graph alone. */
  records?: Pick<Records, "creatorOf">,
): boolean {
  if (!policy?.sees?.length) return true;
  // The system sees what it keeps; an agent sees what it AND its person may (FR-06, FR-17).
  if (isSystem(principal)) return true;
  const sights = policy.sees.filter((sight) => sight.kinds.includes(node.kind));
  if (sights.length === 0) return false;
  principal = actingAs(principal);
  return sights.some((sight) => {
    if (!sightGrantsTo(sight, principal)) return false;
    if (!sight.own) return true;
    const me = principal.id;
    if (me === undefined) return false;
    return (
      node.id === me ||
      graph.out(node.id).some((other) => other.id === me) ||
      graph.in(node.id).some((other) => other.id === me) ||
      records?.creatorOf(node.id) === me
    );
  });
}
