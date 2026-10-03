import { GraphError } from "../graph/graph.js";
import type { OperationLog } from "./log.js";
import type { Operation } from "./types.js";

export interface UndoBlock {
  /** The op that read something the undo target wrote. */
  readonly op: Operation;
  /** The node ids it read that the target wrote. */
  readonly overlap: readonly string[];
}

export type UndoCheck =
  | { readonly ok: true; readonly ops: readonly Operation[] }
  | {
      readonly ok: false;
      readonly ops: readonly Operation[];
      readonly blockedBy: readonly UndoBlock[];
      /** Batches that would have to come along for the undo to be legal. */
      readonly includeBatches: readonly string[];
      readonly message: string;
    };

/** An undo check that said no. */
export type UndoRefused = Extract<UndoCheck, { readonly ok: false }>;

/**
 * AN UNDO THAT CANNOT RUN, AND WHY (FR-18): a later op read what it wrote
 * (`blockedBy` names each, with what it read), it would reach back across a
 * declaration change, or there was nothing live to undo. `check` is the
 * `canUndo` answer it was refused on, so a host can offer to bring the
 * blocking batches along (`check.includeBatches`) without asking again.
 *
 * Still a `GraphError`: a caller that caught those before catches this.
 */
export class UndoBlockedError extends GraphError {
  constructor(readonly check: UndoRefused) {
    super(check.message);
    this.name = "UndoBlockedError";
  }

  /** The ops in the way, with what each read that the undo would take back. */
  get blockedBy(): readonly UndoBlock[] {
    return this.check.blockedBy;
  }
}

/**
 * Undoing an op out of order is legal exactly when no later live op read
 * something it wrote. That is a checkable condition rather than a policy —
 * so when it fails the framework can name the blocking op and offer to bring
 * it along, instead of refusing or corrupting state.
 */
export function checkUndo(
  log: OperationLog,
  batchIds: readonly string[],
): UndoCheck {
  const targets = new Set(batchIds);
  const undone = log.undoneIds();
  const ops = log
    .all()
    .filter((op) => targets.has(op.batch) && !undone.has(op.id));

  if (ops.length === 0) {
    return {
      ok: false,
      ops,
      blockedBy: [],
      includeBatches: [],
      message:
        batchIds.length === 0
          ? "No batch given to undo"
          : `Nothing live to undo in ${batchIds.join(", ")} — already undone, or never applied`,
    };
  }

  const writes = new Set<string>();
  for (const op of ops) for (const id of op.writes) writes.add(id);
  const earliest = Math.min(...ops.map((op) => op.seq));

  /*
   * NOT ACROSS A DECLARATION CHANGE (FR-27). An op from before the change
   * carries an inverse written in the old declaration's words: putting it
   * back would write the old shape into the new graph. The change is named,
   * since it is what stands in the way, not anything a person did since.
   */
  const crossed = log.epochs().find((epoch) => epoch.change !== undefined && epoch.seq > earliest);
  if (crossed) {
    const before = ops.find((op) => op.seq < crossed.seq)!;
    return {
      ok: false,
      ops,
      blockedBy: [],
      includeBatches: [],
      message: `Cannot undo "${before.intent}": it was done before the declaration changed (${crossed.change}), and undo does not reach back across that change.`,
    };
  }

  const blockedBy: UndoBlock[] = [];
  for (const op of log.all()) {
    if (op.seq <= earliest) continue;
    if (targets.has(op.batch)) continue;
    if (undone.has(op.id)) continue;
    const overlap = op.reads.filter((id) => writes.has(id));
    if (overlap.length > 0) blockedBy.push({ op, overlap });
  }

  if (blockedBy.length === 0) return { ok: true, ops };

  const includeBatches = [...new Set(blockedBy.map((b) => b.op.batch))];
  const named = blockedBy
    .map((b) => `"${b.op.intent}" (op ${b.op.id}, read ${b.overlap.join(", ")})`)
    .join("; ");
  return {
    ok: false,
    ops,
    blockedBy,
    includeBatches,
    message: `Cannot undo on its own — a later operation depends on it: ${named}. Include ${includeBatches
      .map((id) => `batch ${id}`)
      .join(", ")} to undo them together.`,
  };
}

/**
 * The primitives an undo would apply: each op's stored inverse, newest first,
 * so dependent writes come apart in the order they went together. (An op's
 * `inverse` is already reversed internally when the op is recorded.)
 */
export function undoPrimitives(ops: readonly Operation[]) {
  return [...ops].sort((a, b) => b.seq - a.seq).flatMap((op) => op.inverse);
}
