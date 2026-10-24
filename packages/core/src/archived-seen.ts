/**
 * THE ARCHIVE AS ONE SEAT MAY SEE IT (FR-198): what a host answers
 * `HistoryHost.archived(from, to)` with for a seat, judged as the seat's
 * own view of the whole history judges — its ops redacted as `logSeenBy`
 * redacts them, and its epochs' graphs served as `seenBy` serves an epoch:
 * the records the seat may see, the fields its sight shows of them, the
 * links between them, and who made only those.
 *
 * WHY FROM WHERE THE ARCHIVE BEGINS. A compacted store's seat view judges
 * from the checkpoint and the tail: the checkpoint keeps what kind each
 * record removed behind the horizon was (FR-199), which is enough for the
 * graph and the tail, but an archived op is judged at its own moment — who
 * it touched, linked and named then, and who had written each field —
 * which only the ops before it say. So the seat is judged here over a
 * store of everything the archive holds: its ops from where it begins, the
 * store's tail after them, every epoch, and the graph as it stands now —
 * the same judgment the seat's live log is served by, so the past it folds
 * from these epochs and ops meets the present it is served.
 *
 * An archive begins at seq 0, or AT AN EPOCH (FR-214) that keeps what was
 * removed behind it and who wrote what (`removed`, `writers`): a host that
 * keeps a plan's window of history makes one where the window begins
 * (`archiveFrom`), deletes what lies behind it and keeps the one epoch, and
 * the ops after it are judged as a compacted store judges its tail.
 *
 * Apart from the store and the page: a host's server reads it, so it is on
 * `@graview/core/seat`, and imports nothing of the store's or the seat
 * view's modules — it makes the whole store with the store's own class.
 */
import type { ArchivedOps } from "./history.js";
import type { EvaluateOptions, InvariantDefinition } from "./invariants/types.js";
import type { ModuleMap } from "./modules.js";
import type { Epoch, LogArchive } from "./ops/log.js";
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
  /**
   * WHERE THE ARCHIVE BEGINS, when the range reaches behind it (FR-214):
   * the seq of the epoch it begins at, before which it holds no op — the
   * answer's `ArchivedOps.keptFrom`, so playback steps the past behind it
   * by the epochs it kept rather than say it was refused.
   */
  readonly keptFrom?: number;
}

/** What a store keeps to itself that the whole store is made with, as `@graview/core/past` reads it. */
interface Opened<S extends AnySchema> {
  readonly invariants: readonly InvariantDefinition<S>[];
  readonly invariantOptions: EvaluateOptions<S>;
  readonly declaredModules: ModuleMap | undefined;
  readonly startingModules: readonly string[] | undefined;
  readonly by: Author | Principal;
  readonly validate: boolean;
  readonly now: () => string;
}

/** The store of the whole history made for one archive and one store, kept while the store's log is the one it was made from. */
type Whole = { readonly length: number; readonly horizon: number; readonly last: Operation | undefined; readonly validate: boolean; readonly store: Store<AnySchema> };
const WHOLE = new WeakMap<object, WeakMap<object, Whole>>();

const given = <K extends string, V>(key: K, value: V | undefined) => (value === undefined ? {} : { [key]: value }) as { readonly [P in K]?: V };

/** An epoch as it stands in a whole log: an earlier checkpoint is no horizon there. */
const unmarked = (epoch: Epoch): Epoch => {
  if (!epoch.horizon) return epoch;
  const { horizon: _horizon, ...rest } = epoch;
  return rest;
};

/** Where an archive begins: seq 0, or the epoch that keeps what lay behind it; and its ops behind the horizon by seq. */
interface Beginning {
  readonly seq: number;
  readonly epoch: Epoch | undefined;
  readonly behind: ReadonlyMap<number, Operation>;
}

/**
 * WHERE AN ARCHIVE BEGINS (FR-214): seq 0 when its ops reach back there
 * without a gap; else the earliest epoch it holds that keeps what was
 * removed behind it (`removed`, FR-199) and from which its ops reach the
 * horizon without one. An archive with neither is refused, naming the
 * newest change missing: a record made and removed there would be judged
 * by nothing.
 */
