import type { Primitive } from "../graph/primitives.js";
import type { FieldRevision } from "../ops/revisions.js";
import type { Operation } from "../ops/types.js";
import type { AnyMutationDefinition, MutationCall } from "../mutations/types.js";

/*
 * WHAT TYPING TOGETHER NEEDS THAT A PAGE OPENING AN APP DOES NOT (Roadmap
 * f-collab-text). An app opens far more often than somebody types into a
 * long field, so the store carries only these hooks; `@graview/core/typing`
 * fills them — a keystroke carried over the log since its revision, a whole
 * write merged as a splice, an undo carried over others' typing — and a
 * host that serves seats loads it (`@graview/ship`'s server entry does), as
 * a face does once a field typed together is focused. Unloaded, a store
 * answers to no `type-text`, writes a whole value as a patch, and lets a
 * later keystroke on a field block an undo of typing in it, as any later
 * write does.
 */

/** The name of the act that types into a text field typed together. */
export const TYPE_TEXT = "type-text";

/** What a store hands the hooks: its declaration, graph and log. */
export interface TypingStore {
  readonly schema: { tryDefinition(kind: string): unknown };
  readonly graph: { getNode(id: string): unknown };
  readonly log: { all(): readonly Operation[]; readonly horizon: number };
}

export const TYPING: {
  /** "Type text", for one store: a keystroke carried over the log since the revision it was made at. */
  typeText?: (store: TypingStore) => AnyMutationDefinition<never>;
  /** Who may type into a field of a record of a kind: the acts any one of which permits it. */
  via?: (schema: TypingStore["schema"], mutations: readonly AnyMutationDefinition<never>[], kind: string | undefined, field: unknown) => readonly string[];
  /** Whether one field of a kind is typed together, by the declaration. */
  collaborative?: (schema: TypingStore["schema"], kind: string | undefined, field: string) => boolean;
  /** These primitives with each whole write over text typed together written as a splice. */
  asSplices?: (store: TypingStore, primitives: readonly Primitive[], base?: readonly FieldRevision[]) => Primitive[];
  /** What each op of an undo puts back, newest first, its splices carried over the typing since. */
  undone?: (log: readonly Operation[], ops: readonly Operation[]) => { readonly op: Operation; readonly primitives: readonly Primitive[] }[];
  /** Of a later op, against what an undo takes back: true when it only typed on text the undo only typed, else the records whose typed text it wrote whole. */
  aside?: (targets: readonly Primitive[], later: Operation) => true | readonly string[];
  /**
   * A client's own typing, still pending, carried over what the server
   * says (`Store.rebase`): each pending batch that only types, as the calls
   * that make its keystrokes on the text the landed ops leave.
   */
  carried?: (rolledBack: readonly Operation[], landed: readonly Operation[], pending: readonly string[]) => ReadonlyMap<string, readonly MutationCall[]>;
} = {};
