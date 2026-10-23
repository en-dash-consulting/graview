import { TYPE_TEXT, type AnySchema, type Batch, type Operation, type PresenceCaret, type Principal, type Store, type TextSplice } from "@graview/core";

/*
 * THE LIVE EDITOR'S ARITHMETIC (Roadmap f-collab-text, phase 4), apart from
 * its drawing so each rule can be held by a test: what a keystroke was, where
 * a caret goes when somebody else's text lands, where another person's caret
 * stands in this page's text, and which run of typing is this person's to
 * take back. Fetched with the live editor, never in a first load.
 */

/*
 * Read here, not from `@graview/core`: whatever a chunk fetched later takes
 * from the main entry, the first load carries.
 */

/** Where a caret goes over a splice (`transformCaret`'s rule): before it stays, past it moves, on it keeps the side `before` says. */
function caretOver(caret: number, splice: TextSplice, before = false): number {
  if (caret < splice.at || (caret === splice.at && before)) return caret;
  const end = splice.at + splice.removed.length;
  if (caret >= end) return caret + splice.inserted.length - splice.removed.length;
  return before ? splice.at : splice.at + splice.inserted.length;
}

const high = (code: number) => code >= 0xd800 && code <= 0xdbff;
const low = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * THE KEYSTROKE AN INPUT MADE: `before` turned into `after`, the caret left
 * at `caret` in `after`. What the two share at either end is left alone, as
 * `diffSplice` does, but the end kept is never left of the caret — so a
 * letter typed into a run of the same letter ("aa" → "aaa") is put where
 * the caret says it was typed, not at the end of the run, and lands where
 * the person typed it among what others type.
 */
export function inputSplice(before: string, after: string, caret: number): TextSplice {
  const most = Math.min(before.length, after.length);
  let tail = 0;
  const tailMost = Math.max(0, Math.min(most, after.length - caret));
  while (tail < tailMost && before.charCodeAt(before.length - 1 - tail) === after.charCodeAt(after.length - 1 - tail)) tail++;
  let head = 0;
  while (head < most - tail && before.charCodeAt(head) === after.charCodeAt(head)) head++;
  // Never half of a pair: an emoji is typed or taken out whole.
  if (head > 0 && high(before.charCodeAt(head - 1))) head--;
  if (tail > 0 && low(before.charCodeAt(before.length - tail))) tail--;
  return { at: head, removed: before.slice(head, before.length - tail), inserted: after.slice(head, after.length - tail) };
}

/** The one splice that turns `before` into `after`: `diffSplice`'s answer, the shared start kept first, never half of a pair. */
export function diffText(before: string, after: string): TextSplice {
  const most = Math.min(before.length, after.length);
  let head = 0;
  while (head < most && before.charCodeAt(head) === after.charCodeAt(head)) head++;
  if (head > 0 && high(before.charCodeAt(head - 1))) head--;
  let tail = 0;
  while (tail < most - head && before.charCodeAt(before.length - 1 - tail) === after.charCodeAt(after.length - 1 - tail)) tail++;
  if (tail > 0 && low(before.charCodeAt(before.length - tail))) tail--;
  return { at: head, removed: before.slice(head, before.length - tail), inserted: after.slice(head, after.length - tail) };
}

/**
 * THE PERSON'S KEYSTROKE, CARRIED OVER SOMEBODY ELSE'S TEXT that landed
 * while it was typed (`transformSplices`' rule, theirs the earlier): apart,
 * it moves by what theirs changed; touching, it takes out what both took
 * out and puts in both, theirs first where they meet.
 */
export function carriedOver(mine: TextSplice, theirs: TextSplice): TextSplice {
  const end = (one: TextSplice) => one.at + one.removed.length;
  if (end(mine) < theirs.at) return mine;
  if (mine.at > end(theirs)) return { ...mine, at: mine.at + theirs.inserted.length - theirs.removed.length };
  const from = Math.min(mine.at, theirs.at);
  const past = end(mine) - end(theirs);
  const removed = mine.removed.slice(0, theirs.at - from) + theirs.inserted + (past > 0 ? mine.removed.slice(mine.removed.length - past) : "");
  const inserted = theirs.at <= mine.at ? theirs.inserted + mine.inserted : mine.inserted + theirs.inserted;
  const said = diffText(removed, inserted);
  return { ...said, at: from + said.at };
}

