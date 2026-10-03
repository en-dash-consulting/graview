import { Graph } from "../graph/graph.js";
import type { GraphSnapshot } from "../graph/types.js";
import type { AnySchema, NodeOfSchema } from "../schema/schema.js";
import type { Batch, Operation } from "./types.js";

/**
 * A POINT THE LOG CAN BE FOLDED FROM (FR-27): the graph as it stood, and
 * the seq of the first op that folds onto it.
 *
 * A log that spans a declaration change cannot be folded from empty under
 * the new declaration, because the ops before the change wrote the old
 * shape. So each declaration version begins an epoch: ship records one when
 * a migration runs, with the migrated graph as its base, and one for the
 * seed a store first opened on, which was never an operation. Verifying
 * folds from the last epoch, and undo does not reach back across an epoch
 * that changed the declaration.
 */
export interface Epoch {
  /** The seq of the first op folded onto `base`; every op before it is history behind the base. */
  readonly seq: number;
  /** The graph at that point. */
  readonly base: GraphSnapshot;
  /** The declaration version the epoch begins, when one is known. */
  readonly version?: number;
  /**
   * What changed to begin it, in a sentence ("migration 1→2: size words
   * become bed counts"). Present when the declaration changed; undo does
   * not cross an epoch that has one. A seed, or a store from before epochs
   * adopting what it holds, begins an epoch without one.
   */
  readonly change?: string;
  /** When it began. */
  readonly at?: string;
  /**
   * THE UNDO HORIZON (FR-23): this epoch is a checkpoint, and the ops
   * before its seq were archived. A log restored with it begins at its seq,
   * a normal open loads it and the ops after it and nothing older, and undo
   * does not reach behind it. Absent on every other epoch.
   */
  readonly horizon?: true;
}

/**
 * WHAT A COMPACTION MOVED OUT OF THE LOG (FR-23): the ops before the
 * horizon, and the epochs before it, oldest first. An adapter keeps them
 * where a normal open does not load them (`loadArchive`), and a full export
 * puts them back in front of the tail.
 */
export interface LogArchive {
  readonly ops: readonly Operation[];
  readonly epochs: readonly Epoch[];
}

const beginsPastZero = (op: Operation): string =>
  `Op "${op.id}" has seq ${op.seq}, so the log begins at seq ${op.seq}: a log that begins past 0 begins at its undo horizon, and none was given (a checkpoint epoch, or { horizon })`;

/**
 * The append-only log. Nothing here mutates or removes an entry: an undo is
 * a new op carrying the inverse, so history is never destroyed and the log
 * doubles as an audit trail of what an agent did on your behalf.
 *
 * A LOG BEGINS AT ITS HORIZON (FR-23). Its seqs are contiguous from there:
 * from 0 for a whole log, from the checkpoint's seq for one compacted
 * behind an undo horizon, whose older ops an adapter archived.
 */
export class OperationLog {
  private ops: Operation[] = [];
  private marks: Epoch[] = [];
  private start = 0;

  /**
   * The seq the next op takes, which is how long the log is counting what
   * a compaction archived (FR-23). The log holds `length - horizon` ops.
   */
  get length(): number {
    return this.start + this.ops.length;
  }

  /**
   * THE SEQ THE LOG BEGINS AT (FR-23): 0 for a whole log, the checkpoint's
   * seq for one compacted behind an undo horizon. The ops before it are
   * archived, not here.
   */
  get horizon(): number {
    return this.start;
  }

  /** The ops this log holds, oldest first: from its horizon on. */
  all(): readonly Operation[] {
    return this.ops;
  }

  /** The ops from `seq` on; from the horizon when `seq` is behind it. */
  opsFrom(seq: number): readonly Operation[] {
    return this.ops.slice(Math.max(0, seq - this.start));
  }

  append(op: Operation): void {
    if (op.seq !== this.length) {
      throw new Error(this.length === 0 && op.seq > 0 ? beginsPastZero(op) : `Op "${op.id}" has seq ${op.seq} but the log is ${this.length} long`);
    }
    this.ops.push(op);
  }

  /**
   * Restores a log and its epochs from storage, checking the sequence is
   * intact. A COMPACTED LOG (FR-23) begins at its horizon: the seq of the
   * checkpoint among `epochs` (the last one marked `horizon`), or
   * `options.horizon` for a log handed over without its base, as a client
   * hydrating on a snapshot is. Its first op must carry that seq, and no
   * epoch may be older than it. Without either, a log begins at 0.
   */
  static from(ops: readonly Operation[], epochs: readonly Epoch[] = [], options: { readonly horizon?: number } = {}): OperationLog {
    const log = new OperationLog();
    const checkpoint = [...epochs].reverse().find((epoch) => epoch.horizon);
    const horizon = options.horizon ?? checkpoint?.seq ?? 0;
    if (!Number.isInteger(horizon) || horizon < 0) throw new Error(`A log cannot begin at seq ${horizon}`);
    if (checkpoint && options.horizon !== undefined && checkpoint.seq !== options.horizon) {
      throw new Error(`A log said to begin at seq ${options.horizon} has its checkpoint at seq ${checkpoint.seq}`);
    }
    const first = ops[0];
    if (first && horizon > 0 && first.seq !== horizon) {
      throw new Error(`A log compacted at seq ${horizon} begins with op "${first.id}" at seq ${first.seq}`);
    }
    log.start = horizon;
    for (const op of ops) log.append(op);
    for (const epoch of epochs) log.markEpoch(epoch);
    return log;
  }

