import type { AnySchema, Principal, Store } from "@graview/core";

/**
 * THE WAY BACK, ON EITHER FACE (FR-152, FR-153).
 *
 * After an act, a notice offers to take it back. On the Pages face it stood
 * at the foot of the picture for the rest of the session — it did not go,
 * and nothing on it closed it — so every page carried a stale offer; on the
 * scene there was no offer at all, and no ⌘Z. Both faces now say the same
 * thing the same way: the offer comes with the act, stands while the act can
 * still be taken back without thought (`WAY_BACK_MS`, longer while a pointer
 * or the keyboard is on it), goes with the next act or a move elsewhere, and
 * closes with its ×. ⌘Z or Ctrl+Z takes the last change back on both faces
 * whether the offer is standing or not, and the scene's Activity keeps
 * every turn.
 *
 * No JSX here: the routed face and the scene each draw it their own way.
 */

export interface LastChange {
  readonly batch: string;
  /** What it did, in the store's own words — the line the Activity rail shows. */
  readonly intent: string;
}

/** How long the offer stands after an act, in milliseconds. */
export const WAY_BACK_MS = 10_000;

/**
 * The change this person can take back: their own latest turn that is not
 * already taken back, is not itself a take-back, that the log lets go of on
 * its own, and that the policy lets them take back — undo is judged like a
 * change ("what you may undo is what you may have done"), so a turn the
 * store would refuse is never offered.
 *
 * "Their own" is the rule the Activity rail uses for "you": a human author
 * who is this principal, or either side has no id to tell them apart. On a
 * served store two seats share one log, and one person's corner should not
 * offer to take back another's work.
 */
export function lastChangeOf<S extends AnySchema>(store: Store<S>, principal?: Principal): LastChange | undefined {
  const batches = store.batches();
  for (let at = batches.length - 1; at >= 0; at--) {
    const batch = batches[at]!;
    if (batch.undone || batch.ops.length === 0) continue;
    if (batch.ops.every((op) => op.undoes !== undefined)) continue;
    const author = batch.author;
    const mine = author.kind === "human" && (principal?.id === undefined || author.id === undefined || author.id === principal.id);
    if (!mine) continue;
    const check = store.canUndo(batch.id);
    if (!check.ok) continue;
    const permitted = check.ops.every((op) => !op.mutation || store.permits(op.mutation, principal).ok);
    if (!permitted) continue;
    return { batch: batch.id, intent: batch.intent };
  }
  return undefined;
}

/**
 * The last change, when it is one made since `seen` batches were in the log:
 * an act just done, the only change an offer comes with. A take-back is no
 * act of this kind, so the change before it is never offered in its place.
 */
export function freshChangeOf<S extends AnySchema>(store: Store<S>, principal: Principal | undefined, seen: number): LastChange | undefined {
  const last = lastChangeOf(store, principal);
  return last && store.batches().slice(seen).some((batch) => batch.id === last.batch) ? last : undefined;
}

/** "Take back “Rename to …”" — the words on the control and in the announcement. */
export const takeBackWords = (change: LastChange) => `Take back “${change.intent}”`;

/** Takes the last change back as `principal`; what it took back, or nothing when there was none. A refusal throws. */
export function takeBackLast<S extends AnySchema>(store: Store<S>, principal?: Principal): LastChange | undefined {
  const last = lastChangeOf(store, principal);
  if (last) store.undo(last.batch, principal ? { author: principal } : {});
  return last;
}

/**
 * ⌘Z or Ctrl+Z, meaning "take the last change back" — not in a text field,
 * where they are the field's own undo and a person typing a name expects the
 * letters back.
 */
export function isTakeBackKey(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    !event.defaultPrevented &&
    !event.altKey &&
    !event.shiftKey &&
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "z" &&
    !(target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select")))
  );
}
