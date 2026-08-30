import { Graph } from "../graph/graph.js";
import type { AnySchema } from "../schema/schema.js";
import type { Batch, Operation } from "./types.js";

/**
 * The append-only log. Nothing here mutates or removes an entry: an undo is
 * a new op carrying the inverse, so history is never destroyed and the log
 * doubles as an audit trail of what an agent did on your behalf.
 */
export class OperationLog {
  private readonly ops: Operation[] = [];

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

  /** Restores a log from storage, checking the sequence is intact. */
  static from(ops: readonly Operation[]): OperationLog {
    const log = new OperationLog();
    for (const op of ops) log.append(op);
    return log;
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
    const undoers = new Map<string, string[]>();
    for (const op of this.ops) {
      if (!op.undoes) continue;
      const list = undoers.get(op.undoes);
      if (list) list.push(op.id);
      else undoers.set(op.undoes, [op.id]);
    }

    const live = new Map<string, boolean>();
    for (let i = this.ops.length - 1; i >= 0; i--) {
      const op = this.ops[i]!;
      const mine = undoers.get(op.id) ?? [];
      live.set(op.id, !mine.some((id) => live.get(id) === true));
    }

    return new Set(
      this.ops.filter((op) => live.get(op.id) === false).map((op) => op.id),
    );
  }

  opsInBatch(batchId: string): Operation[] {
    return this.ops.filter((op) => op.batch === batchId);
  }

  batches(): Batch[] {
    const undone = this.undoneIds();
    const order: string[] = [];
    const grouped = new Map<string, Operation[]>();
    for (const op of this.ops) {
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
        intent: first.intent,
        at: first.at,
        ops,
        undone: ops.every((op) => undone.has(op.id)),
      };
    });
  }

  /** Rebuilds the graph from empty by folding every live op forward. */
  fold<S extends AnySchema>(schema: S, options?: { validate?: boolean }): Graph<S> {
    const graph = new Graph(schema, options);
    for (const op of this.ops) {
      graph.applyPrimitives(op.primitives);
    }
    return graph;
  }

  /** Serializable form for a persistence adapter. */
  toJSON(): Operation[] {
    return [...this.ops];
  }
}

