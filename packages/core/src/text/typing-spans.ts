import type { Primitive } from "../graph/primitives.js";
import type { Operation } from "../ops/types.js";
import { firstText } from "./since.js";
import type { TextSplice } from "./splice.js";
import { compose } from "./transform.js";

/*
 * WHAT A RUN OF TYPING PUT IN AND TOOK OUT, span by span (Roadmap
 * f-collab-text, phase 5): what a diff in history and a notification say of
 * a field typed into, in place of its whole text before and after. Read by
 * `@graview/core/history` and `/subscriptions` only.
 */

/** The spans one primitive changed of one field: a splice, or a first text written whole as the insert it is. */
function spliceOf(primitive: Primitive, node: string, field: string): TextSplice | undefined {
  if (primitive.op === "splice-text") return primitive.id === node && primitive.field === field ? primitive : undefined;
  return firstText(primitive, node, field);
}

/** Spans one after another, keystrokes that touch made one. */
export function joinSpans(spans: readonly TextSplice[], more: readonly TextSplice[]): TextSplice[] {
  const out = [...spans];
  for (const splice of more) {
    const joined = out.length > 0 ? compose(out.at(-1)!, splice) : undefined;
    if (joined) out[out.length - 1] = joined;
    else out.push({ at: splice.at, removed: splice.removed, inserted: splice.inserted });
  }
  return out.filter((one) => one.removed !== "" || one.inserted !== "");
}

/**
 * WHAT THESE OPS TYPED INTO ONE FIELD, as spans: oldest first, each against
 * the text as the one before it left it, keystrokes that touch made one —
 * " white today" put in at 15, "Paint " taken out at 0 — never the text.
 */
export function typedSpans(ops: readonly Operation[], node: string, field: string): TextSplice[] {
  return joinSpans(
    [],
    ops.flatMap((op) => op.primitives.flatMap((primitive) => spliceOf(primitive, node, field) ?? [])),
  );
}
