/**
 * THE ARCHIVE AS ONE SEAT MAY SEE IT (FR-198): what a host answers
 * `HistoryHost.archived(from, to)` with for a seat, judged as the seat's
 * own view of the whole history judges — its ops redacted as `logSeenBy`
 * redacts them, and its epochs' graphs served as `seenBy` serves an epoch:
 * the records the seat may see, the fields its sight shows of them, the
 * links between them, and who made only those.
 *
 * WHY THE WHOLE HISTORY. A compacted store's seat view judges from the
 * checkpoint and the tail, and a record made and removed behind the
 * horizon is in neither: an op or an epoch that names it names, to that
 * view, no record at all, and would be served as it is — the hidden
 * record's id, minted from its label, with it. So the seat is judged here
 * over a store of everything: the archive's ops from seq 0, the store's
 * tail after them, every epoch, and the graph as it stands now — the same
 * judgment the seat's live log is served by, so the past it folds from
 * these epochs and ops meets the present it is served.
 *
 * Apart from the store and the page: a host's server reads it, so it is on
 * `@graview/core/seat`, and imports nothing of the store's or the seat
 * view's modules — it makes the whole store with the store's own class.
 */
import type { ArchivedOps } from "./history.js";
import type { EvaluateOptions, InvariantDefinition } from "./invariants/types.js";
import type { ModuleMap } from "./modules.js";
import type { Epoch } from "./ops/log.js";
import type { Author, Operation } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";
import { seatOf } from "./seat-of.js";
import type { Store, StoreOptions } from "./store.js";

/** What `archivedSeenBy` answers: a valid `HistoryHost.archived` answer, every op of the range in its place and the epochs in it, judged for one seat. */
export interface ArchivedSeen {
  /** The ops of the range, oldest first, each at its seq: one the seat may not see withheld, and no id it may not see in any. */
  readonly ops: readonly Operation[];
  /** The epochs whose seq is in the range, each with its graph as the seat is served it. */
  readonly epochs: readonly Epoch[];
}

/** What a store keeps to itself that the whole store is made with, as `@graview/core/past` reads it. */
interface Opened<S extends AnySchema> {
  readonly invariants: readonly InvariantDefinition<S>[];
  readonly invariantOptions: EvaluateOptions<S>;
  readonly declaredModules: ModuleMap | undefined;
  readonly startingModules: readonly string[] | undefined;
  readonly by: Author | Principal;
  readonly now: () => string;
}

/** The store of the whole history made for one archive and one store, kept while the store's log is the one it was made from. */
type Whole = { readonly length: number; readonly horizon: number; readonly last: Operation | undefined; readonly store: Store<AnySchema> };
const WHOLE = new WeakMap<object, WeakMap<object, Whole>>();

const given = <K extends string, V>(key: K, value: V | undefined) => (value === undefined ? {} : { [key]: value }) as { readonly [P in K]?: V };

/** An epoch as it stands in a whole log: an earlier checkpoint is no horizon there. */
const unmarked = (epoch: Epoch): Epoch => {
  if (!epoch.horizon) return epoch;
  const { horizon: _horizon, ...rest } = epoch;
  return rest;
};

/**
 * THE STORE OF EVERYTHING: the archive's ops behind the horizon, which must
 * reach back to seq 0 without a gap — a record made and removed in a gap
 * would be judged by nothing — then the store's tail, every epoch, and the
 * graph the store holds now.
 */
function wholeOf<S extends AnySchema>(store: Store<S>, archive: ArchivedOps): Store<S> {
  const log = store.log;
  const horizon = log.horizon;
  const tail = log.all();
  let kept = WHOLE.get(archive);
  if (!kept) WHOLE.set(archive, (kept = new WeakMap()));
  const held = kept.get(store);
  if (held && held.length === log.length && held.horizon === horizon && held.last === tail.at(-1)) return held.store as unknown as Store<S>;

  const behind = new Map<number, Operation>();
  for (const op of archive.ops) if (Number.isInteger(op?.seq) && op.seq >= 0 && op.seq < horizon && !behind.has(op.seq)) behind.set(op.seq, op);
  const ops: Operation[] = [];
  for (let seq = 0; seq < horizon; seq++) {
    const op = behind.get(seq);
    if (!op) {
      throw new RangeError(
        `The archive is missing the change at seq ${seq}: a seat's view of the archive is judged from the whole history, and without it a record made and removed there could be named to a seat that may not see it`,
      );
    }
    ops.push(op);
  }
  ops.push(...tail);
  const epochs = new Map<number, Epoch>();
  for (const epoch of archive.epochs ?? []) if (Number.isInteger(epoch?.seq) && epoch.seq < horizon && epoch.base && !epochs.has(epoch.seq)) epochs.set(epoch.seq, unmarked(epoch));
  for (const epoch of log.epochs()) epochs.set(epoch.seq, unmarked(epoch));

  const inside = store as unknown as Opened<S>;
  // The store's own class, so this module imports none of it (`seat-of.ts` says why).
  const Made = store.constructor as new (options: StoreOptions<S>) => Store<S>;
  const whole = new Made({
    schema: store.schema,
    invariants: inside.invariants,
    invariantOptions: inside.invariantOptions,
    ...given("policy", store.policy),
    ...given("modules", inside.declaredModules),
    ...given("enabledModules", inside.startingModules),
    ...given("timeZone", store.timeZone),
    principal: inside.by,
    log: ops,
    epochs: [...epochs.values()].sort((a, b) => a.seq - b.seq),
    snapshot: store.graph.snapshot(),
    validate: false,
    now: inside.now,
  });
  kept.set(store, { length: log.length, horizon, last: tail.at(-1), store: whole as unknown as Store<AnySchema> });
  return whole;
}

/**
 * THE ARCHIVE OF A RANGE AS ONE SEAT MAY SEE IT (FR-198): for seqs `from`
 * up to but not including `to`, the ops and the epochs `archive` holds —
 * what `store.compact` returned, every compaction's together, with its ops
 * from seq 0 to the store's horizon — judged for `principal` under the
 * store's policy and modules as its view of the whole history judges:
 *
 *   - every op of the range at its seq, one that touched what the seat may
 *     not see withheld and none naming such a record anywhere (FR-16,
 *     FR-55) — the same ops `logSeenBy` serves the seat of a store that was
 *     never compacted;
 *   - every epoch in the range, its graph the records the seat is served
 *     then, as its sight shows them (kinds, `own`, `via`, the fields a
 *     sight hides, a field naming a record it may not see cleared or the
 *     record withheld), the links between those, and who made each only
 *     for those.
 *
 * The answer is a `HistoryHost.archived` answer, and a seat's playback
 * folding from its epochs draws only what the seat may see. `store` is the
 * app as it stands, compacted or not (a seat's view is read as the store
 * behind it). An archive with a gap behind the horizon is refused, since
 * what the gap held could not be judged.
 */
export function archivedSeenBy<S extends AnySchema>(store: Store<S>, archive: ArchivedOps, principal: Principal, range: { readonly from: number; readonly to: number }): ArchivedSeen {
  const seat = seatOf(store);
  if (seat) return archivedSeenBy(seat.store, archive, principal, range);
  const { from, to } = range;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) throw new RangeError(`No range from seq ${from} to seq ${to}`);
  const view = wholeOf(store, archive).seenBy(principal);
  const ops = view.log.all();
  return {
    ops: ops.slice(Math.min(from, ops.length), Math.min(to, ops.length)),
    epochs: view.log.epochs().filter((epoch) => epoch.seq >= from && epoch.seq < to),
  };
}
