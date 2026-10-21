import { invert, normalize, type Primitive } from "../graph/primitives.js";
import type { Operation } from "./types.js";

/**
 * WHAT PUTS AN OP BACK, DERIVED (op format 2).
 *
 * Every primitive's inverse is another primitive, so an op's inverse is its
 * primitives turned round, newest first — nothing it needs is missing from
 * them. Format 1 wrote it down beside them anyway, which put every value an
 * op wrote in the log twice more: a 19 KB image set in a field was a 95 KB
 * op. Format 2 writes no inverse, and everything that puts an op back —
 * undo, a rebase's rollback, playback, verifying a fold — reads it here.
 *
 * An op read from format 1 whose stored inverse is not its primitives' own
 * (a host could once hand `append` one) keeps it, and that is what is put
 * back, so a format-1 log means on this build what it meant on the last.
 */
const DERIVED = new WeakMap<object, readonly Primitive[]>();

/** The primitives that put these back, newest first. */
export function inverted(primitives: readonly Primitive[]): Primitive[] {
  return [...primitives].reverse().map(normalize).map(invert);
}

/** What puts this op back: its own stored inverse when it kept one (format 1), else its primitives inverted, worked out once per op. */
export function inverseOf(op: Pick<Operation, "primitives" | "inverse">): readonly Primitive[] {
  if (op.inverse) return op.inverse;
  let derived = DERIVED.get(op);
  if (!derived) DERIVED.set(op, (derived = inverted(op.primitives)));
  return derived;
}

/** Whether two lists of primitives say the same thing, as they would be written. */
function same(a: readonly Primitive[], b: readonly Primitive[]): boolean {
  if (a.length !== b.length) return false;
  for (let at = 0; at < a.length; at++) if (a[at] !== b[at] && JSON.stringify(a[at]) !== JSON.stringify(b[at])) return false;
  return true;
}

/**
 * THE OP AS FORMAT 2 KEEPS IT: an inverse that is its primitives' own is
 * dropped, and one that is not is kept. The format-1 → 2 step of
 * `upgradeOp`, and what a store does to every op it is handed — a log it
 * opens on, ops it receives — so its log is format 2 whatever wrote it.
 */
export function bareOp(op: Operation): Operation {
  if (op.inverse === undefined) return op;
  if (!same(op.inverse, inverted(op.primitives))) return op;
  const { inverse: _dropped, ...bare } = op;
  return bare;
}

/**
 * THE OP AS FORMAT 1 SAID IT: its inverse written out beside its
 * primitives. For a reader that predates format 2 — a client on the live
 * wire that did not say it reads it, a host rolling a store back to a
 * build before 0.1.43 — and never kept by this build.
 */
export function withInverse(op: Operation): Operation & { readonly inverse: readonly Primitive[] } {
  return { ...op, inverse: inverseOf(op) };
}
