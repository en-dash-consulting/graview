import type { GraphSnapshot } from "../graph/types.js";
import type { Epoch } from "../ops/log.js";
import type { Operation } from "../ops/types.js";

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
  appendOps?(scope: Scope, ops: readonly Operation[]): Promise<void>;
  /**
   * Optional: the epochs the log folds from (FR-27), kept beside it. An
   * adapter without them reopens a store with none recorded, and ship has
   * it adopt what it holds as its first epoch on each open.
   */
  loadEpochs?(scope: Scope): Promise<Epoch[]>;
  saveEpochs?(scope: Scope, epochs: readonly Epoch[]): Promise<void>;
}
