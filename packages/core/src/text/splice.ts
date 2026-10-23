import { diffSplice } from "./diff.js";

/**
 * COLLABORATIVE TEXT, THE CORE (Roadmap f-collab-text, phase 1 of 6).
 *
 * Two people typing in one text field used to be two whole-value writes,
 * and the second refused as stale or written over the first. The decision:
 * operational transformation on the server, in-house, no CRDT, and the
 * field's value stays a plain string. A keystroke is a splice — at a UTF-16
 * offset, the text it removed, the text it inserted — and a splice made
 * against an older text is transformed over the ones the log took since.
 * Keeping `removed` (not only its length) makes a splice its own inverse
 * turned round, so undo and the fields an op writes stay mechanical, and
 * lets a fold refuse a splice whose text is not there.
 *
 * Phase 1 (this module): the `splice-text` primitive (op format 3) and the
 * transform. Then: 2, the `type-text` act, and a whole-value write over a
 * field that moved rewritten as a three-way splice; 3, op format 3 on the
 * wire and a client's in-flight buffer (`compose` over unsent keystrokes);
 * 4, the live editor (`transformCaret` keeps a caret where it was); 5, the
 * words a change is said in, and the harness; 6, hardening.
 *
 * Only TP1 is needed: the server orders every splice, so a client transforms
 * against one sequence and never two concurrent branches at once.
 */

/** One change to a string: at `at` (UTF-16 code units), `removed` taken out and `inserted` put in. */
export interface TextSplice {
  readonly at: number;
  readonly removed: string;
  readonly inserted: string;
}

/** Where a splice's removed text ends, in the text it was made against. */
const end = (splice: TextSplice) => splice.at + splice.removed.length;

/** A splice that says only what changes: what its removed and inserted text share at either end left alone. */
function trimmed(splice: TextSplice): TextSplice {
  const said = diffSplice(splice.removed, splice.inserted);
  return { ...said, at: splice.at + said.at };
}

/** The text with the splice made; throws when the text does not hold `removed` at `at`. */
export function applySplice(text: string, splice: TextSplice): string {
  if (!Number.isInteger(splice.at) || splice.at < 0 || splice.at > text.length || text.slice(splice.at, end(splice)) !== splice.removed) {
    throw new RangeError(`The text does not hold ${JSON.stringify(splice.removed)} at ${splice.at}.`);
  }
  return text.slice(0, splice.at) + splice.inserted + text.slice(end(splice));
}

/**
 * `splice` as it applies after `over`, both made against the same text.
 * Apart, it only moves by what `over` added. Touching or overlapping, the
 * two take out everything either removed and put in both insertions — the
 * one further left first, and at the same offset the one earlier in the
 * log (`overEarlier`) — so whichever lands first, the text comes out the same.
 */
function rebase(splice: TextSplice, over: TextSplice, overEarlier: boolean): TextSplice {
  if (end(splice) < over.at) return splice;
  if (splice.at > end(over)) return { ...splice, at: splice.at + over.inserted.length - over.removed.length };
  const from = Math.min(splice.at, over.at);
  const past = end(splice) - end(over);
  const removed = splice.removed.slice(0, over.at - from) + over.inserted + (past > 0 ? splice.removed.slice(splice.removed.length - past) : "");
  const overFirst = over.at < splice.at || (over.at === splice.at && overEarlier);
  return trimmed({ at: from, removed, inserted: overFirst ? over.inserted + splice.inserted : splice.inserted + over.inserted });
}

/**
 * Two splices made against the same text, `a` the earlier in the log:
 * `[a', b']`, `a'` to make after `b` and `b'` after `a`, so that both
 * orders give the same text (TP1). Where they touch, both insertions are
 * kept, left to right, `a`'s first at the same offset.
 */
export function transform(a: TextSplice, b: TextSplice): [TextSplice, TextSplice] {
  return [rebase(a, b, false), rebase(b, a, true)];
}

/**
 * `a` then `b` as one splice, when they touch (a run of keystrokes); none
 * when they do not, since what lies between them is in neither.
 */
export function compose(a: TextSplice, b: TextSplice): TextSplice | undefined {
  const made = a.at + a.inserted.length;
  if (end(b) < a.at || b.at > made) return undefined;
  const from = Math.min(a.at, b.at);
  const past = end(b) - made;
  const before = b.removed.slice(0, a.at - from);
  const after = past > 0 ? b.removed.slice(b.removed.length - past) : "";
  const inserted = applySplice(before + a.inserted + after, { ...b, at: b.at - from });
  return trimmed({ at: from, removed: before + a.removed + after, inserted });
}

/**
 * Where a caret in the text before `splice` is after it. Before the splice
 * it stays, past it it moves by what changed, and on it — text inserted
 * where it stands, or removed around it — `bias` says which side it keeps:
 * `"before"` for a caret of one's own that a remote insertion lands at.
 */
export function transformCaret(caret: number, splice: TextSplice, bias: "before" | "after" = "after"): number {
  if (caret < splice.at || (caret === splice.at && bias === "before")) return caret;
  if (caret >= end(splice)) return caret + splice.inserted.length - splice.removed.length;
  return bias === "before" ? splice.at : splice.at + splice.inserted.length;
}
