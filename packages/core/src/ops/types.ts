import type { Primitive } from "../graph/primitives.js";
import type { MutationCall } from "../mutations/types.js";

export interface Author {
  /**
   * Who moved: a person, an agent acting on their behalf, a rule repairing
   * something, or an external system of record whose change arrived here.
   *
   * `system` earns its place for the same reason the others do: an inbound
   * calendar change is an ordinary op, appears in the activity list beside a
   * person's edits, and is undone like anything else. A sync layer that wrote
   * the graph outside the log would be the one kind of change nobody could
   * see or take back.
   */
  readonly kind: "human" | "agent" | "rule" | "system";
  readonly id?: string;
  readonly session?: string;
}

/**
 * One entry in the append-only log. The graph is a fold over these.
 *
 * `reads` is what turns undo from a stack into a dependency graph, and it
 * has to be captured when the op runs — historical reads are not
 * recoverable, so this field can never be backfilled.
 */
export interface Operation {
  readonly id: string;
  /** Monotonic position in the log. */
  readonly seq: number;
  /** One user gesture, or one agent turn. */
  readonly batch: string;
  readonly author: Author;
  /** Human-readable statement of what was meant, not what changed. */
  readonly intent: string;
  readonly mutation: MutationCall | null;
  readonly primitives: readonly Primitive[];
  readonly inverse: readonly Primitive[];
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  readonly at: string;
  /** Set when this op exists to undo another one. */
  readonly undoes?: string;
}

export interface Batch {
  readonly id: string;
  readonly author: Author;
  readonly intent: string;
  readonly at: string;
  readonly ops: readonly Operation[];
  /** True when every op in the batch has been inverted by a later op. */
  readonly undone: boolean;
}
