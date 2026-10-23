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
/** The text with the splice made; throws when the text does not hold `removed` at `at`. */
export function applySplice(text: string, splice: TextSplice): string {
  if (!Number.isInteger(splice.at) || splice.at < 0 || splice.at > text.length || text.slice(splice.at, end(splice)) !== splice.removed) {
    throw new RangeError(`The text does not hold ${JSON.stringify(splice.removed)} at ${splice.at}.`);
  }
  return text.slice(0, splice.at) + splice.inserted + text.slice(end(splice));
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
