import type { GraphEdge } from "../graph/types.js";
import type { Epoch, LogReading } from "../ops/log.js";
import type { Operation } from "../ops/types.js";
import { actingAs, grantsTo, isSystem } from "./policy.js";
import type { SeatLens } from "../ops/withheld.js";
import type { Policy, Principal, Sight } from "./types.js";

/** What a store reads to judge a seat's sight: its policy, its graph and its log. */
export interface Judged {
  readonly policy: Policy | undefined;
  readonly graph: {
    getNode(id: string): { readonly id: string; readonly kind: string } | undefined;
    out(id: string): readonly { readonly id: string }[];
    in(id: string): readonly { readonly id: string }[];
    /** A store's own graph says its links, so an op can be judged where it stood (FR-55). */
    outEdges?(id: string): readonly GraphEdge[];
    inEdges?(id: string): readonly GraphEdge[];
  };
  readonly log: LogReading;
  /** The kinds of the modules this workspace has off (FR-12), kept from every seat as a sight keeps a record. */
  readonly modules?: { readonly disabledKinds: ReadonlySet<string> };
  /** The declaration, to say which of a kind's fields a record may be served without (FR-55). */
  readonly schema?: { tryDefinition(kind: string): { readonly fields: unknown } | undefined };
}

/** Which fields of a record a seat may not see: a test of a field, or undefined when it sees them all. */
export type FieldsKept = (node: { readonly id: string; readonly kind: string }) => ((field: string) => boolean) | undefined;

/**
 * A SIGHT THAT SHOWS ONLY SOME FIELDS (Roadmap f-field-sight) — `hide` or
 * `fields` — is judged by `@graview/core/field-sight`, which fills these in
 * as it loads: a host that serves seats loads it (`@graview/ship`'s
 * server entry does). Until it is loaded such a sight shows nothing,
 * so a store that cannot judge a field keeps the record rather than serve
 * the field. A store that holds only what its host served one seat
 * (`openRemote`'s) is put in `served` as a mirror: the host judged it, and
 * IT shows what it was served — that store alone, never another store the
 * same page holds whole.
 */
export const FIELD_SIGHT: {
  /** Whether field sight is loaded: a sight that shows only some fields shows what it shows, in every store. */
  on?: boolean;
  /** The stores that hold only what their host served one seat: each shows what it holds, though field sight is not loaded. */
  readonly served: WeakSet<object>;
  /** A seat's lens, made to keep the fields its sight keeps. */
  lens?: (lens: SeatLens, store: Judged, principal: Principal) => SeatLens;
  /** The fields one seat may not see, record by record; undefined when it sees every one. */
  keptFrom?: (store: Judged, principal: Principal) => FieldsKept | undefined;
} = { served: new WeakSet() };

/** Whether a sight shows only some fields: an allow list, or fields it hides. */
export const partialSight = (sight: Sight): boolean => sight.fields !== undefined || (sight.hide?.length ?? 0) > 0;

/**
 * WHETHER A STORE MAY SHOW A SIGHT THAT SHOWS ONLY SOME FIELDS: field sight
 * is loaded and keeps them, or the store is a mirror of what its host
 * served (`FIELD_SIGHT.served`). Otherwise such a sight shows nothing.
 */
export const fieldsJudged = (store: object): boolean => FIELD_SIGHT.on === true || FIELD_SIGHT.served.has(store);

/** The edges a graph can be asked about, to say what is joined to whom. */
interface Joined {
  out(id: string, kind?: string): readonly { readonly id: string }[];
  in(id: string, kind?: string): readonly { readonly id: string }[];
}

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
  /**
   * WHETHER IT KNOWS EVERY RECORD THE LOG EVER HELD (FR-199): read from seq
   * 0, or opened on a checkpoint that keeps the kinds of the records behind
   * it (`Epoch.removed`). When not — a checkpoint written before that — an
   * id it cannot place may be a record made and removed behind the
   * horizon, and the seat view judges it as one of the kind its id names.
   */
  readonly knowsAll: boolean;
}

