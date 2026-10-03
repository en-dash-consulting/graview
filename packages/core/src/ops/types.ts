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
  /**
   * The author's own name, for a reader who has no record or seat to look
   * it up in — another person in a hosted app, an agent from a chat. Said
   * before any id is (FR-17).
   */
  readonly name?: string;
  /**
   * WHO THIS IS FOR. An agent acting for a person records both — "Claude,
   * for Nick" — and is bounded by that person's roles as well as its own
   * (FR-06).
   */
  readonly onBehalfOf?: Author;
}

/**
 * THE CHANNEL an op came through: `web` (a person at the interface),
 * `mcp:<client>` (an agent's tool call), `view:<name>` (a view acting for
 * its viewer), `api`, `cli`. A fact in the log, beside who and for whom.
 */
export type Via = "web" | "api" | "cli" | `mcp:${string}` | `view:${string}` | (string & {});

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
  /**
   * Human-readable statement of what was meant, not what changed: the act's
   * own `describe()` sentence ("Add “Book the van”"), or "Undo: …".
   */
  readonly intent: string;
  /**
   * What the whole gesture was for, when its caller said ("Plan the move"),
   * on every op of the batch. Beside `intent`, never instead of it (FR-18):
   * an op keeps its own sentence, so a blocked undo, the record's history
   * and an audit still say what each op did, and the batch reads as what
   * was meant. Absent when no intent was given, and the batch reads as its
   * ops, as it always did.
   */
  readonly batchIntent?: string;
  readonly mutation: MutationCall | null;
  readonly primitives: readonly Primitive[];
  readonly inverse: readonly Primitive[];
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  readonly at: string;
  /** Set when this op exists to undo another one. */
  readonly undoes?: string;
  /** What the change came through, when the caller said (FR-06). */
  readonly via?: Via;
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
