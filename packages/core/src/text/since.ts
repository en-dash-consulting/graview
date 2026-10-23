import type { Primitive } from "../graph/primitives.js";
import type { Operation } from "../ops/types.js";
import { diffSplice } from "./diff.js";
import { applySplice, transform, type TextSplice } from "./splice.js";

/*
 * A TEXT FIELD AS SOMEBODY LAST READ IT (Roadmap f-collab-text, phase 2).
 *
 * A keystroke, or a whole value written over a field typed together, was
 * made against the text at the revision its sender last read. Every change
 * to the field since is a splice in the log; turned back, newest first, they
 * give the text as it was then, and the change made against it is carried
 * over each of them in turn (`transform`, TP1 — the log orders them, so
 * there is one sequence). A field written whole since, a record added or
 * taken out, or a revision behind the log's horizon has no such text here,
 * and the answer is none.
 */

/** The text at a revision, and the splices the log took on the field since, oldest first. */
export interface TextThen {
  readonly then: string;
  readonly since: readonly TextSplice[];
}

/** Whether a primitive changes one field of one record otherwise than by a splice: written whole, or its record made or taken out. */
export function writesWhole(primitive: Primitive, node: string, field: string): boolean {
  switch (primitive.op) {
    case "patch-node":
      return primitive.id === node && Object.prototype.hasOwnProperty.call(primitive.after, field);
    case "add-node":
    case "remove-node":
      return primitive.node.id === node;
    default:
      return false;
  }
}

/** The splices on one field among these primitives, in order. */
export const splicesOn = (primitives: readonly Primitive[], node: string, field: string): TextSplice[] =>
  primitives.flatMap((one) => (one.op === "splice-text" && one.id === node && one.field === field ? [one] : []));

/**
 * One field's text at revision `rev`, read back from its text now
 * (`current`) over the log's ops after it; none when it cannot be: the
 * field does not hold text, was written whole since, or `rev` is behind
 * what the log holds.
 */
export function textAt(ops: readonly Operation[], horizon: number, node: string, field: string, rev: number, current: unknown): TextThen | undefined {
  if (typeof current !== "string" || rev < horizon - 1) return undefined;
  const since: TextSplice[] = [];
  for (const op of ops) {
    if (op.seq <= rev) continue;
    for (const primitive of op.primitives) {
      if (writesWhole(primitive, node, field)) return undefined;
      if (primitive.op === "splice-text" && primitive.id === node && primitive.field === field) since.push(primitive);
    }
  }
  let then = current;
  try {
    for (let at = since.length - 1; at >= 0; at--) {
      const one = since[at]!;
      then = applySplice(then, { at: one.at, removed: one.inserted, inserted: one.removed });
    }
  } catch {
    return undefined;
  }
  return { then, since };
}

/** A splice made against an older text, carried over each splice taken since, in order: as it applies to the text now. */
export function carried(splice: TextSplice, since: readonly TextSplice[]): TextSplice {
  let now = splice;
  for (const over of since) now = transform(over, now)[1];
  return { at: now.at, removed: now.removed, inserted: now.inserted };
}

/**
 * A WHOLE VALUE WRITTEN OVER TEXT TYPED TOGETHER, AS A SPLICE: against the
 * text its writer read (`then`, a three-way merge — what they changed is
 * carried over what others typed since), or with none, against the text now
 * (the differing range is theirs). None when it changes nothing.
 */
export function wholeAsSplice(current: string, wanted: string, then?: TextThen): TextSplice | undefined {
  const splice = then ? carried(diffSplice(then.then, wanted), then.since) : diffSplice(current, wanted);
  return splice.removed === "" && splice.inserted === "" ? undefined : splice;
}
