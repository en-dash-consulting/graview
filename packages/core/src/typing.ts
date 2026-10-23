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
import { collaborativeFieldOf } from "./schema/collaborative-of.js";
import type { MutationCall } from "./mutations/types.js";
import { carried, firstText, splicesOn, textAt, wholeAsSplice, writesWhole } from "./text/since.js";
import type { TextSplice } from "./text/splice.js";
import { transform } from "./text/transform.js";
import { TYPE_TEXT, TYPING, type TypingStore } from "./text/typing-hook.js";

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

/**
 * A CLIENT'S OWN TYPING, CARRIED OVER WHAT THE SERVER SAYS (Roadmap
 * f-collab-text, phase 3). A client keeps its keystrokes shown and pending
 * while the server is asked, and when the server's ops land under them
 * (`Store.rebase`) each keystroke is carried over every splice they took
 * on its field — the client's half of the transform, so it reaches the
 * text the server will (TP1). A keystroke is applied again where it now
 * stands, against the text then (no `rev`), as the calls of its batch:
 *
 * - a landed op of somebody else's: each splice in it carried over this
 *   client's keystrokes on the field in order, and they over it;
 * - the server's op for one of this client's batches (an echo): that
 *   batch's keystrokes are what it made, and the ones after it already
 *   stand on it;
 * - a batch of this client's taken back with no echo (refused): the
 *   keystrokes after it carried over its inverse, so they no longer stand
 *   on what it typed.
 *
 * A batch that does anything but splice, or one on a field written whole
 * meanwhile, is left to be applied again by its calls, as before.
 */
function carriedTyping(rolledBack: readonly Operation[], landed: readonly Operation[], pending: readonly string[]): ReadonlyMap<string, readonly MutationCall[]> {
  const out = new Map<string, readonly MutationCall[]>();
  type Typed = { readonly batch: string; readonly node: string; readonly field: string; splice: TextSplice };
  const typed: Typed[] = [];
  const untyped = new Set<string>();
  for (const op of rolledBack) {
    const only = op.primitives[0];
    const args = op.mutation?.args as { node?: string; field?: string } | undefined;
    // A keystroke is a splice, or — the first into an empty field — its text written whole, which is its insert at 0.
    const splice = op.mutation?.name !== TYPE_TEXT || op.primitives.length !== 1 || !only ? undefined : only.op === "splice-text" ? only : firstText(only, String(args?.node), String(args?.field));
    if (splice) typed.push({ batch: op.batch, node: String(args?.node), field: String(args?.field), splice });
    else untyped.add(op.batch);
  }
  if (typed.length === 0) return out;
  const key = (one: { node: string; field: string }) => `${one.node}\u0000${one.field}`;
  const whole = new Set<string>();
  const settled = new Set(rolledBack.map((op) => op.batch).filter((batch) => !pending.includes(batch)));
  let mine = typed;
  for (const op of landed) {
    if (settled.has(op.batch)) {
      // The server's own op for a batch of this client's: it is what that batch typed.
      mine = mine.filter((one) => one.batch !== op.batch);
      continue;
    }
    for (const primitive of op.primitives) {
      if (primitive.op === "add-edge" || primitive.op === "remove-edge") continue;
      const id = primitive.op === "add-node" || primitive.op === "remove-node" ? primitive.node.id : primitive.id;
      for (const field of new Set(mine.filter((one) => one.node === id).map((one) => one.field))) {
        // A splice of somebody else's — or their first text into a field empty here too — carried over this client's keystrokes on the field, and they over it.
        let over: TextSplice | undefined = primitive.op === "splice-text" ? (primitive.field === field ? primitive : undefined) : firstText(primitive, id, field);
        for (const one of mine) {
          if (one.node !== id || one.field !== field) continue;
          if (over) [over, one.splice] = transform(over, one.splice);
          else if (writesWhole(primitive, one.node, one.field)) whole.add(key(one));
        }
      }
    }
  }
  // Taken back with no echo: what came after it no longer stands on it.
  mine.forEach((one, at) => {
    if (!settled.has(one.batch)) return;
    let back: TextSplice = { at: one.splice.at, removed: one.splice.inserted, inserted: one.splice.removed };
    for (const later of mine.slice(at + 1)) if (key(later) === key(one)) [back, later.splice] = transform(back, later.splice);
  });
  for (const batch of pending) {
    const ones = mine.filter((one) => one.batch === batch);
    if (ones.length === 0 || untyped.has(batch) || ones.some((one) => whole.has(key(one)))) continue;
    out.set(
      batch,
      ones.map((one) => ({ name: TYPE_TEXT, args: { node: one.node, field: one.field, at: one.splice.at, remove: one.splice.removed.length, insert: one.splice.inserted } })),
    );
  }
  return out;
}

TYPING.typeText = typeTextMutation;
TYPING.via = typeTextVia as never;
TYPING.collaborative = collaborativeFieldOf;
TYPING.asSplices = asSplices;
TYPING.undone = undone;
TYPING.aside = aside;
TYPING.carried = carriedTyping;

/*
 * The transform and the reading of which fields are typed together, for a
 * server and an editor: here, not on `@graview/core`, so a page that never
 * types carries none of it.
 */
export { compose as composeSplices, transform as transformSplices } from "./text/transform.js";
export { diffSplice } from "./text/diff.js";
export { collaborativeFieldOf, isCollaborativeField } from "./schema/collaborative-of.js";