  /**
   * TAKES ANOTHER LOG WHOLESALE (FR-53): its ops, its epochs and its
   * horizon, checked exactly as `from` checks them, in place of what this
   * log held. For a client that resynced and takes the server's history as
   * the server has it (`Store.adopt`); like `truncate`, it is not for
   * history another store has seen. All or nothing: a log that is not
   * intact is refused and this one is as it was.
   */
  replace(ops: readonly Operation[], epochs: readonly Epoch[] = [], options: { readonly horizon?: number } = {}): void {
    const next = OperationLog.from(ops, epochs, options);
    this.ops = next.ops;
    this.marks = next.marks;
    this.start = next.start;
  }

  /** The epochs this log can be folded from, oldest first. */
  epochs(): readonly Epoch[] {
    return this.marks;
  }

  /** The epoch the current graph folds from, if any was marked. */
  lastEpoch(): Epoch | undefined {
    return this.marks.at(-1);
  }

  /**
   * Begins an epoch at `epoch.seq`, usually the log's current length: the
   * next op folds onto `epoch.base`. Epochs are in order and none starts
   * past the end of the log.
   */
  markEpoch(epoch: Epoch): void {
    if (!Number.isInteger(epoch.seq) || epoch.seq < 0 || epoch.seq > this.length) {
      throw new Error(`An epoch at seq ${epoch.seq} starts past the end of a log ${this.length} long`);
    }
    if (epoch.seq < this.start) {
      throw new Error(`An epoch at seq ${epoch.seq} is behind the horizon at seq ${this.start}: it went to the archive with the ops before it`);
    }
    const last = this.lastEpoch();
    if (last && epoch.seq < last.seq) {
      throw new Error(`An epoch at seq ${epoch.seq} comes before the last one, at seq ${last.seq}`);
    }
    this.marks.push(epoch);
  }

  /**
   * ROLLS THE LOG BACK TO `length`, for ops that were only ever
   * provisional: an optimistic client's pending tail, cut back before the
   * server's ops land under it (`Store.rebase`). This is the one way an
   * entry leaves the log, and it is not for history: ops another store has
   * seen are undone by appending, never cut. Refuses to cut behind an epoch.
   * Returns what was cut, oldest first.
   */
  truncate(length: number): Operation[] {
    if (!Number.isInteger(length) || length < this.start || length > this.length) {
      throw new Error(`Cannot cut a log ${this.length} long back to ${length}`);
    }
    const last = this.lastEpoch();
    if (last && last.seq > length) {
      throw new Error(`Cannot cut the log back to ${length}: an epoch begins at seq ${last.seq}`);
    }
    return this.ops.splice(length - this.start);
  }

  /**
   * THE GRAPH AS IT STOOD AT `seq`, AS AN EPOCH TO FOLD FROM (FR-23): the
   * base of the last epoch at or before it, with the ops up to it folded
   * on. An epoch already at `seq` is that graph and is kept as it is,
   * declaration change and all. Marked `horizon`, so `compact` can make it
   * the undo horizon. `at` is when the last op before it was made.
   */
  checkpointAt<S extends AnySchema>(schema: S, seq: number, options: { validate?: boolean } = {}): Epoch {
    if (!Number.isInteger(seq) || seq < this.start || seq > this.length) {
      throw new Error(`No checkpoint at seq ${seq}: this log holds seqs ${this.start} to ${this.length}`);
    }
    const from = [...this.marks].reverse().find((epoch) => epoch.seq <= seq);
    if (from?.seq === seq) return { ...from, horizon: true };
    const base = this.fold(schema, { ...options, ...(from ? { from } : {}), to: seq }).snapshot();
    const at = this.ops[seq - 1 - this.start]?.at ?? from?.at;
    return {
      seq,
      base,
      ...(from?.version !== undefined ? { version: from.version } : {}),
      ...(at !== undefined ? { at } : {}),
      horizon: true,
    };
  }

  /**
   * MOVES THE UNDO HORIZON TO `checkpoint` (FR-23). The ops before its seq
   * leave the log, with the epochs before it; the checkpoint becomes the
   * first epoch, and the log begins at its seq. What left is returned,
   * oldest first, for an adapter to archive: nothing here forgets history,
   * it only stops carrying it. The graph is untouched, and still folds
   * from the checkpoint with the ops after it.
   */
  compact(checkpoint: Epoch): LogArchive {
    if (!Number.isInteger(checkpoint.seq) || checkpoint.seq < this.start || checkpoint.seq > this.length) {
      throw new Error(`Cannot compact at seq ${checkpoint.seq}: this log holds seqs ${this.start} to ${this.length}`);
    }
    const ops = this.ops.slice(0, checkpoint.seq - this.start);
    const epochs = this.marks.filter((epoch) => epoch.seq < checkpoint.seq);
    this.ops = this.ops.slice(checkpoint.seq - this.start);
    this.marks = [{ ...checkpoint, horizon: true }, ...this.marks.filter((epoch) => epoch.seq > checkpoint.seq)];
    this.start = checkpoint.seq;
    return { ops, epochs };
  }

