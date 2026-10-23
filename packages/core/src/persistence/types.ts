import type { GraphSnapshot } from "../graph/types.js";
import type { Epoch, LogArchive } from "../ops/log.js";
import type { Operation } from "../ops/types.js";

/** How an append is checked: see `PersistenceAdapter.appendOps`. */
export interface AppendOptions {
  /** The seq the first op appended takes, as the writer last knew the log: the compare in compare-and-set. */
  readonly head?: number;
}

/**
 * ANOTHER WRITER GOT THERE FIRST. The log of `scope` is at `found` — the
 * seq its next op would take — not at `expected`, the head the writer last
 * knew: something else appended since. Nothing was appended. A store
 * hearing this is no longer the scope's one writer; reopen it to go on
 * from what is stored.
 */
export class LogHeadMovedError extends Error {
  constructor(
    readonly scope: string,
    readonly expected: number,
    readonly found: number,
  ) {
    super(
      `The log of "${scope}" is at seq ${found}, not ${expected} as this writer last knew it: another writer appended to it, and nothing was appended. ` +
        "One writer per scope; reopen the store to go on from what is stored.",
    );
    this.name = "LogHeadMovedError";
  }
}

/**
 * The seq the next op of a log takes: one past its newest op, or — a log
 * that holds none — its checkpoint's seq once compacted (FR-23), else 0.
 */
export function headOf(ops: readonly Pick<Operation, "seq">[], horizon = 0): number {
  return ops.reduce((most, op) => Math.max(most, op.seq + 1), horizon);
}

/** Throws `LogHeadMovedError` when an append that names its head finds the log elsewhere. */
export function assertHead(scope: unknown, ops: readonly unknown[], options: AppendOptions | undefined, found: () => number): void {
  if (options?.head === undefined || ops.length === 0) return;
  const at = found();
  if (at !== options.head) throw new LogHeadMovedError(String(scope), options.head, at);
}

/**
 * The framework owns the reactive graph, invariants, diff and undo;
 * persistence is pluggable underneath. One interface, so a memory adapter
 * in a test and a SQLite adapter in production are interchangeable.
 */
export interface PersistenceAdapter<Scope = string> {
  readonly name: string;
  /**
   * Returns null when nothing has been stored for this scope. Note that a
   * store of an EMPTY graph is indistinguishable from no store at all in a
   * row-backed adapter — treat "null" as "no nodes", not as "never saved".
   */
  load(scope: Scope): Promise<GraphSnapshot | null>;
  save(scope: Scope, snapshot: GraphSnapshot): Promise<void>;
  delete(scope: Scope): Promise<void>;
  /** Optional: adapters that keep history append the log too. */
  loadLog?(scope: Scope): Promise<Operation[]>;
  /**
   * Appends `ops` to the scope's log. ONE WRITER, ENFORCED: given
   * `options.head` — the seq the first of them takes, as the writer last
   * knew the log — an adapter compares it with the head it holds (`headOf`)
   * and, when they differ, throws `LogHeadMovedError` and appends nothing,
   * so two writers on one scope fail loudly rather than interleave. Without
   * it the ops are appended as before. `openStore` always passes it.
   */
  appendOps?(scope: Scope, ops: readonly Operation[], options?: AppendOptions): Promise<void>;
  /**
   * Optional: the epochs the log folds from (FR-27), kept beside it. An
   * adapter without them reopens a store with none recorded, and ship has
   * it adopt what it holds as its first epoch on each open.
   */
  loadEpochs?(scope: Scope): Promise<Epoch[]>;
  saveEpochs?(scope: Scope, epochs: readonly Epoch[]): Promise<void>;
  /**
   * Optional (FR-23): compaction behind an undo horizon. Moves the ops
   * before `checkpoint.seq`, and the epochs before it, into the archive,
   * and makes `checkpoint` the first epoch. From then on `loadLog` returns
   * the ops from its seq on and `loadEpochs` the checkpoint and what came
   * after it, so a normal open loads nothing older; `loadArchive` returns
   * what was moved, oldest first, for a full export. Nothing is deleted.
   * An adapter that keeps no epochs keeps no checkpoint, and has neither.
   */
  compact?(scope: Scope, checkpoint: Epoch): Promise<void>;
  loadArchive?(scope: Scope): Promise<LogArchive>;
}