/** A log as `recordsOf` reads it: its ops, and, for an `OperationLog`, the seq it has reached (FR-23). */
export interface RecordedLog {
  all(): readonly Operation[];
  /** The seq the next op takes, counting what a compaction archived; without it, the ops it holds. */
  readonly length?: number;
  /** Its epochs, for a log compacted behind a checkpoint that names who made what behind it (`Epoch.creators`) and what each record removed behind it was (`Epoch.removed`). */
  epochs?(): readonly Epoch[];
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

/**
 * A fresh index for a log that begins at seq `base`, knowing the makers its
 * checkpoint kept behind it and the kinds of the records removed behind it
 * — and so every record the log ever held, from seq 0 or from a checkpoint
 * that kept those kinds.
 */
function indexFrom(base: number, checkpoint: Epoch | undefined): Index {
  const kinds = new Map<string, string>(Object.entries(checkpoint?.removed ?? {}));
  const creators = new Map<string, string>(Object.entries(checkpoint?.creators ?? {}));
  const knowsAll = base === 0 || checkpoint?.removed !== undefined;
  return { base, end: base, read: [], kinds, creators, entries: [], records: { kindOf: (id) => kinds.get(id), creatorOf: (id) => creators.get(id), knowsAll } };
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
 * known by its maker for as long as this log is open. A log OPENED
 * compacted never read them: it knows them from its checkpoint, which keeps
 * who made each record behind it (`Epoch.creators`, written by
 * `store.checkpoint`) and what kind each record behind it that its graph
 * does not hold was (`Epoch.removed`, FR-199); a checkpoint without those
 * (one written before they existed) leaves it knowing them from the
 * horizon on, and saying so (`knowsAll`).
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
  if (!index) INDEXES.set(log, (index = indexFrom(first, first > 0 ? checkpointOf(log, first) : undefined)));
  for (let seq = index.end; seq < end; seq++) readInto(index, ops[seq - first]!);
  return index.records;
}

/** The checkpoint a log compacted at `seq` begins from: the last epoch marked `horizon`, when it is there. */
function checkpointOf(log: RecordedLog, seq: number): Epoch | undefined {
  const checkpoint = [...(log.epochs?.() ?? [])].reverse().find((epoch) => epoch.horizon);
  return checkpoint?.seq === seq ? checkpoint : undefined;
}

/**
 * WHAT A CHECKPOINT AT `seq` KEEPS OF THE RECORDS BEHIND IT, from the log:
 *
 *   - `creators` (`Epoch.creators`): record id to the seat that first
 *     added it, in the order they were made — what the log's checkpoint
 *     already kept, then what the ops it holds before `seq` add;
 *   - `removed` (`Epoch.removed`, FR-199): record id to kind, for every
 *     record the log made or removed before `seq` that `held` (the
 *     checkpoint's graph) does not hold — so a store opened on it still
 *     knows a field naming one names a record, and of what kind. Absent
 *     when the log does not know every record it held (`knowsAll`): a
 *     checkpoint written from it would claim to.
 */
export function behind(log: RecordedLog, seq: number, held: (id: string) => boolean): { creators: Record<string, string>; removed?: Record<string, string> } {
  recordsOf(log);
  const index = INDEXES.get(log)!;
  const after = [new Set<string>(), new Set<string>()];
  for (let at = index.entries.length - 1; at >= 0 && index.entries[at]!.seq >= seq; at--) after[+index.entries[at]!.creator]!.add(index.entries[at]!.id);
  const creators: Record<string, string> = {};
  const removed: Record<string, string> = {};
  for (const [id, by] of index.creators) if (!after[1]!.has(id)) creators[id] = by;
  for (const [id, kind] of index.kinds) if (!after[0]!.has(id) && !held(id)) removed[id] = kind;
  return index.records.knowsAll ? { creators, removed } : { creators };
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
 * test drives" without a field naming the owner), and what they made. With
 * `via`, only what that one relation joins to their record.
 */
export function sees(
  policy: Policy | undefined,
  principal: Principal,
  node: { readonly id: string; readonly kind: string },
  graph: Joined,
  /** Who made a record, from the log; without it, `own` reads the graph alone. */
  records?: Pick<Records, "creatorOf">,
  /** Whether a sight that shows only some fields may show the record (`fieldsJudged`); without it, only when field sight is loaded. */
  judged: boolean = FIELD_SIGHT.on === true,
): boolean {
  if (!policy?.sees?.length) return true;
  // The system sees what it keeps; an agent sees what it AND its person may (FR-06, FR-17).
  if (isSystem(principal)) return true;
  // A sight that shows only some fields shows nothing until they can be judged: it fails closed (Roadmap f-field-sight).
  const sights = policy.sees.filter((sight) => sight.kinds.includes(node.kind) && (judged || !partialSight(sight)));
  if (sights.length === 0) return false;
  principal = actingAs(principal);
  return sights.some((sight) => {
    if (!grantsTo(sight, principal)) return false;
    if (!sight.own && !sight.via) return true;
    const me = principal.id;
    if (me === undefined) return false;
    // `via` reads the one relation, at either end, and nothing else (Roadmap: visibility scoped by relation).
    const mine = (other: { readonly id: string }) => other.id === me;
    return sight.via
      ? graph.out(node.id, sight.via).some(mine) || graph.in(node.id, sight.via).some(mine)
      : node.id === me || graph.out(node.id).some(mine) || graph.in(node.id).some(mine) || records?.creatorOf(node.id) === me;
  });
}
