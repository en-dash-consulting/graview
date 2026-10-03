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
}

/**
 * The append-only log. Nothing here mutates or removes an entry: an undo is
 * a new op carrying the inverse, so history is never destroyed and the log
 * doubles as an audit trail of what an agent did on your behalf.
 */
export class OperationLog {
  private readonly ops: Operation[] = [];
  private readonly marks: Epoch[] = [];

  get length(): number {
    return this.ops.length;
  }

  all(): readonly Operation[] {
    return this.ops;
  }

  append(op: Operation): void {
    if (op.seq !== this.ops.length) {
      throw new Error(
        `Op "${op.id}" has seq ${op.seq} but the log is ${this.ops.length} long`,
      );
    }
    this.ops.push(op);
  }

  /** Restores a log and its epochs from storage, checking the sequence is intact. */
  static from(ops: readonly Operation[], epochs: readonly Epoch[] = []): OperationLog {
    const log = new OperationLog();
    for (const op of ops) log.append(op);
    for (const epoch of epochs) log.markEpoch(epoch);
    return log;
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
    if (!Number.isInteger(epoch.seq) || epoch.seq < 0 || epoch.seq > this.ops.length) {
      throw new Error(`An epoch at seq ${epoch.seq} starts past the end of a log ${this.ops.length} long`);
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
    if (!Number.isInteger(length) || length < 0 || length > this.ops.length) {
      throw new Error(`Cannot cut a log ${this.ops.length} long back to ${length}`);
    }
    const last = this.lastEpoch();
    if (last && last.seq > length) {
      throw new Error(`Cannot cut the log back to ${length}: an epoch begins at seq ${last.seq}`);
    }
    return this.ops.splice(length);
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
   * `from`, from that epoch's base with the ops from its seq on (FR-27).
   *
   * Each op lands as it landed when it was made: a write is judged as a
   * write (a default filled in on the way in is filled in again), an undo
   * puts back what was there. An op an older declaration accepted and this
   * one does not is HELD AS WRITTEN rather than refusing the whole history
   * (FR-28) — `validateGraph` says what no longer fits. Only an op that
   * cannot apply at all (a patch to a record that is not there) fails.
   */
  fold<S extends AnySchema>(schema: S, options: { validate?: boolean; from?: Epoch } = {}): Graph<S> {
    const base = (options.from?.base ?? { nodes: [], edges: [] }) as GraphSnapshot<NodeOfSchema<S>>;
    const graph = Graph.from(schema, base, options.validate !== undefined ? { validate: options.validate } : {});
    for (const op of this.ops.slice(options.from?.seq ?? 0)) {
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