function beginningOf(archive: ArchivedOps, horizon: number): Beginning {
  const behind = new Map<number, Operation>();
  for (const op of archive.ops) if (Number.isInteger(op?.seq) && op.seq >= 0 && op.seq < horizon && !behind.has(op.seq)) behind.set(op.seq, op);
  let reached = horizon;
  while (reached > 0 && behind.has(reached - 1)) reached--;
  if (reached === 0) return { seq: 0, epoch: undefined, behind };
  const epoch = (archive.epochs ?? [])
    .filter((one) => Number.isInteger(one?.seq) && one.seq >= reached && one.seq <= horizon && one.base && one.removed !== undefined)
    .sort((a, b) => a.seq - b.seq)[0];
  if (!epoch) {
    throw new RangeError(
      `The archive is missing the change at seq ${reached - 1}, and no epoch after it keeps what was removed behind it: a seat's view of the archive is judged from where it begins, and without it a record made and removed there could be named to a seat that may not see it`,
    );
  }
  return { seq: epoch.seq, epoch, behind };
}

/**
 * THE STORE OF EVERYTHING THE ARCHIVE HOLDS: its ops from where it begins
 * — seq 0, or the epoch that keeps what lay behind it, which the store
 * begins at as a compacted store begins at its checkpoint — then the
 * store's tail, every epoch after the beginning, and the graph the store
 * holds now.
 */
function wholeOf<S extends AnySchema>(store: Store<S>, archive: ArchivedOps, validate = false): Store<S> {
  const log = store.log;
  const horizon = log.horizon;
  const tail = log.all();
  let kept = WHOLE.get(archive);
  if (!kept) WHOLE.set(archive, (kept = new WeakMap()));
  const held = kept.get(store);
  if (held && held.length === log.length && held.horizon === horizon && held.last === tail.at(-1) && held.validate === validate) return held.store as unknown as Store<S>;

  const begins = beginningOf(archive, horizon);
  const ops: Operation[] = [];
  for (let seq = begins.seq; seq < horizon; seq++) ops.push(begins.behind.get(seq)!);
  ops.push(...tail);
  const epochs = new Map<number, Epoch>();
  // The epoch it begins at is its checkpoint, as a compacted store's is: what was removed and written behind it is judged by.
  if (begins.epoch) epochs.set(begins.seq, { ...begins.epoch, horizon: true });
  for (const epoch of archive.epochs ?? []) if (Number.isInteger(epoch?.seq) && epoch.seq >= begins.seq && epoch.seq < horizon && epoch.base && !epochs.has(epoch.seq)) epochs.set(epoch.seq, unmarked(epoch));
  for (const epoch of log.epochs()) if (!begins.epoch || epoch.seq > begins.seq) epochs.set(epoch.seq, unmarked(epoch));

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
    validate,
    now: inside.now,
  });
  kept.set(store, { length: log.length, horizon, last: tail.at(-1), validate, store: whole as unknown as Store<AnySchema> });
  return whole;
}

/** An epoch behind where the archive begins, as the seat is served it: judged on its own, as a store opened on it alone judges it. One that keeps no `removed` cannot be, and is left out. */
function servedAlone<S extends AnySchema>(store: Store<S>, epoch: Epoch, principal: Principal): Epoch | undefined {
  if (epoch.removed === undefined) return undefined;
  const inside = store as unknown as Opened<S>;
  const Made = store.constructor as new (options: StoreOptions<S>) => Store<S>;
  const alone = new Made({
    schema: store.schema,
    ...given("policy", store.policy),
    ...given("modules", inside.declaredModules),
    ...given("enabledModules", inside.startingModules),
    principal: inside.by,
    log: [],
    epochs: [{ ...epoch, horizon: true }],
    snapshot: epoch.base as never,
    validate: false,
    now: inside.now,
  });
  return unmarked(alone.seenBy(principal).log.epochs()[0]!);
}

/**
 * THE ARCHIVE OF A RANGE AS ONE SEAT MAY SEE IT (FR-198): for seqs `from`
 * up to but not including `to`, the ops and the epochs `archive` holds —
 * what `store.compact` returned, every compaction's together, with its ops
 * from seq 0 (or from the epoch it begins at, FR-214) to the store's
 * horizon — judged for `principal` under the store's policy and modules as
 * its view of the whole history judges:
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
 * behind it). A range that reaches behind the epoch an archive begins at
 * is answered with no op there and `keptFrom`, the epoch's seq, with the
 * epochs before it that keep what was removed behind them, each judged on
 * its own. An archive with a gap and no such epoch after it is refused,
 * since what the gap held could not be judged.
 */
