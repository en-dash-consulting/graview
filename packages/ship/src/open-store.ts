import {
  Store,
  type AnySchema,
  type GraviewApp,
  type Operation,
  type PersistenceAdapter,
  type StoreOptions,
} from "@graview/core";
import { migrateSnapshot } from "./migrations.js";
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
    loadMeta?(scope: string): { version: number } | null;
    saveMeta?(scope: string, meta: { version: number }): void;
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

  const stored = (await adapter.load(scope)) as GraphSnapshot | null;
  const persisted = (await adapter.loadLog?.(scope)) ?? [];
  let seq = persisted.length;

  const meta = adapter.loadMeta?.(scope) ?? null;
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

  const store = new Store<S>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    ...(app.modules ? { modules: app.modules } : {}),
    snapshot: snapshot as never,
    ...(options.storeOptions ?? {}),
  });

  /*
   * Write at open only when opening CHANGED something — a fresh scope or a
   * migration run. Re-saving an untouched store rewrites the snapshot
   * through the current schema's parse, which silently strips any field a
   * rolled-back declaration does not know — data loss with no prior copy.
   */
  if (stored === null || migrated.length > 0) {
    await adapter.save(scope, store.snapshot());
  }
  adapter.saveMeta?.(scope, { version: target });

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

  return { store, migrated, flush: () => writing, close: unsubscribe };
}
