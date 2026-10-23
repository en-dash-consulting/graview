import type { Primitive } from "../graph/primitives.js";
import type { MutationCall } from "../mutations/types.js";
import type { Lineage } from "./lineage.js";

/**
 * WHO CAN AUTHOR AN OP, AS THIS BUILD KNOWS THEM. The set is open: a kind
 * may be added within a major, and a reader that meets one it does not know
 * reads it as `system` for display and policy (`authorKindOf`) — never
 * refuses the op, which is history and folds the same whoever wrote it.
 */
export const AUTHOR_KINDS = ["human", "visitor", "agent", "rule", "system"] as const;
export type AuthorKind = (typeof AUTHOR_KINDS)[number];
const KNOWN_AUTHOR_KINDS: ReadonlySet<unknown> = new Set(AUTHOR_KINDS);

/**
 * An author's kind as this build reads it: its own when this build knows it,
 * `system` when a newer build wrote one this build does not — the app
 * itself, the least a reader can grant or name it.
 */
export function authorKindOf(author: { readonly kind: string } | undefined): AuthorKind {
  return KNOWN_AUTHOR_KINDS.has(author?.kind) ? (author!.kind as AuthorKind) : "system";
}

export interface Author {
  /**
   * Who moved: a person, a visitor answering a form, an agent acting on
   * their behalf, a rule repairing something, or an external system of
   * record whose change arrived here.
   *
   * `system` earns its place for the same reason the others do: an inbound
   * calendar change is an ordinary op, appears in the activity list beside a
   * person's edits, and is undone like anything else. A sync layer that wrote
   * the graph outside the log would be the one kind of change nobody could
   * see or take back.
   *
   * `visitor` is a person who never joined the app — one answer to a form
   * a host opened (`formVisitor`), under the id the host minted for it. Held
   * to the form's role as a person is to theirs.
   *
   * Read through `authorKindOf`: a kind this build does not know reads as
   * `system` (`AUTHOR_KINDS`). The app's own actor is a `system` or `agent`
   * author with `automated: true`, not a kind of its own.
   */
  readonly kind: AuthorKind;
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
  /**
   * THE APP'S OWN ACTOR (`@graview/core/tidying`): set by a `system` or
   * `agent` author that changes the graph on its own — "Graview, tidying".
   * It is held to what a person said to leave alone and to the
   * declaration's `tidying`, refused what was declined, and its consecutive
   * batches fold into one row of Activity. Ignored on a human author.
   */
  readonly automated?: true;
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
   *
   * DISPLAY ONLY. Nothing in the framework matches on its words — what an
   * op did is its `mutation`, its primitives, its `batch` and its `undoes` —
   * so an act's sentence may be reworded, translated or withheld from a
   * seat without changing what any program decides.
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
  /**
   * WHAT PUTS IT BACK, ONLY WHEN ITS PRIMITIVES DO NOT SAY IT (op format 2).
   * An op's inverse is its primitives inverted, newest first, and is read
   * with `inverseOf(op)`, never from here: this build writes no inverse.
   * Present only on an op read from format 1 whose stored inverse was not
   * its primitives' own; format 1 wrote one on every op, and an op that
   * still carries its own (a format-1 log not yet opened by a store) reads
   * the same.
   */
  readonly inverse?: readonly Primitive[];
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  readonly at: string;
  /** Set when this op exists to undo another one. */
  readonly undoes?: string;
  /** What the change came through, when the caller said (FR-06). */
  readonly via?: Via;
  /**
   * SOMETHING YOU CANNOT SEE HAPPENED HERE (FR-16). Set on an op a store
   * served to a seat that may not see what it touched: it keeps its id,
   * seq, batch and time, so the log has no hole, and nothing else of its
   * own — its author, intent and call are withheld, and its
   * primitives, reads and writes keep only what the seat may see. Absent
   * on every op a store makes; an op without it reads as before.
   */
  readonly withheld?: true;
  /**
   * THE RECORDS ITS SENTENCE READ (FR-55): the ids the act's `describe`
   * looked up to word `intent` ("in favor of Freya Davies"). A sentence
   * names records by their labels, which no id check catches, so a seat
   * that may not see one of these is served the op withheld. Absent on an
   * act without `describe`, and on ops made before it was kept.
   */
  readonly described?: readonly string[];
  /**
   * THE MODULES THIS OP LEAVES ON (FR-12). Set only on an op authored
   * `system · modules`, which turns modules off or on and touches no
   * record: the store's enabled set is the one the last such op says. An
   * op without it reads as before, and folds the same.
   */
  readonly enabledModules?: readonly string[];
  /**
   * THE RECORD THIS ONE WAS MERGED INTO (FR-173). Set on the op of a merge:
   * the duplicate is archived, its links moved to the kept record named
   * here, and both histories stay in the log. Undone as one, like any op.
   */
  readonly mergedInto?: string;
  /**
   * WHAT IT WAS BASED ON, AND HOW SURE ITS MAKER WAS (FR-172), when the
   * caller said (`ApplyOptions.lineage`). On the op rather than its author:
   * an author is the same for every change a seat makes, and a basis is
   * this change's own. A confidence below 1 makes what it links
   * provisional until a person touches it (`linkProvenance`).
   * Withheld with the rest of an op a seat may not see.
   */
  readonly lineage?: Lineage;
  /**
   * THE LINEAGE OF WHAT AN UNDO TOOK BACK (FR-172): set on an undo whose
   * target carried one, so a host reading the log can tell that a
   * suggestion was declined — "do not make this again" — without the
   * target, which a compacted log may no longer hold.
   */
  readonly undoneLineage?: Lineage;
  /**
   * A SUGGESTION THAT WAITS (`suggest`, `@graview/core/tidying`): the calls it proposes, which
   * it does not apply. The op has no primitives and changes nothing; its
   * `lineage` says why and how sure. Accepting it applies the calls as the
   * person, their lineage naming it (`lineage.suggestion`); declining it is
   * an undo of it, which carries its lineage as `undoneLineage`. Withheld
   * whole from a seat that may not see a record it names.
   */
  readonly suggests?: readonly MutationCall[];
  /**
   * WHEN A SUGGESTION STOPS WAITING (an ISO time), when its maker said: on
   * a suggestion's op only. From then on it leaves the Suggested tray and
   * cannot be accepted or declined; nothing is undone, since it changed
   * nothing. An actor that still thinks so judges it again and suggests it
   * anew. Absent, it waits until a person answers it.
   */
  readonly expiresAt?: string;
  /**
   * HOW FAR READERS ARE SERVED, set by a publish (Roadmap
   * f-publishing-lifecycle): in an `on-publish` app, the seats not
   * `working` are served the ops before this seq and none after. Set only
   * on the op of the built-in `publish` act, which touches no record; the
   * last such op that stands says it (`Store.publishedSeq`), so an undo
   * of a publish takes readers back to the one before. An op without it
   * reads as before, and folds the same.
   */
  readonly publishedThrough?: number;
}

export interface Batch {
  readonly id: string;
  readonly author: Author;
  readonly intent: string;
  readonly at: string;
  readonly ops: readonly Operation[];
  /** What the gesture was based on, when its first op said (FR-172). */
  readonly lineage?: Lineage;
  /** True when every op in the batch has been inverted by a later op. */
  readonly undone: boolean;
}
