/**
 * `@graview/core/typing` — TEXT TYPED TOGETHER, MERGED (Roadmap
 * f-collab-text, phase 2).
 *
 * Loaded, every store reads a keystroke (`type-text`) against the text at
 * the revision its sender read and carries it over the splices taken since;
 * writes a whole value over a field typed together as the one splice that
 * makes the change — three ways, against the text at the revision
 * `ApplyOptions.base` names, so an agent's rewrite merges with somebody
 * typing; and carries an undo of one person's typing over everybody else's,
 * so a later keystroke on the field no longer stands in its way. Apart from
 * `@graview/core` so a page that only opens an app carries none of it: a
 * host that serves seats loads it (`@graview/ship`'s server entry does), and
 * a face loads it once a field typed together is focused.
 */
import type { Primitive } from "./graph/primitives.js";
import { inverseOf } from "./ops/inverse.js";
import type { FieldRevision } from "./ops/revisions.js";
import { typeTextMutation, typeTextVia } from "./mutations/type-text.js";
import type { Operation } from "./ops/types.js";
import { collaborativeFieldOf } from "./schema/collaborative.js";
import { carried, splicesOn, textAt, wholeAsSplice, writesWhole } from "./text/since.js";
import { TYPING, type TypingStore } from "./text/typing-hook.js";

/**
 * A WHOLE VALUE WRITTEN OVER TEXT TYPED TOGETHER IS A SPLICE: a patch an
 * act, an edit, an agent or an import writes to such a field, where the
 * record holds text, is rewritten into the one splice that makes the change
 * — against the text the caller read at the revision `base` names for it,
 * else against the text now. A field that holds no text yet, or is cleared,
 * is written whole, as before. Read in order, so a record the same op made
 * or a field it already changed is read as it will be.
 */
function asSplices(store: TypingStore, primitives: readonly Primitive[], base?: readonly FieldRevision[]): Primitive[] {
  if (!primitives.some((one) => one.op === "patch-node")) return [...primitives];
  const made = new Set<string>();
  const touched = new Set<string>();
  const out: Primitive[] = [];
  for (const primitive of primitives) {
    if (primitive.op === "add-node") made.add(primitive.node.id);
    if (primitive.op !== "patch-node" || made.has(primitive.id)) {
      if (primitive.op === "splice-text") touched.add(`${primitive.id}\u0000${primitive.field}`);
      out.push(primitive);
      continue;
    }
    const record = store.graph.getNode(primitive.id) as ({ kind: string } & Record<string, unknown>) | undefined;
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const splices: Primitive[] = [];
    for (const [field, value] of Object.entries(primitive.after)) {
      const current = record?.[field];
      const at = `${primitive.id}\u0000${field}`;
      if (typeof value === "string" && typeof current === "string" && current !== "" && !touched.has(at) && collaborativeFieldOf(store.schema, record?.kind, field)) {
        const claimed = base?.find((entry) => entry.node === primitive.id && entry.field === field);
        const splice = wholeAsSplice(current, value, claimed ? textAt(store.log.all(), store.log.horizon, primitive.id, field, claimed.rev, current) : undefined);
        if (splice) {
          splices.push({ op: "splice-text", id: primitive.id, field, ...splice });
          touched.add(at);
          continue;
        }
        // Merged, it changes nothing: written as the caller wrote it, a patch of what the field already holds.
      }
      before[field] = primitive.before[field];
      after[field] = value;
      touched.add(at);
    }
    if (Object.keys(after).length > 0) out.push(splices.length > 0 ? { op: "patch-node", id: primitive.id, before, after } : primitive);
    out.push(...splices);
  }
  return out;
}

/**
 * WHAT EACH OP OF AN UNDO PUTS BACK, newest first, as the store appends
 * them: its inverse, with each splice in it carried over every splice of
 * the same field that came after it — the rest of its own op, the log
 * since, and what the undo has put back already. So an undo of one
 * person's typing takes back only their words: text somebody else typed
 * since stays where it went, and text of theirs somebody else already
 * deleted shrinks out of what is taken back.
 */
function undone(log: readonly Operation[], ops: readonly Operation[]): { readonly op: Operation; readonly primitives: readonly Primitive[] }[] {
  const putBack: Primitive[] = [];
  return [...ops]
    .sort((a, b) => b.seq - a.seq)
    .map((op) => {
      const inverse = inverseOf(op);
      if (!inverse.some((one) => one.op === "splice-text")) {
        putBack.push(...inverse);
        return { op, primitives: inverse };
      }
      const later = log.filter((one) => one.seq > op.seq).flatMap((one) => one.primitives);
      const count = op.primitives.length;
      const out: Primitive[] = [];
      inverse.forEach((one, at) => {
        if (one.op !== "splice-text") return void out.push(one);
        const splice = carried(one, splicesOn([...op.primitives.slice(count - at), ...later, ...putBack, ...out], one.id, one.field));
        if (splice.removed !== "" || splice.inserted !== "") out.push({ op: "splice-text", id: one.id, field: one.field, ...splice });
      });
      putBack.push(...out);
      return { op, primitives: out };
    });
}

/**
 * TYPING ON TEXT ONLY TYPED, SINCE, STANDS IN NOBODY'S WAY: a later op that
 * only splices, into fields the undone ops wrote no other way than by
 * splicing, read the record for its text, and the undo carries its inverse
 * over that typing. Text written whole since — or the record taken out —
 * still blocks an undo of typing into it, whatever that op read.
 */
function aside(targets: readonly Primitive[], later: Operation): true | readonly string[] {
  const wholes = (node: string, field: string) => targets.some((one) => writesWhole(one, node, field));
  if (later.primitives.length > 0 && later.primitives.every((one) => one.op === "splice-text" && !wholes(one.id, one.field))) return true;
  return targets.flatMap((one) => (one.op === "splice-text" && later.primitives.some((other) => writesWhole(other, one.id, one.field)) ? [one.id] : []));
}

TYPING.typeText = typeTextMutation;
TYPING.via = typeTextVia as never;
TYPING.collaborative = collaborativeFieldOf;
TYPING.asSplices = asSplices;
TYPING.undone = undone;
TYPING.aside = aside;
