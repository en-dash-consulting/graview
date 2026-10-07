import { assertReadable, formatStamp, type AnySchema, type FormatStamp, type GraviewApp, type LogArchive, type Operation, type Store } from "@graview/core";
import type { GraphSnapshot } from "./snapshot.js";

/**
 * THE ANTI-LOCK-IN CLAIM, as a data shape. Everything a deployment is —
 * the graph, its whole attributed history, and the version it stands at —
 * leaves in one JSON-serializable bundle, and re-imports into any other
 * deployment of the same declaration: hosted to self-hosted and back.
 * A tenant who cannot leave was never a customer, only a hostage.
 */
export interface AppBundle {
  readonly format: "graview-bundle";
  readonly bundleVersion: 1;
  readonly app: string;
  readonly version: number;
  readonly exportedAt: string;
  /** The framework that wrote it, and the formats of its snapshot and ops (FR-31). Absent: 0.1.0, format 1. */
  readonly framework?: string;
  readonly formats?: FormatStamp["formats"];
  readonly snapshot: GraphSnapshot;
  readonly log: readonly Operation[];
  /**
   * The seq `log` begins at, when the store was compacted behind an undo
   * horizon and the export left the archive out (FR-23). Absent, the log
   * is the whole history from seq 0: an export with `full: true` always is.
   */
  readonly horizon?: number;
}

export interface ExportOptions {
  /** The persisted log, when the caller has one; the store's own otherwise. */
  readonly log?: readonly Operation[];
  readonly now?: () => string;
}

/*
 * WHERE EACH OPENED STORE'S ARCHIVE IS (FR-23). `openStore` says, for a
 * store over an adapter that keeps one, so a full export of that store can
 * read what a normal open never loaded.
 */
const ARCHIVES = new WeakMap<object, () => Promise<LogArchive>>();

/** Tells `exportBundle` where a store's archive is read from. `openStore` calls it. */
export function rememberArchive(store: object, load: () => Promise<LogArchive>): void {
  ARCHIVES.set(store, load);
}

/**
 * The bundle of a store. With `full: true` it is the WHOLE history (FR-23):
 * the ops a compaction archived, read from the adapter `openStore` opened
 * the store on, in front of the ops the store holds — a promise, since the
 * archive is read when asked for. Without it, the log is what the store
 * holds, and a compacted store's bundle says where it begins (`horizon`).
 */
export function exportBundle<S extends AnySchema>(app: GraviewApp<S>, store: Store<S>, options?: ExportOptions & { readonly full?: false }): AppBundle;
export function exportBundle<S extends AnySchema>(app: GraviewApp<S>, store: Store<S>, options: ExportOptions & { readonly full: true }): Promise<AppBundle>;
export function exportBundle<S extends AnySchema>(
  app: GraviewApp<S>,
  store: Store<S>,
  options: ExportOptions & { readonly full?: boolean } = {},
): AppBundle | Promise<AppBundle> {
  // The persisted log when the caller has one (it holds migration runs and
  // prior sessions); the in-memory log otherwise.
  const log = options.log ?? store.log.all();
  const bundle = (log: readonly Operation[], horizon: number): AppBundle => ({
    format: "graview-bundle",
    bundleVersion: 1,
    app: app.name,
    version: app.version ?? 1,
    exportedAt: (options.now ?? (() => new Date().toISOString()))(),
    ...formatStamp(),
    snapshot: store.snapshot() as GraphSnapshot,
    log,
    ...(horizon > 0 ? { horizon } : {}),
  });
  const horizon = log[0]?.seq ?? store.log.horizon;
  if (!options.full) return bundle(log, horizon);
  if (horizon === 0) return Promise.resolve(bundle(log, 0));
  const archive = ARCHIVES.get(store);
  if (!archive) {
    return Promise.reject(
      new Error(`This store's log was compacted at seq ${horizon} and its archive is not reachable from here: export the store openStore opened, whose adapter keeps the archive.`),
    );
  }
  return archive().then((archived) => {
    const before = archived.ops.filter((op) => op.seq < horizon);
    const whole = [...before, ...log];
    const gap = whole.findIndex((op, index) => op.seq !== index);
    if (gap >= 0) throw new Error(`The archive does not reach back to seq 0 without a gap: seq ${gap} is missing, so this export would not be the whole history.`);
    return bundle(whole, 0);
  });
}

/** Refuses a bundle for a different app or a newer format, plainly. */
export function assertBundle<S extends AnySchema>(app: GraviewApp<S>, bundle: AppBundle): void {
  if (bundle.format !== "graview-bundle") {
    throw new Error(`Not a graview bundle (format "${(bundle as { format?: string }).format}")`);
  }
  if (bundle.bundleVersion > 1) {
    throw new Error(
      `Bundle format ${bundle.bundleVersion} is newer than this ship understands (1). Upgrade @graview/ship, then import.`,
    );
  }
  // A snapshot or ops in a newer format than this framework reads: said, never misread (FR-31).
  assertReadable(bundle);
  if (bundle.app !== app.name) {
    throw new Error(`This bundle is for "${bundle.app}", not "${app.name}"`);
  }
  if (bundle.version > (app.version ?? 1)) {
    throw new Error(
      `Bundle is at version ${bundle.version}; this declaration only reaches ${app.version ?? 1}. ` +
        `Upgrade the app, then import.`,
    );
  }
}