export function archivedSeenBy<S extends AnySchema>(store: Store<S>, archive: ArchivedOps, principal: Principal, range: { readonly from: number; readonly to: number }): ArchivedSeen {
  const seat = seatOf(store);
  if (seat) return archivedSeenBy(seat.store, archive, principal, range);
  const { from, to } = range;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) throw new RangeError(`No range from seq ${from} to seq ${to}`);
  const view = wholeOf(store, archive).seenBy(principal);
  const begins = view.log.horizon;
  const ops = view.log.all();
  const at = (seq: number) => Math.min(Math.max(seq - begins, 0), ops.length);
  const epochs = view.log.epochs().filter((epoch) => epoch.seq >= from && epoch.seq < to);
  if (from >= begins) return { ops: ops.slice(at(from), at(to)), epochs };
  const earlier = (archive.epochs ?? [])
    .filter((epoch) => Number.isInteger(epoch?.seq) && epoch.seq >= from && epoch.seq < Math.min(to, begins) && epoch.base)
    .sort((a, b) => a.seq - b.seq)
    .flatMap((epoch) => servedAlone(store, epoch, principal) ?? []);
  return { ops: ops.slice(at(from), at(to)), epochs: [...earlier, ...epochs], keptFrom: begins };
}

/**
 * THE ARCHIVE FROM AN EPOCH AT `seq` (FR-214): what a host keeps when it
 * keeps a plan's window of history — the epoch the app stood at there,
 * keeping who made each record behind it, what each record removed behind
 * it was and who wrote each field naming a record (`creators`, `removed`,
 * `writers`, FR-199), then the ops and the epochs `archive` holds from it
 * to the store's horizon. Everything behind it can be deleted: an archive
 * that begins at the epoch serves a seat every range after it as the whole
 * one did (`archivedSeenBy`), and makes the same epoch again later.
 *
 * `seq` is any seq from where `archive` begins to the store's horizon,
 * moved back to the start of the gesture it would split, as a checkpoint
 * is (`store.checkpoint`); the epoch says where it landed. At the horizon
 * it is the store's own checkpoint made again from the archive — how a
 * host mends a checkpoint written before it kept `removed` and `writers`.
 * Before the epoch an archive begins at, what made the records is gone,
 * and it is refused.
 */
export function archiveFrom<S extends AnySchema>(store: Store<S>, archive: ArchivedOps, seq: number): LogArchive {
  const seat = seatOf(store);
  if (seat) return archiveFrom(seat.store, archive, seq);
  const horizon = store.log.horizon;
  if (!Number.isInteger(seq) || seq < 0 || seq > horizon) throw new RangeError(`No epoch at seq ${seq}: an archive holds the seqs before the horizon at seq ${horizon}`);
  // Folded as the store folds a checkpoint it makes, so a default filled in on the way in is in the epoch.
  const whole = wholeOf(store, archive, (store as unknown as Opened<S>).validate);
  const begins = whole.log.horizon;
  if (seq < begins) throw new RangeError(`The archive begins at seq ${begins}: no epoch before it can be made, since what made the records there is gone`);
  // Where the archive begins is its own beginning: the epoch that keeps all it must, or the app before anything was made.
  const beginning = (): Epoch => {
    if (begins > 0) return whole.log.epochs()[0]!;
    const { creators: _creators, removed: _removed, writers: _writers, ...start } = whole.log.checkpointAt(whole.schema, 0, { validate: (store as unknown as Opened<S>).validate });
    return { ...start, removed: {} };
  };
  const epoch = (seq > begins ? whole.checkpoint({ seq }) : undefined) ?? beginning();
  const ops = [...beginningOf(archive, horizon).behind.values()].filter((op) => op.seq >= epoch.seq).sort((a, b) => a.seq - b.seq);
  const epochs = (archive.epochs ?? []).filter((one) => Number.isInteger(one?.seq) && one.seq > epoch.seq && one.seq < horizon && one.base).sort((a, b) => a.seq - b.seq);
  return { ops, epochs: [epoch, ...epochs] };
}
