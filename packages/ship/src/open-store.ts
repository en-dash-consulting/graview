import {
  assertReadable,
  formatStamp,
  OperationLog,
  snapshotHash,
  Store,
  type AnySchema,
  type CompactOptions,
  type Epoch,
  type GraviewApp,
  type Operation,
  type PersistenceAdapter,
  type StoreOptions,
  type VerifyResult,
} from "@graview/core";
import { rememberArchive } from "./export.js";
import { migrateSnapshot } from "./migrations.js";
import type { StoredMeta } from "./meta.js";
import type { GraphSnapshot } from "./snapshot.js";

/**
 * ONE declaration plus ONE adapter is a running deployment.
 *
 * `openStore` is the lifecycle every deployment repeats and no app should
 * write: load what was stored, migrate it forward (the run recorded as
 * ordinary operations in the persisted log), fold it into a live store, and
 * keep the adapter current — every applied diff appends its operations and
 * rewrites the snapshot, so a crash loses nothing that was ever notified.
 */

export interface OpenStoreOptions<S extends AnySchema> {
  readonly app: GraviewApp<S>;
  readonly adapter: PersistenceAdapter<string> & {
    loadMeta?(scope: string): StoredMeta | null;
    saveMeta?(scope: string, meta: StoredMeta): void;
  };
  readonly scope?: string;
  /** First-run data when nothing is stored yet. */
  readonly seed?: GraphSnapshot;
  /**
   * The version of a stored graph that predates version metadata. Absent,
   * a metaless store is assumed CURRENT — the conservative reading, since
   * migrating data that is already new-shaped corrupts it.
   */
  readonly assumeVersion?: number;
  /** Told when a persistence write fails; absent, failures reach the console. */
  readonly onPersistError?: (error: unknown) => void;
  /**
   * Discard what is stored for this scope and start from the seed. The
   * way back to the example for a demo that has been edited into a corner —
   * a graph you cannot leave teaches distrust. Everything stored is deleted
   * first, so the seed really is the first load again.
   */
  readonly fresh?: boolean;
  /**
   * Prove the stored graph against its log on open (FR-20). When the two
   * disagree, the graph is rebuilt from the log, saved, and the opened
   * store says so in `rebuilt`. A log that does not fold at all cannot be
   * rebuilt from, and the open throws rather than trusting either.
   */
  readonly verify?: boolean;
  /**
   * Overrides for the store. The declaration's own policy and modules are
   * applied before these, so an app that declares who may do what gets it
   * enforced by the store ship opens without saying so twice.
   */
  readonly storeOptions?: Partial<StoreOptions<S>>;
  /**
   * THE MODULES THIS WORKSPACE HAS ON (FR-12): the host's word, usually
   * what the workspace pays for. The store opens with the set its log last
   * said, and when this differs, turning the difference off or on is
   * written as an op authored `system · modules` — in the history like any
   * change — before the store is handed back. Absent, the log's word
   * stands, and every module when it never said one.
   */
  readonly enabledModules?: readonly string[];
}

/*
 * ONE WRITER PER SCOPE. Nothing here locks: two opens of the same scope
 * would interleave sequence numbers and overwrite each other's snapshots.
 * A deployment owns its scope the way a process owns its port.
 */

