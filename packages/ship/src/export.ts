import { assertReadable, bareOp, CREATED_BY, formatStamp, UPDATED_BY, unseatedOp, unseatedSnapshot, type AnySchema, type Epoch, type FormatStamp, type GraviewApp, type LogArchive, type Operation, type Store } from "@graview/core";
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
   * horizon and the export left the archive out (FR-23), or the archive
   * itself begins at an epoch (FR-214). Absent, the log is the whole
   * history from seq 0.
   */
  readonly horizon?: number;
  /**
   * THE EPOCH `log` BEGINS AT, when it begins past seq 0 (FR-214): the
   * store's checkpoint, or the epoch its archive begins at — the graph
   * then, and what it keeps of the records behind it (`creators`,
   * `removed`, `writers`). A host restores the bundle as a compacted store
   * opened on it: `log`, with this as its one epoch.
   */
  readonly checkpoint?: Epoch;
  /**
   * WHO CHANGED EACH RECORD, AS THE PERSON (Graview HQ
   * feature:f-system-backup-touched-by-seat-ids): for each seat a record's
   * `createdBy` or `updatedBy` names, in the snapshot, the checkpoint or a
   * record the log adds or removes, the record of the people kind it is
   * bound to, or was last bound to — `{ "acct-bud": "participant:bud" }`,
   * which may be a record since removed. The records keep the seat, so a
   * restore says the four the store kept; no restore reads this. Absent
   * where no such seat is bound to anybody.
   */
  readonly seatPeople?: Readonly<Record<string, string>>;
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
 * Where an archive begins (FR-214): seq 0 when its ops reach back there
 * without a gap, else the earliest epoch it holds that keeps what was
 * removed behind it and from which its ops reach the horizon — a host that
 * keeps a plan's window of history keeps that epoch (`archiveFrom`).
 */
function beginningOf(archived: LogArchive, horizon: number): { readonly ops: readonly Operation[]; readonly checkpoint?: Epoch } {
  const bySeq = new Map(archived.ops.filter((op) => op.seq < horizon).map((op) => [op.seq, op]));
  let reached = horizon;
  while (reached > 0 && bySeq.has(reached - 1)) reached--;
  const from = (seq: number) => Array.from({ length: horizon - seq }, (_, at) => bySeq.get(seq + at)!);
  if (reached === 0) return { ops: from(0) };
  const checkpoint = [...archived.epochs].filter((epoch) => epoch.seq >= reached && epoch.seq <= horizon && epoch.removed !== undefined).sort((a, b) => a.seq - b.seq)[0];
  if (!checkpoint) {
    throw new Error(`The archive does not reach back to seq 0 without a gap, and begins at no epoch after it: seq ${reached - 1} is missing, so this export would not be everything kept.`);
  }
  return { ops: from(checkpoint.seq), checkpoint: { ...checkpoint, horizon: true } };
}

/**
 * The bundle of a store. With `full: true` it is EVERYTHING KEPT (FR-23):
 * the ops a compaction archived, read from the adapter `openStore` opened
 * the store on, in front of the ops the store holds — a promise, since the
 * archive is read when asked for. That is the whole history from seq 0,
 * or, when the archive begins at an epoch (FR-214), the log from it with
 * the epoch as `checkpoint`. Without it, the log is what the store holds,
 * and a compacted store's bundle says where it begins (`horizon`) and the
 * checkpoint it begins at.
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
  // Who made or touched each record as the store keeps it, the seat, as an op's author is kept; the checkpoint's own map of bindings (`Epoch.bound`) stays in the installation, and the person each such seat is, is said once, as `seatPeople`.
  const withoutBindings = ({ bound: _bound, ...epoch }: Epoch): Epoch => epoch;
  const bundle = (log: readonly Operation[], horizon: number, checkpoint?: Epoch): AppBundle => {
    // No record says whose a person is: the mark that binds one stays in the installation (Roadmap f-invite-binds-existing-person).
    const snapshot = unseatedSnapshot(store.snapshot() as GraphSnapshot, { touched: "kept" });
    const begins = horizon > 0 && checkpoint?.seq === horizon ? checkpoint : undefined;
    const base = begins ? unseatedSnapshot(begins.base, { touched: "kept" }) : undefined;
    // Who made or changed each record, said once a seat as the person it is (`seatPeople`).
    const kept = log.flatMap((op) => op.primitives.flatMap((primitive) => (primitive.op === "add-node" || primitive.op === "remove-node" ? [primitive.node as object] : [])));
    const people = seatPeopleOf(store, [...snapshot.nodes, ...(base?.nodes ?? []), ...kept]);
    return {
      format: "graview-bundle",
      bundleVersion: 1,
      app: app.name,
      version: app.version ?? 1,
      exportedAt: (options.now ?? (() => new Date().toISOString()))(),
      // Snapshot format 2 when the checkpoint it begins at lies past what stood published (FR-31).
      ...formatStamp(begins),
      snapshot,
      // Stamped op format 2, and so written: a persisted or archived op from format 1 goes without an inverse its primitives already say.
      log: log.map((op) => unseatedOp(bareOp(op))),
      ...(horizon > 0 ? { horizon } : {}),
      ...(begins && base ? { checkpoint: { ...withoutBindings(begins), base } } : {}),
      ...(people ? { seatPeople: people } : {}),
    };
  };
  const horizon = log[0]?.seq ?? store.log.horizon;
  const own = store.log.epochs().find((epoch) => epoch.horizon && epoch.seq === horizon);
  if (!options.full) return bundle(log, horizon, own);
  if (horizon === 0) return Promise.resolve(bundle(log, 0));
  const archive = ARCHIVES.get(store);
  if (!archive) {
    return Promise.reject(
      new Error(`This store's log was compacted at seq ${horizon} and its archive is not reachable from here: export the store openStore opened, whose adapter keeps the archive.`),
    );
  }
  return archive().then((archived) => {
    const begins = beginningOf(archived, horizon);
    return begins.checkpoint ? bundle([...begins.ops, ...log], begins.checkpoint.seq, begins.checkpoint) : bundle([...begins.ops, ...log], 0);
  });
}

/** Each seat the records name as who made or last changed them, and the person it is or was last bound to (`AppBundle.seatPeople`); none where nobody is. */
function seatPeopleOf<S extends AnySchema>(store: Store<S>, nodes: readonly object[]): Readonly<Record<string, string>> | undefined {
  const graph = store.graph as { personSaidFor?(seat: string): string | undefined };
  const people: Record<string, string> = {};
  for (const node of nodes) {
    for (const field of [CREATED_BY, UPDATED_BY]) {
      const seat = (node as Record<string, unknown>)[field];
      if (typeof seat !== "string" || Object.hasOwn(people, seat)) continue;
      const person = graph.personSaidFor?.(seat);
      // "someone": a profile of an account that is somebody's record, or an account one of whose profiles is — no record to name.
      if (person !== undefined && person !== "someone" && person !== seat) people[seat] = person;
    }
  }
  return Object.keys(people).length > 0 ? people : undefined;
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
