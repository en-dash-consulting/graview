import {
  assertReadable,
  formatStamp,
  Store,
  type AnySchema,
  type GraviewApp,
  type Operation,
  type PersistenceAdapter,
  type StoreOptions,
  type VerifyResult,
} from "@graview/core";
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
}

export async function openStore<S extends AnySchema>(
  options: OpenStoreOptions<S>,
): Promise<OpenedStore<S>> {
  const { app, adapter } = options;
  const scope = options.scope ?? app.name;

  if (options.fresh) await adapter.delete(scope);
  const stored = (await adapter.load(scope)) as GraphSnapshot | null;
  const persisted = (await adapter.loadLog?.(scope)) ?? [];
  let seq = persisted.length;

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
      : Math.max(meta?.version ?? options.assumeVersion ?? target, migratedTo);

  let snapshot: GraphSnapshot = stored ?? options.seed ?? { nodes: [], edges: [] };
  let migrated: readonly Operation[] = [];
  if (storedVersion < target) {
    const run = migrateSnapshot(app, snapshot, storedVersion);
    snapshot = run.snapshot;
    migrated = run.ops.map((op) => ({ ...op, seq: seq++ }));
    await adapter.appendOps?.(scope, migrated);
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
  let n = history.length;
  const ids = () => {
    let id = `op${++n}`;
    while (taken.has(id)) id = `op${++n}`;
    taken.add(id);
    return id;
  };

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
    ids,
    // A stored history is read back later, so its timestamps are real ones.
    now: () => new Date().toISOString(),
    ...(options.storeOptions ?? {}),
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
      folded = store.log.fold(app.schema, { validate: options.storeOptions?.validate ?? true }).snapshot();
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
   * rebuild or a migration run. Re-saving an untouched store rewrites the snapshot
   * through the current schema's parse, which silently strips any field a
   * rolled-back declaration does not know — data loss with no prior copy.
   */
  if (stored === null || migrated.length > 0 || rebuilt) {
    await adapter.save(scope, store.snapshot());
  }
  adapter.saveMeta?.(scope, { version: target, ...formatStamp() });

  /*
   * Writes are SERIALISED: a second diff's ops never land before the
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

  return {
    store,
    migrated,
    ...(verified ? { verified } : {}),
    ...(rebuilt ? { rebuilt } : {}),
    flush: () => writing,
    close: unsubscribe,
  };
}
