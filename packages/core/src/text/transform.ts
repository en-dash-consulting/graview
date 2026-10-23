import { diffSplice } from "./diff.js";
import { applySplice, type TextSplice } from "./splice.js";

/*
 * THE TRANSFORM (Roadmap f-collab-text): a splice carried over another made
 * against the same text, and a run of them made one. Apart from `./splice.ts`,
 * which every page folds a splice with, so a page that never types carries
 * none of it: `@graview/core/typing` exports it, and the store's typing,
 * a server and an editor load it from there.
 */

/** Where a splice's removed text ends, in the text it was made against. */
const end = (splice: TextSplice) => splice.at + splice.removed.length;

/** A splice that says only what changes: what its removed and inserted text share at either end left alone. */
function trimmed(splice: TextSplice): TextSplice {
  const said = diffSplice(splice.removed, splice.inserted);
  return { ...said, at: splice.at + said.at };
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