export interface OpenedStore<S extends AnySchema> {
  readonly store: Store<S>;
  /** Operations the opening appended: the migration run, when one happened. */
  readonly migrated: readonly Operation[];
  /**
   * The epoch this opening began (FR-27), when it began one: the seed a new
   * scope starts from, the graph a migration run left (with the change in
   * a sentence), or what a store from before epochs held.
   */
  readonly epoch?: Epoch;
  /** What verifying on open found, when `verify` was asked for. */
  readonly verified?: VerifyResult;
  /**
   * The graph was rebuilt from the log because the stored one disagreed:
   * the hash it had (`from`), the hash it has now (`to`), and the op after
   * which the stored graph had drifted, when one could be named.
   */
  readonly rebuilt?: { readonly from: string; readonly to: string; readonly divergedAfter?: string };
  /** Resolves when every write accepted so far has settled on the adapter. */
  flush(): Promise<void>;
  /** Stops persisting. The store keeps working; nothing further is written. */
  close(): void;
  /**
   * COMPACTS THE LOG BEHIND AN UNDO HORIZON (FR-23). The checkpoint
   * `store.checkpoint(options)` makes (by default: keep the last 90 days
   * and the last 1000 ops, whichever keeps more) becomes the horizon; the
   * adapter archives the ops and epochs before it, then the store lets go
   * of them. The next open loads the checkpoint and the tail, undo stops at
   * the horizon and says so, and `exportBundle(app, store, { full: true })`
   * still carries everything. Settles after every write accepted before
   * it. Refused by an adapter that keeps no archive.
   */
  compact(options?: CompactOptions): Promise<Compaction>;
}

/** What `compact` did: where the log now begins, and how many ops it archived (0 when nothing was old enough). */
export interface Compaction {
  readonly horizon: number;
  readonly archived: number;
  /** The checkpoint that became the horizon, when one did. */
  readonly checkpoint?: Epoch;
}