/** A selection in a text, as a text area holds it. */
export interface Selection {
  readonly start: number;
  readonly end: number;
}

/**
 * WHERE A PERSON'S OWN SELECTION GOES WHEN SOMEBODY ELSE'S TEXT LANDS: each
 * end carried over the splice, and a caret that text was inserted at stays
 * before it — the person keeps typing where they were, and the other's
 * words appear after their caret, not under it.
 */
export function carrySelection(selection: Selection, splice: TextSplice): Selection {
  const start = caretOver(selection.start, splice, true);
  const end = selection.end === selection.start ? start : caretOver(selection.end, splice);
  return { start, end: Math.max(start, end) };
}

/** Whether an op was made by the participant a presence names (`kind:id:session`): their kind and id, and their tab when the op says one. */
function madeBy(op: Operation, participant: string): boolean {
  const { kind, id, session } = op.author;
  const own = `${kind}:${id ?? ""}:`;
  return participant.startsWith(own) && (!session || participant.slice(own.length) === session);
}

/**
 * WHERE ANOTHER PERSON'S CARET STANDS IN THIS PAGE'S TEXT: said against
 * their log at `rev`, carried over every splice into the field this page's
 * log took since that they did not make (what they made, their caret had
 * already moved with), and kept inside the text.
 */
export function caretHere(caret: PresenceCaret, participant: string, log: readonly Operation[], length: number): Selection {
  let anchor = caret.anchor;
  let head = caret.head;
  for (const op of log) {
    if (op.seq < caret.rev || madeBy(op, participant)) continue;
    for (const one of op.primitives) {
      if (one.op !== "splice-text" || one.id !== caret.node || one.field !== caret.field) continue;
      anchor = caretOver(anchor, one);
      head = caretOver(head, one);
    }
  }
  const kept = (at: number) => Math.max(0, Math.min(length, at));
  return { start: kept(anchor), end: kept(head) };
}

/** Whether a batch is a run of typing into this one field. */
const typedInto = (batch: Batch, node: string, field: string): boolean =>
  batch.ops.length > 0 &&
  batch.ops.every((op) => {
    const args = op.mutation?.args as { node?: unknown; field?: unknown } | undefined;
    return op.mutation?.name === TYPE_TEXT && args?.node === node && args.field === field;
  });

/** Whether a batch takes back runs of typing into this one field. */
const takesTypingBack = (store: Store<AnySchema>, batch: Batch, node: string, field: string): boolean =>
  batch.ops.length > 0 &&
  batch.ops.every((op) => op.undoes !== undefined) &&
  store.batches().some((one) => batch.ops.some((op) => op.undoes === one.id || op.undoes === one.ops[0]?.id) && typedInto(one, node, field));

/** A batch this person made: a human author who is this principal (the rule the way back and Activity use for "you"). */
const isMine = (batch: Batch, principal: Principal | undefined): boolean =>
  batch.author.kind === "human" && (principal?.id === undefined || batch.author.id === undefined || batch.author.id === principal.id);

/**
 * THE RUN OF TYPING ⌘Z TAKES BACK: this person's latest run into this field
 * that is not taken back already and that the log lets go of on its own —
 * never somebody else's, though they typed after it. Ctrl or ⌘ Z again
 * takes the one before it.
 */
export function runToTakeBack(store: Store<AnySchema>, principal: Principal | undefined, node: string, field: string): string | undefined {
  const batches = store.batches();
  for (let at = batches.length - 1; at >= 0; at--) {
    const batch = batches[at]!;
    if (!isMine(batch, principal) || batch.undone || !typedInto(batch, node, field)) continue;
    if (store.canUndo(batch.id).ok) return batch.id;
  }
  return undefined;
}

/** The take-back ⌘⇧Z puts back: this person's latest change to this field, when it was taking a run back. */
export function runToPutBack(store: Store<AnySchema>, principal: Principal | undefined, node: string, field: string): string | undefined {
  const batches = store.batches();
  for (let at = batches.length - 1; at >= 0; at--) {
    const batch = batches[at]!;
    if (!isMine(batch, principal)) continue;
    if (typedInto(batch, node, field)) return undefined;
    if (takesTypingBack(store, batch, node, field)) return batch.undone ? undefined : batch.id;
  }
  return undefined;
}