  get(id: string): Operation | undefined {
    return this.ops.find((op) => op.id === id);
  }

  /** Ops that have not been inverted by a later op. */
  live(): Operation[] {
    const undone = this.undoneIds();
    return this.ops.filter((op) => !undone.has(op.id));
  }

  /**
   * An op stands unless a LIVE op undoes it. That one sentence is the whole
   * redo mechanism: undoing an undo makes the undo itself not live, which
   * revives its target. Undoers always follow their target, so resolving
   * from the end of the log backwards terminates in one pass.
   */
  undoneIds(): Set<string> {
    return undoneIn(this.ops);
  }

  opsInBatch(batchId: string): Operation[] {
    return this.ops.filter((op) => op.batch === batchId);
  }

  batches(): Batch[] {
    return batchesOf(this.ops, this.undoneIds());
  }

  /**
   * Rebuilds the graph by folding every op forward: from empty, or, given
   * `from`, from that epoch's base with the ops from its seq on (FR-27),
   * up to the op before seq `to` when that is given. A compacted log folds
   * only from its checkpoint or an epoch after it (FR-23).
   *
   * Each op lands as it landed when it was made: a write is judged as a
   * write (a default filled in on the way in is filled in again), an undo
   * puts back what was there. An op an older declaration accepted and this
   * one does not is HELD AS WRITTEN rather than refusing the whole history
   * (FR-28) — `validateGraph` says what no longer fits. Only an op that
   * cannot apply at all (a patch to a record that is not there) fails.
   */
  fold<S extends AnySchema>(schema: S, options: { validate?: boolean; from?: Epoch; to?: number } = {}): Graph<S> {
    const from = options.from?.seq ?? 0;
    if (from < this.start) {
      throw new Error(
        options.from
          ? `An epoch at seq ${from} is behind the horizon at seq ${this.start}: fold from the checkpoint`
          : `A log compacted at seq ${this.start} does not fold from empty: fold from its checkpoint`,
      );
    }
    const base = (options.from?.base ?? { nodes: [], edges: [] }) as GraphSnapshot<NodeOfSchema<S>>;
    const graph = Graph.from(schema, base, options.validate !== undefined ? { validate: options.validate } : {});
    const to = options.to ?? this.length;
    for (const op of this.ops.slice(from - this.start, Math.max(0, to - this.start))) {
      if (op.undoes !== undefined) {
        graph.applyPrimitives(op.primitives, { restoring: true });
        continue;
      }
      try {
        graph.applyPrimitives(op.primitives);
      } catch {
        graph.applyPrimitives(op.primitives, { restoring: true });
      }
    }
    return graph;
  }

  /** Serializable form for a persistence adapter. */
  toJSON(): Operation[] {
    return [...this.ops];
  }
}


/**
 * What `checkUndo` reads of a log: its ops, which of them are undone, and
 * its epochs. An `OperationLog` is one; so is a log as one seat may see it.
 */
export interface LogReading {
  /** The ops it holds: from the undo horizon on, when the log was compacted (FR-23). */
  all(): readonly Operation[];
  undoneIds(): Set<string>;
  epochs(): readonly Epoch[];
}

/** The ops of a list that a live op undoes (`OperationLog.undoneIds`). */
export function undoneIn(ops: readonly Operation[]): Set<string> {
  const undoers = new Map<string, string[]>();
  for (const op of ops) {
    if (!op.undoes) continue;
    const list = undoers.get(op.undoes);
    if (list) list.push(op.id);
    else undoers.set(op.undoes, [op.id]);
  }

  const live = new Map<string, boolean>();
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i]!;
    const mine = undoers.get(op.id) ?? [];
    live.set(op.id, !mine.some((id) => live.get(id) === true));
  }

  return new Set(ops.filter((op) => live.get(op.id) === false).map((op) => op.id));
}

/** Ops grouped into the gestures they were made in, in the order each began. */
export function batchesOf(ops: readonly Operation[], undone: ReadonlySet<string>): Batch[] {
  const order: string[] = [];
  const grouped = new Map<string, Operation[]>();
  for (const op of ops) {
    const list = grouped.get(op.batch);
    if (list) list.push(op);
    else {
      grouped.set(op.batch, [op]);
      order.push(op.batch);
    }
  }
  return order.map((id) => {
    const ops = grouped.get(id) ?? [];
    const first = ops[0]!;
    return {
      id,
      author: first.author,
      // What the gesture was for, when its caller said; else its first op's own sentence.
      intent: first.batchIntent ?? first.intent,
      at: first.at,
      ops,
      undone: ops.every((op) => undone.has(op.id)),
    };
  });
}