export async function openStore<S extends AnySchema>(
  options: OpenStoreOptions<S>,
): Promise<OpenedStore<S>> {
  const { app, adapter } = options;
  const scope = options.scope ?? app.name;

  if (options.fresh) await adapter.delete(scope);
  const stored = (await adapter.load(scope)) as GraphSnapshot | null;
  const persisted = (await adapter.loadLog?.(scope)) ?? [];
  const epochs: Epoch[] = (await adapter.loadEpochs?.(scope)) ?? [];
  /*
   * A COMPACTED LOG BEGINS AT ITS HORIZON (FR-23): the adapter hands over
   * the checkpoint and the ops from its seq on, and nothing older is read.
   */
  const checkpoint = [...epochs].reverse().find((epoch) => epoch.horizon);
  const horizon = checkpoint?.seq ?? 0;
  let seq = horizon + persisted.length;

  const meta = adapter.loadMeta?.(scope) ?? null;
  /*
   * A SNAPSHOT IN A NEWER FORMAT IS NOT FOLDED (FR-31). A rolled-back
   * framework meeting what its successor wrote says so — the host refolds
   * from the log or rolls forward — rather than reading a shape it does not
   * know and writing its misreading back.
   */
  if (stored !== null) assertReadable(meta);
  const target = app.version ?? 1;
  /*
   * THE LOG OUTRANKS THE META. A crash between writing the migrated
   * snapshot and stamping the version leaves new-shaped data under an old
   * stamp — and re-running a migration over already-migrated data is the
   * exact corruption migrations exist to prevent. The migration ops are in
   * the log before anything else is written, so the log knows the truth.
   */
  const migratedTo = persisted
    .filter((op) => op.author.kind === "system" && op.author.id === "ship:migration")
    .map((op) => Number(op.intent.match(/migration \d+→(\d+):/)?.[1] ?? 0))
    .reduce((highest, version) => Math.max(highest, version), 0);
  const storedVersion =
    stored === null
      ? target
      : // A migration run behind the horizon is archived; the checkpoint still says the version it stood at.
        Math.max(meta?.version ?? options.assumeVersion ?? target, migratedTo, checkpoint?.version ?? 0);

  let snapshot: GraphSnapshot = stored ?? options.seed ?? { nodes: [], edges: [] };
  let migrated: readonly Operation[] = [];
  if (storedVersion < target) {
    const run = migrateSnapshot(app, snapshot, storedVersion);
    snapshot = run.snapshot;
    migrated = run.ops.map((op) => ({ ...op, seq: seq++ }));
    await adapter.appendOps?.(scope, migrated);
  }

  /*
   * EACH DECLARATION VERSION BEGINS AN EPOCH (FR-27): a base graph and the
   * seq the log folds onto it from. A new scope begins one at its seed,
   * which was never an operation. A migration run begins one at the graph
   * it left, naming the change, so the log verifies from there and undo
   * does not reach back across it. A store from before epochs begins one
   * at what it holds — from empty, when its whole log folds to it, since
   * then the whole history is proof — and is verifiable from then on.
   * Recorded straight after the migration's ops, before the snapshot: a
   * crash between the two leaves a stale snapshot that verifying finds.
   */
  const at = new Date().toISOString();
  let epoch: Epoch | undefined;
  if (migrated.length > 0) {
    epoch = { seq, base: snapshot, version: target, change: migrated.map((op) => op.intent).join("; "), at };
  } else if (stored === null) {
    epoch = { seq, base: snapshot, version: target, at };
  } else if (epochs.length === 0 && adapter.saveEpochs) {
    /*
     * Adopted once, where it can be kept: folding the whole log and hashing
     * it is the cost of proving a store from before epochs, and an adapter
     * that cannot keep the result would pay it on every open — a page with
     * two thousand talks did, and the gauntlet took five times as long.
     */
    epoch = foldsFromEmpty(app.schema, persisted, stored)
      ? { seq: 0, base: { nodes: [], edges: [] }, version: storedVersion, at }
      : { seq, base: stored, version: storedVersion, at };
  }
  if (epoch) {
    epochs.push(epoch);
    await adapter.saveEpochs?.(scope, epochs);
  }

  /*
   * The store REOPENS WITH ITS HISTORY. The snapshot is the graph; the
   * persisted log (plus the migration run just appended) is how it got
   * there — and it is handed to the store as the live log rather than
   * folded, because the seed was never an operation. What was done in an
   * earlier session is therefore still attributed, still in the activity,
   * and still undoable, which is what "persistence is the op log" means.
   */
  const history: Operation[] = [...persisted, ...migrated];

  /*
   * Ids that cannot collide with an earlier session's. The store's default
   * counter restarts at op1 every open, and an undo names its target BY ID —
   * a second "op1" would make the log ambiguous about what was taken back.
   * A supplied `ids` still wins.
   */
  const taken = new Set(history.map((op) => op.id));
  // Counting the archived ops too (FR-23): their ids are not here to collide with, but they are taken.
  let n = horizon + history.length;
  const ids = () => {
    let id = `op${++n}`;
    while (taken.has(id)) id = `op${++n}`;
    taken.add(id);
    return id;
  };

  /* A starting set given here is the host's word too, and is recorded below rather than assumed. */
  const storeOptions: Partial<StoreOptions<S>> = { ...(options.storeOptions ?? {}) };
  delete (storeOptions as { enabledModules?: unknown }).enabledModules;
  const store = new Store<S>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    ...(app.modules ? { modules: app.modules } : {}),
    ...(app.policy ? { policy: app.policy } : {}),
    /* The allowlist travels with the declaration, so a deployment enforces
       what the app said an agent was for without being asked to. */
    ...(app.intelligence ? { intelligence: app.intelligence } : {}),
    snapshot,
    log: history,
    epochs,
    ids,
    // A stored history is read back later, so its timestamps are real ones.
    now: () => new Date().toISOString(),
    ...storeOptions,
  });

  /*
   * A STORE OPENED TO VERIFY PROVES ITS GRAPH AGAINST ITS LOG (FR-20). A
   * drifted snapshot — a write that landed without its ops, an edit by hand
   * — is replaced by what the log folds to, which is the record, and the
   * opening says what it did. A log that does not fold is not a record to
   * rebuild from: nothing is replaced, and the open refuses.
   */
  const verified = options.verify ? store.verify() : undefined;
  let rebuilt: OpenedStore<S>["rebuilt"];
  if (verified && !verified.ok) {
    let folded: GraphSnapshot;
    try {
      const from = store.log.lastEpoch();
      folded = store.log.fold(app.schema, { validate: options.storeOptions?.validate ?? true, ...(from ? { from } : {}) }).snapshot();
    } catch {
      throw new Error(`graview ship: "${scope}" does not verify, and its log cannot be rebuilt from. ${verified.reason} Nothing was rebuilt.`);
    }
    store.graph.load(folded as never);
    rebuilt = {
      from: verified.actual,
      to: verified.expected,
      ...(verified.divergedAfter !== undefined ? { divergedAfter: verified.divergedAfter } : {}),
    };
  }

  /*
   * Write at open only when opening CHANGED something — a fresh scope, a
   * rebuild or a migration run. A store opens over records that no longer
   * fit and holds them exactly as stored (FR-28); writing them straight back
   * would only churn the file, and `store.findings()` is how a host hears
   * about them.
   */
  if (stored === null || migrated.length > 0 || rebuilt) {
    await adapter.save(scope, store.snapshot());
  }
  adapter.saveMeta?.(scope, { version: target, ...formatStamp() });

  /*
   * Writes are SERIALIZED: a second diff's ops never land before the
   * first's snapshot, and a failure is reported rather than swallowed —
   * an app that thinks it persisted and did not is the worst quiet state.
   */
  const report = options.onPersistError ?? ((error: unknown) => console.error("graview ship: persistence failed", error));
  let writing: Promise<void> = Promise.resolve();
  const unsubscribe = store.subscribe((_diff, ops) => {
    const stamped = ops.map((op) => ({ ...op, seq: seq++ }));
    writing = writing
      .then(async () => {
        await adapter.appendOps?.(scope, stamped);
        await adapter.save(scope, store.snapshot());
      })
      .catch(report);
  });

  /* The host's word on modules, recorded where it changes the log's (FR-12). */
  const enabledModules = options.enabledModules ?? options.storeOptions?.enabledModules;
  if (enabledModules !== undefined) store.setEnabledModules(enabledModules);
  // A full export of this store reads what a normal open did not load (FR-23).
  const loadArchive = adapter.loadArchive?.bind(adapter);
  if (loadArchive) rememberArchive(store, () => loadArchive(scope));

  return {
    store,
    migrated,
    ...(epoch ? { epoch } : {}),
    ...(verified ? { verified } : {}),
    ...(rebuilt ? { rebuilt } : {}),
    flush: () => writing,
    close: unsubscribe,
    compact: (compactOptions) => {
      /*
       * On the write chain, after every write accepted so far, and ARCHIVE
       * FIRST: the adapter moves what is behind the checkpoint before the
       * store lets go of it, so a failed write leaves a whole log on disk
       * and a whole log in memory, never an archive that is missing ops.
       */
      const done = writing.then(async (): Promise<Compaction> => {
        if (!adapter.compact || !adapter.loadArchive) {
          throw new Error(
            `The ${adapter.name} adapter keeps no archive, so its log cannot be compacted behind an undo horizon. ` +
              "It keeps no epochs either, and a checkpoint is one: compaction is for an adapter that keeps both, as the memory, file and SQL adapters do.",
          );
        }
        const made = store.checkpoint(compactOptions);
        if (!made) return { horizon: store.log.horizon, archived: 0 };
        await adapter.compact(scope, made);
        const archived = store.compact(made);
        return { horizon: store.log.horizon, archived: archived.ops.length, checkpoint: made };
      });
      writing = done.then(
        () => undefined,
        () => undefined,
      );
      return done;
    },
  };
}

/** Whether a log with no epochs folds from empty to exactly what is stored. */
function foldsFromEmpty(schema: AnySchema, ops: readonly Operation[], stored: GraphSnapshot): boolean {
  try {
    return snapshotHash(OperationLog.from(ops).fold(schema).snapshot()) === snapshotHash(stored);
  } catch {
    return false;
  }
}
